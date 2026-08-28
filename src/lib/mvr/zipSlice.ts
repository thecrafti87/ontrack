/**
 * Minimaler ZIP-Reader für den Browser: liest EINEN Eintrag aus einer (beliebig
 * großen) ZIP-Datei, ohne die gesamte Datei zu laden — per gezielten File.slice()-
 * Aufrufen. Wird für den MVR-Import genutzt: aus einer u. U. mehrere GB großen
 * .mvr-Datei wird ausschließlich "GeneralSceneDescription.xml" extrahiert.
 *
 * Unterstützt normale ZIPs und Zip64 (nötig sobald Datei > 4 GB oder
 * Central-Directory-Offset > 4 GB).
 */

const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
const EOCD64_SIGNATURE = 0x06064b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_ID = 0x0001;

export class MvrZipError extends Error {}

function safeNumber(big: bigint): number {
  if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MvrZipError("Die Datei ist für die Verarbeitung im Browser zu groß.");
  }
  return Number(big);
}

type CentralDirEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

/** Zip64-Erweiterungsfeld (Header-ID 0x0001) auswerten; ersetzt nur die als 0xFFFFFFFF markierten Felder. */
function resolveZip64Extra(
  extra: Uint8Array,
  orig: { uncompressedSize: number; compressedSize: number; localHeaderOffset: number }
): { uncompressedSize: number; compressedSize: number; localHeaderOffset: number } {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let pos = 0;
  while (pos + 4 <= extra.length) {
    const id = view.getUint16(pos, true);
    const size = view.getUint16(pos + 2, true);
    if (id === ZIP64_EXTRA_ID) {
      let sub = pos + 4;
      const subEnd = pos + 4 + size;
      let { uncompressedSize, compressedSize, localHeaderOffset } = orig;
      if (uncompressedSize === 0xffffffff && sub + 8 <= subEnd) {
        uncompressedSize = safeNumber(view.getBigUint64(sub, true));
        sub += 8;
      }
      if (compressedSize === 0xffffffff && sub + 8 <= subEnd) {
        compressedSize = safeNumber(view.getBigUint64(sub, true));
        sub += 8;
      }
      if (localHeaderOffset === 0xffffffff && sub + 8 <= subEnd) {
        localHeaderOffset = safeNumber(view.getBigUint64(sub, true));
        sub += 8;
      }
      return { uncompressedSize, compressedSize, localHeaderOffset };
    }
    pos += 4 + size;
  }
  throw new MvrZipError("Keine gültige MVR/ZIP-Datei (Zip64-Erweiterung fehlt).");
}

/** Findet die "End of Central Directory"-Signatur rückwärts im Datei-Ende. */
async function findEocd(file: Blob): Promise<{ eocdOffset: number; view: DataView; indexInTail: number }> {
  const fileSize = file.size;
  if (fileSize < 22) throw new MvrZipError("Keine gültige MVR/ZIP-Datei.");

  const tailSize = Math.min(66 * 1024, fileSize);
  const tailBuffer = await file.slice(fileSize - tailSize, fileSize).arrayBuffer();
  const tailBytes = new Uint8Array(tailBuffer);

  for (let i = tailBytes.length - 22; i >= 0; i--) {
    if (
      tailBytes[i] === 0x50 &&
      tailBytes[i + 1] === 0x4b &&
      tailBytes[i + 2] === 0x05 &&
      tailBytes[i + 3] === 0x06
    ) {
      return {
        eocdOffset: fileSize - tailSize + i,
        view: new DataView(tailBuffer),
        indexInTail: i,
      };
    }
  }
  throw new MvrZipError("Keine gültige MVR/ZIP-Datei.");
}

/** Central-Directory-Offset/-Größe ermitteln (inkl. Zip64-Fall über EOCD64-Locator). */
async function resolveCentralDirectory(
  file: Blob
): Promise<{ cdOffset: number; cdSize: number }> {
  const { eocdOffset, view, indexInTail } = await findEocd(file);

  let cdOffset = view.getUint32(indexInTail + 16, true);
  let cdSize = view.getUint32(indexInTail + 12, true);
  const totalEntries = view.getUint16(indexInTail + 10, true);

  const needsZip64 = cdOffset === 0xffffffff || cdSize === 0xffffffff || totalEntries === 0xffff;
  if (!needsZip64) return { cdOffset, cdSize };

  const locatorOffset = eocdOffset - 20;
  if (locatorOffset < 0) {
    throw new MvrZipError("Keine gültige MVR/ZIP-Datei (Zip64-Locator fehlt).");
  }
  const locatorBuf = await file.slice(locatorOffset, locatorOffset + 20).arrayBuffer();
  const locatorView = new DataView(locatorBuf);
  if (locatorView.getUint32(0, true) !== EOCD64_LOCATOR_SIGNATURE) {
    throw new MvrZipError("Keine gültige MVR/ZIP-Datei (Zip64-Locator ungültig).");
  }
  const eocd64Offset = safeNumber(locatorView.getBigUint64(8, true));

  const eocd64Buf = await file.slice(eocd64Offset, eocd64Offset + 56).arrayBuffer();
  const eocd64View = new DataView(eocd64Buf);
  if (eocd64View.getUint32(0, true) !== EOCD64_SIGNATURE) {
    throw new MvrZipError("Keine gültige MVR/ZIP-Datei (Zip64-Central-Directory ungültig).");
  }
  cdSize = safeNumber(eocd64View.getBigUint64(40, true));
  cdOffset = safeNumber(eocd64View.getBigUint64(48, true));

  return { cdOffset, cdSize };
}

