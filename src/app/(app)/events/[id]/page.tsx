import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import {
  type DeviceStatus,
  EVENT_ITEM_STATUS,
  type EventItemStatus,
  NOT_PLANNABLE,
  formatDateRange,
  groupByCategory,
  GROUP_AUTOOPEN_THRESHOLD,
} from "@/lib/constants";
import { EventEditForm } from "./EventEditForm";
import {
  ItemPositionForm,
  RemoveItemForm,
  BulkMarkPackedForm,
  BulkMarkReturnedForm,
  DeleteEventForm,
} from "./PacklistForms";
import { AddDevicesPicker } from "./AddDevicesPicker";
import { CollapsibleGroup } from "./CollapsibleGroup";
import { MISSION_PHASES, type MissionPhase } from "@/lib/constants";
import { StartMissionForm } from "../../einsatz/forms";
import { PlanUploadForm } from "./PlanUploadForm";
import { PlanBoard, type PlanItem } from "./PlanBoard";
import { AdvanceStatusButton } from "../itemActions";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getNextLabel(status: string): string | null {
  const def = EVENT_ITEM_STATUS[status as EventItemStatus];
  return def?.next ? EVENT_ITEM_STATUS[def.next].label : null;
}

type PacklistItem = {
  id: string;
  position: string | null;
  status: string;
  device: { id: string; name: string; inventoryNo: string; category: string | null };
};

