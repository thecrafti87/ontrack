import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Integrationstest gegen eine echte SQLite-Datei.
 *
 * Die Überlappungsprüfung steckt in einer Prisma-Abfrage, nicht in JavaScript —
 * mit Attrappen würde man nur die eigene Annahme testen, nicht die Regel. Die
 * Datenbank wird dafür mit demselben Migrationslauf aufgebaut, den auch die
 * Desktop-App benutzt; damit ist der gleich mitgeprüft.
 */

const DB_DATEI = path.join(os.tmpdir(), `ontrack-test-conflicts-${process.pid}.db`);
process.env.DATABASE_URL = `file:${DB_DATEI}`;

// Dynamisch geladen, damit DATABASE_URL vorher steht.
let prisma: import("@prisma/client").PrismaClient;
let findEventConflict: typeof import("@/lib/eventConflicts").findEventConflict;
let findLoanConflict: typeof import("@/lib/eventConflicts").findLoanConflict;
let findPlanningConflict: typeof import("@/lib/eventConflicts").findPlanningConflict;

const OKTOBER = { start: new Date("2026-10-21"), end: new Date("2026-10-22") };

beforeAll(async () => {
  fs.rmSync(DB_DATEI, { force: true });

  const { PrismaClient } = await import("@prisma/client");
  const { applyMigrations } = await import("../electron/migrate.js");

  prisma = new PrismaClient();
  await applyMigrations(prisma, path.join(process.cwd(), "prisma", "migrations"));

  ({ findEventConflict, findLoanConflict, findPlanningConflict } = await import(
    "@/lib/eventConflicts"
  ));

  await prisma.device.create({ data: { id: "d1", inventoryNo: "OT-0001", name: "Moving Head" } });
  await prisma.device.create({ data: { id: "d2", inventoryNo: "OT-0002", name: "Astera" } });
  await prisma.device.create({ data: { id: "d3", inventoryNo: "OT-0003", name: "Funkstrecke" } });

  await prisma.user.create({
    data: { id: "u1", email: "lager@example.test", name: "Lager", passwordHash: "x", approved: true },
  });

  await prisma.event.create({
    data: { id: "e1", name: "Stadtfest", startDate: OKTOBER.start, endDate: OKTOBER.end },
  });
  await prisma.event.create({
    data: {
      id: "e2",
      name: "Firmenfeier",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-02"),
    },
  });
});

afterAll(async () => {
  await prisma?.$disconnect();

  // Windows gibt die Datei erst frei, wenn der Query-Engine-Prozess wirklich
  // beendet ist — direkt nach $disconnect wirft rmSync sonst EPERM und lässt
  // die ganze Suite scheitern, obwohl jeder Test bestanden hat.
  for (let versuch = 0; versuch < 20; versuch++) {
    try {
      fs.rmSync(DB_DATEI, { force: true });
      return;
    } catch {
      await new Promise((fertig) => setTimeout(fertig, 50));
    }
  }
  // Aufgeben ist vertretbar: Die Datei liegt im Temp-Verzeichnis.
});

describe("Doppelbuchung von Geräten", () => {
  it("meldet keinen Konflikt, wenn das Gerät nirgends verplant ist", async () => {
    expect(await findEventConflict("d1", "e2", OKTOBER.start, OKTOBER.end)).toBeNull();
  });

  it("erkennt ein Gerät, das im selben Zeitraum schon verplant ist", async () => {
    await prisma.eventItem.create({ data: { eventId: "e1", deviceId: "d1", status: "GEPLANT" } });

    const konflikt = await findEventConflict("d1", "e2", OKTOBER.start, OKTOBER.end);
    expect(konflikt?.eventName).toBe("Stadtfest");
  });

  it("meldet den eigenen Event nicht als Konflikt", async () => {
    // Sonst könnte man ein Gerät nie im Event lassen, in dem es schon ist.
    expect(await findEventConflict("d1", "e1", OKTOBER.start, OKTOBER.end)).toBeNull();
  });

  it("erkennt teilweise Überlappung am Rand", async () => {
    // Anreise am letzten Tag des anderen Events: das zählt.
    const konflikt = await findEventConflict(
      "d1",
      "e2",
      new Date("2026-10-22"),
      new Date("2026-10-25")
    );
    expect(konflikt?.eventName).toBe("Stadtfest");
  });

  it("meldet keinen Konflikt bei Zeiträumen, die sich nicht berühren", async () => {
    expect(
      await findEventConflict("d1", "e2", new Date("2026-10-23"), new Date("2026-10-25"))
    ).toBeNull();
  });

  it("ignoriert Geräte, die bereits zurück im Lager sind", async () => {
    // Zurückgegebene Geräte stehen wieder zur Verfügung.
    await prisma.eventItem.create({ data: { eventId: "e1", deviceId: "d2", status: "ZURUECK" } });
    expect(await findEventConflict("d2", "e2", OKTOBER.start, OKTOBER.end)).toBeNull();
  });

  it("meldet einen Konflikt bei jedem noch nicht zurückgegebenen Status", async () => {
    for (const status of ["GEPACKT", "AUFGEBAUT", "ABGEBAUT"]) {
      await prisma.eventItem.deleteMany({ where: { deviceId: "d2" } });
      await prisma.eventItem.create({ data: { eventId: "e1", deviceId: "d2", status } });
      const konflikt = await findEventConflict("d2", "e2", OKTOBER.start, OKTOBER.end);
      expect(konflikt, `Status ${status} müsste als Konflikt zählen`).not.toBeNull();
    }
  });
});

