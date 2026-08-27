import { describe, expect, it } from "vitest";
import {
  SCHUKO_ABSICHERUNG_A,
  ampereAt230V,
  benoetigteKreise,
  parseNumericFieldValue,
  summarizeLoad,
} from "@/lib/load";

describe("Zahlen aus freien Feldwerten", () => {
  it("liest schlichte Zahlen", () => {
    expect(parseNumericFieldValue("575")).toBe(575);
  });

  it("ignoriert eine mitgetippte Einheit", () => {
    // Im Textfeld steht mal "575", mal "575 W" — beides ist gemeint.
    expect(parseNumericFieldValue("575 W")).toBe(575);
    expect(parseNumericFieldValue("14,5 kg")).toBe(14.5);
  });

  it("versteht das deutsche Dezimalkomma", () => {
    expect(parseNumericFieldValue("1,2")).toBe(1.2);
  });

  it("versteht Tausenderpunkte", () => {
    expect(parseNumericFieldValue("1.200")).toBe(1200);
    expect(parseNumericFieldValue("1.200,5")).toBe(1200.5);
  });

  it("hält einen einfachen Punkt weiter für ein Dezimaltrennzeichen", () => {
    expect(parseNumericFieldValue("1.5")).toBe(1.5);
  });

  it("liefert für Unbrauchbares nichts", () => {
    expect(parseNumericFieldValue(null)).toBeNull();
    expect(parseNumericFieldValue("")).toBeNull();
    expect(parseNumericFieldValue("keine Angabe")).toBeNull();
    expect(parseNumericFieldValue("-5")).toBeNull();
  });
});

describe("Last-Summen", () => {
  it("zählt Gewicht und Leistung zusammen", () => {
    const s = summarizeLoad([
      { weightKg: 14.5, powerRaw: "575" },
      { weightKg: 3.2, powerRaw: "60 W" },
    ]);
    expect(s.gewichtKg).toBe(17.7);
    expect(s.leistungW).toBe(635);
    expect(s.gesamt).toBe(2);
  });

  it("zählt fehlende Angaben mit — die Summe ist sonst eine Lüge", () => {
    // Wer einen LKW nach einer Zahl plant, die die Hälfte verschweigt,
    // steht am Ende vor einem zu kleinen Fahrzeug.
    const s = summarizeLoad([
      { weightKg: 14.5, powerRaw: "575" },
      { weightKg: null, powerRaw: null },
      { weightKg: null, powerRaw: "100" },
    ]);
    expect(s.gewichtKg).toBe(14.5);
    expect(s.ohneGewicht).toBe(2);
    expect(s.leistungW).toBe(675);
    expect(s.ohneLeistung).toBe(1);
  });

  it("behandelt Null und Negatives wie fehlend", () => {
    const s = summarizeLoad([{ weightKg: 0, powerRaw: "0" }]);
    expect(s.gewichtKg).toBe(0);
    expect(s.ohneGewicht).toBe(1);
    expect(s.ohneLeistung).toBe(1);
  });

  it("berücksichtigt Stückzahlen", () => {
    const s = summarizeLoad([{ weightKg: 2, powerRaw: "50", menge: 8 }]);
    expect(s.gewichtKg).toBe(16);
    expect(s.leistungW).toBe(400);
    expect(s.gesamt).toBe(8);
  });

  it("zählt fehlende Angaben je Eintrag, nicht je Stück", () => {
    // Ein Mengenartikel ohne Gewicht ist EINE fehlende Angabe, nicht vierzig.
    // Sonst läse man „40 von 41 Positionen haben kein Gewicht" und hielte die
    // Datenlage für katastrophal, obwohl ein Feld fehlt.
    const s = summarizeLoad([
      { weightKg: 5, powerRaw: "100" },
      { weightKg: null, powerRaw: null, menge: 40 },
    ]);
    expect(s.ohneGewicht).toBe(1);
    expect(s.posGesamt).toBe(2);
    expect(s.gesamt).toBe(41);
  });

  it("lässt Mengenartikel aus der Strom-Warnung heraus", () => {
    // Ein DMX-Kabel bekommt nie eine Wattzahl. Als „ohne Leistung gepflegt"
    // gezählt, wäre die Warnung dauerhaft rot und damit wertlos.
    const s = summarizeLoad([
      { weightKg: 5, powerRaw: "100" },
      { weightKg: 0.4, powerRaw: null, menge: 40, zaehltStrom: false },
    ]);
    expect(s.ohneLeistung).toBe(0);
    expect(s.stromGesamt).toBe(1);
    // Das Gewicht zählt trotzdem voll mit: 5 + 40 × 0,4 = 21
    expect(s.gewichtKg).toBe(21);
  });

  it("rundet Gleitkomma-Reste weg", () => {
    // 0.1 + 0.2 ergibt in JavaScript 0.30000000000000004.
    const s = summarizeLoad([
      { weightKg: 0.1, powerRaw: null },
      { weightKg: 0.2, powerRaw: null },
    ]);
    expect(s.gewichtKg).toBe(0.3);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(summarizeLoad([])).toEqual({
      gewichtKg: 0,
      ohneGewicht: 0,
      leistungW: 0,
      ohneLeistung: 0,
      gesamt: 0,
      posGesamt: 0,
      stromGesamt: 0,
    });
  });
});

describe("Stromplanung", () => {
  it("rechnet Watt in Ampere um", () => {
    expect(ampereAt230V(2300)).toBe(10);
    expect(ampereAt230V(575)).toBe(2.5);
  });

  it("sagt, wie viele 16-A-Kreise nötig sind", () => {
    expect(benoetigteKreise(0)).toBe(0);
    expect(benoetigteKreise(2300)).toBe(1);
    // 16 A bei 230 V sind rund 3680 W — knapp darüber braucht es zwei Kreise.
    expect(benoetigteKreise(3680)).toBe(1);
    expect(benoetigteKreise(4000)).toBe(2);
    expect(benoetigteKreise(SCHUKO_ABSICHERUNG_A * 230 * 2)).toBe(2);
  });
});
