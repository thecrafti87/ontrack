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

// ── Prüfnachweise ────────────────────────────────────────────────────

import { MAINTENANCE_RESULT, type MaintenanceResult } from "./constants";

export type PruefnachweisEingabe = {
  inventoryNo: string;
  deviceName: string;
  title: string;
  intervalMonths: number;
  performedAt: Date;
  result: string;
  testerName: string | null;
  recordedBy: string;
  notes: string | null;
  documentCount: number;
};

export type PruefnachweisZeile = PruefnachweisEingabe & {
  /** Fälligkeit, die sich aus genau dieser Prüfung ergibt. */
  nextDue: Date | null;
};

/**
 * Prüfungen für den Nachweis aufbereiten: nach Gerät sortiert, innerhalb
 * eines Geräts die neueste zuerst.
 *
 * Die Fälligkeit wird je Eintrag berechnet und nicht vom Plan übernommen —
 * ein Nachweis soll zeigen, was die einzelne Prüfung ergeben hat, auch wenn
 * inzwischen weitere folgten. Eine nicht bestandene Prüfung setzt die Frist
 * nicht zurück; sie bekommt deshalb kein Datum, statt eines zu erfinden.
 */
export function pruefnachweise(eintraege: PruefnachweisEingabe[]): PruefnachweisZeile[] {
  return [...eintraege]
    .sort((a, b) => {
      const geraet = a.inventoryNo.localeCompare(b.inventoryNo, "de");
      if (geraet !== 0) return geraet;
      return b.performedAt.getTime() - a.performedAt.getTime();
    })
    .map((eintrag) => ({
      ...eintrag,
      nextDue: MAINTENANCE_RESULT[eintrag.result as MaintenanceResult]?.resetsInterval
        ? addMonths(eintrag.performedAt, eintrag.intervalMonths)
        : null,
    }));
}
