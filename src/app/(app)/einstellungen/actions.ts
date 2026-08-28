"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type SettingsState = { error?: string; success?: boolean } | undefined;

export async function saveSettingsAction(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireRole("ADMIN");

  const foundOwner = String(formData.get("foundOwner") ?? "").trim();
  const foundContact = String(formData.get("foundContact") ?? "").trim();
  const appUrl = String(formData.get("appUrl") ?? "").trim().replace(/\/+$/, "");
  // Leer = Registrierung steht wieder allen offen.
  const registrationCode = String(formData.get("registrationCode") ?? "").trim();
  // Eine Checkbox liefert nichts, wenn sie nicht gesetzt ist — genau richtig:
  // Was nicht ausdrücklich eingeschaltet wurde, bleibt aus.
  const publicReports = formData.get("publicReports") === "an" ? "an" : "aus";

  await prisma.setting.upsert({
    where: { key: "foundOwner" },
    update: { value: foundOwner },
    create: { key: "foundOwner", value: foundOwner },
  });

  await prisma.setting.upsert({
    where: { key: "foundContact" },
    update: { value: foundContact },
    create: { key: "foundContact", value: foundContact },
  });

  await prisma.setting.upsert({
    where: { key: "appUrl" },
    update: { value: appUrl },
    create: { key: "appUrl", value: appUrl },
  });

  await prisma.setting.upsert({
    where: { key: "registrationCode" },
    update: { value: registrationCode },
    create: { key: "registrationCode", value: registrationCode },
  });

  await prisma.setting.upsert({
    where: { key: "publicReports" },
    update: { value: publicReports },
    create: { key: "publicReports", value: publicReports },
  });

  revalidatePath("/einstellungen");
  // Die Registrierungsseite entscheidet anhand dieser Einstellung, ob sie das
  // Feld zeigt — sie muss den neuen Stand sofort sehen.
  revalidatePath("/register");
  return { success: true };
}
