import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "./constants";

const SESSION_COOKIE = "ontrack_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (id) {
    await prisma.session.deleteMany({ where: { id } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  approved: boolean;
};

/** Aktuellen Benutzer aus dem Session-Cookie laden (oder null). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role, approved: user.approved };
}

/** Eingeloggten, freigeschalteten Benutzer verlangen — sonst Redirect. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.approved) redirect("/warten");
  return user;
}

/** Wie requireUser, aber zusätzlich Rollen-Anforderung. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** Helfer dürfen nur lesen und Event-Status abhaken. */
export function canEdit(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "TECHNIKER";
}

/** Kennung der laufenden Sitzung (für "alle anderen Geräte abmelden"). */
export async function currentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Alle Sitzungen eines Benutzers beenden, wahlweise mit Ausnahme einer.
 *
 * Nach einer Passwortänderung ist das Pflicht: Wer das alte Passwort kannte,
 * darf nicht über eine offene Sitzung weiter angemeldet bleiben.
 */
export async function invalidateSessions(
  userId: string,
  keepSessionId?: string | null
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepSessionId ? { NOT: { id: keepSessionId } } : {}),
    },
  });
  return result.count;
}

/**
 * Aussprechbares Startpasswort erzeugen, das der Admin mündlich weitergeben kann.
 *
 * Ohne leicht verwechselbare Zeichen (0/O, 1/l/I) — es wird abgetippt oder am
 * Telefon durchgegeben, und ein Tippfehler kostet einen weiteren Anruf.
 */
export function generatePassword(length = 12): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Mindestanforderung an ein Passwort. Gibt eine Fehlermeldung zurück oder null. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (password.length > 200) return "Das Passwort ist zu lang.";
  return null;
}
