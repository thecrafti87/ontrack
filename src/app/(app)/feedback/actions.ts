"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth";
import { feedbackMail, sendeMail } from "@/lib/mail";
import { resolveBaseUrl } from "@/lib/baseUrl";

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

  const eintrag = await prisma.feedback.create({
    data: { userId: user.id, page: pageValue, message: trimmed },
  });

  // Benachrichtigung — bewusst NACH dem Speichern und ohne Einfluss auf das
  // Ergebnis. Eine Meldung ist erfasst, sobald sie in der Datenbank steht;
  // ob die Mail durchkommt, ändert daran nichts. Wer hier scheitern liesse,
  // verlöre Feedback wegen eines Maildienstes.
  //
  // Ohne eingerichteten Versand passiert still gar nichts. Genau so soll es
  // in der Desktop-Fassung sein, die keinen Maildienst hat.
  try {
    const ergebnis = await sendeMail(
      feedbackMail({
        nachricht: trimmed,
        autor: user.name,
        autorMail: user.email,
        seite: pageValue,
        zeitpunkt: eintrag.createdAt,
        adresse: await resolveBaseUrl(),
      })
    );
    if (ergebnis.art === "fehler") {
      console.warn("[feedback] Mail nicht zugestellt:", ergebnis.grund);
    }
  } catch (fehler) {
    console.warn("[feedback] Mailversand übersprungen:", fehler);
  }

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