describe("Verliehene Geräte in der Planung", () => {
  /** Ein Verleih mit frei wählbaren Eckdaten; das Gerät ist noch nicht zurück. */
  async function verleihe(
    deviceId: string,
    loanId: string,
    issuedAt: Date,
    dueAt: Date,
    borrower = "Bühnenbau Meier"
  ) {
    await prisma.loan.create({
      data: { id: loanId, borrower, issuedAt, dueAt, issuedById: "u1" },
    });
    await prisma.loanItem.create({ data: { loanId, deviceId } });
  }

  it("meldet keinen Konflikt, solange nichts verliehen ist", async () => {
    expect(await findLoanConflict("d3", OKTOBER.start, OKTOBER.end)).toBeNull();
  });

  it("erkennt ein Gerät, das im Veranstaltungszeitraum draußen ist", async () => {
    await verleihe("d3", "l1", new Date("2026-10-19"), new Date("2026-10-25"));

    const konflikt = await findLoanConflict("d3", OKTOBER.start, OKTOBER.end);
    expect(konflikt?.borrower).toBe("Bühnenbau Meier");
    expect(konflikt?.ueberfaellig).toBe(false);
  });

  it("zählt den Rückgabetag als belegt", async () => {
    // Rückgabe am Anreisetag: Die Uhrzeit weiß niemand, der Konflikt ist echt.
    const konflikt = await findLoanConflict(
      "d3",
      new Date("2026-10-25"),
      new Date("2026-10-26"),
      new Date("2026-10-01")
    );
    expect(konflikt).not.toBeNull();
  });

  it("gibt das Gerät nach dem Rückgabetag wieder frei", async () => {
    expect(
      await findLoanConflict(
        "d3",
        new Date("2026-10-26"),
        new Date("2026-10-27"),
        new Date("2026-10-01")
      )
    ).toBeNull();
  });

  it("blockiert bei überfälligem Verleih jeden Zeitraum", async () => {
    // Das Gerät ist faktisch weg. Ein Termin in drei Monaten hilft nicht,
    // solange niemand weiß, wann es wiederkommt.
    const weitInDerZukunft = { start: new Date("2027-03-01"), end: new Date("2027-03-02") };
    const konflikt = await findLoanConflict(
      "d3",
      weitInDerZukunft.start,
      weitInDerZukunft.end,
      new Date("2026-11-15")
    );
    expect(konflikt?.ueberfaellig).toBe(true);
    expect(konflikt?.tage).toBe(21);
  });

  it("gibt zurückgegebene Positionen frei, auch wenn der Verleih noch offen ist", async () => {
    await prisma.loanItem.updateMany({
      where: { loanId: "l1", deviceId: "d3" },
      data: { returnedAt: new Date("2026-10-20") },
    });
    expect(
      await findLoanConflict("d3", OKTOBER.start, OKTOBER.end, new Date("2026-11-15"))
    ).toBeNull();
  });

  it("meldet bei mehreren offenen Verleihen den, der am längsten blockiert", async () => {
    await verleihe("d3", "l2", new Date("2026-10-19"), new Date("2026-10-23"), "Kurz");
    await verleihe("d3", "l3", new Date("2026-10-19"), new Date("2026-10-28"), "Lang");

    const konflikt = await findLoanConflict("d3", OKTOBER.start, OKTOBER.end, new Date("2026-10-01"));
    expect(konflikt?.borrower).toBe("Lang");
  });
});

describe("Kombinierte Prüfung", () => {
  it("meldet die Doppelbuchung, wenn beides zutrifft", async () => {
    // Reihenfolge ist Absicht: Der Terminkonflikt ist der häufigere Fall und
    // die Meldung, mit der man zuerst etwas anfangen kann.
    const konflikt = await findPlanningConflict("d1", "e2", OKTOBER.start, OKTOBER.end);
    expect(konflikt?.art).toBe("event");
  });

  it("meldet den Verleih, wenn der Termin frei ist", async () => {
    const konflikt = await findPlanningConflict(
      "d3",
      "e2",
      OKTOBER.start,
      OKTOBER.end,
      new Date("2026-10-01")
    );
    expect(konflikt?.art).toBe("verleih");
  });

  it("meldet nichts, wenn das Gerät frei und da ist", async () => {
    expect(
      await findPlanningConflict("d2", "e2", new Date("2027-06-01"), new Date("2027-06-02"))
    ).toBeNull();
  });
});
