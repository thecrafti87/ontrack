import { BULK_REASONS, type BulkReason } from "./constants";

/**
 * Rechenregeln für Mengenartikel.
 *
 * Bewusst ohne Datenbank, damit die Fälle prüfbar bleiben, die im Betrieb
 * wehtun: eine Entnahme über den Bestand hinaus, und eine Inventurkorrektur,
 * die nicht relativ, sondern absolut gemeint ist.
 */

export type BestandStatus = "leer" | "knapp" | "ausreichend";

/**
 * Wie sich eine Eingabe auf den Bestand auswirkt.
 *
 * Entnahme und Rückgabe sind relativ ("nimm 20 heraus"), eine Korrektur ist
 * absolut ("es sind tatsächlich 173"). Das zu vermischen wäre die
 * naheliegendste Fehlbedienung: Wer nach der Inventur „173" eingibt und
 * damit 173 dazubekommt, hat den Bestand verdoppelt.
 */
export function berechneDelta(
  reason: BulkReason,
  eingabe: number,
  aktuellerBestand: number
): number {
  if (reason === "KORREKTUR") return eingabe - aktuellerBestand;
  return eingabe * BULK_REASONS[reason].richtung;
}

export type PruefErgebnis = { ok: true; delta: number } | { ok: false; fehler: string };

export function pruefeBewegung(
  reason: BulkReason,
  eingabe: number,
  aktuellerBestand: number
): PruefErgebnis {
  if (!Number.isInteger(eingabe)) return { ok: false, fehler: "Bitte eine ganze Zahl angeben." };
  if (eingabe < 0) return { ok: false, fehler: "Die Menge darf nicht negativ sein." };
  if (reason !== "KORREKTUR" && eingabe === 0) {
    return { ok: false, fehler: "Bitte eine Menge größer als 0 angeben." };
  }

  const delta = berechneDelta(reason, eingabe, aktuellerBestand);
  const neuerBestand = aktuellerBestand + delta;

  if (neuerBestand < 0) {
    return {
      ok: false,
      fehler: `Es sind nur ${aktuellerBestand} vorhanden — so viel lässt sich nicht entnehmen.`,
    };
  }

  return { ok: true, delta };
}

/** Ampel für den Bestand. */
export function bestandStatus(bestand: number, minBestand: number | null): BestandStatus {
  if (bestand <= 0) return "leer";
  if (minBestand != null && bestand <= minBestand) return "knapp";
  return "ausreichend";
}

export const BESTAND_BADGE: Record<BestandStatus, string> = {
  leer: "bg-red-500/15 text-red-400 border-red-500/30",
  knapp: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ausreichend: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

// ── Mengenartikel auf der Packliste ──────────────────────────────────

/**
 * Was mit einem Mengenartikel für eine Veranstaltung passiert ist.
 *
 * Abgeleitet aus den Bewegungen, nicht aus einem eigenen Zählerfeld: Der
 * Bestand selbst wird genauso geführt, und zwei Stellen, die dasselbe zählen,
 * laufen früher oder später auseinander. Dann glaubt man der falschen.
 */
export type EinsatzBewegung = { delta: number; reason: string };

export type EinsatzBilanz = {
  /** Summe aller Entnahmen für diese Veranstaltung. */
  mitgenommen: number;
  /** Summe aller Rückgaben. */
  zurueck: number;
  /** Was noch draußen ist. Nach dem Abbau ist das der Fehlbestand. */
  offen: number;
};

export function einsatzBilanz(bewegungen: EinsatzBewegung[]): EinsatzBilanz {
  let mitgenommen = 0;
  let zurueck = 0;

  for (const bewegung of bewegungen) {
    // Entnahmen sind negativ gespeichert; hier zählt der Betrag.
    if (bewegung.reason === "ENTNAHME") mitgenommen += Math.abs(bewegung.delta);
    else if (bewegung.reason === "RUECKGABE") zurueck += Math.abs(bewegung.delta);
  }

  return { mitgenommen, zurueck, offen: mitgenommen - zurueck };
}

export type EinsatzStatus = "offen" | "unterwegs" | "vollstaendig";

export function einsatzStatus(bilanz: EinsatzBilanz): EinsatzStatus {
  if (bilanz.mitgenommen === 0) return "offen";
  return bilanz.offen > 0 ? "unterwegs" : "vollstaendig";
}

/**
 * Menge, die im Einsatzmodus vorbelegt wird.
 *
 * Beim Packen fehlt, was noch nicht mit ist; beim Zurückräumen kommt zurück,
 * was noch draußen ist. Nie negativ: Wer mehr mitgenommen hat als geplant,
 * bekommt keine Aufforderung, etwas zurück ins Lager zu legen.
 */
export function vorschlagsMenge(
  phase: string,
  geplant: number,
  bilanz: EinsatzBilanz
): number {
  if (phase === "GEPACKT") return Math.max(0, geplant - bilanz.mitgenommen);
  if (phase === "ZURUECK") return Math.max(0, bilanz.offen);
  return 0;
}

export const EINSATZ_STATUS_BADGE: Record<EinsatzStatus, string> = {
  offen: "bg-surface-2 text-muted border-line",
  unterwegs: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  vollstaendig: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export const EINSATZ_STATUS_LABEL: Record<EinsatzStatus, string> = {
  offen: "Noch nicht mit",
  unterwegs: "Unterwegs",
  vollstaendig: "Vollständig zurück",
};
