/**
 * Störungsmeldungen von außen — die Prüfung der Eingaben.
 *
 * Diese Regeln sitzen an einer Stelle, an die jeder herankommt, der die
 * öffentliche Adresse kennt. Deshalb sind die Grenzen hier eng und die
 * Entscheidungen bewusst:
 *
 * - **Länge begrenzt.** Ein offenes Textfeld ohne Obergrenze ist eine
 *   Einladung, die Datenbank vollzuschreiben.
 * - **Mindestlänge.** „x" ist keine Meldung. Wer nichts schreibt, erzeugt
 *   Arbeit, ohne Information zu liefern.
 * - **Kontakt freiwillig.** Die Rückfrage ist oft der halbe Befund, aber wer
 *   sie erzwingt, bekommt erfundene Adressen statt echter Meldungen.
 *
 * Was hier NICHT passiert: prüfen, ob es das Gerät gibt. Die öffentliche Seite
 * darf nicht verraten, welche Inventarnummern vergeben sind — sonst wird sie
 * zum Verzeichnis des Bestands. Eine Meldung zu einer unbekannten Nummer wird
 * trotzdem gespeichert, sonst geht ein Zahlendreher lautlos verloren.
 */

import { extractInventoryNo } from "./scanCode";

export const CODE_MAX = 64;
export const BESCHREIBUNG_MIN = 5;
export const BESCHREIBUNG_MAX = 1000;
export const KONTAKT_MAX = 200;

export type MeldungEingabe = {
  code: string;
  beschreibung: string;
  kontakt?: string | null;
};

export type MeldungWerte = {
  code: string;
  beschreibung: string;
  kontakt: string | null;
};

export type MeldungPruefung =
  | { ok: true; werte: MeldungWerte }
  | { ok: false; feld: "code" | "beschreibung"; meldung: string };

export function pruefeMeldung(eingabe: MeldungEingabe): MeldungPruefung {
  const code = extractInventoryNo(eingabe.code ?? "").trim();
  if (!code) {
    return { ok: false, feld: "code", meldung: "Ohne Gerätenummer lässt sich nichts zuordnen." };
  }
  if (code.length > CODE_MAX) {
    return { ok: false, feld: "code", meldung: "Diese Gerätenummer ist zu lang." };
  }

  const beschreibung = (eingabe.beschreibung ?? "").trim();
  if (beschreibung.length < BESCHREIBUNG_MIN) {
    return {
      ok: false,
      feld: "beschreibung",
      meldung: "Bitte kurz beschreiben, was nicht stimmt — ein Wort reicht meist nicht.",
    };
  }
  if (beschreibung.length > BESCHREIBUNG_MAX) {
    return {
      ok: false,
      feld: "beschreibung",
      meldung: `Bitte auf ${BESCHREIBUNG_MAX} Zeichen kürzen.`,
    };
  }

  const kontaktRoh = (eingabe.kontakt ?? "").trim();
  // Zu lang wird gekürzt statt abgelehnt: Ein Kontakt ist freiwillig, und
  // deswegen eine sonst gute Meldung zurückzuweisen wäre unverhältnismäßig.
  const kontakt = kontaktRoh ? kontaktRoh.slice(0, KONTAKT_MAX) : null;

  return { ok: true, werte: { code, beschreibung, kontakt } };
}

/**
 * Die Antwort an den Melder — bewusst immer dieselbe.
 *
 * Ob die Nummer im Bestand steht oder nicht, darf nicht aus der Antwort
 * hervorgehen. Sonst lässt sich mit ein paar hundert Anfragen herausfinden,
 * welche Inventarnummern es gibt.
 */
export const MELDUNG_DANK =
  "Danke, die Meldung ist angekommen. Das Team sieht sie und kümmert sich.";
