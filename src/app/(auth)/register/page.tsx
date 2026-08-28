import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { einladungNoetig } from "@/lib/registration";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Konto erstellen" };

// Die Seite muss bei jedem Aufruf nachsehen: Der Code kann jederzeit gesetzt
// oder entfernt werden, und der allererste Benutzer braucht nie einen.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [code, anzahl] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "registrationCode" } }),
    prisma.user.count(),
  ]);

  return <RegisterForm einladungNoetig={einladungNoetig(code?.value, anzahl === 0)} />;
}
