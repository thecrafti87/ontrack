import { describe, expect, it } from "vitest";
import {
  addMonths,
  getMaintenanceDueDate,
  getMaintenanceUrgency,
  pruefnachweise,
} from "@/lib/maintenance";
import { MAINTENANCE_RESULT, isMaintenanceResult } from "@/lib/constants";

const JETZT = new Date("2026-08-23T12:00:00Z");

/**
 * Datum in Ortszeit als JJJJ-MM-TT.
 *
 * Nicht toISOString(): das rechnet nach UTC um, während addMonths mit
 * Ortszeit arbeitet. Über die Sommerzeitgrenze hinweg ergäbe der Vergleich
 * sonst einen Tag Unterschied, den die App selbst nie anzeigt.
 */
function lokal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

describe("Fälligkeit von Wartungen", () => {
  it("rechnet Monate korrekt weiter", () => {
    expect(lokal(addMonths(new Date("2026-01-15"), 12))).toBe("2027-01-15");
  });

  it("rutscht bei Monatsletzten nicht in den Folgemonat", () => {
    // JavaScripts setMonth macht aus dem 30. Februar stillschweigend den
    // 2. März. Eine Prüffrist auf einem Monatsletzten würde dadurch bei jedem
    // Durchlauf nach hinten wandern.
    expect(lokal(addMonths(new Date("2026-11-30"), 3))).toBe("2027-02-28");
    expect(lokal(addMonths(new Date("2026-01-31"), 1))).toBe("2026-02-28");
    expect(lokal(addMonths(new Date("2026-08-31"), 6))).toBe("2027-02-28");
  });

  it("trifft im Schaltjahr den 29. Februar", () => {
    expect(lokal(addMonths(new Date("2028-01-31"), 1))).toBe("2028-02-29");
  });

  it("behält den Tag, wo er im Zielmonat existiert", () => {
    expect(lokal(addMonths(new Date("2026-03-15"), 1))).toBe("2026-04-15");
    expect(lokal(addMonths(new Date("2026-01-28"), 1))).toBe("2026-02-28");
  });

  it("gilt als sofort fällig, wenn noch nie geprüft wurde", () => {
    expect(getMaintenanceDueDate(null, 12)).toBeNull();
    expect(getMaintenanceUrgency(null, JETZT)).toBe("overdue");
  });

  it("erkennt überfällige Prüfungen", () => {
    const faellig = getMaintenanceDueDate(new Date("2025-01-01"), 12);
    expect(getMaintenanceUrgency(faellig, JETZT)).toBe("overdue");
  });

  it("warnt 30 Tage im Voraus", () => {
    const in10Tagen = new Date(JETZT.getTime() + 10 * 864e5);
    const in40Tagen = new Date(JETZT.getTime() + 40 * 864e5);
    expect(getMaintenanceUrgency(in10Tagen, JETZT)).toBe("soon");
    expect(getMaintenanceUrgency(in40Tagen, JETZT)).toBe("later");
  });

  it("behandelt den Fälligkeitstag selbst als fällig, nicht als „bald“", () => {
    expect(getMaintenanceUrgency(JETZT, JETZT)).toBe("overdue");
  });
});

describe("Prüfergebnisse", () => {
  it("kennt genau die drei erlaubten Ergebnisse", () => {
    expect(Object.keys(MAINTENANCE_RESULT).sort()).toEqual([
      "BESTANDEN",
      "DURCHGEFALLEN",
      "MAENGEL",
    ]);
  });

  it("setzt das Intervall nur bei bestandener Prüfung zurück", () => {
    // Sonst hätte Durchfallen zur Folge, dass für ein Jahr Ruhe ist.
    expect(MAINTENANCE_RESULT.BESTANDEN.resetsInterval).toBe(true);
    expect(MAINTENANCE_RESULT.MAENGEL.resetsInterval).toBe(true);
    expect(MAINTENANCE_RESULT.DURCHGEFALLEN.resetsInterval).toBe(false);
  });

  it("weist unbekannte Ergebniswerte ab", () => {
    expect(isMaintenanceResult("BESTANDEN")).toBe(true);
    expect(isMaintenanceResult("VIELLEICHT")).toBe(false);
  });
});

describe("Prüfnachweise aufbereiten", () => {
  function pruefung(
    inventoryNo: string,
    performedAt: string,
    result: string,
    intervalMonths = 12
  ) {
    return {
      inventoryNo,
      deviceName: `Gerät ${inventoryNo}`,
      title: "DGUV V3",
      intervalMonths,
      performedAt: new Date(performedAt),
      result,
      testerName: null,
      recordedBy: "Benni",
      notes: null,
      documentCount: 0,
    };
  }

  it("sortiert nach Gerät, innerhalb des Geräts neueste zuerst", () => {
    const zeilen = pruefnachweise([
      pruefung("OT-0002", "2025-01-01", "BESTANDEN"),
      pruefung("OT-0001", "2024-01-01", "BESTANDEN"),
      pruefung("OT-0001", "2026-01-01", "BESTANDEN"),
    ]);

    expect(zeilen.map((z) => `${z.inventoryNo}/${z.performedAt.getFullYear()}`)).toEqual([
      "OT-0001/2026",
      "OT-0001/2024",
      "OT-0002/2025",
    ]);
  });

  it("rechnet die Fälligkeit aus der jeweiligen Prüfung, nicht aus der letzten", () => {
    // Sonst stünde an einer alten Prüfung ein Datum, das zu ihr nicht passt.
    const [neuer, aelter] = pruefnachweise([
      pruefung("OT-0001", "2024-03-15", "BESTANDEN"),
      pruefung("OT-0001", "2026-03-15", "BESTANDEN"),
    ]);

    expect(neuer.nextDue?.getFullYear()).toBe(2027);
    expect(aelter.nextDue?.getFullYear()).toBe(2025);
  });

  it("gibt einer nicht bestandenen Prüfung keine Fälligkeit", () => {
    // Das Gerät bleibt fällig, bis es besteht — ein Datum wäre hier gelogen.
    const [zeile] = pruefnachweise([pruefung("OT-0001", "2026-03-15", "DURCHGEFALLEN")]);
    expect(zeile.nextDue).toBeNull();
  });

  it("behandelt Mängel wie bestanden, weil die Frist dort weiterläuft", () => {
    const [zeile] = pruefnachweise([pruefung("OT-0001", "2026-03-15", "MAENGEL")]);
    expect(zeile.nextDue).not.toBeNull();
  });

  it("lässt die übergebene Liste unverändert", () => {
    const eingabe = [
      pruefung("OT-0002", "2025-01-01", "BESTANDEN"),
      pruefung("OT-0001", "2024-01-01", "BESTANDEN"),
    ];
    pruefnachweise(eingabe);
    expect(eingabe[0].inventoryNo).toBe("OT-0002");
  });
});
