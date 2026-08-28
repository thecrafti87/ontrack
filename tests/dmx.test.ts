import { describe, expect, it } from "vitest";
import {
  absoluteAdresse,
  belegungenAus,
  findeBelegung,
  findeKonflikte,
  formatAdresse,
  kanaeleAusModus,
  letzterKanal,
  parseAdresse,
  parseAdressliste,
  ungeprueft,
  type Belegung,
  type FixtureRohdaten,
} from "@/lib/dmx";

/**
 * Zwei Fehler wären hier teuer:
 *
 * - Ein **erfundener** Konflikt schickt jemanden auf den Hubsteiger, um
 *   nachzusehen, was gar nicht kaputt ist.
 * - Ein **übersehener** Konflikt fällt in der Show auf.
 *
 * Deshalb wird lieber eine Lücke gemeldet als geraten.
 */

function belegung(teil: Partial<Belegung> & { kanal: number }): Belegung {
  return {
    id: teil.id ?? `f-${teil.kanal}`,
    name: teil.name ?? `Fixture ${teil.kanal}`,
    geraeteId: teil.geraeteId ?? null,
    inventarnummer: teil.inventarnummer ?? null,
    ort: teil.ort ?? null,
    adresse: teil.adresse ?? { universum: 1, kanal: teil.kanal },
    kanaele: teil.kanaele ?? null,
    kanalQuelle: teil.kanaele != null ? "modus" : "unbekannt",
  };
}

describe("Adressen lesen", () => {
  it("versteht die Schreibweise vom Pult", () => {
    expect(parseAdresse("2.145")).toEqual({ universum: 2, kanal: 145 });
    expect(parseAdresse("2/145")).toEqual({ universum: 2, kanal: 145 });
    expect(parseAdresse("2:145")).toEqual({ universum: 2, kanal: 145 });
    expect(parseAdresse("U2.145")).toEqual({ universum: 2, kanal: 145 });
  });

  it("nimmt eine blanke Zahl als Kanal im ersten Universum", () => {
    // So tippt es jeder, der nur ein Universum fährt.
    expect(parseAdresse("145")).toEqual({ universum: 1, kanal: 145 });
    expect(parseAdresse("512")).toEqual({ universum: 1, kanal: 512 });
  });

  it("liest eine Zahl über 512 als absolute Adresse", () => {
    // Kanal 657 gibt es nicht — das kann nur absolut gemeint sein.
    expect(parseAdresse("513")).toEqual({ universum: 2, kanal: 1 });
    expect(parseAdresse("657")).toEqual({ universum: 2, kanal: 145 });
  });

  it("weist Unsinn zurück, statt etwas zu erfinden", () => {
    expect(parseAdresse("")).toBeNull();
    expect(parseAdresse("   ")).toBeNull();
    expect(parseAdresse("abc")).toBeNull();
    expect(parseAdresse("0")).toBeNull();
    expect(parseAdresse("1.0")).toBeNull();
    expect(parseAdresse("1.513")).toBeNull();
    expect(parseAdresse("0.100")).toBeNull();
  });

  it("verträgt Leerzeichen", () => {
    expect(parseAdresse("  2 . 145 ")).toEqual({ universum: 2, kanal: 145 });
  });

  it("liest das gespeicherte Feld mit mehreren Breaks", () => {
    expect(parseAdressliste("1.1, 2.145")).toEqual([
      { universum: 1, kanal: 1 },
      { universum: 2, kanal: 145 },
    ]);
  });

  it("überspringt kaputte Teile, statt die ganze Liste zu verwerfen", () => {
    expect(parseAdressliste("1.1, quatsch, 2.5")).toHaveLength(2);
  });

  it("kommt mit leerem Feld zurecht", () => {
    expect(parseAdressliste(null)).toEqual([]);
    expect(parseAdressliste("")).toEqual([]);
  });

  it("schreibt zurück, wie man es liest", () => {
    expect(formatAdresse({ universum: 2, kanal: 145 })).toBe("2.145");
  });

  it("rechnet absolut für den Vergleich", () => {
    expect(absoluteAdresse({ universum: 1, kanal: 1 })).toBe(1);
    expect(absoluteAdresse({ universum: 2, kanal: 1 })).toBe(513);
  });
});

describe("Kanalzahl aus dem Modusnamen", () => {
  it("liest die üblichen Schreibweisen", () => {
    expect(kanaeleAusModus("32ch")).toBe(32);
    expect(kanaeleAusModus("Standard 16 Channel")).toBe(16);
    expect(kanaeleAusModus("Extended_24Ch")).toBe(24);
    expect(kanaeleAusModus("Basic 8 Kanal")).toBe(8);
  });

  it("nimmt KEINE nackte Zahl ohne Kanal-Hinweis", () => {
    // „Mode 2" ist der zweite Modus, kein Zweikanäler. Diese Verwechslung
    // würde Konflikte erfinden, die es nicht gibt.
    expect(kanaeleAusModus("Mode 2")).toBeNull();
    expect(kanaeleAusModus("Standard")).toBeNull();
    expect(kanaeleAusModus("2")).toBeNull();
  });

  it("verwirft unmögliche Werte", () => {
    expect(kanaeleAusModus("999ch")).toBeNull();
    expect(kanaeleAusModus("0ch")).toBeNull();
    expect(kanaeleAusModus(null)).toBeNull();
  });
});

