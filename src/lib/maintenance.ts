// Reine Hilfsfunktionen zur Berechnung der Wartungs-Fälligkeit (Client & Server nutzbar).

export type MaintenanceUrgency = "overdue" | "soon" | "later";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
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
