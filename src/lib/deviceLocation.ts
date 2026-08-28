/**
 * Wo ist das Gerät?
 *
 * Die Frage hat mehrere Antworten, die gleichzeitig in der Datenbank stehen
 * können: ein Lagerstandort, ein Case, ein offener Verleih, ein Einbauort in
 * einer Festinstallation. Die Liste hat aber nur eine Zeile — also braucht es
 * eine Rangfolge, und die muss dieselbe sein wie in der Wirklichkeit:
 *
 * 1. **Verliehen.** Dann ist es schlicht nicht da, egal was sonst gespeichert ist.
 * 2. **Verbaut.** Hängt es montiert in einer Anlage, ist das die konkreteste
 *    Auskunft — konkreter als „Lager Regal 3", wo es seit Monaten nicht liegt.
 * 3. **Im Case.** Konkreter als der Standort des Cases.
 * 4. **Lagerstandort.**
 *
 * Diese Rangfolge steht bewusst hier und nicht in der Seite: Sie entscheidet,
 * was jemand liest, der ein Gerät sucht, und ein stiller Fehler darin schickt
 * Leute ins falsche Gebäude.
 */

export type OrtArt = "verliehen" | "verbaut" | "case" | "standort";

export type Ortsangabe = {
  art: OrtArt;
  /** Die Hauptauskunft — Traverse, Case, Regal, Entleiher. */
  text: string;
  /** Wo das gilt: die Anlage, in der verbaut wurde. Sonst leer. */
  zusatz?: string;
};

export type Ortslage = {
  /** Name des Entleihers bei offenem Verleih. */
  verleihAn?: string | null;
  /** Montageort in einer Anlage — nur bei tatsächlich montierten Geräten. */
  verbaut?: { position?: string | null; objekt?: string | null } | null;
  caseName?: string | null;
  standort?: string | null;
};

function sauber(wert: string | null | undefined): string | null {
  const text = (wert ?? "").trim();
  return text.length > 0 ? text : null;
}

export function bestimmeOrt(lage: Ortslage): Ortsangabe | null {
  const entleiher = sauber(lage.verleihAn);
  if (entleiher) return { art: "verliehen", text: entleiher };

  if (lage.verbaut) {
    const position = sauber(lage.verbaut.position);
    const objekt = sauber(lage.verbaut.objekt);
    // Ohne Position bleibt die Anlage als Auskunft — „montiert in Stadthalle"
    // ist immer noch mehr wert als der Lagerplatz, an dem es nicht liegt.
    if (position) return { art: "verbaut", text: position, ...(objekt ? { zusatz: objekt } : {}) };
    if (objekt) return { art: "verbaut", text: objekt };
  }

  const caseName = sauber(lage.caseName);
  if (caseName) return { art: "case", text: caseName };

  const standort = sauber(lage.standort);
  if (standort) return { art: "standort", text: standort };

  return null;
}

/** Das Wort vor der Ortsangabe. Der Standort trägt keins — er ist der Normalfall. */
export const ORT_PRAEFIX: Record<OrtArt, string> = {
  verliehen: "Verliehen an",
  verbaut: "Verbaut:",
  case: "Case:",
  standort: "",
};
