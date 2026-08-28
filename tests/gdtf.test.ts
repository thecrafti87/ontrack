// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findeGdtfDatei, kanaeleAusGdtf, leseGdtfModi } from "@/lib/mvr/parseGdtf";

/**
 * Der Fußabdruck eines Modus entscheidet, ob die Konfliktprüfung eine
 * Überlappung findet. Zu klein gerechnet, meldet sie zu spät; zu groß
 * gerechnet, erfindet sie Konflikte. Beides ist teurer als ein ehrliches
 * „unbekannt“, deshalb prüfen diese Tests vor allem, wann NICHTS geliefert wird.
 */

function gdtf(modi: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.2">
  <FixtureType Name="Testgerät" ShortName="TEST">
    <DMXModes>${modi}</DMXModes>
  </FixtureType>
</GDTF>`;
}

const EINFACH = gdtf(`
  <DMXMode Name="Standard">
    <DMXChannels>
      <DMXChannel DMXBreak="1" Offset="1" />
      <DMXChannel DMXBreak="1" Offset="2" />
      <DMXChannel DMXBreak="1" Offset="3" />
    </DMXChannels>
  </DMXMode>`);

describe("Fußabdruck eines Modus", () => {
  it("ist der höchste Offset, nicht die Zahl der Kanäle", () => {
    // Pan 16 Bit belegt zwei Bytes: drei Elemente, aber vier Kanäle.
    const xml = gdtf(`
      <DMXMode Name="Standard">
        <DMXChannels>
          <DMXChannel DMXBreak="1" Offset="1,3" />
          <DMXChannel DMXBreak="1" Offset="2,4" />
        </DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Standard")).toBe(4);
  });

  it("zählt virtuelle Kanäle nicht mit", () => {
    // Offset="None" belegt kein DMX — mitgezählt würde der Bereich zu groß.
    const xml = gdtf(`
      <DMXMode Name="Standard">
        <DMXChannels>
          <DMXChannel DMXBreak="1" Offset="1" />
          <DMXChannel DMXBreak="1" Offset="None" />
          <DMXChannel DMXBreak="1" Offset="2" />
        </DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Standard")).toBe(2);
  });

  it("nimmt Break 1 an, wo keiner angegeben ist", () => {
    const xml = gdtf(`
      <DMXMode Name="Standard">
        <DMXChannels>
          <DMXChannel Offset="1" />
          <DMXChannel Offset="8" />
        </DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Standard")).toBe(8);
  });

  it("liest den richtigen von mehreren Modi", () => {
    const xml = gdtf(`
      <DMXMode Name="Basic">
        <DMXChannels><DMXChannel Offset="1" /><DMXChannel Offset="8" /></DMXChannels>
      </DMXMode>
      <DMXMode Name="Extended">
        <DMXChannels><DMXChannel Offset="1" /><DMXChannel Offset="32" /></DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Extended")).toBe(32);
    expect(kanaeleAusGdtf(xml, "Basic")).toBe(8);
  });

  it("verzeiht Schreibweise und Leerzeichen im Modusnamen", () => {
    expect(kanaeleAusGdtf(EINFACH, "  standard ")).toBe(3);
  });
});

describe("Wann nichts geliefert wird", () => {
  it("bei einem Modus, den die Gerätedatei nicht kennt", () => {
    // Ersatzweise den ersten Modus zu nehmen wäre geraten — und ein falscher
    // Fußabdruck erfindet Konflikte.
    const xml = gdtf(`
      <DMXMode Name="Basic">
        <DMXChannels><DMXChannel Offset="1" /><DMXChannel Offset="8" /></DMXChannels>
      </DMXMode>
      <DMXMode Name="Extended">
        <DMXChannels><DMXChannel Offset="1" /><DMXChannel Offset="32" /></DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Vollmodus")).toBeNull();
  });

  it("bei fehlendem Modusnamen und mehreren Modi", () => {
    const xml = gdtf(`
      <DMXMode Name="Basic"><DMXChannels><DMXChannel Offset="8" /></DMXChannels></DMXMode>
      <DMXMode Name="Extended"><DMXChannels><DMXChannel Offset="32" /></DMXChannels></DMXMode>`);
    expect(kanaeleAusGdtf(xml, null)).toBeNull();
  });

  it("aber sehr wohl, wenn es nur einen Modus gibt", () => {
    // Dann ist nichts zu verwechseln.
    expect(kanaeleAusGdtf(EINFACH, null)).toBe(3);
  });

  it("bei mehreren Breaks", () => {
    // Welche Adresse zu welchem Break gehört, steht in der Szene nicht — ohne
    // das wäre jeder Bereich geraten.
    const xml = gdtf(`
      <DMXMode Name="Standard">
        <DMXChannels>
          <DMXChannel DMXBreak="1" Offset="1" />
          <DMXChannel DMXBreak="2" Offset="1" />
        </DMXChannels>
      </DMXMode>`);
    expect(kanaeleAusGdtf(xml, "Standard")).toBeNull();
  });

  it("bei einem Modus ganz ohne belegte Kanäle", () => {
    expect(kanaeleAusGdtf(gdtf(`<DMXMode Name="Leer"><DMXChannels /></DMXMode>`), "Leer")).toBeNull();
  });

  it("bei einer Datei ohne DMXModes", () => {
    const xml = `<?xml version="1.0"?><GDTF><FixtureType Name="X" /></GDTF>`;
    expect(kanaeleAusGdtf(xml, "Standard")).toBeNull();
  });

  it("bei kaputtem XML — mit einer Meldung, nicht mit einer Zahl", () => {
    expect(() => leseGdtfModi("<GDTF><FixtureType")).toThrow(/nicht lesbar/);
  });
});

describe("Die GDTF-Datei im Archiv finden", () => {
  const eintraege = [
    "GeneralSceneDescription.xml",
    "Robe@Robin_600_LEDWash@2023.gdtf",
    "Martin@MAC_Aura@v1.gdtf",
    "thumbnail.png",
  ];

  it("findet den wörtlichen Treffer", () => {
    expect(findeGdtfDatei(eintraege, "Martin@MAC_Aura@v1.gdtf")).toBe("Martin@MAC_Aura@v1.gdtf");
  });

  it("ergänzt eine fehlende Endung", () => {
    // Manche Exporte schreiben den Spec-Namen ohne „.gdtf“.
    expect(findeGdtfDatei(eintraege, "Martin@MAC_Aura@v1")).toBe("Martin@MAC_Aura@v1.gdtf");
  });

  it("verzeiht die Schreibweise", () => {
    expect(findeGdtfDatei(eintraege, "martin@mac_aura@v1.GDTF")).toBe("Martin@MAC_Aura@v1.gdtf");
  });

  it("findet die Datei auch in einem Unterordner", () => {
    expect(findeGdtfDatei(["fixtures/Martin@MAC_Aura@v1.gdtf"], "Martin@MAC_Aura@v1.gdtf")).toBe(
      "fixtures/Martin@MAC_Aura@v1.gdtf"
    );
  });

  it("greift nicht daneben, wenn nichts passt", () => {
    expect(findeGdtfDatei(eintraege, "Clay Paky Sharpy")).toBeNull();
    expect(findeGdtfDatei(eintraege, null)).toBeNull();
    expect(findeGdtfDatei(eintraege, "  ")).toBeNull();
  });
});
