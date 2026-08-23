"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { saveUpload } from "@/lib/uploads";
import {
  DEVICE_STATUS,
  type DeviceStatus,
  ISSUE_STATUS,
  type IssueStatus,
  MAINTENANCE_RESULT,
  isMaintenanceResult,
} from "@/lib/constants";
import { fieldByCode, parseFieldCodes } from "@/lib/fieldCatalog";

export type ActionState =
  | {
      error?: string;
      success?: boolean;
      /** Wechselt bei jedem Erfolg. Formulare hängen ihren React-Schlüssel daran
       *  und montieren sich neu, statt ihren Zustand in einem Effect zurückzusetzen. */
      token?: number;
    }
  | undefined;

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidStatus(value: string): value is DeviceStatus {
  return value in DEVICE_STATUS;
}

/** "Angezeigte Zusatzfelder": null = Kategorie-Standard, sonst JSON-Array eigener Codes. */
function readFieldOverride(formData: FormData): string | null {
  const mode = String(formData.get("fieldMode") ?? "standard");
  if (mode !== "custom") return null;
  const codes = formData
    .getAll("fieldCodes")
    .map((v) => String(v))
    .filter((c) => fieldByCode(c));
  return JSON.stringify(codes);
}

function readDeviceFields(formData: FormData) {
  return {
    inventoryNo: String(formData.get("inventoryNo") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || null,
    serialNo: String(formData.get("serialNo") ?? "").trim() || null,
    purchaseDate: parseOptionalDate(formData.get("purchaseDate")),
    purchasePrice: parseOptionalFloat(formData.get("purchasePrice")),
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    weightKg: parseOptionalFloat(formData.get("weightKg")),
    notes: String(formData.get("notes") ?? "").trim() || null,
    locationId: String(formData.get("locationId") ?? "") || null,
    caseId: String(formData.get("caseId") ?? "") || null,
    status: String(formData.get("status") ?? "EINSATZBEREIT"),
  };
}

export async function createDeviceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const fields = readDeviceFields(formData);

  if (!fields.name) return { error: "Bitte einen Namen angeben." };
  if (!fields.inventoryNo) return { error: "Bitte eine Inventarnummer angeben." };
  if (!isValidStatus(fields.status)) return { error: "Ungültiger Status." };

  const existing = await prisma.device.findUnique({ where: { inventoryNo: fields.inventoryNo } });
  if (existing) return { error: `Die Inventarnummer "${fields.inventoryNo}" ist bereits vergeben.` };

  if (fields.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: fields.locationId } });
    if (!loc) return { error: "Ungültiger Standort." };
  }

  if (fields.caseId) {
    const caseRecord = await prisma.case.findUnique({ where: { id: fields.caseId } });
    if (!caseRecord) return { error: "Ungültiges Case." };
  }

  const device = await prisma.device.create({
    data: {
      inventoryNo: fields.inventoryNo,
      name: fields.name,
      category: fields.category,
      serialNo: fields.serialNo,
      purchaseDate: fields.purchaseDate,
      purchasePrice: fields.purchasePrice,
      supplier: fields.supplier,
      weightKg: fields.weightKg,
      notes: fields.notes,
      locationId: fields.locationId,
      caseId: fields.caseId,
      status: fields.status,
    },
  });

  await logActivity({ userId: user.id, action: "Gerät angelegt", deviceId: device.id });

  revalidatePath("/geraete");
  redirect(`/geraete/${device.id}`);
}

