"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import {
  checkLoginAllowed,
  clearLoginFailures,
  formatRetryAfter,
  recordLoginFailure,
} from "@/lib/rateLimit";

export type ActionState = { error?: string } | undefined;

/** Herkunft des Anmeldeversuchs, soweit hinter einem Reverse-Proxy ermittelbar. */
async function originKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "lokal";
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Die Bremse greift, bevor die Datenbank befragt wird — und unabhängig davon,
  // ob es das Konto gibt. Sonst verriete allein die Sperrmeldung, welche
  // Adressen registriert sind.
  const origin = await originKey();
  const verdict = checkLoginAllowed(email, origin);
  if (!verdict.allowed) {
    return {
      error: `Zu viele Fehlversuche. Bitte in ${formatRetryAfter(verdict.retryAfterMs)} erneut versuchen.`,
    };
  }

  if (!email || !password) {
    recordLoginFailure(email, origin);
    return { error: "E-Mail oder Passwort falsch." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordLoginFailure(email, origin);
    return { error: "E-Mail oder Passwort falsch." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordLoginFailure(email, origin);
    return { error: "E-Mail oder Passwort falsch." };
  }

  clearLoginFailures(email);
  await createSession(user.id);
  redirect(user.approved ? "/" : "/warten");
}

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");

  if (!name || !email || !password || !passwordRepeat) {
    return { error: "Bitte alle Felder ausfüllen." };
  }

  const invalid = validatePassword(password);
  if (invalid) {
    return { error: invalid };
  }

  if (password !== passwordRepeat) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  const passwordHash = await hashPassword(password);
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: isFirstUser ? "ADMIN" : "TECHNIKER",
      approved: isFirstUser,
    },
  });

  await createSession(user.id);
  redirect(user.approved ? "/" : "/warten");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
