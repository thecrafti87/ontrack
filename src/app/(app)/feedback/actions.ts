"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 200;

export type CreateFeedbackResult = { error?: string; success?: boolean } | undefined;

/**
 * Feedback zu einer Seite speichern. Bewusst OHNE canEdit-Prüfung — jede
 * eingeloggte, freigeschaltete Rolle (auch HELFER) darf Feedback geben.
 */
export async function createFeedbackAction(page: string, message: string): Promise<CreateFeedbackResult> {
  const user = await requireUser();

  const trimmed = message.trim();
  if (!trimmed) return { error: "Bitte eine Nachricht eingeben." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: `Die Nachricht darf maximal ${MAX_MESSAGE_LENGTH} Zeichen lang sein.` };
  }

  const pageValue = String(page ?? "").slice(0, MAX_PAGE_LENGTH);

  await prisma.feedback.create({
    data: { userId: user.id, page: pageValue, message: trimmed },
  });

  revalidatePath("/feedback");
  revalidatePath("/");
  return { success: true };
}

/** Feedback als erledigt markieren / wieder öffnen — nur Admin. */
export async function resolveFeedbackAction(
  feedbackId: string,
  resolved: boolean
): Promise<{ error?: string } | undefined> {
  await requireRole("ADMIN");

  await prisma.feedback.update({
    where: { id: feedbackId },
    data: resolved ? { status: "ERLEDIGT", resolvedAt: new Date() } : { status: "OFFEN", resolvedAt: null },
  });

  revalidatePath("/feedback");
  revalidatePath("/");
  return undefined;
}