export async function updateDeviceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ungültiges Gerät." };

  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) return { error: "Gerät nicht gefunden." };

  const fields = readDeviceFields(formData);

  if (!fields.name) return { error: "Bitte einen Namen angeben." };
  if (!fields.inventoryNo) return { error: "Bitte eine Inventarnummer angeben." };
  if (!isValidStatus(fields.status)) return { error: "Ungültiger Status." };

  if (fields.inventoryNo !== existing.inventoryNo) {
    const dup = await prisma.device.findUnique({ where: { inventoryNo: fields.inventoryNo } });
    if (dup) return { error: `Die Inventarnummer "${fields.inventoryNo}" ist bereits vergeben.` };
  }

  if (fields.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: fields.locationId } });
    if (!loc) return { error: "Ungültiger Standort." };
  }

  if (fields.caseId) {
    const caseRecord = await prisma.case.findUnique({ where: { id: fields.caseId } });
    if (!caseRecord) return { error: "Ungültiges Case." };
  }

  const fieldOverride = readFieldOverride(formData);

  const changedFields: string[] = [];
  if (existing.inventoryNo !== fields.inventoryNo) changedFields.push("Inventarnummer");
  if (existing.name !== fields.name) changedFields.push("Name");
  if ((existing.category ?? null) !== fields.category) changedFields.push("Kategorie");
  if ((existing.serialNo ?? null) !== fields.serialNo) changedFields.push("Seriennummer");
  if ((existing.purchaseDate?.getTime() ?? null) !== (fields.purchaseDate?.getTime() ?? null))
    changedFields.push("Kaufdatum");
  if ((existing.purchasePrice ?? null) !== fields.purchasePrice) changedFields.push("Kaufpreis");
  if ((existing.supplier ?? null) !== fields.supplier) changedFields.push("Lieferant");
  if ((existing.weightKg ?? null) !== fields.weightKg) changedFields.push("Gewicht");
  if ((existing.notes ?? null) !== fields.notes) changedFields.push("Notizen");
  if ((existing.locationId ?? null) !== fields.locationId) changedFields.push("Standort");
  if ((existing.caseId ?? null) !== fields.caseId) changedFields.push("Case");
  if (existing.status !== fields.status) changedFields.push("Status");
  if ((existing.fieldOverride ?? null) !== fieldOverride) changedFields.push("Feldauswahl");

  await prisma.device.update({
    where: { id },
    data: {
      inventoryNo: fields.inventoryNo,
      name: fields.name,
      category: fields.category,
      serialNo: fields.serialNo,
      purchaseDate: fields.purchaseDate,
      purchasePrice: fields.purchasePrice,
      supplier: fields.supplier,
      weightKg: fields.weightKg,
      notes: fields.notes,
      locationId: fields.locationId,
      caseId: fields.caseId,
      status: fields.status,
      fieldOverride,
    },
  });

  if (changedFields.length > 0) {
    await logActivity({
      userId: user.id,
      action: "Gerät bearbeitet",
      details: changedFields.join(", "),
      deviceId: id,
    });
  }

  revalidatePath("/geraete");
  revalidatePath(`/geraete/${id}`);
  redirect(`/geraete/${id}`);
}

export async function changeStatusAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("deviceId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isValidStatus(status)) return { error: "Ungültiger Status." };

  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) return { error: "Gerät nicht gefunden." };

  if (existing.status === status) return undefined;

  await prisma.device.update({ where: { id }, data: { status } });

  const oldLabel = isValidStatus(existing.status) ? DEVICE_STATUS[existing.status].label : existing.status;

  await logActivity({
    userId: user.id,
    action: `Status geändert: ${oldLabel} → ${DEVICE_STATUS[status].label}`,
    deviceId: id,
  });

  revalidatePath(`/geraete/${id}`);
  revalidatePath("/geraete");
  return undefined;
}

export async function changeLocationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("deviceId") ?? "");
  const locationId = String(formData.get("locationId") ?? "") || null;

  const existing = await prisma.device.findUnique({ where: { id }, include: { location: true } });
  if (!existing) return { error: "Gerät nicht gefunden." };

  let newLocation: { name: string } | null = null;
  if (locationId) {
    newLocation = await prisma.location.findUnique({ where: { id: locationId } });
    if (!newLocation) return { error: "Ungültiger Standort." };
  }

  if ((existing.locationId ?? null) === locationId) return undefined;

  await prisma.device.update({ where: { id }, data: { locationId } });

  await logActivity({
    userId: user.id,
    action: `Standort geändert: ${existing.location?.name ?? "kein Standort"} → ${newLocation?.name ?? "kein Standort"}`,
    deviceId: id,
  });

  revalidatePath(`/geraete/${id}`);
  return undefined;
}

