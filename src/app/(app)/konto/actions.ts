"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  currentSessionId,
  hashPassword,
  invalidateSessions,
  requireUser,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export type ActionState = { error?: string; success?: string } | undefined;

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const repeat = String(formData.get("newPasswordRepeat") ?? "");

  if (!current || !next || !repeat) return { error: "Bitte alle Felder ausfüllen." };
  if (next !== repeat) return { error: "Die neuen Passwörter stimmen nicht überein." };

  const invalid = validatePassword(next);
  if (invalid) return { error: invalid };

  if (next === current) return { error: "Das neue Passwort ist mit dem alten identisch." };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { error: "Konto nicht gefunden." };

  // Das alte Passwort verlangen: sonst könnte ein fremd übernommener Rechner mit
  // offener Sitzung das Konto dauerhaft an sich reißen.
  if (!(await verifyPassword(current, record.passwordHash))) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  // Andere Geräte abmelden, die eigene Sitzung behalten.
  const keep = await currentSessionId();
  const closed = await invalidateSessions(user.id, keep);

  await logActivity({ userId: user.id, action: "Eigenes Passwort geändert" });

  revalidatePath("/konto");
  return {
    success:
      closed > 0
        ? `Passwort geändert. ${closed} andere ${closed === 1 ? "Sitzung wurde" : "Sitzungen wurden"} abgemeldet.`
        : "Passwort geändert.",
  };
}
