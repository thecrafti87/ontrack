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

const OKTOBER = { start: new Date("2026-10-21"), end: new Date("2026-10-22") };

beforeAll(async () => {
  fs.rmSync(DB_DATEI, { force: true });

  const { PrismaClient } = await import("@prisma/client");
  const { applyMigrations } = await import("../electron/migrate.js");

  prisma = new PrismaClient();
  await applyMigrations(prisma, path.join(process.cwd(), "prisma", "migrations"));

  ({ findEventConflict } = await import("@/lib/eventConflicts"));

  await prisma.device.create({ data: { id: "d1", inventoryNo: "OT-0001", name: "Moving Head" } });
  await prisma.device.create({ data: { id: "d2", inventoryNo: "OT-0002", name: "Astera" } });

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
  fs.rmSync(DB_DATEI, { force: true });
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
