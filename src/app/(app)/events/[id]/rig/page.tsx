import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDateTime, groupByCategory, GROUP_AUTOOPEN_THRESHOLD } from "@/lib/constants";
import { RigViewToggle } from "./RigViewToggle";
import { RigAssignForm } from "./RigAssignForm";
import { RigInstallStatusForm } from "./RigInstallStatusForm";
import { ApplyToPacklistForm, ApplyPositionsToPlanForm, DeleteRigForm } from "./RigActionsForms";

type RigRow = {
  id: string;
  name: string;
  fixtureId: string | null;
  gdtfSpec: string | null;
  gdtfMode: string | null;
  dmxAddresses: string | null;
  posX: number | null;
  posY: number | null;
  posZ: number | null;
  layerName: string | null;
  deviceId: string | null;
  installStatus: string;
  actualPosition: string | null;
  device: { id: string; inventoryNo: string; name: string } | null;
};

function formatPos(f: { posX: number | null; posY: number | null; posZ: number | null }): string {
  if (f.posX == null && f.posY == null && f.posZ == null) return "–";
  const fmt = (v: number | null) => (v == null ? "–" : v.toFixed(2));
  return `${fmt(f.posX)} / ${fmt(f.posY)} / ${fmt(f.posZ)} m`;
}

function RigFixtureGroups({
  groups,
  editable,
  deviceUsage,
  defaultOpen,
}: {
  groups: { category: string; items: RigRow[] }[];
  editable: boolean;
  deviceUsage: Map<string, number>;
  defaultOpen: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ category, items }) => (
        <details key={category} open={defaultOpen} className="rounded-xl border border-line">
          <summary className="cursor-pointer select-none px-3 py-3 md:py-2 text-sm font-medium bg-surface-2 rounded-xl flex items-center justify-between gap-2 flex-wrap">
            <span>
              {category} ({items.length})
            </span>
          </summary>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">FixtureID</th>
                  <th className="px-3 py-2 font-medium">Typ</th>
                  <th className="px-3 py-2 font-medium">DMX</th>
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium">Zuordnung</th>
                  <th className="px-3 py-2 font-medium">Montage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">{f.name}</td>
                    <td className="px-3 py-2 font-mono">{f.fixtureId ?? "–"}</td>
                    <td className="px-3 py-2">
                      {[f.gdtfSpec, f.gdtfMode].filter(Boolean).join(" / ") || "–"}
                    </td>
                    <td className="px-3 py-2 font-mono">{f.dmxAddresses ?? "–"}</td>
                    <td className="px-3 py-2 font-mono">{formatPos(f)}</td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <RigAssignForm fixtureId={f.id} currentInventoryNo={f.device?.inventoryNo ?? ""} />
                      ) : f.device ? (
                        <Link href={`/geraete/${f.device.id}`} className="text-accent hover:underline">
                          {f.device.inventoryNo}
                        </Link>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                      {f.deviceId && (deviceUsage.get(f.deviceId) ?? 0) > 1 && (
                        <span className="block text-xs text-amber-400 mt-1">
                          ⚠️ Gerät mehrfach zugeordnet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <RigInstallStatusForm
                        fixtureId={f.id}
                        status={f.installStatus}
                        actualPosition={f.actualPosition}
                        editable={editable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil */}
          <div className="md:hidden flex flex-col divide-y divide-line px-1">
            {items.map((f) => (
              <div key={f.id} className="flex flex-col gap-1 py-2 px-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{f.name}</span>
                  {f.fixtureId && <span className="text-xs text-muted font-mono">{f.fixtureId}</span>}
                </div>
                <p className="text-xs text-muted">
                  {[f.gdtfSpec, f.gdtfMode].filter(Boolean).join(" / ") || "–"}
                </p>
                <p className="text-xs text-muted font-mono">
                  DMX {f.dmxAddresses ?? "–"} · {formatPos(f)}
                </p>
                {editable ? (
                  <RigAssignForm fixtureId={f.id} currentInventoryNo={f.device?.inventoryNo ?? ""} />
                ) : f.device ? (
                  <Link href={`/geraete/${f.device.id}`} className="text-accent hover:underline text-sm">
                    {f.device.inventoryNo} — {f.device.name}
                  </Link>
                ) : (
                  <span className="text-xs text-muted">Keine Zuordnung</span>
                )}
                {f.deviceId && (deviceUsage.get(f.deviceId) ?? 0) > 1 && (
                  <span className="text-xs text-amber-400">⚠️ Gerät mehrfach zugeordnet</span>
                )}
                <RigInstallStatusForm
                  fixtureId={f.id}
                  status={f.installStatus}
                  actualPosition={f.actualPosition}
                  editable={editable}
                />
              </div>
            ))}
          </div>
        </details>
      ))}
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
  return { title: `Rig — ${event.name}` };
}

