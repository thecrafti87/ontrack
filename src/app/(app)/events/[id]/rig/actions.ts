"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { NOT_PLANNABLE, type DeviceStatus } from "@/lib/constants";
import { findEventConflict } from "@/lib/eventConflicts";

export type ActionState = { error?: string; success?: string } | undefined;

export type RigFixtureInput = {
  uuid: string;
  name: string;
  fixtureId: string | null;
  gdtfSpec: string | null;
  gdtfMode: string | null;
  layerName: string | null;
  className: string | null;
  dmxAddresses: string | null;
  posX: number | null;
  posY: number | null;
  posZ: number | null;
};

export type ImportRigChunkResult = { created: number; autoMatched: number };

// ── Import (Client parst die MVR im Browser, hier landen nur die Fixture-Daten) ──

/**
 * Speichert einen Chunk bereits geparster Fixtures. Beim ersten Chunk (replace=true)
 * werden zuvor vorhandene RigFixtures des Events gelöscht (Re-Import ersetzt komplett).
 * Auto-Match: eindeutiger Substring-Treffer von Inventarnummer oder Seriennummer in
 * Name/FixtureID — bei Mehrdeutigkeit bleibt die Zuordnung leer.
 */
export async function importRigAction(
  eventId: string,
  meta: { filename: string },
  fixtures: RigFixtureInput[],
  replace: boolean
): Promise<ImportRigChunkResult> {
  const user = await requireUser();
  if (!canEdit(user)) throw new Error("Keine Berechtigung.");

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Veranstaltung nicht gefunden.");

  if (replace) {
    await prisma.rigFixture.deleteMany({ where: { eventId } });
  }

  const devices = await prisma.device.findMany({
    select: { id: true, inventoryNo: true, serialNo: true },
  });

  const rows = fixtures.map((f) => {
    const haystack = `${f.name} ${f.fixtureId ?? ""}`.toLowerCase();
    const candidates = new Set<string>();
    for (const d of devices) {
      if (d.inventoryNo && haystack.includes(d.inventoryNo.toLowerCase())) candidates.add(d.id);
    }
    for (const d of devices) {
      if (d.serialNo && d.serialNo.trim() && haystack.includes(d.serialNo.toLowerCase())) {
        candidates.add(d.id);
      }
    }
    const deviceId = candidates.size === 1 ? Array.from(candidates)[0] : null;

    return {
      eventId,
      uuid: f.uuid,
      fixtureId: f.fixtureId,
      name: f.name,
      gdtfSpec: f.gdtfSpec,
      gdtfMode: f.gdtfMode,
      layerName: f.layerName,
      className: f.className,
      dmxAddresses: f.dmxAddresses,
      posX: f.posX,
      posY: f.posY,
      posZ: f.posZ,
      deviceId,
    };
  });

  if (rows.length > 0) {
    await prisma.rigFixture.createMany({ data: rows });
  }

  return {
    created: rows.length,
    autoMatched: rows.filter((r) => r.deviceId).length,
  };
}

export async function logRigImportSummaryAction(
  eventId: string,
  filename: string,
  total: number
): Promise<void> {
  const user = await requireUser();
  await logActivity({
    userId: user.id,
    action: `MVR-Rig importiert: ${total} Fixtures (Datei ${filename})`,
    eventId,
  });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/rig`);
}

// ── Zuordnung einzelner Fixtures zu Geräten ─────────────────────────────

export async function setRigFixtureDeviceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const fixtureId = String(formData.get("fixtureId") ?? "");
  const inventoryNo = String(formData.get("inventoryNo") ?? "").trim();

  const fixture = await prisma.rigFixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { error: "Fixture nicht gefunden." };

  if (!inventoryNo) {
    await prisma.rigFixture.update({ where: { id: fixtureId }, data: { deviceId: null } });
    revalidatePath(`/events/${fixture.eventId}/rig`);
    return undefined;
  }

  const device = await prisma.device.findUnique({ where: { inventoryNo } });
  if (!device) return { error: `Gerät mit Inventarnummer "${inventoryNo}" nicht gefunden.` };

  await prisma.rigFixture.update({ where: { id: fixtureId }, data: { deviceId: device.id } });
  revalidatePath(`/events/${fixture.eventId}/rig`);
  return undefined;
}

// ── Montage-Status (Soll/Ist) ────────────────────────────────────────────

export async function setRigInstallStatusAction(
  fixtureId: string,
  status: "GEPLANT" | "MONTIERT" | "ABWEICHEND",
  actualPosition?: string
): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const fixture = await prisma.rigFixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { error: "Fixture nicht gefunden." };

  const trimmedActual = actualPosition?.trim() || "";
  if (status === "ABWEICHEND" && !trimmedActual) {
    return { error: "Bitte angeben, wo das Gerät stattdessen montiert wurde." };
  }

  await prisma.rigFixture.update({
    where: { id: fixtureId },
    data: {
      installStatus: status,
      actualPosition: status === "ABWEICHEND" ? trimmedActual : null,
    },
  });

  const actionText =
    status === "MONTIERT"
      ? `Rig-Montage: ${fixture.name} montiert wie geplant`
      : status === "ABWEICHEND"
        ? `Rig-Montage: ${fixture.name} abweichend montiert → ${trimmedActual}`
        : `Rig-Montage: ${fixture.name} zurückgesetzt`;

  await logActivity({
    userId: user.id,
    action: actionText,
    eventId: fixture.eventId,
    deviceId: fixture.deviceId ?? undefined,
  });

  revalidatePath(`/events/${fixture.eventId}/rig`);
  if (fixture.deviceId) revalidatePath(`/geraete/${fixture.deviceId}`);
  return undefined;
}

// ── Rig löschen ──────────────────────────────────────────────────────────

export async function deleteRigAction(eventId: string): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const count = await prisma.rigFixture.count({ where: { eventId } });
  await prisma.rigFixture.deleteMany({ where: { eventId } });

  if (count > 0) {
    await logActivity({ userId: user.id, action: `Rig gelöscht (${count} Fixtures)`, eventId });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/rig`);
  return undefined;
}

