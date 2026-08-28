"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type MeldungAktionState = { fehler?: string; erfolg?: string } | undefined;

/**
 * Eine Meldung von außen übernehmen: Daraus wird eine echte Fehlermeldung.
 *
 * Hier — und erst hier — wird das Gerät gesperrt. Das ist der Grund für die
 * Trennung: Wer ohne Konto meldet, löst keinen Zustandswechsel aus. Übernimmt
 * jemand aus dem Team, steht diese Person mit Namen dafür ein, genau wie bei
 * einer selbst erfassten Fehlermeldung.
 */
export async function uebernehmeMeldungAction(
  _prevState: MeldungAktionState,
  formData: FormData
): Promise<MeldungAktionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { fehler: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const meldung = await prisma.externalReport.findUnique({
    where: { id },
    include: { device: { select: { id: true, name: true, status: true } } },
  });
  if (!meldung) return { fehler: "Meldung nicht gefunden." };
  if (meldung.status !== "NEU") return { fehler: "Diese Meldung ist schon bearbeitet." };

  if (!meldung.device) {
    return {
      fehler:
        "Zu dieser Nummer gibt es kein Gerät. Ohne Gerät lässt sich keine Fehlermeldung anlegen — bitte die Nummer prüfen oder die Meldung verwerfen.",
    };
  }

  const beschreibung = meldung.contact
    ? `${meldung.description}\n\n(Meldung ohne Anmeldung, Rückfragen an: ${meldung.contact})`
    : `${meldung.description}\n\n(Meldung ohne Anmeldung)`;

  const issue = await prisma.issue.create({
    data: { deviceId: meldung.device.id, reporterId: user.id, description: beschreibung },
  });

  if (meldung.device.status === "EINSATZBEREIT") {
    await prisma.device.update({
      where: { id: meldung.device.id },
      data: { status: "DEFEKT_GEMELDET" },
    });
  }

  await prisma.externalReport.update({
    where: { id },
    data: {
      status: "UEBERNOMMEN",
      handledById: user.id,
      handledAt: new Date(),
      issueId: issue.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "Externe Meldung übernommen",
    details: meldung.description.slice(0, 100),
    deviceId: meldung.device.id,
  });

  revalidatePath("/meldungen");
  revalidatePath(`/geraete/${meldung.device.id}`);
  revalidatePath("/geraete");
  return { erfolg: `Fehlermeldung für ${meldung.device.name} angelegt.` };
}

/**
 * Eine Meldung verwerfen.
 *
 * Gelöscht wird nicht: Wer sie verworfen hat und wann, bleibt nachvollziehbar.
 * Sonst steht bei der nächsten Rückfrage Aussage gegen Aussage.
 */
export async function verwerfeMeldungAction(
  _prevState: MeldungAktionState,
  formData: FormData
): Promise<MeldungAktionState> {
  const user = await requireUser();
  if (!canEdit(user)) return { fehler: "Keine Berechtigung." };

  const id = String(formData.get("id") ?? "");
  const meldung = await prisma.externalReport.findUnique({ where: { id } });
  if (!meldung) return { fehler: "Meldung nicht gefunden." };
  if (meldung.status !== "NEU") return { fehler: "Diese Meldung ist schon bearbeitet." };

  await prisma.externalReport.update({
    where: { id },
    data: { status: "VERWORFEN", handledById: user.id, handledAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    action: "Externe Meldung verworfen",
    details: meldung.description.slice(0, 100),
    deviceId: meldung.deviceId ?? undefined,
  });

  revalidatePath("/meldungen");
  return { erfolg: "Meldung verworfen." };
}
