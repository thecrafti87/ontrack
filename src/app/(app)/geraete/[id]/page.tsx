import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import {
  DEVICE_STATUS,
  type DeviceStatus,
  EVENT_ITEM_STATUS,
  type EventItemStatus,
  ISSUE_STATUS,
  type IssueStatus,
  MAINTENANCE_RESULT,
  type MaintenanceResult,
  NOT_PLANNABLE,
  formatDate,
  formatDateRange,
  formatDateTime,
} from "@/lib/constants";
import { getMaintenanceDueDate, getMaintenanceUrgency } from "@/lib/maintenance";
import { FIELD_CATALOG } from "@/lib/fieldCatalog";
import { resolveBaseUrl } from "@/lib/baseUrl";
import { NfcWriteCard } from "@/components/NfcWriteCard";
import { StatusChangeForm, LocationChangeForm, PhotoUploadForm, DeletePhotoForm } from "./forms";
import { ScanCapture } from "./ScanCapture";
import { ReportIssueForm, IssueStatusForm } from "./issueForms";
import {
  AddMaintenancePlanForm,
  RecordMaintenanceForm,
  DeleteMaintenancePlanForm,
  DeleteMaintenanceRecordForm,
} from "../maintenanceForms";
import { AdvanceStatusButton } from "../../events/itemActions";
import { resolveActiveFieldCodes } from "../actions";
import { TechDataCard, type DisplayGroup, type ActiveField } from "./TechDataCard";

const URGENCY_CLASSES: Record<string, string> = {
  overdue: "border-red-500/40 bg-red-500/5",
  soon: "border-amber-500/40 bg-amber-500/5",
  later: "border-line",
};

const URGENCY_BADGE_CLASSES: Record<string, string> = {
  overdue: "bg-red-500/15 text-red-400 border-red-500/30",
  soon: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  later: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

/**
 * Eine Karte, die zugeklappt anfängt.
 *
 * Die Geräteseite war auf dem Handy fast 5000 Pixel lang — sechs Bildschirme.
 * Wer nach einem Scan davorsteht, will Status, Standort und Defekte sehen,
 * nicht Fotos und Historie durchscrollen. Zugeklappt heißt aber nicht
 * versteckt: Die Kopfzeile sagt, was drin ist und wie viel.
 */
function Ausklappbar({
  titel,
  zusatz,
  children,
}: {
  titel: string;
  zusatz?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="card">
      <summary className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 font-semibold">
        <span>{titel}</span>
        {zusatz && <span className="text-sm font-normal text-muted">{zusatz}</span>}
      </summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id }, select: { name: true } });
  if (!device) return {};
  return { title: device.name };
}

