import { describe, expect, it } from "vitest";
import { berechneDelta, bestandStatus, pruefeBewegung } from "@/lib/bulk";

describe("Wirkung einer Bewegung auf den Bestand", () => {
  it("zieht bei einer Entnahme ab", () => {
    expect(berechneDelta("ENTNAHME", 20, 100)).toBe(-20);
  });

  it("addiert bei Rückgabe und Zugang", () => {
    expect(berechneDelta("RUECKGABE", 15, 80)).toBe(15);
    expect(berechneDelta("ZUGANG", 50, 80)).toBe(50);
  });

  it("versteht eine Korrektur als Zielbestand, nicht als Zugang", () => {
    // Die naheliegendste Fehlbedienung: Wer nach der Inventur "173" eingibt
    // und damit 173 dazubekommt, hat den Bestand verdoppelt.
    expect(berechneDelta("KORREKTUR", 173, 200)).toBe(-27);
    expect(berechneDelta("KORREKTUR", 173, 100)).toBe(73);
    expect(berechneDelta("KORREKTUR", 100, 100)).toBe(0);
  });
});

describe("Prüfung vor dem Buchen", () => {
  it("lässt eine gültige Entnahme durch", () => {
    const r = pruefeBewegung("ENTNAHME", 20, 100);
    expect(r).toEqual({ ok: true, delta: -20 });
  });

  it("verhindert eine Entnahme über den Bestand hinaus", () => {
    const r = pruefeBewegung("ENTNAHME", 120, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler).toContain("nur 100");
  });

  it("erlaubt die Entnahme des kompletten Bestands", () => {
    expect(pruefeBewegung("ENTNAHME", 100, 100)).toEqual({ ok: true, delta: -100 });
  });

  it("weist Nachkommastellen ab", () => {
    // Halbe Schellen gibt es nicht.
    expect(pruefeBewegung("ENTNAHME", 2.5, 100).ok).toBe(false);
  });

  it("weist negative Mengen ab", () => {
    expect(pruefeBewegung("ENTNAHME", -5, 100).ok).toBe(false);
  });

  it("weist die Menge 0 ab — außer bei einer Korrektur", () => {
    expect(pruefeBewegung("ENTNAHME", 0, 100).ok).toBe(false);
    // "Es sind tatsächlich 0 da" ist eine gültige Inventuraussage.
    expect(pruefeBewegung("KORREKTUR", 0, 100)).toEqual({ ok: true, delta: -100 });
  });

  it("lässt eine Korrektur nach oben zu", () => {
    expect(pruefeBewegung("KORREKTUR", 250, 200)).toEqual({ ok: true, delta: 50 });
  });
});

describe("Bestands-Ampel", () => {
  it("meldet leer bei 0 oder weniger", () => {
    expect(bestandStatus(0, 10)).toBe("leer");
    expect(bestandStatus(-1, null)).toBe("leer");
  });

  it("meldet knapp ab der Warnschwelle", () => {
    expect(bestandStatus(10, 10)).toBe("knapp");
    expect(bestandStatus(5, 10)).toBe("knapp");
    expect(bestandStatus(11, 10)).toBe("ausreichend");
  });

  it("warnt ohne Schwelle nur bei leer", () => {
    expect(bestandStatus(1, null)).toBe("ausreichend");
    expect(bestandStatus(0, null)).toBe("leer");
  });
});
