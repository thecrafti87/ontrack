import { describe, expect, it } from "vitest";
import { erstelleAbnahme, ortVon, type AbnahmeFixture } from "@/lib/abnahme";

/**
 * Dieses Dokument wird unterschrieben. Was es verschweigt, gilt hinterher als
 * in Ordnung — deshalb prüfen diese Tests vor allem, dass die Vorbehalte
 * vollständig und richtig gezählt sind.
 */

const HEUTE = new Date("2026-08-28T00:00:00Z");

function fixture(teil: Partial<AbnahmeFixture>): AbnahmeFixture {
  return {
    name: "Wash 1",
    fixtureId: "101",
    layerName: "Traverse vorn",
    dmxAddresses: "1.1",
    installStatus: "MONTIERT",
    actualPosition: null,
    device: { inventoryNo: "OT-0001", name: "Robe MegaPointe" },
    pruefungFaellig: null,
    ...teil,
  };
}

describe("Gruppierung", () => {
  it("trennt montiert, abweichend und offen", () => {
    const abnahme = erstelleAbnahme(
      [
        fixture({}),
        fixture({ installStatus: "ABWEICHEND", actualPosition: "Traverse hinten" }),
        fixture({ installStatus: "GEPLANT" }),
      ],
      HEUTE
    );
    expect(abnahme.zahlen).toEqual({ gesamt: 3, montiert: 1, abweichend: 1, offen: 1 });
    expect(abnahme.gruppen.map((g) => g.gruppe)).toEqual(["montiert", "abweichend", "offen"]);
  });

  it("lässt leere Gruppen weg", () => {
    // Eine Überschrift „Abweichend montiert" ohne Zeilen darunter irritiert nur.
    const abnahme = erstelleAbnahme([fixture({}), fixture({})], HEUTE);
    expect(abnahme.gruppen.map((g) => g.gruppe)).toEqual(["montiert"]);
  });

  it("behandelt einen unbekannten Status als offen", () => {
    // Lieber als „noch nicht montiert" führen, als still verschwinden lassen.
    expect(erstelleAbnahme([fixture({ installStatus: "IRGENDWAS" })], HEUTE).zahlen.offen).toBe(1);
  });
});

describe("Der genannte Ort", () => {
  it("ist der tatsächliche, wenn einer erfasst wurde", () => {
    expect(
      ortVon(fixture({ installStatus: "ABWEICHEND", actualPosition: "Traverse hinten, 2. v. r." }))
    ).toBe("Traverse hinten, 2. v. r.");
  });

  it("sonst der geplante Layer", () => {
    expect(ortVon(fixture({ actualPosition: "   " }))).toBe("Traverse vorn");
  });

  it("und sonst eine ehrliche Lücke", () => {
    expect(ortVon(fixture({ actualPosition: null, layerName: null }))).toBe("ohne Angabe");
  });
});

describe("Vorbehalte", () => {
  it("nennt nicht montierte Positionen", () => {
    const abnahme = erstelleAbnahme([fixture({}), fixture({ installStatus: "GEPLANT" })], HEUTE);
    expect(abnahme.vorbehalte).toHaveLength(1);
    expect(abnahme.vorbehalte[0]).toMatchObject({ art: "nicht_montiert", anzahl: 1 });
  });

  it("nennt montierte Positionen ohne zugeordnetes Gerät", () => {
    // Ein Abnahmeprotokoll, das nicht sagt, welches Gerät dort hängt, ist an
    // dieser Stelle wertlos.
    const abnahme = erstelleAbnahme([fixture({ device: null })], HEUTE);
    expect(abnahme.vorbehalte[0]).toMatchObject({ art: "ohne_geraet", anzahl: 1 });
  });

  it("zählt fehlende Geräte NICHT bei noch offenen Positionen", () => {
    // Dass an einer unmontierten Position nichts hängt, ist keine eigene
    // Beanstandung — es steht schon als „nicht montiert" da.
    const abnahme = erstelleAbnahme([fixture({ installStatus: "GEPLANT", device: null })], HEUTE);
    expect(abnahme.vorbehalte.map((v) => v.art)).toEqual(["nicht_montiert"]);
  });

  it("nennt überfällige Prüfungen verbauter Geräte", () => {
    const abnahme = erstelleAbnahme(
      [fixture({ pruefungFaellig: new Date("2026-06-01T00:00:00Z") })],
      HEUTE
    );
    expect(abnahme.vorbehalte[0]).toMatchObject({ art: "pruefung_faellig", anzahl: 1 });
  });

  it("schweigt bei einer Prüfung, die noch läuft", () => {
    const abnahme = erstelleAbnahme(
      [fixture({ pruefungFaellig: new Date("2027-06-01T00:00:00Z") })],
      HEUTE
    );
    expect(abnahme.vorbehalte).toEqual([]);
    expect(abnahme.ohneVorbehalt).toBe(true);
  });

  it("macht aus einer dokumentierten Abweichung KEINEN Vorbehalt", () => {
    // Sie ist festgehalten und damit erledigt — das ist der Sinn des Dokuments.
    const abnahme = erstelleAbnahme(
      [fixture({ installStatus: "ABWEICHEND", actualPosition: "Traverse hinten" })],
      HEUTE
    );
    expect(abnahme.vorbehalte).toEqual([]);
  });

  it("nennt mehrere Vorbehalte nebeneinander", () => {
    const abnahme = erstelleAbnahme(
      [
        fixture({ installStatus: "GEPLANT" }),
        fixture({ device: null }),
        fixture({ pruefungFaellig: new Date("2026-01-01T00:00:00Z") }),
      ],
      HEUTE
    );
    expect(abnahme.vorbehalte.map((v) => v.art)).toEqual([
      "nicht_montiert",
      "ohne_geraet",
      "pruefung_faellig",
    ]);
    expect(abnahme.ohneVorbehalt).toBe(false);
  });
});
