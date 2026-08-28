import { describe, expect, it } from "vitest";
import { bestimmeOrt } from "@/lib/deviceLocation";

/**
 * Die Rangfolge entscheidet, wohin jemand läuft, der ein Gerät sucht. Ein
 * Fehler darin kostet keine Daten, sondern eine halbe Stunde und einen
 * Umweg — deshalb ist jede Stufe hier einzeln festgehalten.
 */

describe("Rangfolge der Ortsangabe", () => {
  const alles = {
    verleihAn: "Bühne Nord GmbH",
    verbaut: { position: "Traverse Nord, 3. von links", objekt: "Stadthalle" },
    caseName: "Case 4",
    standort: "Lager Regal 3",
  };

  it("Verliehen schlägt alles — das Gerät ist schlicht nicht da", () => {
    expect(bestimmeOrt(alles)).toEqual({ art: "verliehen", text: "Bühne Nord GmbH" });
  });

  it("Verbaut schlägt Case und Standort", () => {
    expect(bestimmeOrt({ ...alles, verleihAn: null })).toEqual({
      art: "verbaut",
      text: "Traverse Nord, 3. von links",
      zusatz: "Stadthalle",
    });
  });

  it("Case schlägt Standort", () => {
    expect(bestimmeOrt({ ...alles, verleihAn: null, verbaut: null })).toEqual({
      art: "case",
      text: "Case 4",
    });
  });

  it("Standort bleibt als letzte Auskunft", () => {
    expect(bestimmeOrt({ standort: "Lager Regal 3" })).toEqual({
      art: "standort",
      text: "Lager Regal 3",
    });
  });

  it("gibt nichts zurück, wo nichts bekannt ist", () => {
    expect(bestimmeOrt({})).toBeNull();
    expect(bestimmeOrt({ verleihAn: "", caseName: "  ", standort: null })).toBeNull();
  });
});

describe("Verbaut ohne vollständige Angabe", () => {
  it("nennt die Anlage, wenn die Position fehlt", () => {
    // „Montiert in der Stadthalle" ist immer noch mehr wert als ein Lagerplatz,
    // an dem das Gerät nachweislich nicht liegt.
    expect(bestimmeOrt({ verbaut: { objekt: "Stadthalle" }, standort: "Lager" })).toEqual({
      art: "verbaut",
      text: "Stadthalle",
    });
  });

  it("nennt die Position auch ohne Anlagennamen", () => {
    expect(bestimmeOrt({ verbaut: { position: "Traverse Nord" } })).toEqual({
      art: "verbaut",
      text: "Traverse Nord",
    });
  });

  it("fällt durch, wenn beides leer ist", () => {
    // Ein Eintrag ohne Inhalt darf den Lagerstandort nicht verdecken.
    expect(bestimmeOrt({ verbaut: { position: "  ", objekt: null }, standort: "Lager" })).toEqual({
      art: "standort",
      text: "Lager",
    });
  });
});
