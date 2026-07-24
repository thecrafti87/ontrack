"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { saveUpload } from "@/lib/uploads";
import { NOT_PLANNABLE, EVENT_ITEM_STATUS, type EventItemStatus, type DeviceStatus } from "@/lib/constants";
import { findEventConflict } from "@/lib/eventConflicts";

export type ActionState = { error?: string; success?: string } | undefined;

function parseRequiredDate(value: FormDataEntryValue | null): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Veranstaltungen: Anlegen / Bearbeiten / Löschen ─────────────────

export async function createEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const startDate = parseRequiredDate(formData.get("startDate"));
  const endDate = parseRequiredDate(formData.get("endDate"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!startDate || !endDate) return { error: "Bitte Start- und Enddatum angeben." };
  if (endDate < startDate) return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };

  const event = await prisma.event.create({
    data: { name, venue, startDate, endDate, notes },
  });

  await logActivity({ userId: user.id, action: "Veranstaltung angelegt", eventId: event.id });

  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const startDate = parseRequiredDate(formData.get("startDate"));
  const endDate = parseRequiredDate(formData.get("endDate"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id) return { error: "Ungültige Veranstaltung." };
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!startDate || !endDate) return { error: "Bitte Start- und Enddatum angeben." };
  if (endDate < startDate) return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return { error: "Veranstaltung nicht gefunden." };

  await prisma.event.update({ where: { id }, data: { name, venue, startDate, endDate, notes } });

  await logActivity({ userId: user.id, action: "Veranstaltung bearbeitet", eventId: id });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  return undefined;
}

export async function deleteEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };

  await prisma.event.delete({ where: { id } });

  await logActivity({ userId: user.id, action: "Veranstaltung gelöscht", details: event.name });

  revalidatePath("/events");
  redirect("/events");
}

// ── Packliste: Geräte hinzufügen (mit Konfliktprüfung) ──────────────

export async function addDevicesToEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const eventId = String(formData.get("eventId") ?? "");
  const deviceIds = Array.from(new Set(formData.getAll("deviceIds").map(String).filter(Boolean)));
  const override = formData.get("override") === "on";

  if (deviceIds.length === 0) return { error: "Bitte mindestens ein Gerät auswählen." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };

  const candidates: { id: string; name: string }[] = [];
  for (const deviceId of deviceIds) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) continue;
    if (NOT_PLANNABLE.includes(device.status as DeviceStatus)) continue;
    const existingItem = await prisma.eventItem.findUnique({
      where: { eventId_deviceId: { eventId, deviceId } },
    });
    if (existingItem) continue;
    candidates.push({ id: device.id, name: device.name });
  }

  if (candidates.length === 0) {
    return { error: "Keine neuen, einplanbaren Geräte in der Auswahl." };
  }

  const conflictByDevice = new Map<string, boolean>();
  const conflictNames: string[] = [];
  for (const candidate of candidates) {
    const conflict = await findEventConflict(candidate.id, eventId, event.startDate, event.endDate);
    conflictByDevice.set(candidate.id, !!conflict);
    if (conflict) conflictNames.push(candidate.name);
  }

  if (conflictNames.length > 0 && !override) {
    return {
      error: `Terminkonflikt bei: ${conflictNames.join(", ")}. Bitte "Konflikte ignorieren" aktivieren, um trotzdem einzuplanen.`,
    };
  }

  for (const candidate of candidates) {
    await prisma.eventItem.create({ data: { eventId, deviceId: candidate.id } });
    const hadConflict = conflictByDevice.get(candidate.id);
    await logActivity({
      userId: user.id,
      action: hadConflict
        ? `Packliste: ${candidate.name} trotz Konflikt eingeplant`
        : `Packliste: ${candidate.name} hinzugefügt`,
      eventId,
      deviceId: candidate.id,
    });
  }

  revalidatePath(`/events/${eventId}`);
  return undefined;
}