export async function uploadPhotoAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const deviceId = String(formData.get("deviceId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte ein Foto auswählen." };
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  let filename: string;
  try {
    filename = await saveUpload(file);
  } catch {
    return { error: "Dieser Dateityp wird nicht unterstützt." };
  }

  await prisma.photo.create({
    data: { filename, caption, deviceId, uploadedById: user.id },
  });

  await logActivity({ userId: user.id, action: "Foto hinzugefügt", deviceId });

  revalidatePath(`/geraete/${deviceId}`);
  return undefined;
}

export async function deletePhotoAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const photoId = String(formData.get("photoId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "");

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return { error: "Foto nicht gefunden." };

  await prisma.photo.delete({ where: { id: photoId } });

  revalidatePath(`/geraete/${deviceId}`);
  return undefined;
}

export async function deleteDeviceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return { error: "Gerät nicht gefunden." };

  await prisma.device.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    action: "Gerät gelöscht",
    details: `${device.name} (${device.inventoryNo})`,
  });

  revalidatePath("/geraete");
  redirect("/geraete");
}

function isValidLat(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLng(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Erfasst einen QR-Scan: aktualisiert bei vorhandenen Koordinaten "zuletzt gesehen"
 * und protokolliert den Scan in jedem Fall (auch ohne GPS). Auch für HELFER erlaubt.
 */
export async function recordScanAction(
  deviceId: string,
  lat: number | null,
  lng: number | null
): Promise<void> {
  const user = await requireUser();

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return;

  const validLat = isValidLat(lat) ? lat : null;
  const validLng = isValidLng(lng) ? lng : null;

  let details = "ohne GPS";

  if (validLat != null && validLng != null) {
    details = `mit GPS (${validLat.toFixed(5)}, ${validLng.toFixed(5)})`;
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastLat: validLat, lastLng: validLng, lastSeenAt: new Date() },
    });
  }

  await logActivity({
    userId: user.id,
    action: "Gerät gescannt",
    details,
    deviceId,
    lat: validLat ?? undefined,
    lng: validLng ?? undefined,
  });

  revalidatePath(`/geraete/${deviceId}`);
}

// ── Fehlermeldungen ─────────────────────────────────────────────────

function isValidIssueStatus(value: string): value is IssueStatus {
  return value in ISSUE_STATUS;
}

