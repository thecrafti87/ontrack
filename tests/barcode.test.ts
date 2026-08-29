import { describe, expect, it } from "vitest";
import {
  codeErklaerung,
  istHausinternerCode,
  leseBarcode,
  pruefzifferStimmt,
} from "@/lib/barcode";

/**
 * Der Fehler, der wehtut: einen Produktcode für eine Gerätekennung zu halten.
 *
 * Acht baugleiche Scheinwerfer tragen denselben EAN. Wer ihn als Seriennummer
 * speichert, findet beim nächsten Scan acht Geräte und weiß nicht, welches vor
 * ihm steht — und hat die Unterscheidung dauerhaft verloren, weil die echten
 * Seriennummern nie erfasst wurden.
 */

describe("Prüfziffer", () => {
  it("erkennt gültige EAN-13", () => {
    // Reale, öffentlich dokumentierte Beispielcodes.
    expect(pruefzifferStimmt("4006381333931")).toBe(true);
    expect(pruefzifferStimmt("5901234123457")).toBe(true);
  });

  it("erkennt gültige EAN-8 und UPC-12", () => {
    expect(pruefzifferStimmt("96385074")).toBe(true);
    expect(pruefzifferStimmt("036000291452")).toBe(true);
  });

  it("weist eine falsche Prüfziffer zurück", () => {
    expect(pruefzifferStimmt("4006381333932")).toBe(false);
    expect(pruefzifferStimmt("5901234123450")).toBe(false);
  });

  it("weist Längen zurück, die es nicht gibt", () => {
    // Genau das trennt Produktcode von Seriennummer.
    expect(pruefzifferStimmt("12345")).toBe(false);
    expect(pruefzifferStimmt("1234567890")).toBe(false);
    expect(pruefzifferStimmt("")).toBe(false);
  });

  it("weist Buchstaben zurück", () => {
    expect(pruefzifferStimmt("400638133393X")).toBe(false);
  });
});

describe("Einordnung eines gescannten Codes", () => {
  it("erkennt das eigene Etikett an der Adresse", () => {
    const c = leseBarcode("https://ontrack.example/d/OT-0042");
    expect(c.art).toBe("adresse");
    expect(c.seriennummer).toBe("OT-0042");
  });

  it("erkennt einen Produktcode an der Prüfziffer", () => {
    const c = leseBarcode("4006381333931");
    expect(c.art).toBe("produktcode");
    expect(c.produktcode).toBe("4006381333931");
    // Ein Produktcode ist KEINE Gerätekennung — das Feld bleibt leer.
    expect(c.seriennummer).toBeNull();
  });

  it("verträgt Leerzeichen und Bindestriche im Produktcode", () => {
    expect(leseBarcode(" 400-6381-333931 ").produktcode).toBe("4006381333931");
  });

  it("liest eine GS1-Kette in ihre beiden Teile", () => {
    // Der einzige Fall, in dem beides sauber ausgezeichnet ist.
    const c = leseBarcode("(01)04006381333931(21)MP-2024-0815");
    expect(c.art).toBe("gs1");
    expect(c.produktcode).toBe("04006381333931");
    expect(c.seriennummer).toBe("MP-2024-0815");
  });

  it("kommt mit einer GS1-Kette ohne Seriennummer zurecht", () => {
    const c = leseBarcode("(01)04006381333931");
    expect(c.produktcode).toBe("04006381333931");
    expect(c.seriennummer).toBeNull();
  });

  it("hält alles Übrige für eine Seriennummer", () => {
    const c = leseBarcode("MP-2024-0815");
    expect(c.art).toBe("seriennummer");
    expect(c.seriennummer).toBe("MP-2024-0815");
    expect(c.produktcode).toBeNull();
  });

  it("nimmt im Zweifel die Seriennummer an, nicht den Produktcode", () => {
    // Dreizehn Ziffern mit falscher Prüfziffer sind kein Produktcode. Die
    // harmlosere Verwechslung gewinnt: Eine Seriennummer betrifft nur dieses
    // eine Gerät, ein falscher Produktcode verdirbt die ganze Bauart.
    const c = leseBarcode("1234567890123");
    expect(c.art).toBe("seriennummer");
    expect(c.seriennummer).toBe("1234567890123");
  });

  it("kommt mit leerem Text zurecht", () => {
    const c = leseBarcode("   ");
    expect(c.art).toBe("seriennummer");
    expect(c.seriennummer).toBeNull();
  });
});

describe("Hausinterne Codes", () => {
  it("erkennt den für Eigenetiketten reservierten Bereich", () => {
    // GS1 vergibt 02 und 20–29 nie an Hersteller.
    expect(istHausinternerCode("2000010000128")).toBe(true);
    expect(istHausinternerCode("0212345678909")).toBe(true);
  });

  it("hält einen Herstellercode nicht dafür", () => {
    expect(istHausinternerCode("4006381333931")).toBe(false);
  });
});

describe("Erklärung für den Bediener", () => {
  it("sagt bei einem Produktcode, dass er die Bauart meint", () => {
    expect(codeErklaerung(leseBarcode("4006381333931"))).toContain("Bauart");
  });

  it("sagt bei einer Seriennummer, dass sie dieses eine Gerät meint", () => {
    expect(codeErklaerung(leseBarcode("MP-2024-0815"))).toContain("dieses einen Geräts");
  });

  it("weist auf den hausinternen Bereich hin", () => {
    expect(codeErklaerung(leseBarcode("2000010000128"))).toContain("hausinternen");
  });
});