describe("Gleiche Startadresse", () => {
  it("wird auch ohne bekannte Kanalzahl gefunden", () => {
    // Der eine Fall, der immer sicher ist.
    const konflikte = findeKonflikte([
      belegung({ kanal: 100, id: "a" }),
      belegung({ kanal: 100, id: "b" }),
    ]);
    expect(konflikte).toHaveLength(1);
    expect(konflikte[0]!.art).toBe("gleiche_adresse");
    expect(konflikte[0]!.beteiligte).toHaveLength(2);
  });

  it("fasst drei Geräte auf derselben Adresse zu einem Befund zusammen", () => {
    // Drei Einzelmeldungen für denselben Sachverhalt wären Lärm.
    const konflikte = findeKonflikte([
      belegung({ kanal: 50, id: "a" }),
      belegung({ kanal: 50, id: "b" }),
      belegung({ kanal: 50, id: "c" }),
    ]);
    expect(konflikte).toHaveLength(1);
    expect(konflikte[0]!.beteiligte).toHaveLength(3);
  });

  it("trennt nach Universum", () => {
    // Kanal 100 in Universum 1 und 2 stört sich nicht.
    const konflikte = findeKonflikte([
      belegung({ kanal: 100, adresse: { universum: 1, kanal: 100 } }),
      belegung({ kanal: 100, id: "b", adresse: { universum: 2, kanal: 100 } }),
    ]);
    expect(konflikte).toEqual([]);
  });
});

describe("Überlappung", () => {
  it("erkennt ein Gerät, das in das nächste hineinreicht", () => {
    // 1 bis 32, das nächste beginnt bei 20.
    const konflikte = findeKonflikte([
      belegung({ kanal: 1, kanaele: 32, id: "a" }),
      belegung({ kanal: 20, kanaele: 16, id: "b" }),
    ]);
    const ueber = konflikte.filter((k) => k.art === "ueberlappung");
    expect(ueber).toHaveLength(1);
    expect(ueber[0]).toMatchObject({ von: 20, bis: 32 });
  });

  it("meldet nichts, wenn die Bereiche sich gerade berühren", () => {
    // 1 bis 16, das nächste ab 17 — genau richtig gepatcht.
    expect(findeKonflikte([
      belegung({ kanal: 1, kanaele: 16, id: "a" }),
      belegung({ kanal: 17, kanaele: 16, id: "b" }),
    ])).toEqual([]);
  });

  it("schweigt, wenn eine Kanalzahl fehlt", () => {
    // Lieber eine Lücke melden als eine Überlappung erfinden.
    expect(findeKonflikte([
      belegung({ kanal: 1, kanaele: 32, id: "a" }),
      belegung({ kanal: 20, id: "b" }),
    ])).toEqual([]);
  });

  it("findet auch die dritte Überschneidung in einer Kette", () => {
    const konflikte = findeKonflikte([
      belegung({ kanal: 1, kanaele: 40, id: "a" }),
      belegung({ kanal: 10, kanaele: 8, id: "b" }),
      belegung({ kanal: 30, kanaele: 8, id: "c" }),
    ]);
    expect(konflikte.filter((k) => k.art === "ueberlappung")).toHaveLength(2);
  });
});

describe("Überlauf über das Universum", () => {
  it("meldet ein Gerät, das über Kanal 512 hinausreicht", () => {
    const konflikte = findeKonflikte([belegung({ kanal: 500, kanaele: 32, id: "a" })]);
    expect(konflikte).toHaveLength(1);
    expect(konflikte[0]).toMatchObject({ art: "ueberlauf", bis: 531 });
  });

  it("lässt ein Gerät in Ruhe, das genau auf 512 endet", () => {
    expect(findeKonflikte([belegung({ kanal: 497, kanaele: 16, id: "a" })])).toEqual([]);
  });
});

describe("Was sich nicht prüfen lässt", () => {
  it("wird gezählt, damit „keine Konflikte“ nicht in die Irre führt", () => {
    const belegungen = [
      belegung({ kanal: 1, kanaele: 16 }),
      belegung({ kanal: 40, id: "b" }),
      belegung({ kanal: 80, id: "c" }),
    ];
    expect(ungeprueft(belegungen)).toBe(2);
  });

  it("rechnet den letzten Kanal nur bei bekannter Kanalzahl", () => {
    expect(letzterKanal(belegung({ kanal: 10, kanaele: 4 }))).toBe(13);
    expect(letzterKanal(belegung({ kanal: 10 }))).toBeNull();
  });
});

