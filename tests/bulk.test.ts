import { describe, expect, it } from "vitest";
import {
  berechneDelta,
  bestandStatus,
  einsatzBilanz,
  einsatzStatus,
  pruefeBewegung,
  vorschlagsMenge,
} from "@/lib/bulk";

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

describe("Mengenartikel auf der Packliste", () => {
  const ENTNAHME = (menge: number) => ({ delta: -menge, reason: "ENTNAHME" });
  const RUECKGABE = (menge: number) => ({ delta: menge, reason: "RUECKGABE" });

  it("zählt nichts, solange nichts gebucht wurde", () => {
    expect(einsatzBilanz([])).toEqual({ mitgenommen: 0, zurueck: 0, offen: 0 });
  });

  it("summiert mehrere Entnahmen", () => {
    // Beim Verladen wird selten alles auf einmal gebucht.
    expect(einsatzBilanz([ENTNAHME(20), ENTNAHME(20)]).mitgenommen).toBe(40);
  });

  it("rechnet Teilrückgaben gegen", () => {
    const bilanz = einsatzBilanz([ENTNAHME(40), RUECKGABE(25), RUECKGABE(7)]);
    expect(bilanz).toEqual({ mitgenommen: 40, zurueck: 32, offen: 8 });
  });

  it("ignoriert Bewegungen, die nichts mit dem Einsatz zu tun haben", () => {
    // Ein Zugang aus einer Neubeschaffung oder eine Inventurkorrektur darf
    // nicht als „mitgenommen" durchgehen.
    const bilanz = einsatzBilanz([
      ENTNAHME(10),
      { delta: 50, reason: "ZUGANG" },
      { delta: -3, reason: "KORREKTUR" },
    ]);
    expect(bilanz).toEqual({ mitgenommen: 10, zurueck: 0, offen: 10 });
  });

  it("meldet den Fehlbestand als offene Menge", () => {
    // Nach dem Abbau ist genau das die Zahl, die zählt.
    expect(einsatzBilanz([ENTNAHME(40), RUECKGABE(38)]).offen).toBe(2);
  });
});

describe("Status eines Mengenartikels im Einsatz", () => {
  it("ist offen, bevor etwas mitgenommen wurde", () => {
    expect(einsatzStatus({ mitgenommen: 0, zurueck: 0, offen: 0 })).toBe("offen");
  });

  it("ist unterwegs, solange etwas draußen ist", () => {
    expect(einsatzStatus({ mitgenommen: 40, zurueck: 10, offen: 30 })).toBe("unterwegs");
  });

  it("ist vollständig, wenn alles zurück ist", () => {
    expect(einsatzStatus({ mitgenommen: 40, zurueck: 40, offen: 0 })).toBe("vollstaendig");
  });
});

describe("Vorbelegte Menge im Einsatzmodus", () => {
  const NICHTS = { mitgenommen: 0, zurueck: 0, offen: 0 };

  it("schlägt beim Packen die fehlende Menge vor", () => {
    expect(vorschlagsMenge("GEPACKT", 40, NICHTS)).toBe(40);
    expect(vorschlagsMenge("GEPACKT", 40, { mitgenommen: 30, zurueck: 0, offen: 30 })).toBe(10);
  });

  it("schlägt beim Zurückräumen vor, was noch draußen ist", () => {
    expect(vorschlagsMenge("ZURUECK", 40, { mitgenommen: 40, zurueck: 15, offen: 25 })).toBe(25);
  });

  it("wird nie negativ, wenn mehr mitgenommen wurde als geplant", () => {
    // Sonst stünde da eine Aufforderung, Kabel ins Lager zurückzulegen, die
    // nie herausgegeben wurden.
    expect(vorschlagsMenge("GEPACKT", 40, { mitgenommen: 45, zurueck: 0, offen: 45 })).toBe(0);
  });

  it("schlägt beim Auf- und Abbau nichts vor", () => {
    // In diesen Phasen ändert sich an der Menge nichts.
    expect(vorschlagsMenge("AUFGEBAUT", 40, NICHTS)).toBe(0);
    expect(vorschlagsMenge("ABGEBAUT", 40, NICHTS)).toBe(0);
  });
});
