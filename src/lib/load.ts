/**
 * Gewichts- und Stromlast-Summen für Events und Cases.
 *
 * Beides wird längst erfasst — Gewicht als eigenes Feld, Leistung im
 * Feldkatalog — aber nirgends zusammengezählt. Summiert ergeben sie
 * Ladungsplanung für das Fahrzeug und eine Vorwarnung, bevor eine Zuleitung
 * überlastet wird.
 *
 * Wichtigste Regel hier: Eine Summe über unvollständige Daten ist eine
 * Untergrenze, keine Antwort. Wie viele Geräte keinen Wert haben, gehört
 * deshalb untrennbar zum Ergebnis — sonst plant jemand einen LKW nach einer
 * Zahl, die die Hälfte des Gewichts verschweigt.
 */

/** Standard-Netzspannung für die Umrechnung Watt → Ampere (einphasig). */
export const NETZSPANNUNG_V = 230;

/** Übliche Absicherung einer einzelnen Schuko-Zuleitung. */
export const SCHUKO_ABSICHERUNG_A = 16;

export type LoadItem = {
  /** Gewicht in kg, falls gepflegt. */
  weightKg: number | null;
  /** Rohwert des Feldkatalog-Eintrags "powerW", falls gepflegt. */
  powerRaw: string | null;
  /** Stückzahl, falls das Objekt mehrfach zählt (Mengenartikel). */
  menge?: number;
  /**
   * Kann dieser Eintrag überhaupt Strom ziehen? Für Kabel, Schellen und
   * Gaffa ist das nein — sie als „ohne Leistung gepflegt" zu zählen, machte
   * die Warnung nutzlos, denn sie bekommen nie eine Wattzahl.
   */
  zaehltStrom?: boolean;
};

export type LoadSummary = {
  gewichtKg: number;
  /**
   * Einträge ohne gepflegtes Gewicht — die Summe ist um sie zu niedrig.
   *
   * Gezählt werden Einträge, nicht Stückzahlen: Ein Mengenartikel ohne
   * Gewicht ist eine fehlende Angabe, nicht vierzig.
   */
  ohneGewicht: number;
  leistungW: number;
  /** Einträge, die Strom ziehen könnten, aber keine Leistung hinterlegt haben. */
  ohneLeistung: number;
  /** Stückzahl insgesamt. */
  gesamt: number;
  /** Anzahl der Einträge — Bezugsgröße für die Gewichts-Warnung. */
  posGesamt: number;
  /** Einträge, die überhaupt Strom ziehen können — Bezugsgröße für die Strom-Warnung. */
  stromGesamt: number;
};

/**
 * Zahl aus einem frei eingegebenen Feldwert lesen.
 *
 * Die Werte kommen aus einem Textfeld, entsprechend steht dort mal „575",
 * mal „575 W", mal „1,2". Deutsche Dezimalkommata sind der Normalfall, nicht
 * die Ausnahme.
 */
export function parseNumericFieldValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;

  const bereinigt = raw
    .trim()
    // Tausenderpunkte nur zwischen Ziffern entfernen: "1.200" → "1200",
    // aber "1.5" bleibt unangetastet und wird gleich als Komma behandelt.
    .replace(/(\d)\.(?=\d{3}\b)/g, "$1")
    .replace(",", ".");

  const treffer = bereinigt.match(/-?\d+(\.\d+)?/);
  if (!treffer) return null;

  const zahl = Number(treffer[0]);
  if (!Number.isFinite(zahl) || zahl < 0) return null;
  return zahl;
}

export function summarizeLoad(items: LoadItem[]): LoadSummary {
  let gewichtKg = 0;
  let ohneGewicht = 0;
  let leistungW = 0;
  let ohneLeistung = 0;
  let gesamt = 0;
  let stromGesamt = 0;

  for (const item of items) {
    const menge = item.menge ?? 1;
    gesamt += menge;

    if (item.weightKg != null && item.weightKg > 0) gewichtKg += item.weightKg * menge;
    else ohneGewicht++;

    if (item.zaehltStrom === false) continue;
    stromGesamt++;

    const watt = parseNumericFieldValue(item.powerRaw);
    if (watt != null && watt > 0) leistungW += watt * menge;
    else ohneLeistung++;
  }

  return {
    // Auf zwei Nachkommastellen runden: Gleitkomma-Addition erzeugt sonst
    // Anzeigen wie "14.499999999999998 kg".
    gewichtKg: Math.round(gewichtKg * 100) / 100,
    ohneGewicht,
    leistungW: Math.round(leistungW),
    ohneLeistung,
    gesamt,
    posGesamt: items.length,
    stromGesamt,
  };
}

/** Grobe Stromaufnahme in Ampere bei einphasigem 230-V-Netz. */
export function ampereAt230V(watt: number): number {
  return Math.round((watt / NETZSPANNUNG_V) * 10) / 10;
}

/** Wie viele 16-A-Kreise die Last mindestens braucht. */
export function benoetigteKreise(watt: number): number {
  if (watt <= 0) return 0;
  return Math.ceil(ampereAt230V(watt) / SCHUKO_ABSICHERUNG_A);
}
