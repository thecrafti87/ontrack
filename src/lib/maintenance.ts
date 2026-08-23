// Reine Hilfsfunktionen zur Berechnung der Wartungs-Fälligkeit (Client & Server nutzbar).

export type MaintenanceUrgency = "overdue" | "soon" | "later";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Monate addieren, ohne in den Folgemonat zu rutschen.
 *
 * `setMonth` allein genügt nicht: Der 30.11. plus drei Monate ergäbe den
 * 30. Februar, den JavaScript stillschweigend zum 2. März weiterdreht. Eine
 * Prüffrist, die auf einen Monatsletzten fällt, würde dadurch bei jedem
 * Durchlauf ein paar Tage nach hinten wandern. Deshalb wird der Tag auf den
 * letzten gültigen des Zielmonats begrenzt.
 */
export function addMonths(date: Date, months: number): Date {
  const tag = date.getDate();
  const result = new Date(date);

  // Zuerst auf den Monatsersten, dann den Monat setzen — so kann nichts überlaufen.
  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const letzterTagDesZielmonats = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(tag, letzterTagDesZielmonats));
  return result;
}

/** Fälligkeitsdatum: null bedeutet "sofort fällig" (noch nie durchgeführt). */
export function getMaintenanceDueDate(lastDoneAt: Date | null, intervalMonths: number): Date | null {
  if (!lastDoneAt) return null;
  return addMonths(lastDoneAt, intervalMonths);
}

/** Dringlichkeit: überfällig/sofort fällig, bald fällig (≤30 Tage) oder später. */
export function getMaintenanceUrgency(dueDate: Date | null, now: Date = new Date()): MaintenanceUrgency {
  if (!dueDate) return "overdue";
  if (dueDate.getTime() <= now.getTime()) return "overdue";
  const in30Days = new Date(now.getTime() + 30 * DAY_MS);
  if (dueDate.getTime() <= in30Days.getTime()) return "soon";
  return "later";
}