/** Kompakte, nach Kategorie gruppierte Packliste mit Fortschritt je Gruppe. */
function PacklistGroups({
  items,
  editable,
  defaultOpen,
}: {
  items: PacklistItem[];
  editable: boolean;
  defaultOpen: boolean;
}) {
  const groups = groupByCategory(items, (i) => i.device.category);

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ category, items: groupItems }) => {
        const packedInGroup = groupItems.filter((i) => i.status !== "GEPLANT").length;
        return (
          <CollapsibleGroup
            key={category}
            defaultOpen={defaultOpen}
            summary={
              <>
                <span>
                  {category} ({groupItems.length})
                </span>
                <span className="text-xs text-muted font-normal">
                  {packedInGroup}/{groupItems.length} gepackt
                </span>
              </>
            }
          >
            <div className="flex flex-col divide-y divide-line px-1">
              {groupItems.map((item) => {
                const st = EVENT_ITEM_STATUS[item.status as EventItemStatus];
                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 py-3 md:py-2 px-2 min-h-11"
                  >
                    <Link
                      href={`/geraete/${item.device.id}`}
                      className="min-w-0 flex-1 min-h-11 flex flex-col justify-center hover:text-accent"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.device.name}</span>
                        <span className={`badge shrink-0 ${st?.badge ?? ""}`}>
                          {st?.label ?? item.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted font-mono">{item.device.inventoryNo}</p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {editable ? (
                        <ItemPositionForm itemId={item.id} initialPosition={item.position ?? ""} />
                      ) : (
                        item.position && <span className="text-xs text-muted">{item.position}</span>
                      )}
                      <AdvanceStatusButton itemId={item.id} nextLabel={getNextLabel(item.status)} />
                      {editable && (
                        <RemoveItemForm itemId={item.id} deviceName={item.device.name} compact />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleGroup>
        );
      })}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  if (!event) return {};
  return { title: event.name };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const editable = canEdit(user);

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      items: { include: { device: true }, orderBy: { device: { name: "asc" } } },
    },
  });

  if (!event) notFound();

  const today = startOfDay(new Date());
  const eventEnded = event.endDate < today;

  const total = event.items.length;
  const packedOrLater = event.items.filter((i) => i.status !== "GEPLANT").length;
  const builtOrLater = event.items.filter((i) =>
    ["AUFGEBAUT", "ABGEBAUT", "ZURUECK"].includes(i.status)
  ).length;
  const returnedCount = event.items.filter((i) => i.status === "ZURUECK").length;
  const notReturnedItems = event.items.filter((i) => i.status !== "ZURUECK");

  // Kandidaten für "Geräte hinzufügen" — noch nicht im Event, einplanbarer Status
  const existingDeviceIds = new Set(event.items.map((i) => i.deviceId));
  const allDevices = await prisma.device.findMany({ orderBy: { name: "asc" } });
  const candidateDevices = allDevices.filter(
    (d) => !existingDeviceIds.has(d.id) && !NOT_PLANNABLE.includes(d.status as DeviceStatus)
  );

  // Konfliktprüfung als EINE Batch-Query statt einer Anfrage pro Kandidat (N+1).
  // Bei mehreren überlappenden Konflikten pro Gerät reicht der erste (deterministisch
  // durch den ersten Treffer beim Aufbau der Map).
  const candidateIds = candidateDevices.map((d) => d.id);
  const conflictItems =
    candidateIds.length > 0
      ? await prisma.eventItem.findMany({
          where: {
            deviceId: { in: candidateIds },
            eventId: { not: event.id },
            status: { not: "ZURUECK" },
            event: { startDate: { lte: event.endDate }, endDate: { gte: event.startDate } },
          },
          include: { event: true },
        })
      : [];
  const conflictByDeviceId = new Map<string, (typeof conflictItems)[number]>();
  for (const item of conflictItems) {
    if (!conflictByDeviceId.has(item.deviceId)) conflictByDeviceId.set(item.deviceId, item);
  }

  const pickerCandidates = candidateDevices.map((d) => {
    const conflictItem = conflictByDeviceId.get(d.id);
    return {
      id: d.id,
      name: d.name,
      inventoryNo: d.inventoryNo,
      conflict: conflictItem
        ? {
            eventName: conflictItem.event.name,
            period: formatDateRange(conflictItem.event.startDate, conflictItem.event.endDate),
          }
        : null,
    };
  });

  const cases = await prisma.case.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const rigFixtureCount = await prisma.rigFixture.count({ where: { eventId: event.id } });

  const planImageUrl = event.planImage ? `/api/files/${event.planImage}` : null;
  const planItems: PlanItem[] = event.items.map((i) => ({
    id: i.id,
    deviceId: i.deviceId,
    deviceName: i.device.name,
    inventoryNo: i.device.inventoryNo,
    status: i.status as EventItemStatus,
    planX: i.planX,
    planY: i.planY,
  }));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-muted">
          {event.venue && <>{event.venue} · </>}
          {formatDateRange(event.startDate, event.endDate)}
        </p>
        {event.notes && <p className="text-sm text-muted whitespace-pre-wrap">{event.notes}</p>}

        {editable && (
          <EventEditForm
            event={{
              id: event.id,
              name: event.name,
              venue: event.venue,
              startDate: event.startDate.toISOString().slice(0, 10),
              endDate: event.endDate.toISOString().slice(0, 10),
              notes: event.notes,
            }}
          />
        )}
      </div>

      {eventEnded && notReturnedItems.length > 0 && (
        <div className="card bg-red-500/10 border-red-500/30 flex flex-col gap-2">
          <p className="text-red-300 text-sm font-semibold">
            ⚠️ {notReturnedItems.length} Gerät(e) noch nicht zurück im Lager
          </p>
          <ul className="text-sm text-red-300/90 list-disc list-inside">
            {notReturnedItems.map((i) => (
              <li key={i.id}>{i.device.name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Packliste */}
      <div className="card flex flex-col gap-4">
        {/* Der Weg in die Arbeit steht über der Liste, nicht in einem Untermenü. */}
        {total > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-sm font-medium">Einsatz starten</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(MISSION_PHASES) as MissionPhase[]).map((phase) => (
                <StartMissionForm key={phase} eventId={event.id} phase={phase} />
              ))}
            </div>
            <p className="text-xs text-muted">
              Danach hakt jeder Scan das Gerät direkt ab — ohne Zwischenklick.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">Packliste</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted">
              Gepackt {packedOrLater}/{total} · Aufgebaut {builtOrLater}/{total} · Zurück{" "}
              {returnedCount}/{total}
            </p>
            {total > 0 && (
              <a
                href={`/api/export/packliste/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary shrink-0"
              >
                Als PDF drucken
              </a>
            )}
          </div>
        </div>

        {editable && total > 0 && (
          <div className="flex flex-wrap gap-2">
            <BulkMarkPackedForm eventId={event.id} />
            <BulkMarkReturnedForm eventId={event.id} />
          </div>
        )}

        {event.items.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Geräte eingeplant.</p>
        ) : (
          /* Die Packliste ist der Zweck dieser Seite: unterhalb des Schwellwerts
             steht sie offen da, auf jedem Gerät. */
          <PacklistGroups
            items={event.items}
            editable={editable}
            defaultOpen={total < GROUP_AUTOOPEN_THRESHOLD}
          />
        )}
      </div>

      {/* Geräte hinzufügen */}
      {editable && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Geräte hinzufügen</h2>
          <AddDevicesPicker eventId={event.id} candidates={pickerCandidates} cases={cases} />
        </div>
      )}

      {/* Rig (MVR) */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">Rig (MVR)</h2>
          <Link href={`/events/${event.id}/rig`} className="btn-secondary">
            {rigFixtureCount > 0 ? "Rig ansehen" : "MVR importieren"}
          </Link>
        </div>
        <p className="text-sm text-muted">
          {rigFixtureCount > 0 ? `${rigFixtureCount} Fixtures importiert` : "Noch kein Rig importiert."}
        </p>
      </div>

      {/* Veranstaltungsplan */}
      <div className="card flex flex-col gap-4">
        <h2 className="font-semibold">Veranstaltungsplan</h2>
        <PlanBoard eventId={event.id} planImageUrl={planImageUrl} items={planItems} editable={editable} />
        {editable && <PlanUploadForm eventId={event.id} hasExisting={!!event.planImage} />}
      </div>

      {/* Gefahrenzone */}
      {user.role === "ADMIN" && (
        <div className="card border-red-500/30">
          <h2 className="font-semibold text-red-400 mb-3">Gefahrenzone</h2>
          <DeleteEventForm eventId={event.id} eventName={event.name} />
        </div>
      )}
    </div>
  );
}
