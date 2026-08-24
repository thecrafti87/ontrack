/**
 * Regeln rund um den Verleih.
 *
 * Ohne Datenbank, damit die Fristen prüfbar bleiben — vor allem die Frage,
 * ab wann etwas überfällig ist. Ein Verleih, der „heute" zurück soll, ist
 * heute noch nicht überfällig, sondern erst morgen.
 */

export type LoanStatus = "offen" | "faellig_heute" | "ueberfaellig" | "zurueck";

const TAG_MS = 24 * 60 * 60 * 1000;

function tagesbeginn(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Zustand eines Verleihs.
 *
 * Vollständig zurückgegeben schlägt alles andere: Ein abgeschlossener
 * Verleih ist nie überfällig, auch wenn die Rückgabe spät kam.
 */
export function loanStatus(
  dueAt: Date,
  returnedAt: Date | null,
  heute: Date = new Date()
): LoanStatus {
  if (returnedAt) return "zurueck";

  const frist = tagesbeginn(dueAt).getTime();
  const jetzt = tagesbeginn(heute).getTime();

  if (jetzt > frist) return "ueberfaellig";
  if (jetzt === frist) return "faellig_heute";
  return "offen";
}

/** Tage über die Frist hinaus. 0, solange nichts überfällig ist. */
export function tageUeberfaellig(
  dueAt: Date,
  returnedAt: Date | null,
  heute: Date = new Date()
): number {
  if (returnedAt) return 0;
  const differenz = tagesbeginn(heute).getTime() - tagesbeginn(dueAt).getTime();
  return differenz > 0 ? Math.round(differenz / TAG_MS) : 0;
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  offen: "Ausgegeben",
  faellig_heute: "Heute zurück",
  ueberfaellig: "Überfällig",
  zurueck: "Zurückgegeben",
};

export const LOAN_STATUS_BADGE: Record<LoanStatus, string> = {
  offen: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  faellig_heute: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ueberfaellig: "bg-red-500/15 text-red-400 border-red-500/30",
  zurueck: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

/**
 * Ist ein Verleih vollständig zurückgegeben?
 *
 * Wird nach jeder Teilrückgabe gefragt: Erst wenn das letzte Gerät zurück
 * ist, gilt der ganze Verleih als abgeschlossen.
 */
export function alleZurueck(items: { returnedAt: Date | null }[]): boolean {
  return items.length > 0 && items.every((i) => i.returnedAt != null);
}

/** Wie viele Geräte noch ausstehen. */
export function offeneAnzahl(items: { returnedAt: Date | null }[]): number {
  return items.filter((i) => i.returnedAt == null).length;
}