// ── In Packliste übernehmen ──────────────────────────────────────────────

export type ApplyPacklistResult = { added: number; skippedReasons: string[] };

function formatFixturePosition(f: { layerName: string | null; posX: number | null; posY: number | null }): string {
  const layer = f.layerName?.trim() || "Ohne Layer";
  if (f.posX == null || f.posY == null) return layer;
  return `${layer} / ${f.posX.toFixed(2)},${f.posY.toFixed(2)}`;
}

export async function applyRigToPacklistAction(eventId: string): Promise<ApplyPacklistResult> {
  const user = await requireUser();
  if (!canEdit(user)) return { added: 0, skippedReasons: ["Keine Berechtigung."] };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { added: 0, skippedReasons: ["Veranstaltung nicht gefunden."] };

  const rigFixtures = await prisma.rigFixture.findMany({
    where: { eventId, deviceId: { not: null } },
    include: { device: true },
  });

  // Ein Gerät darf mehreren Fixtures zugeordnet sein — für die Packliste zählt es
  // nur einmal; die erste zugehörige Fixture liefert die Positions-Vorbelegung.
  const byDevice = new Map<string, (typeof rigFixtures)[number]>();
  for (const f of rigFixtures) {
    if (f.deviceId && !byDevice.has(f.deviceId)) byDevice.set(f.deviceId, f);
  }

  let added = 0;
  const reasonCounts = new Map<string, number>();
  const bump = (reason: string) => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);

  for (const [deviceId, fixture] of byDevice) {
    const device = fixture.device!;
    const existingItem = await prisma.eventItem.findUnique({
      where: { eventId_deviceId: { eventId, deviceId } },
    });
    if (existingItem) {
      bump("bereits in Packliste");
      continue;
    }
    if (NOT_PLANNABLE.includes(device.status as DeviceStatus)) {
      bump("nicht einsatzbereit");
      continue;
    }
    const conflict = await findEventConflict(deviceId, eventId, event.startDate, event.endDate);
    if (conflict) {
      bump("Terminkonflikt");
      continue;
    }

    await prisma.eventItem.create({
      data: { eventId, deviceId, position: formatFixturePosition(fixture) },
    });
    await logActivity({
      userId: user.id,
      action: `Packliste: ${device.name} aus Rig übernommen`,
      eventId,
      deviceId,
    });
    added++;
  }

  const skippedReasons = Array.from(reasonCounts.entries()).map(
    ([reason, count]) => `${count} übersprungen (${reason})`
  );

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/rig`);
  return { added, skippedReasons };
}

// ── Positionen auf den Veranstaltungsplan übertragen ─────────────────────

export type ApplyPlanResult = { error?: string; success?: string };

export async function applyRigPositionsToPlanAction(eventId: string): Promise<ApplyPlanResult> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };
  if (!event.planImage) return { error: "Für dieses Event ist kein Veranstaltungsplan hochgeladen." };

  const rigFixtures = await prisma.rigFixture.findMany({
    where: { eventId, deviceId: { not: null }, posX: { not: null }, posY: { not: null } },
  });

  const byDevice = new Map<string, (typeof rigFixtures)[number]>();
  for (const f of rigFixtures) {
    if (f.deviceId && !byDevice.has(f.deviceId)) byDevice.set(f.deviceId, f);
  }
  if (byDevice.size === 0) return { error: "Keine zugeordneten Fixtures mit Position gefunden." };

  const deviceIds = Array.from(byDevice.keys());
  const items = await prisma.eventItem.findMany({ where: { eventId, deviceId: { in: deviceIds } } });
  const itemByDevice = new Map(items.map((i) => [i.deviceId, i]));

  const usable: { deviceId: string; x: number; y: number }[] = [];
  for (const [deviceId, fixture] of byDevice) {
    if (!itemByDevice.has(deviceId)) continue;
    usable.push({ deviceId, x: fixture.posX!, y: fixture.posY! });
  }
  if (usable.length === 0) {
    return { error: "Keine der zugeordneten Geräte befindet sich in der Packliste." };
  }

  const xs = usable.map((u) => u.x);
  const ys = usable.map((u) => u.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const margin = 0.05;
  const span = 1 - margin * 2;

  for (const u of usable) {
    const nx = rangeX === 0 ? 0.5 : (u.x - minX) / rangeX;
    const ny = rangeY === 0 ? 0.5 : (u.y - minY) / rangeY;
    const planX = margin + nx * span;
    // y-Achse gespiegelt: größeres Welt-Y => weiter oben im Plan (kleineres planY)
    const planY = margin + (1 - ny) * span;
    const item = itemByDevice.get(u.deviceId)!;
    await prisma.eventItem.update({ where: { id: item.id }, data: { planX, planY } });
  }

  await logActivity({
    userId: user.id,
    action: `Rig-Positionen auf Plan übertragen (${usable.length} Marker)`,
    eventId,
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/rig`);
  return { success: `${usable.length} Positionen übertragen.` };
}