describe("Aus Fixtures Belegungen machen", () => {
  const roh = (teil: Partial<FixtureRohdaten>): FixtureRohdaten => ({
    id: "f1",
    name: "Robin 600",
    dmxAddresses: "1.1",
    gdtfMode: null,
    layerName: null,
    actualPosition: null,
    device: null,
    ...teil,
  });

  it("macht aus jedem Break eine eigene Belegung", () => {
    // Zwei Breaks können unabhängig voneinander kollidieren.
    const belegungen = belegungenAus([roh({ dmxAddresses: "1.1, 2.145" })]);
    expect(belegungen).toHaveLength(2);
    expect(belegungen.map((b) => formatAdresse(b.adresse))).toEqual(["1.1", "2.145"]);
  });

  it("zieht die Kanalzahl aus der GDTF-Datei der aus dem Modusnamen vor", () => {
    // Gemessen schlägt geraten.
    const [b] = belegungenAus([roh({ gdtfMode: "Standard 16ch", gdtfChannels: 32 })]);
    expect(b!.kanaele).toBe(32);
    expect(b!.kanalQuelle).toBe("gdtf");
  });

  it("fällt auf den Modusnamen zurück, wenn keine Datei gelesen wurde", () => {
    const [b] = belegungenAus([roh({ gdtfMode: "Standard 16ch" })]);
    expect(b!.kanaele).toBe(16);
    expect(b!.kanalQuelle).toBe("modus");
  });

  it("sagt „unbekannt“, statt sich etwas auszudenken", () => {
    const [b] = belegungenAus([roh({ gdtfMode: "Mode 2" })]);
    expect(b!.kanaele).toBeNull();
    expect(b!.kanalQuelle).toBe("unbekannt");
  });

  it("verwirft eine unmögliche Kanalzahl aus der Datei", () => {
    const [b] = belegungenAus([roh({ gdtfChannels: 0, gdtfMode: "Standard 8ch" })]);
    expect(b!.kanaele).toBe(8);
  });

  it("nennt den tatsächlichen Einbauort vor dem Layer aus der Zeichnung", () => {
    // Wer vor Ort sucht, will wissen wo es hängt — nicht wie es gezeichnet war.
    const [b] = belegungenAus([
      roh({ layerName: "Licht OG", actualPosition: "Traverse Nord, 3. von links" }),
    ]);
    expect(b!.ort).toBe("Traverse Nord, 3. von links");
  });

  it("nimmt den Layer, solange nichts Tatsächliches erfasst ist", () => {
    expect(belegungenAus([roh({ layerName: "Licht OG", actualPosition: "   " })])[0]!.ort).toBe(
      "Licht OG"
    );
  });

  it("übergeht ein Fixture ganz ohne Adresse", () => {
    expect(belegungenAus([roh({ dmxAddresses: null })])).toEqual([]);
  });

  it("reicht das zugeordnete Gerät durch, damit man von der Adresse dorthin kommt", () => {
    const [b] = belegungenAus([roh({ device: { id: "dev1", inventoryNo: "LI-0042" } })]);
    expect(b!.geraeteId).toBe("dev1");
    expect(b!.inventarnummer).toBe("LI-0042");
  });
});

describe("Wer sitzt auf dieser Adresse", () => {
  const belegungen: Belegung[] = [
    belegung({ kanal: 1, kanaele: 32, id: "a", name: "Wash 1" }),
    belegung({ kanal: 100, id: "b", name: "Blinder" }),
    belegung({ kanal: 100, id: "c", name: "Blinder 2" }),
    belegung({ kanal: 200, id: "d", name: "Anderes Universum", adresse: { universum: 2, kanal: 200 } }),
  ];

  it("findet die Startadresse", () => {
    const fund = findeBelegung(belegungen, { universum: 1, kanal: 100 });
    expect(fund.genau.map((b) => b.name)).toEqual(["Blinder", "Blinder 2"]);
    expect(fund.imBereich).toEqual([]);
  });

  it("findet auch das Gerät, das weiter vorne beginnt", () => {
    // Kanal 20 gehört zu „Wash 1", das bei 1 anfängt und 32 Kanäle hat.
    const fund = findeBelegung(belegungen, { universum: 1, kanal: 20 });
    expect(fund.genau).toEqual([]);
    expect(fund.imBereich.map((b) => b.name)).toEqual(["Wash 1"]);
  });

  it("greift nicht ins falsche Universum", () => {
    expect(findeBelegung(belegungen, { universum: 3, kanal: 100 })).toEqual({
      genau: [],
      imBereich: [],
    });
    expect(findeBelegung(belegungen, { universum: 2, kanal: 200 }).genau).toHaveLength(1);
  });

  it("meldet nichts, wo nichts ist", () => {
    expect(findeBelegung(belegungen, { universum: 1, kanal: 400 })).toEqual({
      genau: [],
      imBereich: [],
    });
  });
});

describe("Ein sauberer Plan", () => {
  it("meldet nichts", () => {
    const konflikte = findeKonflikte([
      belegung({ kanal: 1, kanaele: 16, id: "a" }),
      belegung({ kanal: 17, kanaele: 16, id: "b" }),
      belegung({ kanal: 33, kanaele: 16, id: "c" }),
      belegung({ kanal: 1, id: "d", adresse: { universum: 2, kanal: 1 }, kanaele: 32 }),
    ]);
    expect(konflikte).toEqual([]);
  });
});
