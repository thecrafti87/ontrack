/**
 * Veranstaltung oder Objekt?
 *
 * Beide teilen sich dieselbe Tabelle, weil beide dasselbe tun: Geräte an einen
 * Ort binden. Sie unterscheiden sich in einem Punkt, und der färbt auf alles ab:
 *
 * - Eine **Veranstaltung** hat einen Anfang und ein Ende. Danach kommen die
 *   Geräte zurück.
 * - Ein **Objekt** ist eine Festinstallation. Es hat einen Anfang und läuft,
 *   bis jemand es zurückbaut. Ein Ende kann geplant sein, muss aber nicht.
 *
 * Deshalb ist `endDate` optional. Ein erfundenes Enddatum („31.12.2099") wäre
 * bequem und würde in jeder Auswertung als Tatsache auftauchen: im Kalender als
 * Balken über 70 Jahre, in der Konfliktprüfung als Zeitraum, im Bericht als
 * Datum. Fehlende Angabe ist ehrlicher — und lässt sich abfragen.
 *
 * Für die Belegung eines Geräts heißt „kein Ende" NICHT „nicht belegt",
 * sondern das Gegenteil: dauerhaft belegt. Wer eine fest verbaute Lampe für
 * ein Festival einplant, bekommt zu Recht einen Konflikt gemeldet.
 */

export type EventArt = "VERANSTALTUNG" | "OBJEKT";

export const EVENT_ART: Record<EventArt, { label: string; plural: string; kurz: string }> = {
  VERANSTALTUNG: { label: "Veranstaltung", plural: "Veranstaltungen", kurz: "Event" },
  OBJEKT: { label: "Objekt", plural: "Objekte", kurz: "Objekt" },
};

export function eventArt(kind: string | null | undefined): EventArt {
  return kind === "OBJEKT" ? "OBJEKT" : "VERANSTALTUNG";
}

export function istObjekt(kind: string | null | undefined): boolean {
  return eventArt(kind) === "OBJEKT";
}

/**
 * Läuft das noch?
 *
 * Ohne Enddatum: ja, unbegrenzt. Mit Enddatum: bis einschließlich dieses Tages.
 */
export function laeuftNoch(endDate: Date | null | undefined, heute: Date): boolean {
  if (!endDate) return true;
  return endDate >= heute;
}

/**
 * Überschneidet sich der Zeitraum mit einem gesuchten Fenster?
 *
 * Ein offenes Ende reicht bis in jede Zukunft — deshalb genügt es, dass der
 * Anfang vor dem Ende des gesuchten Fensters liegt.
 */
export function zeitraumUeberschneidet(
  start: Date,
  ende: Date | null | undefined,
  fensterStart: Date,
  fensterEnde: Date
): boolean {
  if (start > fensterEnde) return false;
  if (!ende) return true;
  return ende >= fensterStart;
}

/** Das Ende in Worten. Ohne Datum kein Datum — sondern das, was zutrifft. */
export function endeText(endDate: Date | null | undefined, formatiere: (d: Date) => string): string {
  return endDate ? formatiere(endDate) : "läuft";
}

/** Anfang und Ende zusammen, wie es in einer Zeile steht. */
export function zeitraumText(
  startDate: Date,
  endDate: Date | null | undefined,
  formatiere: (d: Date) => string
): string {
  if (!endDate) return `seit ${formatiere(startDate)}`;
  return `${formatiere(startDate)} – ${formatiere(endDate)}`;
}
