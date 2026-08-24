import { describe, expect, it } from "vitest";
import { alleZurueck, loanStatus, offeneAnzahl, tageUeberfaellig } from "@/lib/loan";

const HEUTE = new Date(2026, 7, 24, 14, 30);

describe("Zustand eines Verleihs", () => {
  it("ist offen, solange die Frist in der Zukunft liegt", () => {
    expect(loanStatus(new Date(2026, 7, 30), null, HEUTE)).toBe("offen");
  });

  it("meldet den Fristtag selbst als faellig-heute, nicht als ueberfaellig", () => {
    // Wer heute zurückbringen soll, ist heute noch nicht säumig.
    expect(loanStatus(new Date(2026, 7, 24), null, HEUTE)).toBe("faellig_heute");
  });

  it("ist ab dem Folgetag überfällig", () => {
    expect(loanStatus(new Date(2026, 7, 23), null, HEUTE)).toBe("ueberfaellig");
  });

  it("ignoriert Uhrzeiten", () => {
    // Frist um 8 Uhr, jetzt 14:30 desselben Tages: noch nicht überfällig.
    expect(loanStatus(new Date(2026, 7, 24, 8, 0), null, HEUTE)).toBe("faellig_heute");
  });

  it("ist nach der Rückgabe nie überfällig", () => {
    // Auch eine verspätete Rückgabe schließt den Verleih ab.
    expect(loanStatus(new Date(2026, 6, 1), new Date(2026, 7, 20), HEUTE)).toBe("zurueck");
  });
});

describe("Verzug in Tagen", () => {
  it("zählt ab dem Tag nach der Frist", () => {
    expect(tageUeberfaellig(new Date(2026, 7, 24), null, HEUTE)).toBe(0);
    expect(tageUeberfaellig(new Date(2026, 7, 23), null, HEUTE)).toBe(1);
    expect(tageUeberfaellig(new Date(2026, 7, 17), null, HEUTE)).toBe(7);
  });

  it("zählt nicht in die Zukunft", () => {
    expect(tageUeberfaellig(new Date(2026, 8, 1), null, HEUTE)).toBe(0);
  });

  it("zählt nach der Rückgabe nicht weiter", () => {
    expect(tageUeberfaellig(new Date(2026, 6, 1), new Date(2026, 6, 5), HEUTE)).toBe(0);
  });

  it("übersteht den Monatswechsel", () => {
    expect(tageUeberfaellig(new Date(2026, 6, 31), null, new Date(2026, 7, 3))).toBe(3);
  });
});

describe("Teilrückgaben", () => {
  it("gilt erst als abgeschlossen, wenn das letzte Gerät zurück ist", () => {
    expect(alleZurueck([{ returnedAt: new Date() }, { returnedAt: null }])).toBe(false);
    expect(alleZurueck([{ returnedAt: new Date() }, { returnedAt: new Date() }])).toBe(true);
  });

  it("gilt ohne Geräte nicht als abgeschlossen", () => {
    // Ein leerer Verleih ist ein Fehler, kein erledigter Vorgang.
    expect(alleZurueck([])).toBe(false);
  });

  it("zählt die noch ausstehenden Geräte", () => {
    expect(
      offeneAnzahl([{ returnedAt: new Date() }, { returnedAt: null }, { returnedAt: null }])
    ).toBe(2);
    expect(offeneAnzahl([])).toBe(0);
  });
});
