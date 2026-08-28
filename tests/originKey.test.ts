import { describe, expect, it } from "vitest";
import { leseHerkunft } from "@/lib/originKey";

/**
 * Diese Auswertung entscheidet, ob eine Bremse „je Besucher" oder „für alle
 * zusammen" wirkt. Der Unterschied fällt erst auf, wenn niemand mehr
 * hereinkommt — deshalb ist der Fall ohne Header hier genauso festgehalten wie
 * der Normalfall.
 */

describe("Herkunft aus den Kopfzeilen", () => {
  it("nimmt X-Forwarded-For", () => {
    expect(leseHerkunft("203.0.113.7", null)).toEqual({
      key: "203.0.113.7",
      quelle: "x-forwarded-for",
    });
  });

  it("nimmt bei einer Proxy-Kette den ursprünglichen Absender", () => {
    // Vorne steht der Client, dahinter die Proxys. Nähme man den letzten,
    // zählte man den eigenen Reverse Proxy und bremste alle gemeinsam.
    expect(leseHerkunft("203.0.113.7, 10.0.0.1, 10.0.0.2", null).key).toBe("203.0.113.7");
  });

  it("verträgt Leerzeichen in der Kette", () => {
    expect(leseHerkunft("  203.0.113.7 ,10.0.0.1", null).key).toBe("203.0.113.7");
  });

  it("weicht auf X-Real-IP aus", () => {
    expect(leseHerkunft(null, "198.51.100.4")).toEqual({
      key: "198.51.100.4",
      quelle: "x-real-ip",
    });
    expect(leseHerkunft("", "198.51.100.4").quelle).toBe("x-real-ip");
  });

  it("meldet es, wenn beides fehlt", () => {
    // Der gefährliche Fall: Alle Besucher landen unter einem Schlüssel, und
    // aus der Bremse je Adresse wird eine für die ganze Instanz. Deshalb wird
    // die Quelle „unbekannt" mitgegeben, statt sie zu verschlucken.
    expect(leseHerkunft(null, null)).toEqual({ key: "lokal", quelle: "unbekannt" });
    expect(leseHerkunft("   ", "  ")).toEqual({ key: "lokal", quelle: "unbekannt" });
  });
});
