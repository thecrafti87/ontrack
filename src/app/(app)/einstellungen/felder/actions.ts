"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { fieldByCode } from "@/lib/fieldCatalog";

export type ActionState = { error?: string; success?: string } | undefined;

export async function saveCategoryFieldsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole("ADMIN");

  const category = String(formData.get("category") ?? "").trim();
  if (!category) return { error: "Bitte eine Kategorie angeben." };

  const codes = formData
    .getAll("fieldCodes")
    .map((v) => String(v))
    .filter((c) => fieldByCode(c));
  const fieldCodesJson = JSON.stringify(codes);

  await prisma.categoryFieldConfig.upsert({
    where: { category },
    update: { fieldCodes: fieldCodesJson },
    create: { category, fieldCodes: fieldCodesJson },
  });

  await logActivity({
    userId: user.id,
    action: `Zusatzfelder für Kategorie ${category} konfiguriert (${codes.length} Felder)`,
  });

  revalidatePath("/einstellungen/felder");
  return { success: "Gespeichert." };
}
