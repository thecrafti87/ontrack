"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type ActionState = { error?: string } | undefined;

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-Mail oder Passwort falsch." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "E-Mail oder Passwort falsch." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "E-Mail oder Passwort falsch." };
  }

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

  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
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