/** Central Directory durchsuchen und den passenden Eintrag zurückgeben (case-insensitive, endsWith-tolerant). */
async function findEntry(file: Blob, entryName: string): Promise<CentralDirEntry> {
  const { cdOffset, cdSize } = await resolveCentralDirectory(file);
  const cdBuf = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cdView = new DataView(cdBuf);
  const cdBytes = new Uint8Array(cdBuf);
  const decoder = new TextDecoder("utf-8");
  const wantedLower = entryName.toLowerCase();

  let pos = 0;
  while (pos + 46 <= cdBytes.length) {
    const sig = cdView.getUint32(pos, true);
    if (sig !== CENTRAL_DIR_SIGNATURE) break;

    const compressionMethod = cdView.getUint16(pos + 10, true);
    let compressedSize = cdView.getUint32(pos + 20, true);
    let uncompressedSize = cdView.getUint32(pos + 24, true);
    const nameLen = cdView.getUint16(pos + 28, true);
    const extraLen = cdView.getUint16(pos + 30, true);
    const commentLen = cdView.getUint16(pos + 32, true);
    let localHeaderOffset = cdView.getUint32(pos + 42, true);

    const nameStart = pos + 46;
    const name = decoder.decode(cdBytes.slice(nameStart, nameStart + nameLen));

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      const extraStart = nameStart + nameLen;
      const extra = cdBytes.slice(extraStart, extraStart + extraLen);
      const resolved = resolveZip64Extra(extra, { uncompressedSize, compressedSize, localHeaderOffset });
      uncompressedSize = resolved.uncompressedSize;
      compressedSize = resolved.compressedSize;
      localHeaderOffset = resolved.localHeaderOffset;
    }

    const nameLower = name.toLowerCase();
    if (nameLower === wantedLower || nameLower.endsWith(wantedLower)) {
      return { name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset };
    }

    pos = nameStart + nameLen + extraLen + commentLen;
  }

  throw new MvrZipError(`${entryName} nicht gefunden.`);
}

/**
 * Extrahiert einen ZIP-Eintrag als Rohdaten, ohne die restliche Datei zu laden.
 * Funktioniert unabhängig von der Gesamtgröße der ZIP-Datei.
 *
 * Ein Blob statt eines ArrayBuffers, damit das Ergebnis selbst wieder als ZIP
 * gelesen werden kann — genau das braucht der GDTF-Anteil einer MVR, denn dort
 * liegt ein Archiv im Archiv.
 */
export async function extractZipEntryBlob(file: Blob, entryName: string): Promise<Blob> {
  const entry = await findEntry(file, entryName);

  const localHeaderBuf = await file
    .slice(entry.localHeaderOffset, entry.localHeaderOffset + 30)
    .arrayBuffer();
  const localView = new DataView(localHeaderBuf);
  if (localView.getUint32(0, true) !== LOCAL_FILE_SIGNATURE) {
    throw new MvrZipError("Keine gültige MVR/ZIP-Datei (Local-File-Header ungültig).");
  }
  const localNameLen = localView.getUint16(26, true);
  const localExtraLen = localView.getUint16(28, true);
  const dataStart = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;
  const dataEnd = dataStart + entry.compressedSize;

  const blob = file.slice(dataStart, dataEnd);

  if (entry.compressionMethod === 0) return blob;
  if (entry.compressionMethod === 8) {
    const stream = blob.stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).blob();
  }
  throw new MvrZipError("Nicht unterstützte Komprimierungsmethode in der MVR-Datei.");
}

/**
 * Extrahiert den Textinhalt eines ZIP-Eintrags, ohne die restliche Datei zu laden.
 */
export async function extractZipEntry(file: Blob, entryName: string): Promise<string> {
  const blob = await extractZipEntryBlob(file, entryName);
  return new TextDecoder("utf-8").decode(await blob.arrayBuffer());
}

/**
 * Alle Einträge auflisten.
 *
 * Wird gebraucht, weil der Dateiname der GDTF im MVR nicht immer wörtlich dem
 * `gdtfSpec`-Attribut der Szene entspricht — mal fehlt die Endung, mal weicht
 * die Groß-/Kleinschreibung ab.
 */
export async function listZipEntries(file: Blob): Promise<string[]> {
  const { cdOffset, cdSize } = await resolveCentralDirectory(file);
  const cdBuf = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cdView = new DataView(cdBuf);
  const cdBytes = new Uint8Array(cdBuf);
  const decoder = new TextDecoder("utf-8");
  const namen: string[] = [];

  let pos = 0;
  while (pos + 46 <= cdBytes.length) {
    if (cdView.getUint32(pos, true) !== CENTRAL_DIR_SIGNATURE) break;
    const nameLen = cdView.getUint16(pos + 28, true);
    const extraLen = cdView.getUint16(pos + 30, true);
    const commentLen = cdView.getUint16(pos + 32, true);
    const nameStart = pos + 46;
    namen.push(decoder.decode(cdBytes.slice(nameStart, nameStart + nameLen)));
    pos = nameStart + nameLen + extraLen + commentLen;
  }

  return namen;
}
