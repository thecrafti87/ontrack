"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type ActionState = { error?: string } | undefined;

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function createLocationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const lat = parseOptionalFloat(formData.get("lat"));
  const lng = parseOptionalFloat(formData.get("lng"));

  if (!name) return { error: "Bitte einen Namen angeben." };

  const existing = await prisma.location.findUnique({ where: { name } });
  if (existing) return { error: "Ein Standort mit diesem Namen existiert bereits." };

  await prisma.location.create({
    data: { name, description: description || null, lat, lng },
  });

  await logActivity({ userId: user.id, action: `Standort angelegt: ${name}` });

  revalidatePath("/standorte");
  return undefined;
}

export async function updateLocationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const lat = parseOptionalFloat(formData.get("lat"));
  const lng = parseOptionalFloat(formData.get("lng"));

  if (!id) return { error: "Ungültiger Standort." };
  if (!name) return { error: "Bitte einen Namen angeben." };

  const duplicate = await prisma.location.findFirst({ where: { name, NOT: { id } } });
  if (duplicate) return { error: "Ein Standort mit diesem Namen existiert bereits." };

  await prisma.location.update({
    where: { id },
    data: { name, description: description || null, lat, lng },
  });

  revalidatePath("/standorte");
  return undefined;
}

export async function deleteLocationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const location = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { devices: true } } },
  });
  if (!location) return { error: "Standort nicht gefunden." };

  if (location._count.devices > 0) {
    return {
      error: `Standort "${location.name}" kann nicht gelöscht werden: ${location._count.devices} Gerät(e) zugeordnet.`,
    };
  }

  await prisma.location.delete({ where: { id } });

  revalidatePath("/standorte");
  return undefined;
}
