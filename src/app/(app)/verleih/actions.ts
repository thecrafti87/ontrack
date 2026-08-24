"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { alleZurueck } from "@/lib/loan";

export type ActionState = { error?: string } | undefined;

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createLoanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const borrower = String(formData.get("borrower") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const dueAt = parseDate(formData.get("dueAt"));
  const deviceIds = formData.getAll("deviceIds").map(String).filter(Boolean);

  if (!borrower) return { error: "Bitte angeben, an wen verliehen wird." };
  if (!dueAt) return { error: "Bitte ein Rückgabedatum angeben." };
  if (deviceIds.length === 0) return { error: "Bitte mindestens ein Gerät auswählen." };

  // Ein Gerät kann nicht zweimal gleichzeitig verliehen sein. Ohne diese
  // Prüfung stünde es in zwei offenen Verleihen und wäre in beiden „draußen".
  const bereitsVerliehen = await prisma.loanItem.findMany({
    where: { deviceId: { in: deviceIds }, returnedAt: null },
    include: { device: { select: { inventoryNo: true, name: true } } },
  });
  if (bereitsVerliehen.length > 0) {
    const namen = bereitsVerliehen
      .map((i) => `${i.device.name} (${i.device.inventoryNo})`)
      .slice(0, 3)
      .join(", ");
    return {
      error: `Bereits verliehen: ${namen}${bereitsVerliehen.length > 3 ? " und weitere" : ""}.`,
    };
  }

  const loan = await prisma.loan.create({
    data: {
      borrower,
      contact,
      notes,
      dueAt,
      issuedById: user.id,
      items: { create: deviceIds.map((deviceId) => ({ deviceId })) },
    },
  });

  for (const deviceId of deviceIds) {
    await logActivity({
      userId: user.id,
      action: `Verliehen an ${borrower}`,
      details: `Rückgabe bis ${dueAt.toLocaleDateString("de-DE")}`,
      deviceId,
    });
  }

  revalidatePath("/verleih");
  revalidatePath("/geraete");
  redirect(`/verleih/${loan.id}`);
}

/**
 * Einzelne Geräte zurücknehmen.
 *
 * Teilrückgaben sind der Normalfall — es kommt selten alles auf einmal
 * zurück. Erst wenn das letzte Gerät da ist, gilt der Verleih als
 * abgeschlossen.
 */
export async function returnItemsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { error: "Keine Berechtigung." };

  const loanId = String(formData.get("loanId") ?? "");
  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);

  if (itemIds.length === 0) return { error: "Bitte mindestens ein Gerät auswählen." };

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { items: { include: { device: { select: { id: true, name: true } } } } },
  });
  if (!loan) return { error: "Verleih nicht gefunden." };

  const jetzt = new Date();
  const betroffen = loan.items.filter((i) => itemIds.includes(i.id) && i.returnedAt == null);

  if (betroffen.length === 0) return { error: "Diese Geräte sind bereits zurück." };

  await prisma.loanItem.updateMany({
    where: { id: { in: betroffen.map((i) => i.id) } },
    data: { returnedAt: jetzt },
  });

  for (const item of betroffen) {
    await logActivity({
      userId: user.id,
      action: `Zurück von ${loan.borrower}`,
      deviceId: item.device.id,
    });
  }

  // Nach der Teilrückgabe neu bewerten, ob der Verleih abgeschlossen ist.
  const danach = loan.items.map((i) =>
    betroffen.some((b) => b.id === i.id) ? { returnedAt: jetzt } : { returnedAt: i.returnedAt }
  );
  if (alleZurueck(danach)) {
    await prisma.loan.update({ where: { id: loanId }, data: { returnedAt: jetzt } });
    await logActivity({
      userId: user.id,
      action: `Verleih abgeschlossen: ${loan.borrower}`,
    });
  }

  revalidatePath("/verleih");
  revalidatePath(`/verleih/${loanId}`);
  revalidatePath("/geraete");
  return undefined;
}

export async function deleteLoanAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");

  const id = String(formData.get("id") ?? "");
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return { error: "Verleih nicht gefunden." };

  await prisma.loan.delete({ where: { id } });
  await logActivity({ userId: admin.id, action: `Verleih gelöscht: ${loan.borrower}` });

  revalidatePath("/verleih");
  redirect("/verleih");
}