/** Fehler melden — für ALLE Rollen erlaubt, auch HELFER. */
export async function createIssueAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const deviceId = String(formData.get("deviceId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const file = formData.get("file");

  if (!description) return { error: "Bitte eine Beschreibung angeben." };

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  const issue = await prisma.issue.create({
    data: { deviceId, reporterId: user.id, description },
  });

  if (file instanceof File && file.size > 0) {
    try {
      const filename = await saveUpload(file);
      await prisma.photo.create({
        data: { filename, issueId: issue.id, uploadedById: user.id },
      });
    } catch {
      // Foto war optional — Dateityp nicht unterstützt, Fehlermeldung bleibt trotzdem bestehen.
    }
  }

  if (device.status === "EINSATZBEREIT") {
    await prisma.device.update({ where: { id: deviceId }, data: { status: "DEFEKT_GEMELDET" } });
  }

  const shortDescription = description.length > 100 ? `${description.slice(0, 100)}…` : description;

  await logActivity({
    userId: user.id,
    action: "Fehler gemeldet",
    details: shortDescription,
    deviceId,
  });

  revalidatePath(`/geraete/${deviceId}`);
  revalidatePath("/geraete");
  return undefined;
}

/**
 * Statuswechsel einer Fehlermeldung (nur canEdit). Aktualisiert bei Bedarf
 * auch automatisch den Gerätestatus und protokolliert beides.
 */
export async function setIssueStatusAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const issueId = String(formData.get("issueId") ?? "");
  const targetStatus = String(formData.get("status") ?? "");

  if (!isValidIssueStatus(targetStatus)) return { error: "Ungültiger Status." };

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) return { error: "Fehlermeldung nicht gefunden." };

  const device = await prisma.device.findUnique({ where: { id: issue.deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status: targetStatus,
      resolvedAt: targetStatus === "ERLEDIGT" ? new Date() : null,
    },
  });

  const oldIssueLabel = isValidIssueStatus(issue.status) ? ISSUE_STATUS[issue.status].label : issue.status;

  await logActivity({
    userId: user.id,
    action: `Fehlermeldung Status geändert: ${oldIssueLabel} → ${ISSUE_STATUS[targetStatus].label}`,
    deviceId: device.id,
  });

  if (targetStatus === "IN_REPARATUR" && device.status !== "IN_REPARATUR" && device.status !== "AUSGEMUSTERT") {
    const oldDeviceLabel = isValidStatus(device.status) ? DEVICE_STATUS[device.status].label : device.status;
    await prisma.device.update({ where: { id: device.id }, data: { status: "IN_REPARATUR" } });
    await logActivity({
      userId: user.id,
      action: `Status geändert: ${oldDeviceLabel} → ${DEVICE_STATUS.IN_REPARATUR.label}`,
      deviceId: device.id,
    });
  } else if (targetStatus === "ERLEDIGT") {
    const remainingOpen = await prisma.issue.count({
      where: {
        deviceId: device.id,
        status: { in: ["OFFEN", "IN_REPARATUR"] },
        NOT: { id: issueId },
      },
    });
    const newDeviceStatus: DeviceStatus = remainingOpen === 0 ? "EINSATZBEREIT" : "DEFEKT_GEMELDET";
    // Automatik nur im Defekt-Workflow: manuell gesperrte oder ausgemusterte
    // Geräte werden durch das Erledigen einer Meldung nicht reaktiviert.
    const autoManaged = device.status === "DEFEKT_GEMELDET" || device.status === "IN_REPARATUR";
    if (autoManaged && device.status !== newDeviceStatus) {
      const oldDeviceLabel = isValidStatus(device.status) ? DEVICE_STATUS[device.status].label : device.status;
      await prisma.device.update({ where: { id: device.id }, data: { status: newDeviceStatus } });
      await logActivity({
        userId: user.id,
        action: `Status geändert: ${oldDeviceLabel} → ${DEVICE_STATUS[newDeviceStatus].label}`,
        deviceId: device.id,
      });
    }
  }

  revalidatePath(`/geraete/${device.id}`);
  revalidatePath("/geraete");
  return undefined;
}

// ── Wartungspläne ───────────────────────────────────────────────────

function parseIntervalMonths(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 120) return null;
  return n;
}

