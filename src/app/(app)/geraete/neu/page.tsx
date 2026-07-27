import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import DeviceForm from "../DeviceForm";

export const metadata: Metadata = { title: "Neues Gerät" };

function nextInventoryNumber(existingNumbers: string[]): string {
  let max = 0;
  let digits = 4;
  for (const no of existingNumbers) {
    const match = /^OT-(\d+)$/.exec(no);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
      digits = Math.max(digits, match[1].length);
    }
  }
  const next = max + 1;
  return `OT-${String(next).padStart(digits, "0")}`;
}

export default async function NewDevicePage() {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/geraete");

  const [devices, locations, cases] = await Promise.all([
    prisma.device.findMany({ select: { inventoryNo: true, category: true } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.case.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categories = Array.from(
    new Set(devices.map((d) => d.category).filter((c): c is string => !!c))
  ).sort();

  const suggestedNo = nextInventoryNumber(devices.map((d) => d.inventoryNo));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Neues Gerät</h1>
      <div className="card">
        <DeviceForm
          mode="create"
          categories={categories}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          cases={cases.map((c) => ({ id: c.id, name: c.name }))}
          nextInventoryNo={suggestedNo}
        />
      </div>
    </div>
  );
}
