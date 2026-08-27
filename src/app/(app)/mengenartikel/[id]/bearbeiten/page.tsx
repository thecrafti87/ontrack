import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { BulkItemForm } from "../../forms";

export const metadata: Metadata = { title: "Mengenartikel bearbeiten" };

export default async function BearbeitenPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canEdit(user)) redirect(`/mengenartikel/${id}`);

  const [item, locations, kategorien] = await Promise.all([
    prisma.bulkItem.findUnique({ where: { id } }),
    prisma.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.bulkItem.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  if (!item) notFound();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{item.name} bearbeiten</h1>
      <p className="text-sm text-muted">
        Der Bestand lässt sich hier nicht ändern — er ergibt sich aus den Bewegungen.
        Für eine Inventur den Vorgang „Korrektur“ auf der Artikelseite nutzen.
      </p>
      <BulkItemForm
        mode="edit"
        categories={kategorien.map((k) => k.category as string)}
        locations={locations}
        initial={{
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          minQuantity: item.minQuantity,
          weightKg: item.weightKg,
          notes: item.notes,
          locationId: item.locationId,
        }}
      />
    </div>
  );
}
