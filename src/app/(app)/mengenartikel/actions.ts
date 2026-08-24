"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { BULK_REASONS, isBulkReason } from "@/lib/constants";
import { pruefeBewegung } from "@/lib/bulk";

export type ActionState = { error?: string; success?: boolean } | undefined;

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createBulkItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "Stück").trim() || "Stück";
  const minQuantity = parseOptionalInt(formData.get("minQuantity"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const locationId = String(formData.get("locationId") ?? "") || null;
  const startbestand = parseOptionalInt(formData.get("quantity")) ?? 0;

  if (!name) return { error: "Bitte einen Namen angeben." };

  // Name plus Standort ist eindeutig: „DMX-Kabel 3 m" darf in Halle 1 und
  // Halle 2 getrennt geführt werden, aber nicht zweimal am selben Ort.
  const vorhanden = await prisma.bulkItem.findFirst({ where: { name, locationId } });
  if (vorhanden) {
    return { error: `„${name}" gibt es an diesem Standort bereits.` };
  }

  const item = await prisma.$transaction(async (tx) => {
    const angelegt = await tx.bulkItem.create({
      data: { name, category, unit, minQuantity, notes, locationId, quantity: 0 },
    });

    // Auch der Anfangsbestand ist eine Bewegung — sonst gäbe es Bestand ohne
    // Herkunft, und die Historie wäre von Beginn an unvollständig.
    if (startbestand > 0) {
      await tx.bulkItem.update({
        where: { id: angelegt.id },
        data: { quantity: startbestand },
      });
      await tx.bulkMovement.create({
        data: {
          itemId: angelegt.id,
          delta: startbestand,
          reason: "ZUGANG",
          note: "Anfangsbestand",
          userId: user.id,
        },
      });
    }

    return angelegt;
  });

  await logActivity({ userId: user.id, action: `Mengenartikel angelegt: ${name}` });

  revalidatePath("/mengenartikel");
  redirect(`/mengenartikel/${item.id}`);
}

export async function updateBulkItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Bitte einen Namen angeben." };

  const item = await prisma.bulkItem.findUnique({ where: { id } });
  if (!item) return { error: "Artikel nicht gefunden." };

  const locationId = String(formData.get("locationId") ?? "") || null;
  const doppelt = await prisma.bulkItem.findFirst({
    where: { name, locationId, NOT: { id } },
  });
  if (doppelt) return { error: `„${name}" gibt es an diesem Standort bereits.` };

  await prisma.bulkItem.update({
    where: { id },
    data: {
      name,
      category: String(formData.get("category") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "Stück").trim() || "Stück",
      minQuantity: parseOptionalInt(formData.get("minQuantity")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      locationId,
      // quantity fehlt hier absichtlich: Der Bestand wird ausschließlich über
      // Bewegungen geändert, sonst entstünde Bestand ohne Herkunft.
    },
  });

  await logActivity({ userId: user.id, action: `Mengenartikel bearbeitet: ${name}` });

  revalidatePath("/mengenartikel");
  revalidatePath(`/mengenartikel/${id}`);
  redirect(`/mengenartikel/${id}`);
}

/**
 * Entnahme, Rückgabe, Zugang oder Korrektur buchen.
 *
 * Bestand und Bewegung entstehen in einer Transaktion. Getrennt gebucht
 * würden sie beim ersten Fehler auseinanderlaufen, und der Bestand wäre
 * nicht mehr aus der Historie erklärbar.
 */
export async function recordMovementAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const itemId = String(formData.get("itemId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const menge = parseInt(String(formData.get("menge") ?? ""), 10);
  const note = String(formData.get("note") ?? "").trim() || null;
  const eventId = String(formData.get("eventId") ?? "") || null;

  if (!isBulkReason(reason)) return { error: "Unbekannter Grund." };
  if (!Number.isFinite(menge)) return { error: "Bitte eine Menge angeben." };

  // Korrekturen sind Inventurentscheidungen — nicht für Helfer.
  if (reason === "KORREKTUR" && !canEdit(user)) {
    return { error: "Korrekturen darf nur ein Techniker oder Admin buchen." };
  }

  const item = await prisma.bulkItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Artikel nicht gefunden." };

  const pruefung = pruefeBewegung(reason, menge, item.quantity);
  if (!pruefung.ok) return { error: pruefung.fehler };

  await prisma.$transaction([
    prisma.bulkItem.update({
      where: { id: itemId },
      data: { quantity: { increment: pruefung.delta } },
    }),
    prisma.bulkMovement.create({
      data: { itemId, delta: pruefung.delta, reason, note, userId: user.id, eventId },
    }),
  ]);

  const vorzeichen = pruefung.delta > 0 ? "+" : "";
  await logActivity({
    userId: user.id,
    action: `${BULK_REASONS[reason].label}: ${item.name} (${vorzeichen}${pruefung.delta} ${item.unit})`,
    eventId: eventId ?? undefined,
  });

  revalidatePath("/mengenartikel");
  revalidatePath(`/mengenartikel/${itemId}`);
  return { success: true };
}

export async function deleteBulkItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const item = await prisma.bulkItem.findUnique({ where: { id } });
  if (!item) return { error: "Artikel nicht gefunden." };

  await prisma.bulkItem.delete({ where: { id } });
  await logActivity({ userId: admin.id, action: `Mengenartikel gelöscht: ${item.name}` });

  revalidatePath("/mengenartikel");
  redirect("/mengenartikel");
}