export async function createMaintenancePlanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const deviceId = String(formData.get("deviceId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const intervalMonths = parseIntervalMonths(formData.get("intervalMonths"));
  const lastDoneAt = parseOptionalDate(formData.get("lastDoneAt"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!title) return { error: "Bitte einen Titel angeben." };
  if (intervalMonths == null) return { error: "Bitte ein gültiges Intervall (1–120 Monate) angeben." };

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  await prisma.maintenancePlan.create({
    data: { deviceId, title, intervalMonths, lastDoneAt, notes },
  });

  await logActivity({
    userId: user.id,
    action: `Wartungsplan hinzugefügt: ${title}`,
    deviceId,
  });

  revalidatePath(`/geraete/${deviceId}`);
  revalidatePath("/wartung");
  return undefined;
}

/**
 * Führt den Fälligkeitsstichtag eines Plans anhand seiner Prüfungen nach.
 *
 * Maßgeblich ist die jüngste Prüfung, die das Intervall zurücksetzt — eine
 * nicht bestandene Prüfung tut das nicht. Gibt es (noch) keine solche Prüfung,
 * bleibt ein von Hand eingetragener Stichtag unangetastet: er ist dann die
 * einzige Angabe darüber, wann zuletzt geprüft wurde.
 */
async function syncPlanLastDone(planId: string) {
  const resetting = Object.entries(MAINTENANCE_RESULT)
    .filter(([, cfg]) => cfg.resetsInterval)
    .map(([key]) => key);

  const newest = await prisma.maintenanceRecord.findFirst({
    where: { planId, result: { in: resetting } },
    orderBy: { performedAt: "desc" },
    select: { performedAt: true },
  });

  if (!newest) return;
  await prisma.maintenancePlan.update({
    where: { id: planId },
    data: { lastDoneAt: newest.performedAt },
  });
}

/** Erfasst eine durchgeführte Prüfung samt Ergebnis, Prüfer und Protokoll. */
export async function recordMaintenanceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const planId = String(formData.get("planId") ?? "");
  const result = String(formData.get("result") ?? "");
  const performedAt = parseOptionalDate(formData.get("performedAt")) ?? new Date();
  const testerName = String(formData.get("testerName") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const blockDevice = formData.get("blockDevice") === "on";
  const unblockDevice = formData.get("unblockDevice") === "on";
  const file = formData.get("file");

  if (!isMaintenanceResult(result)) return { error: "Bitte ein Ergebnis auswählen." };
  if (performedAt.getTime() > Date.now()) {
    return { error: "Das Prüfdatum kann nicht in der Zukunft liegen." };
  }

  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Wartungsplan nicht gefunden." };

  // Das Protokoll zuerst speichern: schlägt der Upload fehl, entsteht kein
  // Prüfeintrag, der einen Nachweis behauptet, den es nicht gibt.
  let filename: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      filename = await saveUpload(file);
    } catch {
      return { error: "Dieser Dateityp wird nicht unterstützt (erlaubt: PDF und Bilder)." };
    }
  }

  const record = await prisma.maintenanceRecord.create({
    data: {
      planId,
      performedAt,
      result,
      testerName,
      notes,
      recordedById: user.id,
      ...(filename
        ? { documents: { create: { filename, caption: "Prüfprotokoll", uploadedById: user.id } } }
        : {}),
    },
  });

  await syncPlanLastDone(planId);

  // Sperren nur auf ausdrücklichen Wunsch — der Haken ist bei "nicht bestanden"
  // vorbelegt, gesetzt wird der Status aber nie von allein.
  if (blockDevice) {
    const device = await prisma.device.findUnique({ where: { id: plan.deviceId } });
    if (device && device.status !== "GESPERRT") {
      await prisma.device.update({ where: { id: plan.deviceId }, data: { status: "GESPERRT" } });
      await logActivity({
        userId: user.id,
        action: `Status geändert: ${DEVICE_STATUS[device.status as DeviceStatus]?.label ?? device.status} → Gesperrt`,
        details: `Prüfung nicht bestanden: ${plan.title}`,
        deviceId: plan.deviceId,
      });
    }
  }

  // Das Gegenstück: Nach bestandener Nachprüfung darf ein gesperrtes Gerät
  // wieder freigegeben werden. Ohne das blieb die Sperre Handarbeit an
  // anderer Stelle — und wurde dort erfahrungsgemäß vergessen.
  //
  // Nur aus GESPERRT heraus: "defekt gemeldet", "in Reparatur" oder
  // "ausgemustert" haben eigene Gründe, die eine Prüfung nicht aufhebt.
  if (unblockDevice && MAINTENANCE_RESULT[result].resetsInterval) {
    const device = await prisma.device.findUnique({ where: { id: plan.deviceId } });
    if (device && device.status === "GESPERRT") {
      await prisma.device.update({
        where: { id: plan.deviceId },
        data: { status: "EINSATZBEREIT" },
      });
      await logActivity({
        userId: user.id,
        action: "Status geändert: Gesperrt → Einsatzbereit",
        details: `Prüfung bestanden: ${plan.title}`,
        deviceId: plan.deviceId,
      });
    }
  }

  await logActivity({
    userId: user.id,
    action: `Prüfung erfasst: ${plan.title} — ${MAINTENANCE_RESULT[result].label}`,
    details:
      [testerName && `Prüfer: ${testerName}`, filename && "Protokoll hinterlegt"]
        .filter(Boolean)
        .join(" · ") || undefined,
    deviceId: plan.deviceId,
  });

  revalidatePath(`/geraete/${plan.deviceId}`);
  revalidatePath("/wartung");
  return { success: true, token: Date.now() };
}

