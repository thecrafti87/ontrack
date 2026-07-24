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

  revalidatePath("/einstellungen");
  return { success: true };
}
