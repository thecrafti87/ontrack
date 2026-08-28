/**
 * Monatsraster für die Kalenderansicht.
 *
 * Reine Datumsarithmetik, ohne Datenbank — damit die Grenzfälle prüfbar
 * bleiben: Monatswechsel, Schaltjahre, und vor allem der Wochenbeginn.
 * JavaScript zählt Sonntag als 0; in Deutschland beginnt die Woche montags.
 */

export const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export type Kalendertag = {
  datum: Date;
  /** Gehört der Tag zum angezeigten Monat oder füllt er nur die Woche auf? */
  imMonat: boolean;
};

/** Datum ohne Uhrzeit — Vergleiche sollen auf den Tag gehen, nicht auf die Sekunde. */
export function tagesbeginn(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Wochentag mit Montag = 0 statt Sonntag = 0. */
export function wochentagMontagsBasiert(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Vollständige Wochen eines Monats, jeweils Montag bis Sonntag.
 *
 * Die Ränder werden mit Tagen der Nachbarmonate aufgefüllt, damit jede Zeile
 * sieben Felder hat — ein Raster mit Löchern liest sich schlechter als eines
 * mit blassen Nachbartagen.
 */
export function buildMonthGrid(jahr: number, monat: number): Kalendertag[][] {
  const erster = new Date(jahr, monat, 1);
  const start = new Date(erster);
  start.setDate(start.getDate() - wochentagMontagsBasiert(erster));

  const wochen: Kalendertag[][] = [];
  const laufend = new Date(start);

  // Höchstens sechs Wochen — mehr braucht kein Monat, und die Schleife kann
  // so nicht davonlaufen.
  for (let w = 0; w < 6; w++) {
    const woche: Kalendertag[] = [];
    for (let t = 0; t < 7; t++) {
      woche.push({
        datum: new Date(laufend),
        imMonat: laufend.getMonth() === monat,
      });
      laufend.setDate(laufend.getDate() + 1);
    }
    wochen.push(woche);

    // Fertig, sobald die nächste Woche komplett im Folgemonat läge.
    if (laufend.getMonth() !== monat && laufend > erster) break;
  }

  return wochen;
}

/**
 * Liegt der Tag im Zeitraum (beide Grenzen einschließlich, tagesgenau)?
 *
 * Ohne Ende gilt der Zeitraum ab dem Anfang unbegrenzt — so ist ein Objekt
 * (Festinstallation) modelliert.
 */
export function tagImZeitraum(tag: Date, start: Date, ende: Date | null | undefined): boolean {
  const t = tagesbeginn(tag).getTime();
  if (t < tagesbeginn(start).getTime()) return false;
  if (!ende) return true;
  return t <= tagesbeginn(ende).getTime();
}

/** Monat verschieben, ohne über Jahresgrenzen zu stolpern. */
export function verschiebeMonat(jahr: number, monat: number, delta: number): { jahr: number; monat: number } {
  const d = new Date(jahr, monat + delta, 1);
  return { jahr: d.getFullYear(), monat: d.getMonth() };
}

/** "2026-10" lesen; bei Unsinn den aktuellen Monat. */
export function parseMonatParam(
  raw: string | undefined,
  heute: Date
): { jahr: number; monat: number } {
  const treffer = (raw ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!treffer) return { jahr: heute.getFullYear(), monat: heute.getMonth() };

  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]) - 1;
  if (jahr < 1970 || jahr > 2999 || monat < 0 || monat > 11) {
    return { jahr: heute.getFullYear(), monat: heute.getMonth() };
  }
  return { jahr, monat };
}

/** Gegenstück zu parseMonatParam. */
export function monatParam(jahr: number, monat: number): string {
  return `${jahr}-${String(monat + 1).padStart(2, "0")}`;
}
