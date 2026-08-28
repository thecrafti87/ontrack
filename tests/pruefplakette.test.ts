import { describe, expect, it } from "vitest";
import { monatJahr, teilePlaketten, type PlaketteEingabe } from "@/lib/pruefplakette";

/**
 * Eine Plakette ist eine Bescheinigung. Sie auf ein Gerät zu kleben, das die
 * Prüfung nicht bestanden hat, ist keine Schlamperei, sondern eine falsche
 * Aussage mit Haftungsfolge — deshalb steht der Ausschluss hier an erster
 * Stelle und nicht die Beschriftung.
 */

const basis: PlaketteEingabe = {
  id: "plan-1",
  inventoryNo: "OT-0001",
  deviceName: "Robe MegaPointe",
  titel: "DGUV V3-Prüfung",
  intervalMonths: 12,
  lastDoneAt: new Date("2026-03-15T00:00:00Z"),
  letztesErgebnis: "BESTANDEN",
  pruefer: "Elektro Meier GmbH",
};

describe("Wer keine Plakette bekommt", () => {
  it("das nie geprüfte Gerät", () => {
    const { druckbar, abgelehnt } = teilePlaketten([{ ...basis, lastDoneAt: null }]);
    expect(druckbar).toEqual([]);
    expect(abgelehnt[0]).toMatchObject({ inventoryNo: "OT-0001", grund: "nie_geprueft" });
  });

  it("das durchgefallene Gerät", () => {
    const { druckbar, abgelehnt } = teilePlaketten([
      { ...basis, letztesErgebnis: "DURCHGEFALLEN" },
    ]);
    expect(druckbar).toEqual([]);
    expect(abgelehnt[0]!.grund).toBe("nicht_bestanden");
  });

  it("auch das Gerät mit Mängeln", () => {
    // Solange nachgebessert wird, ist es nicht freigegeben. „Fast bestanden"
    // gibt es auf einer Plakette nicht.
    const { druckbar, abgelehnt } = teilePlaketten([{ ...basis, letztesErgebnis: "MAENGEL" }]);
    expect(druckbar).toEqual([]);
    expect(abgelehnt[0]!.grund).toBe("nicht_bestanden");
  });

  it("wird mit Grund zurückgemeldet, nicht still übergangen", () => {
    // Sonst druckt jemand 40 Plaketten, bekommt 38 und merkt es beim Kleben.
    const { druckbar, abgelehnt } = teilePlaketten([
      basis,
      { ...basis, id: "plan-2", inventoryNo: "OT-0002", lastDoneAt: null },
      { ...basis, id: "plan-3", inventoryNo: "OT-0003", letztesErgebnis: "DURCHGEFALLEN" },
    ]);
    expect(druckbar).toHaveLength(1);
    expect(abgelehnt.map((a) => a.inventoryNo)).toEqual(["OT-0002", "OT-0003"]);
  });
});

describe("Was auf der Plakette steht", () => {
  it("rechnet die nächste Fälligkeit aus dem Intervall", () => {
    const [p] = teilePlaketten([basis]).druckbar;
    expect(monatJahr(p!.geprueftAm)).toBe("03/2026");
    expect(monatJahr(p!.naechsteFaellig)).toBe("03/2027");
  });

  it("kommt mit kurzen Intervallen über den Jahreswechsel zurecht", () => {
    const [p] = teilePlaketten([
      { ...basis, lastDoneAt: new Date("2026-11-20T00:00:00Z"), intervalMonths: 6 },
    ]).druckbar;
    expect(monatJahr(p!.naechsteFaellig)).toBe("05/2027");
  });

  it("nennt den Prüfer, wenn einer bekannt ist", () => {
    expect(teilePlaketten([basis]).druckbar[0]!.pruefer).toBe("Elektro Meier GmbH");
  });

  it("lässt ihn weg statt ein leeres Feld zu drucken", () => {
    expect(teilePlaketten([{ ...basis, pruefer: "   " }]).druckbar[0]!.pruefer).toBeNull();
    expect(teilePlaketten([{ ...basis, pruefer: null }]).druckbar[0]!.pruefer).toBeNull();
  });

  it("akzeptiert einen Plan ohne erfasste Einzelprüfung", () => {
    // Ältere Bestände haben oft nur den Stichtag, keinen Prüfeintrag. Das ist
    // kein Grund, die Plakette zu verweigern — nur ein unbekanntes Ergebnis
    // ist etwas anderes als ein schlechtes.
    const { druckbar } = teilePlaketten([{ ...basis, letztesErgebnis: null }]);
    expect(druckbar).toHaveLength(1);
  });
});

describe("Monat und Jahr", () => {
  it("wird zweistellig geschrieben", () => {
    expect(monatJahr(new Date("2027-01-05T00:00:00Z"))).toBe("01/2027");
    expect(monatJahr(new Date("2027-12-31T00:00:00Z"))).toBe("12/2027");
  });
});
