import { describe, expect, it } from "vitest";
import {
  DEVICE_STATUS,
  EVENT_ITEM_STATUS,
  MISSION_PHASES,
  MISSION_PHASE_ORDER,
  NOT_PLANNABLE,
  NO_CATEGORY_LABEL,
  eventItemStatusRank,
  formatDateRange,
  groupByCategory,
  nextMissionPhase,
} from "@/lib/constants";

describe("Gruppierung nach Kategorie", () => {
  const geraete = [
    { name: "Spot", kategorie: "Licht" },
    { name: "Box", kategorie: "Ton" },
    { name: "Kabel", kategorie: null },
    { name: "Wash", kategorie: "Licht" },
    { name: "Klemme", kategorie: "  " },
  ];

  it("fasst gleiche Kategorien zusammen", () => {
    const gruppen = groupByCategory(geraete, (g) => g.kategorie);
    const licht = gruppen.find((g) => g.category === "Licht");
    expect(licht?.items.map((i) => i.name)).toEqual(["Spot", "Wash"]);
  });

  it("sortiert alphabetisch, „Ohne Kategorie“ immer zuletzt", () => {
    const gruppen = groupByCategory(geraete, (g) => g.kategorie);
    expect(gruppen.map((g) => g.category)).toEqual(["Licht", "Ton", NO_CATEGORY_LABEL]);
  });

  it("behandelt leere und nur aus Leerzeichen bestehende Kategorien gleich", () => {
    const gruppen = groupByCategory(geraete, (g) => g.kategorie);
    const ohne = gruppen.find((g) => g.category === NO_CATEGORY_LABEL);
    expect(ohne?.items.map((i) => i.name)).toEqual(["Kabel", "Klemme"]);
  });

  it("liefert bei leerer Eingabe keine Gruppen", () => {
    expect(groupByCategory([], () => null)).toEqual([]);
  });
});

describe("Zeitraum-Anzeige", () => {
  it("zeigt bei eintägigen Events nur ein Datum", () => {
    expect(formatDateRange("2026-10-21T08:00:00", "2026-10-21T23:00:00")).toBe("21.10.2026");
  });

  it("zeigt bei mehrtägigen Events beide Daten", () => {
    expect(formatDateRange("2026-10-21T08:00:00", "2026-10-22T23:00:00")).toBe(
      "21.10.2026 – 22.10.2026"
    );
  });
});

describe("Status-Definitionen", () => {
  it("sperrt defekte und ausgemusterte Geräte für die Planung", () => {
    // Ein defektes Gerät darf nicht versehentlich eingeplant werden.
    expect(NOT_PLANNABLE).toContain("DEFEKT_GEMELDET");
    expect(NOT_PLANNABLE).toContain("GESPERRT");
    expect(NOT_PLANNABLE).toContain("IN_REPARATUR");
    expect(NOT_PLANNABLE).toContain("AUSGEMUSTERT");
    expect(NOT_PLANNABLE).not.toContain("EINSATZBEREIT");
  });

  it("hat für jeden Gerätestatus eine deutsche Bezeichnung", () => {
    for (const [key, def] of Object.entries(DEVICE_STATUS)) {
      expect(def.label, `Bezeichnung fehlt für ${key}`).toBeTruthy();
    }
  });

  it("bildet die Event-Stufen als lückenlose Kette bis zum Ende ab", () => {
    // geplant → gepackt → aufgebaut → abgebaut → zurück, danach Schluss.
    const kette: string[] = [];
    let aktuell: string | null = "GEPLANT";
    while (aktuell) {
      kette.push(aktuell);
      const def: { next: string | null } =
        EVENT_ITEM_STATUS[aktuell as keyof typeof EVENT_ITEM_STATUS];
      aktuell = def.next;
    }
    expect(kette).toEqual(["GEPLANT", "GEPACKT", "AUFGEBAUT", "ABGEBAUT", "ZURUECK"]);
    expect(kette.length).toBe(Object.keys(EVENT_ITEM_STATUS).length);
  });
});

describe("Reihenfolge der Einsatzphasen", () => {
  it("führt vom Packen bis zum Zurückräumen", () => {
    expect(nextMissionPhase("GEPACKT")).toBe("AUFGEBAUT");
    expect(nextMissionPhase("AUFGEBAUT")).toBe("ABGEBAUT");
    expect(nextMissionPhase("ABGEBAUT")).toBe("ZURUECK");
  });

  it("endet nach dem Zurückräumen", () => {
    // Kein "danach" heißt: Der Abschluss bietet keinen nächsten Schritt an,
    // sondern nur noch das Beenden. Gäbe es hier eine Phase, liefe der
    // Einsatz im Kreis.
    expect(nextMissionPhase("ZURUECK")).toBeNull();
  });

  it("deckt jede Phase ab", () => {
    // Käme eine Phase dazu, ohne in der Reihenfolge zu stehen, bliebe der
    // Einsatz an ihr hängen — ohne Weg vorwärts.
    for (const phase of MISSION_PHASE_ORDER) {
      expect(MISSION_PHASES[phase], `Phase ${phase} fehlt in MISSION_PHASES`).toBeTruthy();
    }
    expect(MISSION_PHASE_ORDER).toHaveLength(Object.keys(MISSION_PHASES).length);
  });

  it("hält die Reihenfolge mit den Packlisten-Status zusammen", () => {
    // Jede Phase muss ein gültiger Zielstatus sein, sonst bucht ein Scan in
    // einen Status, den die Packliste nicht kennt.
    for (const phase of MISSION_PHASE_ORDER) {
      expect(eventItemStatusRank(phase), `Phase ${phase} ist kein Packlisten-Status`)
        .toBeGreaterThan(0);
    }
  });
});
