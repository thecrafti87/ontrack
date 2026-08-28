import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { EmptyState, NoMatches } from "@/components/EmptyState";
import { requireUser, canEdit } from "@/lib/auth";
import { DEVICE_STATUS, formatDate, type DeviceStatus } from "@/lib/constants";
import { getMaintenanceDueDate, getMaintenanceUrgency } from "@/lib/maintenance";
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

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const totalCount = await prisma.device.count({ where });
  // Ohne diese zweite Zahl liesse sich nicht unterscheiden, ob der Bestand
  // leer ist oder nur der Filter nicht passt — und wer „Lege dein erstes
  // Gerät an" liest, während 300 im Bestand stehen, hält die App für kaputt.
  const bestandGesamt = q || status || kategorie ? await prisma.device.count() : totalCount;
  const filterAktiv = Boolean(q || status || kategorie);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const [devices, categoryRows] = await Promise.all([
    prisma.device.findMany({
      where,
      include: {
        location: true,
        case: { select: { id: true, name: true } },
        // Offener Verleih: „verliehen" schlägt jeden Standort — das Gerät ist
        // schlicht nicht da.
        loanItems: {
          where: { returnedAt: null },
          select: { loan: { select: { id: true, borrower: true, dueAt: true } } },
          take: 1,
        },
        maintenances: { select: { lastDoneAt: true, intervalMonths: true } },
        // Nur der nächste noch nicht beendete Einsatz — mehr braucht die Liste nicht.
        eventItems: {
          where: { event: { endDate: { gte: heute } } },
          select: { event: { select: { id: true, name: true, startDate: true } } },
          orderBy: { event: { startDate: "asc" } },
          take: 1,
        },
      },
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

  /**
   * Was in der Liste wirklich zählt: Wo liegt das Gerät (Case schlägt
   * Standort — im Case ist es konkreter), wofür ist es als Nächstes
   * eingeplant, und ist eine Prüfung überfällig.
   */
  const zeilen = devices.map((device) => {
    const ueberfaellig = device.maintenances.some(
      (m) => getMaintenanceUrgency(getMaintenanceDueDate(m.lastDoneAt, m.intervalMonths)) === "overdue"
    );
    const naechster = device.eventItems[0]?.event ?? null;
    const verleih = device.loanItems[0]?.loan ?? null;
    return {
      device,
      // Reihenfolge der Aussagekraft: verliehen schlägt Case schlägt Standort.
      ort: verleih ? verleih.borrower : device.case ? device.case.name : (device.location?.name ?? null),
      ortArt: verleih ? ("verliehen" as const) : device.case ? ("case" as const) : ("standort" as const),
      verleih,
      naechster,
      ueberfaellig,
    };
  });
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
          activeFilters={[
            ...(kategorie
              ? [{ label: `Kategorie: ${kategorie}`, href: hrefFor({ kategorie: undefined, page: 1 }, filters) }]
              : []),
            ...(status
              ? [
                  {
                    label: `Status: ${DEVICE_STATUS[status as DeviceStatus]?.label ?? status}`,
                    href: hrefFor({ status: undefined, page: 1 }, filters),
                  },
                ]
              : []),
            ...(sort !== "nummer"
              ? [
                  {
                    label: `Sortiert nach ${sort === "name" ? "Name" : "Status"}`,
                    href: hrefFor({ sort: "nummer", page: 1 }, filters),
                  },
                ]
              : []),
          ]}
          selects={[
            {
              param: "kategorie",
              label: "Kategorie",
              options: [
                { value: "", label: "Alle Kategorien" },
                ...categories.map((c) => ({ value: c, label: c })),
              ],
            },
            {
              param: "sort",
              label: "Sortierung",
              defaultValue: "nummer",
              options: [
                { value: "nummer", label: "Nummer" },
                { value: "name", label: "Name" },
                { value: "status", label: "Status" },
              ],
            },
          ]}
          panelExtra={
            <div>
              <p className="label">Status</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={hrefFor({ status: undefined, page: 1 }, filters)}
                  className={`badge ${
                    !status
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "bg-surface-2 text-muted border-line"
                  }`}
                >
                  Alle
                </Link>
                {statusEntries.map(([key, val]) => (
                  <Link
                    key={key}
                    href={hrefFor({ status: key, page: 1 }, filters)}
                    className={`badge ${
                      status === key ? val.badge : "bg-surface-2 text-muted border-line"
                    }`}
                  >
                    {val.label}
                  </Link>
                ))}
              </div>
            </div>
          }
        />
      </Suspense>

      {bestandGesamt === 0 && (
        <EmptyState
          titel="Noch keine Geräte"
          aktion={canEdit(user) ? { href: "/geraete/neu", text: "Erstes Gerät anlegen" } : undefined}
        >
          Jedes Gerät bekommt eine Inventarnummer und damit einen QR-Code zum
          Aufkleben. Ein Scan zeigt danach sofort, was es ist, wo es steht und
          ob es einsatzbereit ist. Wer schon eine Liste hat, spart sich das
          Eintippen: unter „Mehr → Import“ lässt sich eine CSV-Datei einlesen.
        </EmptyState>
      )}

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
              <th className="px-4 py-2 font-medium">Wo</th>
              <th className="px-4 py-2 font-medium">Nächster Einsatz</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {zeilen.map(({ device, ort, ortArt, verleih, naechster, ueberfaellig }) => {
              const st = DEVICE_STATUS[device.status as DeviceStatus];
              return (
                <DeviceTableRow key={device.id} href={`/geraete/${device.id}`}>
                  <td className="px-4 py-2">
                    <span className="font-semibold">{device.name}</span>
                    {device.category && (
                      <span className="text-muted"> · {device.category}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">{device.inventoryNo}</td>
                  <td className="px-4 py-2">
                    {ort ? (
                      <>
                        {ortArt === "case" && <span className="text-muted">Case: </span>}
                        {ortArt === "verliehen" && (
                          <span className="text-violet-400">Verliehen an </span>
                        )}
                        {ort}
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {naechster ? (
                      <>
                        {naechster.name}
                        <span className="text-muted"> · {formatDate(naechster.startDate)}</span>
                      </>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${st?.badge ?? ""}`}>{st?.label ?? device.status}</span>
                      {verleih && (
                        <span
                          className="badge bg-violet-500/15 text-violet-400 border-violet-500/30"
                          title={`Zurück bis ${formatDate(verleih.dueAt)}`}
                        >
                          Verliehen
                        </span>
                      )}
                      {ueberfaellig && (
                        <span
                          className="badge bg-amber-500/15 text-amber-400 border-amber-500/30"
                          title="Eine Prüfung ist überfällig"
                        >
                          Prüfung fällig
                        </span>
                      )}
                    </div>
                  </td>
                </DeviceTableRow>
              );
            })}
          </tbody>
        </table>
        {devices.length === 0 && filterAktiv && <NoMatches was="Geräte" zuruecksetzen="/geraete" />}
      </div>

      {/* Mobil: kompakte zweizeilige Karten */}
      <div className="md:hidden flex flex-col gap-2">
        {zeilen.length === 0 && filterAktiv && <NoMatches was="Geräte" zuruecksetzen="/geraete" />}
        {zeilen.map(({ device, ort, ortArt, verleih, naechster, ueberfaellig }) => {
          const st = DEVICE_STATUS[device.status as DeviceStatus];
          return (
            <Link
              key={device.id}
              href={`/geraete/${device.id}`}
              className="rounded-xl border border-line px-3 py-2.5 flex items-start justify-between gap-3 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate text-sm">{device.name}</p>
                <p className="text-xs text-muted truncate">
                  <span className="font-mono">{device.inventoryNo}</span>
                  {ort && (
                    <>
                      {" · "}
                      {ortArt === "case"
                        ? `Case: ${ort}`
                        : ortArt === "verliehen"
                          ? `Verliehen an ${ort}`
                          : ort}
                    </>
                  )}
                </p>
                {naechster && (
                  <p className="text-xs text-sky-400 truncate">
                    {naechster.name} · {formatDate(naechster.startDate)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`badge ${st?.badge ?? ""}`}>{st?.label ?? device.status}</span>
                {verleih && (
                  <span className="badge bg-violet-500/15 text-violet-400 border-violet-500/30">
                    Verliehen
                  </span>
                )}
                {ueberfaellig && (
                  <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/30">
                    Prüfung fällig
                  </span>
                )}
              </div>
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
