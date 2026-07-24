"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type ActionState = { error?: string; success?: string } | undefined;

function readCaseFields(formData: FormData) {
  return {
    inventoryNo: String(formData.get("inventoryNo") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    locationId: String(formData.get("locationId") ?? "") || null,
  };
}

export async function createCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const fields = readCaseFields(formData);

  if (!fields.name) return { error: "Bitte einen Namen angeben." };
  if (!fields.inventoryNo) return { error: "Bitte eine Inventarnummer angeben." };

  const existing = await prisma.case.findUnique({ where: { inventoryNo: fields.inventoryNo } });
  if (existing) return { error: `Die Inventarnummer "${fields.inventoryNo}" ist bereits vergeben.` };

  if (fields.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: fields.locationId } });
    if (!loc) return { error: "Ungültiger Standort." };
  }

  const caseRecord = await prisma.case.create({
    data: {
      inventoryNo: fields.inventoryNo,
      name: fields.name,
      description: fields.description,
      locationId: fields.locationId,
    },
  });

  await logActivity({ userId: user.id, action: `Case angelegt: ${caseRecord.name}` });

  revalidatePath("/cases");
  redirect(`/cases/${caseRecord.id}`);
}

export async function updateCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ungültiges Case." };

  const existing = await prisma.case.findUnique({ where: { id } });
  if (!existing) return { error: "Case nicht gefunden." };

  const fields = readCaseFields(formData);

  if (!fields.name) return { error: "Bitte einen Namen angeben." };
  if (!fields.inventoryNo) return { error: "Bitte eine Inventarnummer angeben." };

  if (fields.inventoryNo !== existing.inventoryNo) {
    const dup = await prisma.case.findUnique({ where: { inventoryNo: fields.inventoryNo } });
    if (dup) return { error: `Die Inventarnummer "${fields.inventoryNo}" ist bereits vergeben.` };
  }

  if (fields.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: fields.locationId } });
    if (!loc) return { error: "Ungültiger Standort." };
  }

  await prisma.case.update({
    where: { id },
    data: {
      inventoryNo: fields.inventoryNo,
      name: fields.name,
      description: fields.description,
      locationId: fields.locationId,
    },
  });

  await logActivity({ userId: user.id, action: `Case bearbeitet: ${fields.name}` });

  revalidatePath("/cases");
  revalidatePath(`/cases/${id}`);
  redirect(`/cases/${id}`);
}

export async function deleteCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const caseRecord = await prisma.case.findUnique({ where: { id } });
  if (!caseRecord) return { error: "Case nicht gefunden." };

  await prisma.case.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    action: "Case gelöscht",
    details: `${caseRecord.name} (${caseRecord.inventoryNo})`,
  });

  revalidatePath("/cases");
  redirect("/cases");
}

// ── Geräte im Case ───────────────────────────────────────────────────

