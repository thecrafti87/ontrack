import { beforeEach, describe, expect, it } from "vitest";
import {
  clearQueue,
  dequeueScan,
  enqueueScan,
  pruneOtherQueues,
  queueKey,
  readQueue,
  type SimpleStorage,
} from "@/lib/offlineQueue";

/** Speicher-Attrappe, damit die Regeln ohne Browser prüfbar sind. */
function fakeStorage(): SimpleStorage & { daten: Map<string, string> } {
  const daten = new Map<string, string>();
  return {
    daten,
    getItem: (k) => daten.get(k) ?? null,
    setItem: (k, v) => void daten.set(k, v),
    removeItem: (k) => void daten.delete(k),
  };
}

const EINSATZ = "mission-1";
let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
});

describe("Vormerken ohne Netz", () => {
  it("beginnt leer", () => {
    expect(readQueue(store, EINSATZ)).toEqual([]);
  });

  it("merkt einen Scan vor", () => {
    enqueueScan(store, EINSATZ, "OT-0001", "a", 1000);
    expect(readQueue(store, EINSATZ)).toEqual([{ id: "a", code: "OT-0001", at: 1000 }]);
  });

  it("behält die Reihenfolge des Scannens bei", () => {
    // Nachgebucht wird in Scan-Reihenfolge; sonst kann eine spätere Buchung
    // eine frühere überholen.
    enqueueScan(store, EINSATZ, "OT-0001", "a", 1000);
    enqueueScan(store, EINSATZ, "OT-0002", "b", 2000);
    enqueueScan(store, EINSATZ, "OT-0003", "c", 3000);
    expect(readQueue(store, EINSATZ).map((e) => e.code)).toEqual([
      "OT-0001",
      "OT-0002",
      "OT-0003",
    ]);
  });

  it("behält denselben Code doppelt", () => {
    // Zweimal zu scannen ist eine Aussage über die Arbeit. Der Server meldet
    // die zweite Buchung als "war schon" — stiller Verlust wäre schlimmer.
    enqueueScan(store, EINSATZ, "OT-0001", "a", 1000);
    enqueueScan(store, EINSATZ, "OT-0001", "b", 1100);
    expect(readQueue(store, EINSATZ)).toHaveLength(2);
  });

  it("entfernt Leerraum und ignoriert leere Codes", () => {
    enqueueScan(store, EINSATZ, "  OT-0001  ", "a", 1000);
    enqueueScan(store, EINSATZ, "   ", "b", 1100);
    expect(readQueue(store, EINSATZ)).toEqual([{ id: "a", code: "OT-0001", at: 1000 }]);
  });
});

describe("Nachbuchen", () => {
  beforeEach(() => {
    enqueueScan(store, EINSATZ, "OT-0001", "a", 1000);
    enqueueScan(store, EINSATZ, "OT-0002", "b", 2000);
  });

  it("trägt einen nachgebuchten Scan aus", () => {
    dequeueScan(store, EINSATZ, "a");
    expect(readQueue(store, EINSATZ).map((e) => e.id)).toEqual(["b"]);
  });

  it("lässt die übrigen unangetastet, wenn einer fehlschlägt", () => {
    // Genau der Fall: Der erste Scan wird nachgebucht, beim zweiten reißt die
    // Verbindung wieder ab. Er muss erhalten bleiben.
    dequeueScan(store, EINSATZ, "a");
    expect(readQueue(store, EINSATZ)).toHaveLength(1);
  });

  it("verträgt das Austragen einer unbekannten Kennung", () => {
    dequeueScan(store, EINSATZ, "gibt-es-nicht");
    expect(readQueue(store, EINSATZ)).toHaveLength(2);
  });

  it("räumt den Speichereintrag weg, wenn nichts mehr aussteht", () => {
    dequeueScan(store, EINSATZ, "a");
    dequeueScan(store, EINSATZ, "b");
    expect(store.daten.has(queueKey(EINSATZ))).toBe(false);
  });
});

describe("Beschädigte Daten", () => {
  it("liefert bei kaputtem JSON eine leere Liste statt zu scheitern", () => {
    store.setItem(queueKey(EINSATZ), "{kein json");
    expect(readQueue(store, EINSATZ)).toEqual([]);
  });

  it("liefert bei einem falschen Datentyp eine leere Liste", () => {
    store.setItem(queueKey(EINSATZ), '"eine Zeichenkette"');
    expect(readQueue(store, EINSATZ)).toEqual([]);
  });

  it("sortiert einzelne beschädigte Einträge aus, statt alles zu verwerfen", () => {
    // Die Warteschlange ist das einzige Protokoll der Arbeit ohne Netz.
    store.setItem(
      queueKey(EINSATZ),
      JSON.stringify([
        { id: "a", code: "OT-0001", at: 1000 },
        { id: "b" },
        null,
        { id: "c", code: "OT-0003", at: 3000 },
      ])
    );
    expect(readQueue(store, EINSATZ).map((e) => e.id)).toEqual(["a", "c"]);
  });
});

describe("Warteschlangen je Einsatz", () => {
  it("hält die Einsätze auseinander", () => {
    enqueueScan(store, "mission-1", "OT-0001", "a", 1000);
    enqueueScan(store, "mission-2", "OT-0002", "b", 2000);
    expect(readQueue(store, "mission-1").map((e) => e.code)).toEqual(["OT-0001"]);
    expect(readQueue(store, "mission-2").map((e) => e.code)).toEqual(["OT-0002"]);
  });

  it("räumt Reste vergangener Einsätze weg", () => {
    enqueueScan(store, "alt-1", "OT-0001", "a", 1000);
    enqueueScan(store, "alt-2", "OT-0002", "b", 2000);
    enqueueScan(store, "aktuell", "OT-0003", "c", 3000);

    const entfernt = pruneOtherQueues(store, "aktuell", Array.from(store.daten.keys()));

    expect(entfernt).toHaveLength(2);
    expect(readQueue(store, "aktuell")).toHaveLength(1);
    expect(readQueue(store, "alt-1")).toEqual([]);
  });

  it("lässt fremde Speichereinträge in Ruhe", () => {
    store.setItem("ganz-etwas-anderes", "wichtig");
    pruneOtherQueues(store, "aktuell", Array.from(store.daten.keys()));
    expect(store.getItem("ganz-etwas-anderes")).toBe("wichtig");
  });

  it("räumt ohne laufenden Einsatz alle Warteschlangen weg", () => {
    enqueueScan(store, "alt-1", "OT-0001", "a", 1000);
    pruneOtherQueues(store, null, Array.from(store.daten.keys()));
    expect(readQueue(store, "alt-1")).toEqual([]);
  });

  it("leert eine Warteschlange auf Wunsch vollständig", () => {
    enqueueScan(store, EINSATZ, "OT-0001", "a", 1000);
    clearQueue(store, EINSATZ);
    expect(readQueue(store, EINSATZ)).toEqual([]);
  });
});
