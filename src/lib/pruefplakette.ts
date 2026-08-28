/**
 * Prüfplaketten: welches Gerät bekommt eine, und was steht darauf.
 *
 * Eine Plakette ist keine Zierde, sondern eine Aussage: „Dieses Gerät wurde am
 * X geprüft und ist bis Y wiederkehrend zu prüfen." Wer sie liest, verlässt
 * sich darauf, ohne nachzuschlagen — deshalb sind die Ausschlussregeln hier
 * wichtiger als die Gestaltung:
 *
 * - **Nie geprüft** → keine Plakette. Es gibt nichts zu bescheinigen.
 * - **Nicht bestanden** → keine Plakette. Eine Plakette auf einem
 *   durchgefallenen Gerät ist eine falsche Aussage, und zwar eine mit
 *   Haftungsfolge. Auch „Mängel" reicht nicht: Solange nachgebessert wird,
 *   ist das Gerät nicht freigegeben.
 *
 * Abgelehnte Geräte verschwinden nicht still, sondern werden mit Grund
 * zurückgegeben — sonst druckt jemand 40 Plaketten, bekommt 37, und merkt es
 * erst beim Kleben.
 */

import { addMonths } from "./maintenance";

export type PlaketteEingabe = {
  /** Kennung des Prüfplans — wird durchgereicht, damit der Aufrufer die
   *  Auswahl nicht über Namen zurückrechnen muss. */
  id: string;
  inventoryNo: string;
  deviceName: string;
  /** Titel des Prüfplans, z. B. „DGUV V3-Prüfung". */
  titel: string;
  intervalMonths: number;
  /** Stichtag aus dem Plan — leer, solange nie geprüft wurde. */
  lastDoneAt: Date | null;
  /** Ergebnis der jüngsten Prüfung: BESTANDEN | MAENGEL | DURCHGEFALLEN. */
  letztesErgebnis: string | null;
  pruefer: string | null;
};

export type Plakette = {
  id: string;
  inventoryNo: string;
  deviceName: string;
  titel: string;
  geprueftAm: Date;
  naechsteFaellig: Date;
  pruefer: string | null;
};

export type Ablehnungsgrund = "nie_geprueft" | "nicht_bestanden";

export type Abgelehnt = {
  id: string;
  inventoryNo: string;
  deviceName: string;
  grund: Ablehnungsgrund;
};

export const ABLEHNUNG_TEXT: Record<Ablehnungsgrund, string> = {
  nie_geprueft: "noch nie geprüft",
  nicht_bestanden: "letzte Prüfung nicht bestanden",
};

export function teilePlaketten(eintraege: PlaketteEingabe[]): {
  druckbar: Plakette[];
  abgelehnt: Abgelehnt[];
} {
  const druckbar: Plakette[] = [];
  const abgelehnt: Abgelehnt[] = [];

  for (const e of eintraege) {
    if (!e.lastDoneAt) {
      abgelehnt.push({
        id: e.id,
        inventoryNo: e.inventoryNo,
        deviceName: e.deviceName,
        grund: "nie_geprueft",
      });
      continue;
    }

    if (e.letztesErgebnis !== null && e.letztesErgebnis !== "BESTANDEN") {
      abgelehnt.push({
        id: e.id,
        inventoryNo: e.inventoryNo,
        deviceName: e.deviceName,
        grund: "nicht_bestanden",
      });
      continue;
    }

    druckbar.push({
      id: e.id,
      inventoryNo: e.inventoryNo,
      deviceName: e.deviceName,
      titel: e.titel,
      geprueftAm: e.lastDoneAt,
      naechsteFaellig: addMonths(e.lastDoneAt, e.intervalMonths),
      pruefer: e.pruefer?.trim() || null,
    });
  }

  return { druckbar, abgelehnt };
}

/**
 * Monat und Jahr — die Angabe, auf die es auf einer Plakette ankommt.
 *
 * Ein tagesgenaues Datum suggeriert eine Schärfe, die die Prüffrist nicht hat,
 * und ist auf 20 mm ohnehin nicht zu lesen.
 */
export function monatJahr(datum: Date): string {
  return `${String(datum.getMonth() + 1).padStart(2, "0")}/${datum.getFullYear()}`;
}
