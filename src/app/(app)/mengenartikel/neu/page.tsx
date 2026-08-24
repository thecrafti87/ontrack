import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { BulkItemForm } from "../forms";

export const metadata: Metadata = { title: "Neuer Mengenartikel" };

export default async function NeuerMengenartikelPage() {
  const user = await requireUser();
  if (!canEdit(user)) redirect("/mengenartikel");

  const [locations, kategorien] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.bulkItem.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Neuer Mengenartikel</h1>
      <BulkItemForm
        mode="create"
        categories={kategorien.map((k) => k.category as string)}
        locations={locations}
      />
    </div>
  );
}
