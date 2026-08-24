import { describe, expect, it } from "vitest";
import {
  WOCHENTAGE,
  buildMonthGrid,
  monatParam,
  parseMonatParam,
  tagImZeitraum,
  verschiebeMonat,
  wochentagMontagsBasiert,
} from "@/lib/calendar";

describe("Wochenbeginn", () => {
  it("zählt Montag als ersten Tag", () => {
    // JavaScript hat Sonntag = 0; in Deutschland beginnt die Woche montags.
    expect(wochentagMontagsBasiert(new Date(2026, 7, 24))).toBe(0); // Montag
    expect(wochentagMontagsBasiert(new Date(2026, 7, 30))).toBe(6); // Sonntag
  });

  it("beschriftet die Spalten passend dazu", () => {
    expect(WOCHENTAGE[0]).toBe("Mo");
    expect(WOCHENTAGE[6]).toBe("So");
  });
});

describe("Monatsraster", () => {
  it("liefert nur vollständige Wochen", () => {
    for (const [jahr, monat] of [
      [2026, 0],
      [2026, 1],
      [2026, 7],
      [2028, 1],
    ] as const) {
      const wochen = buildMonthGrid(jahr, monat);
      for (const w of wochen) expect(w).toHaveLength(7);
    }
  });

  it("beginnt jede Woche an einem Montag", () => {
    const wochen = buildMonthGrid(2026, 9);
    for (const w of wochen) expect(wochentagMontagsBasiert(w[0]!.datum)).toBe(0);
  });

  it("enthält jeden Tag des Monats genau einmal", () => {
    const wochen = buildMonthGrid(2026, 1); // Februar 2026, 28 Tage
    const imMonat = wochen.flat().filter((t) => t.imMonat);
    expect(imMonat).toHaveLength(28);
    expect(new Set(imMonat.map((t) => t.datum.getDate())).size).toBe(28);
  });

  it("kennt den 29. Februar im Schaltjahr", () => {
    const imMonat = buildMonthGrid(2028, 1).flat().filter((t) => t.imMonat);
    expect(imMonat).toHaveLength(29);
  });

  it("markiert Auffülltage der Nachbarmonate", () => {
    // 1. August 2026 ist ein Samstag — die Woche beginnt also im Juli.
    const wochen = buildMonthGrid(2026, 7);
    const erste = wochen[0]!;
    expect(erste[0]!.imMonat).toBe(false);
    expect(erste[0]!.datum.getMonth()).toBe(6);
  });

  it("bleibt bei höchstens sechs Wochen", () => {
    for (let m = 0; m < 12; m++) {
      expect(buildMonthGrid(2026, m).length).toBeLessThanOrEqual(6);
      expect(buildMonthGrid(2026, m).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("Zeitraum-Treffer", () => {
  const start = new Date(2026, 9, 21);
  const ende = new Date(2026, 9, 23);

  it("schließt beide Grenzen ein", () => {
    expect(tagImZeitraum(new Date(2026, 9, 21), start, ende)).toBe(true);
    expect(tagImZeitraum(new Date(2026, 9, 23), start, ende)).toBe(true);
  });

  it("trifft Tage dazwischen", () => {
    expect(tagImZeitraum(new Date(2026, 9, 22), start, ende)).toBe(true);
  });

  it("schließt Tage davor und danach aus", () => {
    expect(tagImZeitraum(new Date(2026, 9, 20), start, ende)).toBe(false);
    expect(tagImZeitraum(new Date(2026, 9, 24), start, ende)).toBe(false);
  });

  it("ignoriert Uhrzeiten", () => {
    // Ein Event, das um 18 Uhr endet, läuft an diesem Tag trotzdem.
    const spaet = new Date(2026, 9, 23, 18, 30);
    expect(tagImZeitraum(new Date(2026, 9, 23, 6, 0), start, spaet)).toBe(true);
  });
});

describe("Monatswechsel", () => {
  it("springt über die Jahresgrenze", () => {
    expect(verschiebeMonat(2026, 11, 1)).toEqual({ jahr: 2027, monat: 0 });
    expect(verschiebeMonat(2026, 0, -1)).toEqual({ jahr: 2025, monat: 11 });
  });

  it("liest und schreibt den Monatsparameter", () => {
    expect(monatParam(2026, 9)).toBe("2026-10");
    expect(parseMonatParam("2026-10", new Date(2026, 0, 1))).toEqual({ jahr: 2026, monat: 9 });
  });

  it("fällt bei Unsinn auf den heutigen Monat zurück", () => {
    const heute = new Date(2026, 7, 24);
    for (const unsinn of [undefined, "", "quatsch", "2026-13", "2026-00", "99999-01"]) {
      expect(parseMonatParam(unsinn, heute)).toEqual({ jahr: 2026, monat: 7 });
    }
  });
});