export async function addDeviceToCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const caseId = String(formData.get("caseId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "");
  if (!deviceId) return { error: "Bitte ein Gerät auswählen." };

  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) return { error: "Case nicht gefunden." };

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  await prisma.device.update({ where: { id: deviceId }, data: { caseId } });

  await logActivity({
    userId: user.id,
    action: `Zum Case ${caseRecord.name} hinzugefügt`,
    deviceId,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/geraete/${deviceId}`);
  return undefined;
}

export async function removeDeviceFromCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const caseId = String(formData.get("caseId") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "");

  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) return { error: "Case nicht gefunden." };

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return { error: "Gerät nicht gefunden." };

  await prisma.device.update({ where: { id: deviceId }, data: { caseId: null } });

  await logActivity({
    userId: user.id,
    action: `Aus Case ${caseRecord.name} entfernt`,
    deviceId,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath(`/geraete/${deviceId}`);
  return undefined;
}

// ── Sammel-Umbuchung ─────────────────────────────────────────────────

export async function relocateCaseAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const caseId = String(formData.get("caseId") ?? "");
  const locationId = String(formData.get("locationId") ?? "") || null;

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    include: { devices: { include: { location: true } } },
  });
  if (!caseRecord) return { error: "Case nicht gefunden." };

  let newLocation: { name: string } | null = null;
  if (locationId) {
    newLocation = await prisma.location.findUnique({ where: { id: locationId } });
    if (!newLocation) return { error: "Ungültiger Standort." };
  }
  const newLocationName = newLocation?.name ?? "kein Standort";

  await prisma.case.update({ where: { id: caseId }, data: { locationId } });

  let movedCount = 0;
  for (const device of caseRecord.devices) {
    if ((device.locationId ?? null) === locationId) continue;
    await prisma.device.update({ where: { id: device.id }, data: { locationId } });
    await logActivity({
      userId: user.id,
      action: `Standort geändert: ${device.location?.name ?? "kein Standort"} → ${newLocationName} (per Case-Umbuchung ${caseRecord.name})`,
      deviceId: device.id,
    });
    movedCount += 1;
  }

  revalidatePath(`/cases/${caseId}`);
  for (const device of caseRecord.devices) {
    revalidatePath(`/geraete/${device.id}`);
  }

  return { success: `${caseRecord.devices.length} Geräte nach ${newLocationName} umgebucht` };
}

// ── Scan-Zuordnung (Sammelliste + Bestätigung) ──────────────────────

export type ScanCheckResult = {
  kind: "ready" | "alreadyHere" | "otherCase" | "unknown" | "isCase" | "error";
  deviceId?: string;
  deviceName?: string;
  inventoryNo?: string;
  otherCaseName?: string;
  message?: string;
};

export type AssignBatchOutcome = "assigned" | "moved" | "skippedUnknown" | "skippedAlready" | "skippedOtherCase";

export type AssignBatchResult = {
  inventoryNo: string;
  deviceName?: string;
  outcome: AssignBatchOutcome;
  detail?: string;
};

/** Aus einem gescannten Text (URL oder Rohtext) die Inventarnummer extrahieren. */
function extractInventoryNoFromCode(code: string): string {
  try {
    const url = new URL(code);
    if (url.pathname.startsWith("/d/")) {
      return decodeURIComponent(url.pathname.slice("/d/".length));
    }
  } catch {
    // kein gültiges URL-Format — Rohtext wird als Inventarnummer verwendet
  }
  return code.trim();
}

/**
 * Prüft einen gescannten/eingegebenen Code READ-ONLY gegen den Ziel-Case.
 * Schreibt nichts — dient dem Aufbau der client-seitigen Sammelliste.
 */
export async function scanCheckAction(caseId: string, code: string): Promise<ScanCheckResult> {
  const user = await requireUser();
  if (!canEdit(user)) return { kind: "error", message: "Keine Berechtigung." };

  const inventoryNo = extractInventoryNoFromCode(code);
  if (!inventoryNo) return { kind: "error", message: "Leerer Code." };

  const targetCase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!targetCase) return { kind: "error", message: "Case nicht gefunden." };

  const device = await prisma.device.findUnique({
    where: { inventoryNo },
    include: { case: true },
  });

  if (!device) {
    const caseMatch = await prisma.case.findUnique({ where: { inventoryNo } });
    if (caseMatch) {
      return { kind: "isCase", inventoryNo, message: "Das ist ein Case-Code — bitte Geräte scannen" };
    }
    return { kind: "unknown", inventoryNo, message: `${inventoryNo} nicht gefunden` };
  }

  if (device.caseId === caseId) {
    return {
      kind: "alreadyHere",
      deviceId: device.id,
      deviceName: device.name,
      inventoryNo: device.inventoryNo,
    };
  }

  if (device.caseId && device.case) {
    return {
      kind: "otherCase",
      deviceId: device.id,
      deviceName: device.name,
      inventoryNo: device.inventoryNo,
      otherCaseName: device.case.name,
    };
  }

  return {
    kind: "ready",
    deviceId: device.id,
    deviceName: device.name,
    inventoryNo: device.inventoryNo,
  };
}

/**
 * Führt die gesammelten Scan-Einträge als Batch aus. Prüft pro Item erneut
 * den aktuellen Zustand (kann sich seit der Vorprüfung geändert haben).
 */
export async function assignBatchAction(
  caseId: string,
  items: { inventoryNo: string; allowMove: boolean }[]
): Promise<AssignBatchResult[]> {
  const user = await requireUser();
  if (!canEdit(user)) {
    return [{ inventoryNo: "", outcome: "skippedUnknown", detail: "Keine Berechtigung." }];
  }

  const limited = items.slice(0, 200);

  const targetCase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!targetCase) {
    return limited.map((item) => ({
      inventoryNo: item.inventoryNo,
      outcome: "skippedUnknown" as const,
      detail: "Case nicht gefunden.",
    }));
  }

  const results: AssignBatchResult[] = [];

  for (const item of limited) {
    const device = await prisma.device.findUnique({
      where: { inventoryNo: item.inventoryNo },
      include: { case: true },
    });

    if (!device) {
      results.push({ inventoryNo: item.inventoryNo, outcome: "skippedUnknown" });
      continue;
    }

    if (device.caseId === caseId) {
      results.push({
        inventoryNo: device.inventoryNo,
        deviceName: device.name,
        outcome: "skippedAlready",
      });
      continue;
    }

    if (device.caseId && device.case && !item.allowMove) {
      results.push({
        inventoryNo: device.inventoryNo,
        deviceName: device.name,
        outcome: "skippedOtherCase",
        detail: device.case.name,
      });
      continue;
    }

    const previousCaseName = device.case?.name;

    await prisma.device.update({ where: { id: device.id }, data: { caseId } });

    await logActivity({
      userId: user.id,
      action:
        previousCaseName
          ? `Zum Case ${targetCase.name} umgehängt (per Scan bestätigt, vorher ${previousCaseName})`
          : `Zum Case ${targetCase.name} hinzugefügt (per Scan bestätigt)`,
      deviceId: device.id,
    });

    if (device.caseId) revalidatePath(`/cases/${device.caseId}`);
    revalidatePath(`/geraete/${device.id}`);

    results.push({
      inventoryNo: device.inventoryNo,
      deviceName: device.name,
      outcome: previousCaseName ? "moved" : "assigned",
    });
  }

  revalidatePath(`/cases/${caseId}`);

  return results;
}
