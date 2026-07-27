import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { EtikettenPicker } from "./EtikettenPicker";

export const metadata: Metadata = { title: "Etiketten drucken" };

export default async function EtikettenPage() {
  await requireUser();

  const [devices, cases] = await Promise.all([
    prisma.device.findMany({
      select: { id: true, name: true, inventoryNo: true },
      orderBy: { name: "asc" },
    }),
    prisma.case.findMany({
      select: { id: true, name: true, inventoryNo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Etiketten drucken</h1>
      <p className="text-sm text-muted">
        Geräte und/oder Cases auswählen und als PDF-Etikettenbogen oder Einzeletiketten öffnen.
      </p>
      <EtikettenPicker devices={devices} cases={cases} />
    </div>
  );
}
