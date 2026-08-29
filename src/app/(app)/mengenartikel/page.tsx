import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { groupByCategory } from "@/lib/constants";
import { BESTAND_BADGE, bestandStatus } from "@/lib/bulk";

export const metadata: Metadata = { title: "Mengenartikel" };

/**
 * Verbrauchs- und Kleinteile nach Stückzahl.
 *
 * Knappe und leere Bestände stehen oben: Das ist die einzige Information,
 * wegen der man diese Seite im Alltag öffnet.
 */
export default async function MengenartikelPage() {
  const user = await requireUser();

  const items = await prisma.bulkItem.findMany({
    include: { location: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const mitStatus = items.map((i) => ({ ...i, status: bestandStatus(i.quantity, i.minQuantity) }));
  const nachschub = mitStatus.filter((i) => i.status !== "ausreichend");
  const gruppen = groupByCategory(mitStatus, (i) => i.category);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mengenartikel</h1>
        {canEdit(user) && (
          <Link href="/mengenartikel/neu" className="btn-primary">
            + Neuer Artikel
          </Link>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-muted">
          Noch keine Mengenartikel. Hier gehören Dinge hin, die nach Stückzahl geführt
          werden — Kabel, Schellen, Klemmen, Gaffa.
        </p>
      )}

      {nachschub.length > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/10 flex flex-col gap-2">
          <h2 className="font-semibold text-amber-300">Nachschub nötig</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {nachschub.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/mengenartikel/${i.id}`}
                  className="flex min-h-11 items-center hover:underline"
                >
                  {i.name} — {i.quantity} {i.unit}
                  {i.minQuantity != null && <span className="text-muted"> (Warnschwelle {i.minQuantity})</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gruppen.map((gruppe) => (
        <div key={gruppe.category} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
            {gruppe.category}
          </h2>
          {gruppe.items.map((item) => (
            <Link
              key={item.id}
              href={`/mengenartikel/${item.id}`}
              className="rounded-xl border border-line px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{item.name}</p>
                {item.location && (
                  <p className="text-xs text-muted truncate">{item.location.name}</p>
                )}
              </div>
              <span className={`badge shrink-0 ${BESTAND_BADGE[item.status]}`}>
                {item.quantity} {item.unit}
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
