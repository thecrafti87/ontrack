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
