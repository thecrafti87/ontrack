import { describe, expect, it } from "vitest";
import { MAX_SERIE, buildSeries } from "@/lib/series";

function nummern(start: string, anzahl: number): string[] {
  const r = buildSeries(start, anzahl);
  if (!r.ok) throw new Error(r.fehler);
  return r.nummern;
}

describe("Fortlaufende Inventarnummern", () => {
  it("zählt die letzte Ziffernfolge weiter", () => {
    expect(nummern("OT-0007", 3)).toEqual(["OT-0007", "OT-0008", "OT-0009"]);
  });

  it("behält die Stellenzahl bei", () => {
    // Sonst folgt auf OT-0007 ein OT-8, und die Sortierung der Liste bricht.
    expect(nummern("OT-0001", 2)).toEqual(["OT-0001", "OT-0002"]);
    expect(nummern("A-005", 2)).toEqual(["A-005", "A-006"]);
  });

  it("trägt den Zehnerübergang korrekt", () => {
    expect(nummern("OT-0009", 2)).toEqual(["OT-0009", "OT-0010"]);
    expect(nummern("OT-0099", 2)).toEqual(["OT-0099", "OT-0100"]);
  });

  it("schneidet nichts ab, wenn die Reihe über die Stellenzahl hinauswächst", () => {
    expect(nummern("OT-098", 3)).toEqual(["OT-098", "OT-099", "OT-100"]);
    expect(nummern("X-9", 2)).toEqual(["X-9", "X-10"]);
  });

  it("zählt die LETZTE Ziffernfolge, nicht die erste", () => {
    // "LX2-014" hat zwei Ziffernfolgen — gemeint ist die hintere.
    expect(nummern("LX2-014", 2)).toEqual(["LX2-014", "LX2-015"]);
  });

  it("behält ein Suffix hinter der Zahl", () => {
    expect(nummern("OT-007-A", 2)).toEqual(["OT-007-A", "OT-008-A"]);
  });

  it("kommt mit einer reinen Zahl zurecht", () => {
    expect(nummern("100", 3)).toEqual(["100", "101", "102"]);
  });

  it("liefert bei Stückzahl 1 genau die Startnummer", () => {
    expect(nummern("OT-0042", 1)).toEqual(["OT-0042"]);
  });

  it("entfernt Leerraum um die Startnummer", () => {
    expect(nummern("  OT-0001  ", 1)).toEqual(["OT-0001"]);
  });
});

describe("Abweisungen", () => {
  it("verlangt eine Startnummer", () => {
    const r = buildSeries("   ", 3);
    expect(r.ok).toBe(false);
  });

  it("verlangt eine Ziffernfolge zum Weiterzählen", () => {
    const r = buildSeries("NUR-TEXT", 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler).toContain("Ziffernfolge");
  });

  it("weist unsinnige Stückzahlen ab", () => {
    expect(buildSeries("OT-0001", 0).ok).toBe(false);
    expect(buildSeries("OT-0001", -5).ok).toBe(false);
    expect(buildSeries("OT-0001", 1.5).ok).toBe(false);
  });

  it("begrenzt die Serienlänge", () => {
    expect(buildSeries("OT-0001", MAX_SERIE).ok).toBe(true);
    expect(buildSeries("OT-0001", MAX_SERIE + 1).ok).toBe(false);
  });
});