/** Löscht einen Prüfeintrag. Nur Admin — es ist ein Nachweisdokument. */
export async function deleteMaintenanceRecordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Nur Admins dürfen Prüfnachweise löschen." };

  const recordId = String(formData.get("recordId") ?? "");
  const record = await prisma.maintenanceRecord.findUnique({
    where: { id: recordId },
    include: { plan: true },
  });
  if (!record) return { error: "Prüfeintrag nicht gefunden." };

  await prisma.maintenanceRecord.delete({ where: { id: recordId } });
  await syncPlanLastDone(record.planId);

  await logActivity({
    userId: user.id,
    action: `Prüfnachweis gelöscht: ${record.plan.title}`,
    details: `Prüfung vom ${record.performedAt.toLocaleDateString("de-DE")}`,
    deviceId: record.plan.deviceId,
  });

  revalidatePath(`/geraete/${record.plan.deviceId}`);
  revalidatePath("/wartung");
  return undefined;
}

export async function deleteMaintenancePlanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Wartungsplan nicht gefunden." };

  await prisma.maintenancePlan.delete({ where: { id: planId } });

  await logActivity({
    userId: user.id,
    action: `Wartungsplan gelöscht: ${plan.title}`,
    deviceId: plan.deviceId,
  });

  revalidatePath(`/geraete/${plan.deviceId}`);
  revalidatePath("/wartung");
  return undefined;
}

// ── Technische Zusatzfelder ─────────────────────────────────────────

/** Für ein Gerät wirksame Feld-Codes: eigener Override, sonst Kategorie-Standard. */
export async function resolveActiveFieldCodes(device: {
  category: string | null;
  fieldOverride: string | null;
}): Promise<string[]> {
  const overrideCodes = parseFieldCodes(device.fieldOverride);
  if (overrideCodes) return overrideCodes;

  if (!device.category) return [];
  const config = await prisma.categoryFieldConfig.findUnique({
    where: { category: device.category },
  });
  return parseFieldCodes(config?.fieldCodes ?? null) ?? [];
}

export async function saveFieldValuesAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const deviceId = String(formData.get("deviceId") ?? "");
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  const activeCodes = await resolveActiveFieldCodes(device);
  if (activeCodes.length === 0) return { success: true, token: Date.now() };

  const existingValues = await prisma.deviceFieldValue.findMany({ where: { deviceId } });
  const existingMap = new Map(existingValues.map((v) => [v.fieldCode, v.value]));

  const changedLabels: string[] = [];

  for (const code of activeCodes) {
    const def = fieldByCode(code);
    if (!def) continue;

    const raw = formData.get(code);
    const value = raw == null ? "" : String(raw).trim();
    const previous = existingMap.get(code) ?? "";
    if (value === previous) continue;

    changedLabels.push(def.label);

    if (!value) {
      await prisma.deviceFieldValue.deleteMany({ where: { deviceId, fieldCode: code } });
    } else {
      await prisma.deviceFieldValue.upsert({
        where: { deviceId_fieldCode: { deviceId, fieldCode: code } },
        update: { value },
        create: { deviceId, fieldCode: code, value },
      });
    }
  }

  if (changedLabels.length > 0) {
    await logActivity({
      userId: user.id,
      action: "Technische Daten aktualisiert",
      details: changedLabels.join(", "),
      deviceId,
    });
  }

  revalidatePath(`/geraete/${deviceId}`);
  return { success: true, token: Date.now() };
}
