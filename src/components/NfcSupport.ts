// Web NFC (NDEFReader) — nur Chrome/Edge auf Android, über HTTPS oder localhost.
// Es gibt kein offizielles @types-Paket dafür, daher minimale eigene Deklarationen
// statt "any". Aufrufer MÜSSEN vorher isNfcSupported() prüfen — auf nicht
// unterstützten Geräten (u. a. iPhone) bleiben alle Funktionen unbenutzt/verborgen.

/** Ein einzelner NDEF-Datensatz, wie ihn Web NFC beim Lesen liefert. */
interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  message: NDEFMessage;
  serialNumber: string;
}

/** Datensatz-Vorgabe zum Schreiben (nur "url" wird hier genutzt). */
interface NDEFRecordInit {
  recordType: "url" | "text" | "mime" | "absolute-url" | "smart-poster" | "unknown" | "empty";
  data?: string | BufferSource;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: NDEFMessageInit | string, options?: { overwrite?: boolean; signal?: AbortSignal }): Promise<void>;
  addEventListener(
    type: "reading",
    listener: (this: NDEFReader, ev: NDEFReadingEvent) => void
  ): void;
  addEventListener(type: "readingerror", listener: (this: NDEFReader, ev: Event) => void): void;
  removeEventListener(
    type: "reading",
    listener: (this: NDEFReader, ev: NDEFReadingEvent) => void
  ): void;
  removeEventListener(type: "readingerror", listener: (this: NDEFReader, ev: Event) => void): void;
}

declare global {
  interface Window {
    NDEFReader?: { new (): NDEFReader };
  }
}

/** Web NFC nur auf unterstützten Geräten (Chrome/Edge Android, HTTPS/localhost) verfügbar. */
export function isNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

function decodeRecord(record: NDEFRecord): string | null {
  if (!record.data) return null;
  try {
    if (record.recordType === "url" || record.recordType === "absolute-url") {
      return new TextDecoder().decode(record.data);
    }
    if (record.recordType === "text") {
      return new TextDecoder(record.encoding || "utf-8").decode(record.data);
    }
    return null;
  } catch {
    return null;
  }
}

function nfcErrorMessage(err: unknown, context: "scan" | "write"): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") return "Berechtigung für NFC verweigert.";
    if (err.name === "NotSupportedError") {
      return context === "write"
        ? "Tag ist schreibgeschützt oder nicht kompatibel."
        : "NFC wird von diesem Gerät nicht unterstützt.";
    }
    if (err.name === "AbortError") {
      return context === "write" ? "Schreibvorgang abgebrochen." : "NFC-Scan abgebrochen.";
    }
    if (err.name === "NetworkError") return "Kein Tag erkannt — bitte erneut versuchen.";
  }
  return context === "write" ? "Tag konnte nicht beschrieben werden." : "NFC-Scan konnte nicht gestartet werden.";
}

export type NfcReadHandle = { stop: () => void };

const NFC_DEBOUNCE_MS = 3000;

/**
 * Startet einen fortlaufenden NFC-Scan (Web NFC). Gelesene Texte (URL- oder
 * Text-Records) gehen an onCode — entprellt: derselbe Text max. 1x pro 3s
 * (analog zum Kamera-Scanner). Rückgabe: stop() beendet den Scan (AbortController).
 */
export function readNfc(onCode: (text: string) => void, onError?: (message: string) => void): NfcReadHandle {
  if (!isNfcSupported()) {
    onError?.("NFC wird von diesem Gerät nicht unterstützt.");
    return { stop: () => {} };
  }

  const controller = new AbortController();
  let lastCode: { text: string; at: number } | null = null;

  function handleReading(ev: NDEFReadingEvent) {
    for (const record of ev.message.records) {
      const text = decodeRecord(record);
      if (!text) continue;
      const now = Date.now();
      if (lastCode && lastCode.text === text && now - lastCode.at < NFC_DEBOUNCE_MS) return;
      lastCode = { text, at: now };
      onCode(text);
      return;
    }
  }

  function handleReadingError() {
    onError?.("Tag konnte nicht gelesen werden — bitte erneut ans Gerät halten.");
  }

  // Sowohl das Anlegen des Readers als auch scan() selbst können SYNCHRON werfen
  // (z. B. Berechtigung sofort verweigert, oder — beim Testen mit einem
  // simulierten/unvollständigen NDEFReader-Shim — weil scan() gar keine
  // Funktion ist). Try/catch fängt das zusätzlich zum .catch() der Promise ab,
  // damit hier nie ein unbehandelter Fehler durchschlägt.
  try {
    const reader = new window.NDEFReader!();
    reader.addEventListener("reading", handleReading);
    reader.addEventListener("readingerror", handleReadingError);

    reader.scan({ signal: controller.signal }).catch((err: unknown) => {
      if (controller.signal.aborted) return; // gewollter Abbruch (Toggle aus / Unmount) — kein Fehler
      onError?.(nfcErrorMessage(err, "scan"));
    });

    return {
      stop: () => {
        controller.abort();
        reader.removeEventListener("reading", handleReading);
        reader.removeEventListener("readingerror", handleReadingError);
      },
    };
  } catch (err) {
    onError?.(nfcErrorMessage(err, "scan"));
    return { stop: () => {} };
  }
}

export type NfcWriteResult = { ok: true } | { ok: false; message: string };

/** Beschreibt einen NFC-Tag mit einer URL (NDEF "url"-Record). */
export async function writeNfc(url: string): Promise<NfcWriteResult> {
  if (!isNfcSupported()) {
    return { ok: false, message: "NFC wird von diesem Gerät nicht unterstützt." };
  }
  try {
    const writer = new window.NDEFReader!();
    await writer.write({ records: [{ recordType: "url", data: url }] });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: nfcErrorMessage(err, "write") };
  }
}