export default async function RigPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: eventId } = await params;
  const editable = canEdit(user);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const rigFixtures = await prisma.rigFixture.findMany({
    where: { eventId },
    include: { device: { select: { id: true, inventoryNo: true, name: true } } },
    orderBy: [{ layerName: "asc" }, { name: "asc" }],
  });

  const devices = await prisma.device.findMany({
    orderBy: { name: "asc" },
    select: { inventoryNo: true, name: true },
  });

  const total = rigFixtures.length;
  const matched = rigFixtures.filter((f) => f.deviceId).length;
  const unmatched = total - matched;
  const montiert = rigFixtures.filter((f) => f.installStatus === "MONTIERT").length;
  const abweichend = rigFixtures.filter((f) => f.installStatus === "ABWEICHEND").length;
  const offen = total - montiert - abweichend;

  const deviceUsage = new Map<string, number>();
  for (const f of rigFixtures) {
    if (f.deviceId) deviceUsage.set(f.deviceId, (deviceUsage.get(f.deviceId) ?? 0) + 1);
  }

  const lastImportLog =
    rigFixtures.length > 0
      ? await prisma.activityLog.findFirst({
          where: { eventId, action: { startsWith: "MVR-Rig importiert" } },
          orderBy: { createdAt: "desc" },
        })
      : null;

  const groups = groupByCategory(rigFixtures, (f) => f.layerName);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Rig — {event.name}</h1>
          {lastImportLog && (
            <p className="text-sm text-muted">
              {lastImportLog.details ?? lastImportLog.action} · {formatDateTime(lastImportLog.createdAt)}
            </p>
          )}
        </div>
        <Link href={`/events/${eventId}`} className="btn-secondary">
          Zur Veranstaltung
        </Link>
      </div>

      <RigViewToggle eventId={eventId} hasFixtures={total > 0} editable={editable}>
        <div className="card flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Fixtures</h2>
            <div className="text-sm text-muted flex flex-col items-end gap-0.5">
              <p>
                {total} gesamt · {matched} zugeordnet · {unmatched} ohne Zuordnung
              </p>
              <p>
                montiert {montiert} / abweichend {abweichend} / offen {offen}
              </p>
            </div>
          </div>

          {editable && total > 0 && (
            <div className="flex flex-wrap gap-2">
              <ApplyToPacklistForm eventId={eventId} />
              <ApplyPositionsToPlanForm eventId={eventId} disabled={!event.planImage} />
            </div>
          )}

          <datalist id="rig-device-options">
            {devices.map((d) => (
              <option key={d.inventoryNo} value={d.inventoryNo}>
                {`${d.inventoryNo} — ${d.name}`}
              </option>
            ))}
          </datalist>

          {total === 0 ? (
            <p className="text-muted text-sm">Noch kein Rig importiert.</p>
          ) : (
            <RigFixtureGroups
              groups={groups}
              editable={editable}
              deviceUsage={deviceUsage}
              defaultOpen={total < GROUP_AUTOOPEN_THRESHOLD}
            />
          )}

          {user.role === "ADMIN" && total > 0 && (
            <div className="pt-2 border-t border-line">
              <DeleteRigForm eventId={eventId} />
            </div>
          )}
        </div>
      </RigViewToggle>
    </div>
  );
}
