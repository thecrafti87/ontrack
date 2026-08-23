import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { DEVICE_STATUS, type DeviceStatus } from "@/lib/constants";
import { DeviceTableRow } from "./DeviceTableRow";
import { FilterBar } from "./FilterBar";

export const metadata: Metadata = { title: "Geräte" };

const PAGE_SIZE = 50;

type SortKey = "name" | "nummer" | "status";
const SORT_KEYS: SortKey[] = ["name", "nummer", "status"];

type Filters = {
  q: string;
  status?: string;
  kategorie?: string;
  sort: SortKey;
  page: number;
};

/** Baut einen /geraete-Link aus den aktuellen Filtern + gezielten Überschreibungen. */
function hrefFor(overrides: Partial<Filters>, base: Filters): string {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status) params.set("status", merged.status);
  if (merged.kategorie) params.set("kategorie", merged.kategorie);
  if (merged.sort !== "nummer") params.set("sort", merged.sort);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const s = params.toString();
  return s ? `/geraete?${s}` : "/geraete";
}

export default async function GeraetePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; kategorie?: string; sort?: string; page?: string }>;
}) {
  const user = await requireUser();
  const raw = await searchParams;

  const q = (raw.q ?? "").trim();
  const status = raw.status || undefined;
  const kategorie = raw.kategorie || undefined;
  const sort: SortKey = SORT_KEYS.includes(raw.sort as SortKey) ? (raw.sort as SortKey) : "nummer";
  const requestedPage = Math.max(1, parseInt(raw.page ?? "1", 10) || 1);

  // Case-insensitive Volltextsuche über name/inventoryNo/category per Rohabfrage
  // (Prisma+SQLite unterstützt kein mode:"insensitive"). Parameter werden über
  // das Tagged-Template automatisch gebunden — keine String-Interpolation von q.
  let matchedIds: string[] | null = null;
  if (q) {
    const likePattern = `%${q}%`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Device
      WHERE name LIKE ${likePattern} COLLATE NOCASE
         OR inventoryNo LIKE ${likePattern} COLLATE NOCASE
         OR category LIKE ${likePattern} COLLATE NOCASE
    `;
    matchedIds = rows.map((r) => r.id);
  }

  const where = {
    ...(status ? { status } : {}),
    ...(kategorie ? { category: kategorie } : {}),
    ...(matchedIds !== null ? { id: { in: matchedIds } } : {}),
  };

  const orderBy =
    sort === "name" ? { name: "asc" as const } :
    sort === "status" ? { status: "asc" as const } :
    { inventoryNo: "asc" as const };

  const totalCount = await prisma.device.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const [devices, categoryRows] = await Promise.all([
    prisma.device.findMany({
      where,
      include: { location: true },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.device.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const categories = categoryRows.map((c) => c.category as string);
  const filters: Filters = { q, status, kategorie, sort, page };

  const statusEntries = Object.entries(DEVICE_STATUS) as [
    DeviceStatus,
    (typeof DEVICE_STATUS)[DeviceStatus],
  ][];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Geräte</h1>
        {canEdit(user) && (
          <Link href="/geraete/neu" className="btn-primary">
            + Neues Gerät
          </Link>
        )}
      </div>

      <Suspense fallback={<div className="h-12" />}>
        <FilterBar
          searchPlaceholder="Suche nach Name, Inventarnummer, Kategorie…"
          selects={[
            {
              param: "kategorie",
              ariaLabel: "Nach Kategorie filtern",
              className: "input md:w-48",
              options: [
                { value: "", label: "Alle Kategorien" },
                ...categories.map((c) => ({ value: c, label: c })),
              ],
            },
            {
              param: "sort",
              ariaLabel: "Sortierung",
              className: "input md:w-40",
              defaultValue: "nummer",
              options: [
                { value: "nummer", label: "Nummer" },
                { value: "name", label: "Name" },
                { value: "status", label: "Status" },
              ],
            },
          ]}
        />
      </Suspense>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={hrefFor({ status: undefined, page: 1 }, filters)}
          className={`badge shrink-0 ${
            !status ? "bg-accent/15 text-accent border-accent/30" : "bg-surface-2 text-muted border-line"
          }`}
        >
          Alle
        </Link>
        {statusEntries.map(([key, val]) => (
          <Link
            key={key}
            href={hrefFor({ status: key, page: 1 }, filters)}
            className={`badge shrink-0 ${status === key ? val.badge : "bg-surface-2 text-muted border-line"}`}
          >
            {val.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {totalCount} Geräte · Seite {page} von {totalPages}
        </p>
        {/* Export immer über den gesamten Bestand, nicht über den gefilterten
            Ausschnitt — eine Inventarliste soll vollständig sein. */}
        <p className="text-sm text-muted">
          Bestand exportieren:{" "}
          <a href="/api/export/inventar?format=csv" className="text-accent underline">
            CSV
          </a>{" "}
          ·{" "}
          <a
            href="/api/export/inventar?format=pdf"
            className="text-accent underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF
          </a>
        </p>
      </div>

      {/* Desktop: kompakte Tabelle mit sticky Kopf im Scrollbereich */}
      <div className="hidden md:block overflow-auto max-h-[65vh] rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Inventarnr.</th>
              <th className="px-4 py-2 font-medium">Kategorie</th>
              <th className="px-4 py-2 font-medium">Standort</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {devices.map((device) => {
              const st = DEVICE_STATUS[device.status as DeviceStatus];
              return (
                <DeviceTableRow key={device.id} href={`/geraete/${device.id}`}>
                  <td className="px-4 py-2 font-semibold">{device.name}</td>
                  <td className="px-4 py-2 font-mono">{device.inventoryNo}</td>
                  <td className="px-4 py-2">{device.category ?? "–"}</td>
                  <td className="px-4 py-2">{device.location?.name ?? "–"}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${st?.badge ?? ""}`}>{st?.label ?? device.status}</span>
                  </td>
                </DeviceTableRow>
              );
            })}
          </tbody>
        </table>
        {devices.length === 0 && <p className="p-4 text-muted">Keine Geräte gefunden.</p>}
      </div>

      {/* Mobil: kompakte zweizeilige Karten */}
      <div className="md:hidden flex flex-col gap-2">
        {devices.length === 0 && <p className="text-muted">Keine Geräte gefunden.</p>}
        {devices.map((device) => {
          const st = DEVICE_STATUS[device.status as DeviceStatus];
          return (
            <Link
              key={device.id}
              href={`/geraete/${device.id}`}
              className="rounded-xl border border-line px-3 py-2 min-h-11 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate text-sm">{device.name}</p>
                <p className="text-xs text-muted truncate">
                  <span className="font-mono">{device.inventoryNo}</span>
                  {device.category && <> · {device.category}</>}
                  {device.location && <> · {device.location.name}</>}
                </p>
              </div>
              <span className={`badge shrink-0 ${st?.badge ?? ""}`}>{st?.label ?? device.status}</span>
            </Link>
          );
        })}
      </div>

      {/* Blätter-Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Link
            href={hrefFor({ page: page - 1 }, filters)}
            aria-disabled={page <= 1}
            className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            ← Zurück
          </Link>
          <span className="text-sm text-muted">
            Seite {page} von {totalPages}
          </span>
          <Link
            href={hrefFor({ page: page + 1 }, filters)}
            aria-disabled={page >= totalPages}
            className={`btn-secondary ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            Weiter →
          </Link>
        </div>
      )}
    </div>
  );
}
