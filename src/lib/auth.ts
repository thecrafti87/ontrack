import "server-only";
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
