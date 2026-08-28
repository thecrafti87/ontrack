/**
 * Wer darf sich registrieren?
 *
 * Bewusst ohne Datenbank, damit die Regel prüfbar ist — sie entscheidet, wer
 * überhaupt an das System kommt, und das ist keine Stelle für Vermutungen.
 *
 * Drei Zustände, in dieser Reihenfolge:
 *
 * 1. **Noch kein Benutzer da.** Immer erlaubt. Sonst wäre eine frische
 *    Installation nicht einzurichten — der erste Registrierte wird Admin, und
 *    es gibt niemanden, der vorher einen Code hinterlegen könnte. Das gilt
 *    auch für die Desktop-Fassung, die bei jedem Anwender leer startet.
 * 2. **Kein Code hinterlegt.** Erlaubt wie bisher. Eine Instanz im eigenen
 *    Netz braucht keine Hürde.
 * 3. **Code hinterlegt.** Nur mit passendem Code.
 *
 * Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung und ohne
 * umgebende Leerzeichen: Der Code wird auf einem Handy abgetippt, oft aus
 * einer Nachricht kopiert. Ein Fehlschlag wegen eines mitkopierten
 * Leerzeichens wäre reine Schikane.
 */

export type EinladungsErgebnis =
  | { erlaubt: true }
  | { erlaubt: false; grund: "fehlt" | "falsch" };

export type EinladungsLage = {
  /** Der hinterlegte Code. Leer oder null = Registrierung ohne Code offen. */
  hinterlegt: string | null | undefined;
  /** Was im Formular eingegeben wurde. */
  eingegeben: string;
  /** Gibt es überhaupt schon einen Benutzer? */
  ersterBenutzer: boolean;
};

function normalisiere(wert: string | null | undefined): string {
  return (wert ?? "").trim().toLowerCase();
}

/** Ist für diese Instanz überhaupt ein Code nötig? */
export function einladungNoetig(
  hinterlegt: string | null | undefined,
  ersterBenutzer: boolean
): boolean {
  if (ersterBenutzer) return false;
  return normalisiere(hinterlegt).length > 0;
}

export function pruefeEinladung(lage: EinladungsLage): EinladungsErgebnis {
  if (!einladungNoetig(lage.hinterlegt, lage.ersterBenutzer)) return { erlaubt: true };

  const eingegeben = normalisiere(lage.eingegeben);
  if (eingegeben.length === 0) return { erlaubt: false, grund: "fehlt" };

  return normalisiere(lage.hinterlegt) === eingegeben
    ? { erlaubt: true }
    : { erlaubt: false, grund: "falsch" };
}

/**
 * Ein Vorschlag für einen Code, den man am Telefon durchgeben kann.
 *
 * Keine Zeichen, die sich verwechseln lassen (0/O, 1/l/I), und in Gruppen —
 * so lässt er sich vorlesen und abtippen, ohne dass jemand nachfragt.
 */
export function codeVorschlag(zufall: (grenze: number) => number): string {
  const zeichen = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const gruppe = () =>
    Array.from({ length: 4 }, () => zeichen[zufall(zeichen.length)]).join("");
  return `${gruppe()}-${gruppe()}`;
}
