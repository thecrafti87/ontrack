"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generatePassword, hashPassword, invalidateSessions, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ROLES, type Role } from "@/lib/constants";

export type ActionState =
  | {
      error?: string;
      /** Neu gesetztes Passwort — wird dem Admin einmalig zum Weitergeben angezeigt. */
      newPassword?: string;
      forUser?: string;
    }
  | undefined;

function isValidRole(value: string): value is Role {
  return value in ROLES;
}

/** Anzahl anderer freigeschalteter Admins (ohne den übergebenen Benutzer). */
async function countOtherApprovedAdmins(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", approved: true, NOT: { id: excludeUserId } },
  });
}

export async function approveUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (target.approved) return undefined;

  await prisma.user.update({ where: { id }, data: { approved: true } });
  await logActivity({ userId: admin.id, action: `Benutzer ${target.email} freigeschaltet` });

  revalidatePath("/benutzer");
  return undefined;
}

export async function changeRoleAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!isValidRole(role)) return { error: "Ungültige Rolle." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (target.role === role) return undefined;

  if (target.role === "ADMIN" && target.approved) {
    const others = await countOtherApprovedAdmins(id);
    if (others === 0) {
      return { error: "Der letzte freigeschaltete Admin kann nicht herabgestuft werden." };
    }
  }

  await prisma.user.update({ where: { id }, data: { role } });

  await logActivity({
    userId: admin.id,
    action: `Benutzer ${target.email}: Rolle geändert: ${ROLES[target.role as Role].label} → ${ROLES[role].label}`,
  });

  revalidatePath("/benutzer");
  return undefined;
}

export async function deactivateUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  if (id === admin.id) return { error: "Du kannst dein eigenes Konto nicht deaktivieren." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (!target.approved) return undefined;

  if (target.role === "ADMIN") {
    const others = await countOtherApprovedAdmins(id);
    if (others === 0) {
      return { error: "Der letzte freigeschaltete Admin kann nicht deaktiviert werden." };
    }
  }

  await prisma.user.update({ where: { id }, data: { approved: false } });
  await logActivity({ userId: admin.id, action: `Benutzer ${target.email} deaktiviert` });

  revalidatePath("/benutzer");
  return undefined;
}

export async function deleteUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  if (id === admin.id) return { error: "Du kannst dein eigenes Konto nicht löschen." };

  const target = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { logs: true, photos: true, issues: true } } },
  });
  if (!target) return { error: "Benutzer nicht gefunden." };

  const entryCount = target._count.logs + target._count.photos + target._count.issues;
  if (entryCount > 0) {
    return { error: `${target.name} hat Einträge, stattdessen deaktivieren.` };
  }

  await prisma.user.delete({ where: { id } });
  await logActivity({ userId: admin.id, action: `Benutzer ${target.email} gelöscht` });

  revalidatePath("/benutzer");
  return undefined;
}

/**
 * Setzt ein neues Passwort und zeigt es dem Admin einmalig an.
 *
 * Kein E-Mail-Versand: OnTrack hat keine Mail-Infrastruktur, und die
 * Desktop-Version könnte gar keine verschicken. Der Admin gibt das Passwort
 * mündlich weiter, der Benutzer ändert es danach unter „Mein Konto“.
 */
export async function resetUserPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Benutzer nicht gefunden." };

  const password = generatePassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });

  // Alle Sitzungen des Benutzers beenden — auch die eigene, falls der Admin
  // sein eigenes Passwort zurücksetzt.
  await invalidateSessions(id);

  await logActivity({
    userId: admin.id,
    action: `Passwort zurückgesetzt für ${target.email}`,
  });

  revalidatePath("/benutzer");
  return { newPassword: password, forUser: target.name };
}
