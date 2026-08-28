import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/EmptyState";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDateRange } from "@/lib/constants";
import { EVENT_ART, eventArt, istObjekt, laeuftNoch } from "@/lib/eventKind";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Events" };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

type EventRow = {
  id: string;
  name: string;
  kind: string;
  venue: string | null;
  startDate: Date;
  endDate: Date | null;
  items: { status: string }[];
};

function progressLabel(event: EventRow, mode: "count" | "returned"): string {
  if (mode === "returned") {
    const back = event.items.filter((i) => i.status === "ZURUECK").length;
    return `${back}/${event.items.length} zurück`;
  }
  return `${event.items.length} Geräte`;
}

function EventGroup({
  title,
  events,
  progressMode,
  hideTitle,
}: {
  title: string;
  events: EventRow[];
  progressMode: "count" | "returned";
  hideTitle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!hideTitle && <h2 className="font-semibold text-lg">{title}</h2>}
      {events.length === 0 ? (
        <p className="text-muted text-sm">Keine Einträge.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Ort</th>
                  <th className="px-4 py-3 font-medium">Zeitraum</th>
                  <th className="px-4 py-3 font-medium">Fortschritt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <Link href={`/events/${event.id}`} className="font-medium hover:text-accent">
                        {event.name}
                      </Link>
                      {istObjekt(event.kind) && (
                        <span className="text-muted"> · {EVENT_ART[eventArt(event.kind)].label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{event.venue ?? "–"}</td>
                    <td className="px-4 py-3">{formatDateRange(event.startDate, event.endDate)}</td>
                    <td className="px-4 py-3">{progressLabel(event, progressMode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="card flex flex-col gap-1 hover:bg-surface-2 transition-colors"
              >
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-muted">
                  {event.venue ? `${event.venue} · ` : ""}
                  {formatDateRange(event.startDate, event.endDate)}
                </p>
                <p className="text-sm text-muted">{progressLabel(event, progressMode)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default async function EventsPage() {
  const user = await requireUser();
  const editable = canEdit(user);

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const events = await prisma.event.findMany({
    include: { items: { select: { status: true } } },
  });

  // Objekte stehen fuer sich: Eine Festinstallation laeuft dauerhaft und wuerde
  // die Liste der laufenden Veranstaltungen sonst monatelang blockieren.
  const objekte = events
    .filter((e) => istObjekt(e.kind) && laeuftNoch(e.endDate, today))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const termine = events.filter((e) => !objekte.includes(e));

  const laufend = termine
    .filter((e) => e.startDate <= todayEnd && laeuftNoch(e.endDate, today))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const anstehend = termine
    .filter((e) => e.startDate > todayEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const vergangen = termine
    .filter((e) => e.endDate != null && e.endDate < today)
    .sort((a, b) => (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0))
    .slice(0, 20);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Veranstaltungen</h1>

      {events.length === 0 && (
        <EmptyState titel="Noch keine Veranstaltungen">
          Eine Veranstaltung ist der Auftrag, für den Geräte zusammengestellt
          werden: Name, Ort, Zeitraum — und die Packliste dazu. Sie ist die
          Grundlage für den Einsatzmodus, in dem beim Verladen jeder Scan
          direkt abhakt. Ohne Veranstaltung gibt es nichts abzuhaken.
        </EmptyState>
      )}

      {editable && <CreateEventForm />}

      {events.length > 0 && (
        <>
          {objekte.length > 0 && (
            <EventGroup title="Objekte (Festinstallation)" events={objekte} progressMode="count" />
          )}
          <EventGroup title="Laufend" events={laufend} progressMode="count" />
          <EventGroup title="Anstehend" events={anstehend} progressMode="count" />
        </>
      )}

      <details className={events.length === 0 ? "hidden" : undefined}>
        <summary className="font-semibold text-lg text-muted cursor-pointer select-none">
          Vergangen ({vergangen.length})
        </summary>
        <div className="mt-3">
          <EventGroup title="" events={vergangen} progressMode="returned" hideTitle />
        </div>
      </details>
    </div>
  );
}