export default async function DeviceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scan?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { scan } = await searchParams;

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      location: true,
      case: true,
      photos: { orderBy: { createdAt: "desc" } },
      logs: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 30 },
      issues: {
        include: { reporter: true, photos: true },
        orderBy: { createdAt: "desc" },
      },
      maintenances: {
        include: {
          records: {
            include: { recordedBy: { select: { name: true } }, documents: true },
            orderBy: { performedAt: "desc" },
          },
        },
      },
      eventItems: {
        include: { event: true },
        orderBy: { event: { startDate: "asc" } },
      },
    },
  });

  if (!device) notFound();

  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  const baseUrl = await resolveBaseUrl();

  const status = DEVICE_STATUS[device.status as DeviceStatus];
  const editable = canEdit(user);
  const notPlannable = NOT_PLANNABLE.includes(device.status as DeviceStatus);

  // Technische Zusatzfelder: aktive Auswahl (Override oder Kategorie-Standard) + vorhandene Werte
  const activeFieldCodes = await resolveActiveFieldCodes(device);
  const fieldValueRows = await prisma.deviceFieldValue.findMany({ where: { deviceId: device.id } });
  const fieldValueMap = new Map(fieldValueRows.map((v) => [v.fieldCode, v.value]));
  const activeCodeSet = new Set(activeFieldCodes);
  const displayCodeSet = new Set([...activeFieldCodes, ...fieldValueMap.keys()]);

  const displayFieldsFlat = FIELD_CATALOG.filter((f) => displayCodeSet.has(f.code)).map((f) => ({
    code: f.code,
    label: f.label,
    unit: f.unit,
    group: f.group,
    value: fieldValueMap.get(f.code) ?? "",
    isExtra: !activeCodeSet.has(f.code),
  }));

  const displayGroups: DisplayGroup[] = [];
  for (const field of displayFieldsFlat) {
    let group = displayGroups.find((g) => g.group === field.group);
    if (!group) {
      group = { group: field.group, fields: [] };
      displayGroups.push(group);
    }
    group.fields.push(field);
  }

  const activeFields: ActiveField[] = FIELD_CATALOG.filter((f) => activeCodeSet.has(f.code)).map(
    (f) => ({ code: f.code, label: f.label, unit: f.unit, value: fieldValueMap.get(f.code) ?? "" })
  );

  // Einsätze: nur relevante (noch nicht länger als 7 Tage vorbei)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  // Ein laufendes Objekt hat kein Ende und bleibt deshalb immer relevant.
  const relevantEventItems = device.eventItems.filter(
    (i) => i.event.endDate == null || i.event.endDate >= sevenDaysAgo
  );

  // Rig-Position (Soll aus MVR-Import + Montage-Ist) je Event, in dem dieses Gerät einer Fixture zugeordnet ist
  const deviceRigFixtures = await prisma.rigFixture.findMany({
    where: { deviceId: device.id },
    include: { event: { select: { name: true } } },
  });
  const rigFixtureByEventId = new Map<string, (typeof deviceRigFixtures)[number]>();
  for (const f of deviceRigFixtures) {
    if (!rigFixtureByEventId.has(f.eventId)) rigFixtureByEventId.set(f.eventId, f);
  }
  // Die eine Montage, die den Standort überschreibt: tatsächlich verbaut.
  const montage =
    deviceRigFixtures.find((f) => f.installStatus === "MONTIERT" || f.installStatus === "ABWEICHEND") ??
    null;
  const RIG_STATUS_BADGE: Record<string, string> = {
    GEPLANT: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    MONTIERT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    ABWEICHEND: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  const RIG_STATUS_LABEL: Record<string, string> = {
    GEPLANT: "Geplant",
    MONTIERT: "Montiert",
    ABWEICHEND: "Abweichend",
  };
  function formatRigPos(f: { posX: number | null; posY: number | null; posZ: number | null }): string {
    const fmt = (v: number | null) => (v == null ? "–" : v.toFixed(2));
    return `${fmt(f.posX)} / ${fmt(f.posY)} / ${fmt(f.posZ)} m`;
  }

  function nextEventItemLabel(itemStatus: string): string | null {
    const def = EVENT_ITEM_STATUS[itemStatus as EventItemStatus];
    return def?.next ? EVENT_ITEM_STATUS[def.next].label : null;
  }

  // Fehlermeldungen: offen/in Reparatur zuerst, dann nach Datum (Grund-Sortierung bereits per DB-Query)
  const sortedIssues = [...device.issues].sort((a, b) => {
    const rank = (s: string) => (s === "ERLEDIGT" ? 1 : 0);
    return rank(a.status) - rank(b.status);
  });

  // Wartungspläne: dringendste zuerst
  const maintenancePlans = device.maintenances
    .map((plan) => {
      const dueDate = getMaintenanceDueDate(plan.lastDoneAt, plan.intervalMonths);
      return { ...plan, dueDate, urgency: getMaintenanceUrgency(dueDate) };
    })
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      {scan === "1" && <ScanCapture deviceId={device.id} />}

      {notPlannable && (
        <div className="card bg-red-500/10 border-red-500/30 text-red-300 text-sm">
          ⚠️ Dieses Gerät ist aktuell nicht für Veranstaltungen einplanbar.
        </div>
      )}

      {/* Kopf */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{device.name}</h1>
          <span className={`badge shrink-0 ${status?.badge ?? ""}`}>{status?.label ?? device.status}</span>
        </div>
        <p className="text-muted">
          <span className="font-mono">{device.inventoryNo}</span>
          {device.category && <> · {device.category}</>}
        </p>
        <div className="flex flex-wrap gap-3">
          {editable && (
            <Link href={`/geraete/${device.id}/bearbeiten`} className="btn-secondary self-start">
              Bearbeiten
            </Link>
          )}
          <Link
            href={`/api/etiketten?ids=d:${device.id}&layout=single`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary self-start"
          >
            Etikett (PDF)
          </Link>
        </div>
      </div>

      {editable && (
        <div className="card">
          <h2 className="font-semibold mb-3">Status ändern</h2>
          <StatusChangeForm deviceId={device.id} currentStatus={device.status as DeviceStatus} />
        </div>
      )}

      {/* Standort */}
      <div className="card flex flex-col gap-4">
        <h2 className="font-semibold">Standort</h2>
        {/*
          Wer hier nach einem Scan landet, will als Erstes wissen, wo das Gerät
          hängt. Ist es montiert, ist das die Antwort — der Lagerplatz steht
          dann darunter und erklärt sich von selbst.
        */}
        {montage ? (
          <div className="flex flex-col gap-1">
            <p>
              <span className="text-emerald-400">Verbaut:</span>{" "}
              {montage.actualPosition?.trim() || montage.layerName?.trim() || "Position nicht erfasst"}
            </p>
            <p className="text-sm text-muted">
              in{" "}
              <Link href={`/events/${montage.eventId}/rig`} className="text-accent">
                {montage.event.name}
              </Link>
              {montage.installStatus === "ABWEICHEND" && " · weicht vom Plan ab"}
            </p>
            <p className="text-sm text-muted">
              Lager: {device.location?.name ?? "kein Standort zugewiesen"}
            </p>
          </div>
        ) : (
          <p>{device.location?.name ?? "Kein Standort zugewiesen"}</p>
        )}

        {device.case && (
          <p className="text-sm text-muted">
            Case:{" "}
            <Link href={`/cases/${device.case.id}`} className="text-accent">
              {device.case.name}
            </Link>
          </p>
        )}

        {device.lastSeenAt && (
          <p className="text-sm text-muted">
            Zuletzt gesehen: {formatDateTime(device.lastSeenAt)}
            {device.lastLat != null && device.lastLng != null && (
              <>
                {" "}
                ·{" "}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${device.lastLat}&mlon=${device.lastLng}#map=17/${device.lastLat}/${device.lastLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-action"
                >
                  auf Karte anzeigen
                </a>
              </>
            )}
          </p>
        )}

        {editable && (
          <LocationChangeForm
            deviceId={device.id}
            currentLocationId={device.locationId}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        )}
      </div>

      {/* Stammdaten */}
      <div className="card">
        <h2 className="font-semibold mb-3">Stammdaten</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex justify-between md:block">
            <dt className="text-muted">Inventarnummer</dt>
            <dd className="font-mono">{device.inventoryNo}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Kategorie</dt>
            <dd>{device.category ?? "–"}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Seriennummer</dt>
            <dd>{device.serialNo ?? "–"}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Kaufdatum</dt>
            <dd>{formatDate(device.purchaseDate)}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Kaufpreis</dt>
            <dd>{device.purchasePrice != null ? `${device.purchasePrice.toFixed(2)} €` : "–"}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Lieferant</dt>
            <dd>{device.supplier ?? "–"}</dd>
          </div>
          <div className="flex justify-between md:block">
            <dt className="text-muted">Gewicht</dt>
            <dd>{device.weightKg != null ? `${device.weightKg} kg` : "–"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-muted">Notizen</dt>
            <dd className="whitespace-pre-wrap">{device.notes ?? "–"}</dd>
          </div>
        </dl>
      </div>

      {/* Technische Daten */}
      <TechDataCard
        deviceId={device.id}
        deviceCategory={device.category}
        editable={editable}
        isAdmin={user.role === "ADMIN"}
        displayGroups={displayGroups}
        activeFields={activeFields}
      />

      {/* Fotos */}
      <Ausklappbar
        titel="Fotos"
        zusatz={device.photos.length === 0 ? "keine" : `${device.photos.length}`}
      >

        {device.photos.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Fotos.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {device.photos.map((photo) => (
              <div key={photo.id} className="relative">
                <a href={`/api/files/${photo.filename}`} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${photo.filename}`}
                    alt={photo.caption ?? device.name}
                    className="w-full aspect-square object-cover rounded-xl border border-line"
                  />
                </a>
                {photo.caption && <p className="text-xs text-muted mt-1 truncate">{photo.caption}</p>}
                {user.role === "ADMIN" && <DeletePhotoForm photoId={photo.id} deviceId={device.id} />}
              </div>
            ))}
          </div>
        )}

        {editable && <PhotoUploadForm deviceId={device.id} />}
      </Ausklappbar>

      {/* Einsätze */}
      {relevantEventItems.length > 0 && (
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold">Einsätze</h2>
          <ul className="flex flex-col gap-3">
            {relevantEventItems.map((item) => {
              const st = EVENT_ITEM_STATUS[item.status as EventItemStatus];
              const rigFixture = rigFixtureByEventId.get(item.eventId);
              return (
                <li key={item.id} className="rounded-xl border border-line p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/events/${item.event.id}`}
                      className="-my-1 flex min-h-11 items-center py-1 font-medium hover:text-accent"
                    >
                      {item.event.name}
                    </Link>
                    <span className={`badge shrink-0 ${st?.badge ?? ""}`}>{st?.label ?? item.status}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {formatDateRange(item.event.startDate, item.event.endDate)}
                    {item.position && <> · {item.position}</>}
                  </p>
                  {rigFixture && (
                    <p className="text-xs text-muted flex items-center gap-2 flex-wrap">
                      <span>
                        Rig-Position: {rigFixture.layerName?.trim() || "Ohne Layer"} · {formatRigPos(rigFixture)}
                      </span>
                      <span className={`badge shrink-0 ${RIG_STATUS_BADGE[rigFixture.installStatus] ?? ""}`}>
                        {RIG_STATUS_LABEL[rigFixture.installStatus] ?? rigFixture.installStatus}
                      </span>
                      {rigFixture.installStatus === "ABWEICHEND" && rigFixture.actualPosition && (
                        <span className="text-amber-400">→ tatsächlich: {rigFixture.actualPosition}</span>
                      )}
                    </p>
                  )}
                  <AdvanceStatusButton itemId={item.id} nextLabel={nextEventItemLabel(item.status)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Fehlermeldungen */}
      <div className="card flex flex-col gap-4">
        <h2 className="font-semibold">Fehlermeldungen</h2>

        {sortedIssues.length === 0 ? (
          <p className="text-muted text-sm">Keine Fehlermeldungen.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedIssues.map((issue) => {
              const issueStatus = ISSUE_STATUS[issue.status as IssueStatus];
              return (
                <li key={issue.id} className="rounded-xl border border-line p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
                    <span className={`badge shrink-0 ${issueStatus?.badge ?? ""}`}>
                      {issueStatus?.label ?? issue.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDateTime(issue.createdAt)} — gemeldet von {issue.reporter?.name ?? "Unbekannt"}
                  </p>

                  {issue.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {issue.photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={`/api/files/${photo.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/files/${photo.filename}`}
                            alt={issue.description}
                            className="size-16 object-cover rounded-lg border border-line"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {editable && issue.status !== "ERLEDIGT" && (
                    <IssueStatusForm issueId={issue.id} status={issue.status as IssueStatus} />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <ReportIssueForm deviceId={device.id} />
      </div>

      {/* Wartung */}
      <div className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Wartung</h2>
          {/* Nur zeigen, wenn es auch etwas nachzuweisen gibt. */}
          {maintenancePlans.some((plan) => plan.records.length > 0) && (
            <a
              href={`/api/export/pruefnachweise?geraet=${device.id}`}
              className="link-action text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Prüfnachweis (PDF)
            </a>
          )}
        </div>

        {maintenancePlans.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Wartungspläne.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {maintenancePlans.map((plan) => (
              <li
                key={plan.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 ${URGENCY_CLASSES[plan.urgency]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{plan.title}</p>
                  <span className={`badge shrink-0 ${URGENCY_BADGE_CLASSES[plan.urgency]}`}>
                    {plan.dueDate ? `fällig am ${formatDate(plan.dueDate)}` : "sofort fällig"}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  alle {plan.intervalMonths} Monate · zuletzt am {formatDate(plan.lastDoneAt)}
                </p>
                {plan.notes && <p className="text-sm text-muted whitespace-pre-wrap">{plan.notes}</p>}

                {plan.records.length > 0 && (
                  <ol className="flex flex-col gap-2 border-t border-line/60 pt-2">
                    {plan.records.map((rec) => {
                      const res = MAINTENANCE_RESULT[rec.result as MaintenanceResult];
                      return (
                        <li key={rec.id} className="text-sm flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge shrink-0 ${res?.badge ?? ""}`}>
                              {res?.label ?? rec.result}
                            </span>
                            <span>{formatDate(rec.performedAt)}</span>
                            {rec.testerName && <span className="text-muted">· {rec.testerName}</span>}
                          </div>
                          {rec.notes && (
                            <p className="text-muted whitespace-pre-wrap">{rec.notes}</p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
                            {rec.documents.map((doc) => (
                              <a
                                key={doc.id}
                                href={`/api/files/${doc.filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent underline"
                              >
                                Protokoll öffnen
                              </a>
                            ))}
                            <span>erfasst von {rec.recordedBy.name}</span>
                            {user.role === "ADMIN" && <DeleteMaintenanceRecordForm recordId={rec.id} />}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {editable && (
                  <div className="flex flex-wrap items-start gap-2">
                    <RecordMaintenanceForm
                      planId={plan.id}
                      deviceIsBlocked={device.status === "GESPERRT"}
                    />
                    {user.role === "ADMIN" && <DeleteMaintenancePlanForm planId={plan.id} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {editable && <AddMaintenancePlanForm deviceId={device.id} />}
      </div>

      {/* Historie */}
      <Ausklappbar
        titel="Historie"
        zusatz={
          device.logs.length === 0
            ? "keine Einträge"
            : `${device.logs.length} ${device.logs.length === 1 ? "Eintrag" : "Einträge"}`
        }
      >
        {device.logs.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Einträge.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {device.logs.map((log) => (
              <li key={log.id} className="border-b border-line last:border-0 pb-2 last:pb-0">
                <span className="text-muted">{formatDateTime(log.createdAt)}</span> — {log.action}
                {log.details && <> — {log.details}</>}
                {" — von "}
                {log.user?.name ?? "Unbekannt"}
              </li>
            ))}
          </ul>
        )}
      </Ausklappbar>

      <NfcWriteCard url={`${baseUrl}/d/${device.inventoryNo}`} />
    </div>
  );
}
