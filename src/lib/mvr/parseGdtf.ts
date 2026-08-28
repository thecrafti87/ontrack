/**
 * Kanalzahl aus einer GDTF-Gerätedatei lesen.
 *
 * In einer MVR liegt neben der Szene für jeden Gerätetyp die zugehörige
 * GDTF-Datei — ein Archiv im Archiv, in dem eine `description.xml` steckt.
 * Darin steht je Modus, welche Kanäle das Gerät belegt. Genau die Angabe, die
 * sich aus dem Modusnamen sonst nur raten lässt.
 *
 * Der Fußabdruck eines Modus ist der **höchste Offset** über alle Kanäle, nicht
 * deren Anzahl: Ein 16-Bit-Kanal belegt zwei Bytes (`Offset="1,2"`), und
 * virtuelle Kanäle (`Offset="None"`) belegen gar keins. Wer die Elemente zählt,
 * bekommt zu wenig heraus und meldet dann Überlappungen zu spät.
 */

export class GdtfError extends Error {}

function directChildren(el: Element, tag: string): Element[] {
  const treffer: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const kind = el.children[i]!;
    if (kind.tagName === tag) treffer.push(kind);
  }
  return treffer;
}

function firstChild(el: Element, tag: string): Element | null {
  return directChildren(el, tag)[0] ?? null;
}

/** Offsets eines Kanals: "1,2" → [1,2]; "None", "" oder fehlend → []. */
function offsets(kanal: Element): number[] {
  const roh = kanal.getAttribute("Offset");
  if (!roh || roh.trim().toLowerCase() === "none") return [];
  return roh
    .split(",")
    .map((teil) => Number.parseInt(teil.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Der Break, zu dem ein Kanal gehört. Fehlt die Angabe, ist es Break 1;
 * "Overwrite" gehört zum Break des übergeordneten Geräts und zählt hier nicht.
 */
function breakVon(kanal: Element): number | null {
  const roh = (kanal.getAttribute("DMXBreak") ?? "1").trim();
  if (roh.toLowerCase() === "overwrite") return null;
  const zahl = Number.parseInt(roh, 10);
  return Number.isFinite(zahl) && zahl > 0 ? zahl : null;
}

export type GdtfModus = {
  name: string;
  /** Belegte Kanäle je Break, aufsteigend nach Break-Nummer. */
  kanaeleJeBreak: number[];
};

/** Alle Modi einer `description.xml` mit ihrem Fußabdruck. */
export function leseGdtfModi(xml: string): GdtfModus[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new GdtfError("Die Gerätedatei ist nicht lesbar (ungültiges XML).");
  }

  const fixtureType = doc.documentElement && firstChild(doc.documentElement, "FixtureType");
  if (!fixtureType) return [];

  const modiEl = firstChild(fixtureType, "DMXModes");
  if (!modiEl) return [];

  const modi: GdtfModus[] = [];
  for (const modusEl of directChildren(modiEl, "DMXMode")) {
    const kanaeleEl = firstChild(modusEl, "DMXChannels");
    const hoechster = new Map<number, number>();

    if (kanaeleEl) {
      for (const kanal of directChildren(kanaeleEl, "DMXChannel")) {
        const nr = breakVon(kanal);
        if (nr == null) continue;
        for (const offset of offsets(kanal)) {
          hoechster.set(nr, Math.max(hoechster.get(nr) ?? 0, offset));
        }
      }
    }

    modi.push({
      name: modusEl.getAttribute("Name") ?? "",
      kanaeleJeBreak: [...hoechster.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, kanaele]) => kanaele),
    });
  }

  return modi;
}

/**
 * Den passenden Modus heraussuchen und seinen Fußabdruck zurückgeben.
 *
 * Zurückgegeben wird nur ein Wert, wenn er **eindeutig** ist:
 *
 * - Der benannte Modus muss gefunden werden. Steht in der Szene ein Modus, den
 *   die Gerätedatei nicht kennt, wird nicht ersatzweise der erste genommen —
 *   das wäre geraten, und ein falscher Fußabdruck erfindet Konflikte.
 * - Nur bei genau einem Break. Bei mehreren Breaks ist ohne die Break-Nummer
 *   aus der Szene nicht zu sagen, welche Adresse welchen Bereich belegt.
 *
 * Ohne Modusangabe zählt der Sonderfall, dass die Datei nur einen Modus kennt —
 * dann gibt es nichts zu verwechseln.
 */
export function kanaeleAusGdtf(xml: string, modusName: string | null | undefined): number | null {
  const modi = leseGdtfModi(xml);
  if (modi.length === 0) return null;

  const gesucht = (modusName ?? "").trim().toLowerCase();
  const modus = gesucht
    ? modi.find((m) => m.name.trim().toLowerCase() === gesucht)
    : modi.length === 1
      ? modi[0]
      : undefined;

  if (!modus) return null;
  if (modus.kanaeleJeBreak.length !== 1) return null;

  const kanaele = modus.kanaeleJeBreak[0]!;
  return kanaele > 0 && kanaele <= 512 ? kanaele : null;
}

/**
 * Den Dateinamen der GDTF im MVR finden.
 *
 * `gdtfSpec` aus der Szene stimmt nicht immer wörtlich mit dem Eintrag im
 * Archiv überein: mal fehlt die Endung, mal weicht die Schreibweise ab, mal
 * liegt die Datei in einem Unterordner.
 */
export function findeGdtfDatei(eintraege: string[], gdtfSpec: string | null): string | null {
  const spec = (gdtfSpec ?? "").trim();
  if (!spec) return null;

  const gdtfs = eintraege.filter((e) => e.toLowerCase().endsWith(".gdtf"));
  const specLower = spec.toLowerCase();
  const mitEndung = specLower.endsWith(".gdtf") ? specLower : `${specLower}.gdtf`;

  return (
    gdtfs.find((e) => e.toLowerCase() === mitEndung) ??
    gdtfs.find((e) => e.toLowerCase().endsWith(`/${mitEndung}`)) ??
    null
  );
}
