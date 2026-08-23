import { describe, expect, it } from "vitest";
import {
  EVENT_ITEM_STATUS,
  MISSION_PHASES,
  eventItemStatusRank,
  hasReachedPhase,
  isMissionPhase,
  type MissionPhase,
} from "@/lib/constants";
import { extractInventoryNo } from "@/lib/scanCode";

describe("Phasen des Einsatzmodus", () => {
  it("bildet jede Phase auf einen echten Packlisten-Status ab", () => {
    // Es soll kein zweites Statusmodell neben dem der Packliste geben.
    for (const phase of Object.keys(MISSION_PHASES)) {
      expect(EVENT_ITEM_STATUS, `Phase ${phase} hat keinen Status`).toHaveProperty(phase);
    }
  });

  it("deckt alle Arbeitsschritte nach der Planung ab", () => {
    expect(Object.keys(MISSION_PHASES)).toEqual([
      "GEPACKT",
      "AUFGEBAUT",
      "ABGEBAUT",
      "ZURUECK",
    ]);
    // "GEPLANT" ist keine Phase: Planen ist Verwaltungsarbeit, kein Einsatz.
    expect(MISSION_PHASES).not.toHaveProperty("GEPLANT");
  });

  it("weist unbekannte Phasen ab", () => {
    expect(isMissionPhase("GEPACKT")).toBe(true);
    expect(isMissionPhase("GEPLANT")).toBe(false);
    expect(isMissionPhase("QUATSCH")).toBe(false);
  });
});

describe("Reihenfolge der Packlisten-Status", () => {
  it("ordnet die Stufen aufsteigend", () => {
    expect(eventItemStatusRank("GEPLANT")).toBe(0);
    expect(eventItemStatusRank("GEPACKT")).toBe(1);
    expect(eventItemStatusRank("AUFGEBAUT")).toBe(2);
    expect(eventItemStatusRank("ABGEBAUT")).toBe(3);
    expect(eventItemStatusRank("ZURUECK")).toBe(4);
  });

  it("behandelt unbekannte Werte als Anfang, statt zu scheitern", () => {
    expect(eventItemStatusRank("KAPUTT")).toBe(0);
  });
});

describe("Ein Scan darf nie rückwärts buchen", () => {
  it("erkennt eine bereits erreichte Phase", () => {
    expect(hasReachedPhase("GEPACKT", "GEPACKT")).toBe(true);
    expect(hasReachedPhase("AUFGEBAUT", "GEPACKT")).toBe(true);
    expect(hasReachedPhase("ZURUECK", "GEPACKT")).toBe(true);
  });

  it("erkennt eine noch offene Phase", () => {
    expect(hasReachedPhase("GEPLANT", "GEPACKT")).toBe(false);
    expect(hasReachedPhase("GEPACKT", "AUFGEBAUT")).toBe(false);
    expect(hasReachedPhase("AUFGEBAUT", "ABGEBAUT")).toBe(false);
  });

  it("schützt jede spätere Stufe vor jeder früheren Phase", () => {
    // Der Kern der Regel: Wer beim Packen ein längst aufgebautes Gerät
    // scannt, darf es nicht auf "gepackt" zurückstufen. Das wäre stiller
    // Datenverlust mitten in der Arbeit.
    const stufen = ["GEPLANT", "GEPACKT", "AUFGEBAUT", "ABGEBAUT", "ZURUECK"];
    const phasen = Object.keys(MISSION_PHASES) as MissionPhase[];

    for (const status of stufen) {
      for (const phase of phasen) {
        const spaeterAlsPhase = eventItemStatusRank(status) > eventItemStatusRank(phase);
        if (spaeterAlsPhase) {
          expect(
            hasReachedPhase(status, phase),
            `${status} müsste gegen Phase ${phase} geschützt sein`
          ).toBe(true);
        }
      }
    }
  });
});

describe("Gescannte Codes auswerten", () => {
  it("liest die Inventarnummer aus einer Etiketten-Adresse", () => {
    expect(extractInventoryNo("https://ontrack.example.de/d/OT-0001")).toBe("OT-0001");
  });

  it("kommt mit Unterverzeichnissen in der Adresse zurecht", () => {
    expect(extractInventoryNo("https://example.de/ontrack/d/OT-0042")).toBe("OT-0042");
  });

  it("dekodiert Sonderzeichen in der Nummer", () => {
    expect(extractInventoryNo("https://example.de/d/OT%2F0007")).toBe("OT/0007");
  });

  it("nimmt einen nackten Barcode unverändert", () => {
    // Hersteller-Barcodes enthalten keine Adresse.
    expect(extractInventoryNo("5901234123457")).toBe("5901234123457");
    expect(extractInventoryNo("  OT-0003  ")).toBe("OT-0003");
  });

  it("lässt eine Adresse ohne /d/ unangetastet", () => {
    expect(extractInventoryNo("https://example.de/geraete/123")).toBe(
      "https://example.de/geraete/123"
    );
  });

  it("liefert für leere Eingabe nichts", () => {
    expect(extractInventoryNo("   ")).toBe("");
  });
});
