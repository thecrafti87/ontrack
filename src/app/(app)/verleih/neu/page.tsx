import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { NOT_PLANNABLE } from "@/lib/constants";
import { LoanForm } from "../forms";

export const metadata: Metadata = { title: "Geräte herausgeben" };

export default async function NeuerVerleihPage() {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/verleih");

  // Nur, was auch tatsächlich herausgegeben werden kann: nichts Defektes,
  // Gesperrtes oder bereits Verliehenes.
  const devices = await prisma.device.findMany({
    where: {
      status: { notIn: NOT_PLANNABLE },
      loanItems: { none: { returnedAt: null } },
    },
    select: { id: true, name: true, inventoryNo: true, category: true },
    orderBy: { inventoryNo: "asc" },
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Geräte herausgeben</h1>
        <p className="text-muted mt-1">
          Zur Auswahl stehen nur einsatzbereite Geräte, die nicht bereits verliehen sind.
        </p>
      </div>
      <LoanForm devices={devices} />
    </div>
  );
}