export async function addCaseToEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const eventId = String(formData.get("eventId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  if (!caseId) return { error: "Bitte ein Case auswählen." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };

  const targetCase = await prisma.case.findUnique({ where: { id: caseId }, include: { devices: true } });
  if (!targetCase) return { error: "Case nicht gefunden." };

  let added = 0;
  let skippedNotPlannable = 0;
  let skippedConflict = 0;

  for (const device of targetCase.devices) {
    const existingItem = await prisma.eventItem.findUnique({
      where: { eventId_deviceId: { eventId, deviceId: device.id } },
    });
    if (existingItem) continue;

    if (NOT_PLANNABLE.includes(device.status as DeviceStatus)) {
      skippedNotPlannable++;
      continue;
    }

    const conflict = await findEventConflict(device.id, eventId, event.startDate, event.endDate);
    if (conflict) {
      skippedConflict++;
      continue;
    }

    await prisma.eventItem.create({ data: { eventId, deviceId: device.id } });
    await logActivity({
      userId: user.id,
      action: `Packliste: ${device.name} hinzugefügt (Case ${targetCase.name})`,
      eventId,
      deviceId: device.id,
    });
    added++;
  }

  const parts = [`${added} Gerät(e) hinzugefügt`];
  if (skippedNotPlannable > 0) parts.push(`${skippedNotPlannable} übersprungen (defekt)`);
  if (skippedConflict > 0) parts.push(`${skippedConflict} übersprungen (Terminkonflikt)`);

  revalidatePath(`/events/${eventId}`);
  return { success: parts.join(", ") };
}

export async function removeEventItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.eventItem.findUnique({ where: { id: itemId }, include: { device: true } });
  if (!item) return { error: "Eintrag nicht gefunden." };

  await prisma.eventItem.delete({ where: { id: itemId } });

  await logActivity({
    userId: user.id,
    action: `Packliste: ${item.device.name} entfernt`,
    eventId: item.eventId,
    deviceId: item.deviceId,
  });

  revalidatePath(`/events/${item.eventId}`);
  return undefined;
}

// ── Packliste: Statuswechsel (ALLE Rollen inkl. HELFER) ─────────────

export async function advanceItemStatusAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.eventItem.findUnique({
    where: { id: itemId },
    include: { device: true },
  });
  if (!item) return { error: "Eintrag nicht gefunden." };

  const currentDef = EVENT_ITEM_STATUS[item.status as EventItemStatus];
  const next = currentDef?.next;
  if (!next) return { error: "Kein weiterer Schritt möglich." };

  await prisma.eventItem.update({ where: { id: itemId }, data: { status: next } });

  await logActivity({
    userId: user.id,
    action: `Packliste: ${item.device.name} → ${EVENT_ITEM_STATUS[next as EventItemStatus].label}`,
    eventId: item.eventId,
    deviceId: item.deviceId,
  });

  revalidatePath(`/events/${item.eventId}`);
  revalidatePath(`/geraete/${item.deviceId}`);
  return undefined;
}

export async function updateItemPositionTextAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const itemId = String(formData.get("itemId") ?? "");
  const position = String(formData.get("position") ?? "").trim() || null;

  const item = await prisma.eventItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Eintrag nicht gefunden." };

  await prisma.eventItem.update({ where: { id: itemId }, data: { position } });

  revalidatePath(`/events/${item.eventId}`);
  return undefined;
}

export async function bulkMarkPackedAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const eventId = String(formData.get("eventId") ?? "");
  const result = await prisma.eventItem.updateMany({
    where: { eventId, status: "GEPLANT" },
    data: { status: "GEPACKT" },
  });

  if (result.count > 0) {
    await logActivity({
      userId: user.id,
      action: `Packliste: alle als gepackt markiert (${result.count} Gerät(e))`,
      eventId,
    });
  }

  revalidatePath(`/events/${eventId}`);
  return undefined;
}

export async function bulkMarkReturnedAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const eventId = String(formData.get("eventId") ?? "");
  const result = await prisma.eventItem.updateMany({
    where: { eventId, status: { not: "ZURUECK" } },
    data: { status: "ZURUECK" },
  });

  if (result.count > 0) {
    await logActivity({
      userId: user.id,
      action: `Packliste: alle als zurück im Lager markiert (${result.count} Gerät(e))`,
      eventId,
    });
  }

  revalidatePath(`/events/${eventId}`);
  return undefined;
}

// ── Veranstaltungsplan: Upload & Positionierung ─────────────────────

export async function uploadPlanImageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const eventId = String(formData.get("eventId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Bilddatei auswählen." };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };

  let filename: string;
  try {
    filename = await saveUpload(file);
  } catch {
    return { error: "Dieser Dateityp wird nicht unterstützt (jpg/png/webp)." };
  }

  await prisma.event.update({ where: { id: eventId }, data: { planImage: filename } });

  await logActivity({
    userId: user.id,
    action: event.planImage ? "Veranstaltungsplan ersetzt" : "Veranstaltungsplan hochgeladen",
    eventId,
  });

  revalidatePath(`/events/${eventId}`);
  return undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Direkter Aufruf aus Client-Komponenten (Drag & Drop / Platzieren) — kein <form>. */
export async function updatePlanPositionAction(
  itemId: string,
  x: number,
  y: number
): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Ungültige Position." };

  const item = await prisma.eventItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Eintrag nicht gefunden." };

  await prisma.eventItem.update({
    where: { id: itemId },
    data: { planX: clamp01(x), planY: clamp01(y) },
  });

  revalidatePath(`/events/${item.eventId}`);
  return undefined;
}

export async function removePlanPositionAction(
  itemId: string
): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const item = await prisma.eventItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Eintrag nicht gefunden." };

  await prisma.eventItem.update({ where: { id: itemId }, data: { planX: null, planY: null } });

  revalidatePath(`/events/${item.eventId}`);
  return undefined;
}
