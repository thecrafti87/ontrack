import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/constants";
import {
  WOCHENTAGE,
  buildMonthGrid,
  monatParam,
  parseMonatParam,
  tagImZeitraum,
  tagesbeginn,
  verschiebeMonat,
} from "@/lib/calendar";

export const metadata: Metadata = { title: "Kalender" };

const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * „Was ist wann wo im Einsatz" — bisher nur Veranstaltung für Veranstaltung
 * zu beantworten.
 *
 * Am Desktop ein Monatsraster, auf dem Handy eine Liste der Tage mit
 * Einsätzen. Ein Raster mit sieben Spalten ist auf 375 Pixeln unlesbar; die
 * Liste beantwortet dieselbe Frage, nur in der Form, die dort trägt.
 */
export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>;
}) {
  await requireUser();
  const raw = await searchParams;

  const heute = tagesbeginn(new Date());
  const { jahr, monat } = parseMonatParam(raw.monat, heute);

  const monatsStart = new Date(jahr, monat, 1);
  const monatsEnde = new Date(jahr, monat + 1, 0, 23, 59, 59, 999);

  const wochen = buildMonthGrid(jahr, monat);
  const rasterStart = wochen[0]![0]!.datum;
  const rasterEnde = wochen[wochen.length - 1]![6]!.datum;

  // Alles, was das sichtbare Raster berührt — auch Veranstaltungen, die vor
  // dem Monat beginnen und hineinragen.
  const events = await prisma.event.findMany({
    where: {
      startDate: { lte: new Date(rasterEnde.getFullYear(), rasterEnde.getMonth(), rasterEnde.getDate(), 23, 59, 59) },
      endDate: { gte: rasterStart },
    },
    include: { _count: { select: { items: true } } },
    orderBy: { startDate: "asc" },
  });

  const vorher = verschiebeMonat(jahr, monat, -1);
  const nachher = verschiebeMonat(jahr, monat, 1);

  function eventsAn(tag: Date) {
    return events.filter((e) => tagImZeitraum(tag, e.startDate, e.endDate));
  }

  const tageMitEinsatz = wochen
    .flat()
    .filter((t) => t.imMonat && eventsAn(t.datum).length > 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          {MONATSNAMEN[monat]} {jahr}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/kalender?monat=${monatParam(vorher.jahr, vorher.monat)}`}
            className="btn-secondary"
            aria-label="Vorheriger Monat"
          >
            ←
          </Link>
          <Link href="/kalender" className="btn-secondary">
            Heute
          </Link>
          <Link
            href={`/kalender?monat=${monatParam(nachher.jahr, nachher.monat)}`}
            className="btn-secondary"
            aria-label="Nächster Monat"
          >
            →
          </Link>
        </div>
      </div>

      {events.length === 0 && (
        <p className="text-muted">In diesem Zeitraum ist nichts geplant.</p>
      )}

      {/* Desktop: Monatsraster */}
      <div className="hidden md:block rounded-2xl border border-line overflow-hidden">
        <div className="grid grid-cols-7 bg-surface-2 text-xs font-medium text-muted">
          {WOCHENTAGE.map((tag) => (
            <div key={tag} className="px-2 py-2 text-center">
              {tag}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {wochen.flat().map((tag) => {
            const treffer = eventsAn(tag.datum);
            const istHeute = tag.datum.getTime() === heute.getTime();
            return (
              <div
                key={tag.datum.toISOString()}
                className={`min-h-24 border-t border-l border-line p-1.5 flex flex-col gap-1 ${
                  tag.imMonat ? "" : "opacity-40"
                } ${istHeute ? "bg-accent/10" : ""}`}
              >
                <span
                  className={`text-xs tabular-nums ${
                    istHeute ? "font-bold text-accent" : "text-muted"
                  }`}
                >
                  {tag.datum.getDate()}
                </span>
                {treffer.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    title={`${e.name}${e.venue ? ` · ${e.venue}` : ""} · ${e._count.items} Geräte`}
                    className="text-[11px] leading-tight rounded px-1.5 py-1 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors truncate"
                  >
                    {e.name}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Handy: Liste der Tage mit Einsatz */}
      <div className="md:hidden flex flex-col gap-3">
        {tageMitEinsatz.length === 0 && events.length > 0 && (
          <p className="text-muted">In {MONATSNAMEN[monat]} selbst ist nichts geplant.</p>
        )}
        {tageMitEinsatz.map((tag) => {
          const istHeute = tag.datum.getTime() === heute.getTime();
          return (
            <div key={tag.datum.toISOString()} className="flex flex-col gap-2">
              <p
                className={`text-sm font-semibold ${istHeute ? "text-accent" : "text-muted"}`}
              >
                {WOCHENTAGE[(tag.datum.getDay() + 6) % 7]}, {tag.datum.getDate()}.{" "}
                {MONATSNAMEN[monat]}
                {istHeute && " · heute"}
              </p>
              {eventsAn(tag.datum).map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="card flex flex-col gap-0.5 hover:bg-surface-2 transition-colors"
                >
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-sm text-muted">
                    {formatDateRange(e.startDate, e.endDate)}
                    {e.venue && <> · {e.venue}</>} · {e._count.items} Geräte
                  </span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Zeitraum {formatDateRange(monatsStart, monatsEnde)} · {events.length}{" "}
        {events.length === 1 ? "Veranstaltung berührt" : "Veranstaltungen berühren"} diesen
        Monat
      </p>
    </div>
  );
}
