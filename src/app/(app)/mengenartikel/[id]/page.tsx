import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { BULK_REASONS, type BulkReason, formatDateTime } from "@/lib/constants";
import { BESTAND_BADGE, bestandStatus } from "@/lib/bulk";
import { MovementForm, DeleteBulkItemForm } from "../forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.bulkItem.findUnique({ where: { id }, select: { name: true } });
  return item ? { title: item.name } : {};
}

export default async function MengenartikelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const item = await prisma.bulkItem.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      movements: {
        include: {
          user: { select: { name: true } },
          event: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!item) notFound();

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const events = await prisma.event.findMany({
    where: { endDate: { gte: heute } },
    select: { id: true, name: true },
    orderBy: { startDate: "asc" },
    take: 20,
  });

  const status = bestandStatus(item.quantity, item.minQuantity);
  const editable = canEdit(user);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <span className={`badge shrink-0 ${BESTAND_BADGE[status]}`}>
            {item.quantity} {item.unit}
          </span>
        </div>
        <p className="text-muted">
          {item.category ?? "Ohne Kategorie"}
          {item.location && <> · {item.location.name}</>}
          {item.minQuantity != null && <> · Warnschwelle {item.minQuantity}</>}
        </p>
        {item.notes && <p className="text-sm text-muted whitespace-pre-wrap">{item.notes}</p>}
        {editable && (
          <Link href={`/mengenartikel/${item.id}/bearbeiten`} className="btn-secondary self-start">
            Bearbeiten
          </Link>
        )}
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Buchen</h2>
        <MovementForm
          itemId={item.id}
          bestand={item.quantity}
          einheit={item.unit}
          events={events}
          darfKorrigieren={editable}
        />
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Bewegungen</h2>
        {item.movements.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Bewegungen.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {item.movements.map((m) => (
              <li key={m.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p>
                    <span className="font-medium">
                      {BULK_REASONS[m.reason as BulkReason]?.label ?? m.reason}
                    </span>
                    {m.event && (
                      <>
                        {" · "}
                        <Link href={`/events/${m.event.id}`} className="text-accent hover:underline">
                          {m.event.name}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(m.createdAt)} · {m.user.name}
                    {m.note && <> · {m.note}</>}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono tabular-nums ${
                    m.delta >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {user.role === "ADMIN" && (
        <div className="card border-red-500/30">
          <h2 className="font-semibold text-red-400 mb-3">Gefahrenzone</h2>
          <DeleteBulkItemForm id={item.id} name={item.name} />
        </div>
      )}
    </div>
  );
}
