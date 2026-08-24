import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { summarizeLoad } from "@/lib/load";
import { LoadSummaryCard } from "@/components/LoadSummary";
import { requireUser, canEdit } from "@/lib/auth";
import { DEVICE_STATUS, type DeviceStatus, groupByCategory, GROUP_AUTOOPEN_THRESHOLD } from "@/lib/constants";
import { resolveBaseUrl } from "@/lib/baseUrl";
import { NfcWriteCard } from "@/components/NfcWriteCard";
import { AddDeviceToCaseForm, RemoveDeviceFromCaseForm, RelocateCaseForm } from "./forms";

type CaseDevice = {
  id: string;
  name: string;
  inventoryNo: string;
  status: string;
  category: string | null;
};

/** Kompakte, nach Kategorie gruppierte Geräteliste (Case-Inhalt). */
function CaseDeviceGroups({
  devices,
  caseId,
  editable,
  defaultOpen,
}: {
  devices: CaseDevice[];
  caseId: string;
  editable: boolean;
  defaultOpen: boolean;
}) {
  const groups = groupByCategory(devices, (d) => d.category);

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ category, items }) => (
        <details key={category} open={defaultOpen} className="rounded-xl border border-line">
          <summary className="cursor-pointer select-none px-3 py-3 md:py-2 text-sm font-medium bg-surface-2 rounded-xl">
            {category} ({items.length})
          </summary>
          <div className="flex flex-col divide-y divide-line px-1">
            {items.map((device) => {
              const st = DEVICE_STATUS[device.status as DeviceStatus];
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-2 py-3 md:py-2 px-2 min-h-11"
                >
                  <Link
                    href={`/geraete/${device.id}`}
                    className="min-w-0 flex-1 min-h-11 flex flex-col justify-center hover:text-accent"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{device.name}</span>
                      <span className={`badge shrink-0 ${st?.badge ?? ""}`}>{st?.label ?? device.status}</span>
                    </div>
                    <p className="text-xs text-muted font-mono">{device.inventoryNo}</p>
                  </Link>
                  {editable && <RemoveDeviceFromCaseForm caseId={caseId} deviceId={device.id} compact />}
                </div>
              );
            })}
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
  const caseRecord = await prisma.case.findUnique({ where: { id }, select: { name: true } });
  if (!caseRecord) return {};
  return { title: caseRecord.name };
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const editable = canEdit(user);

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      location: true,
      devices: {
        include: { fieldValues: { where: { fieldCode: "powerW" }, select: { value: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!caseRecord) notFound();

  const totalDeviceCount = caseRecord.devices.length;
  const einsatzbereitCount = caseRecord.devices.filter((d) => d.status === "EINSATZBEREIT").length;
  const defektGesperrtCount = caseRecord.devices.filter(
    (d) => d.status === "DEFEKT_GEMELDET" || d.status === "GESPERRT"
  ).length;
  const desktopDefaultOpen = totalDeviceCount < GROUP_AUTOOPEN_THRESHOLD;

  // Ein Case wird getragen und angeschlossen — beides will man vorher wissen.
  const last = summarizeLoad(
    caseRecord.devices.map((d) => ({
      weightKg: d.weightKg,
      powerRaw: d.fieldValues[0]?.value ?? null,
    }))
  );

  const [locations, unassignedDevices] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.device.findMany({ where: { caseId: null }, orderBy: { name: "asc" } }),
  ]);
  const baseUrl = await resolveBaseUrl();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{caseRecord.name}</h1>
        <p className="text-muted">
          <span className="font-mono">{caseRecord.inventoryNo}</span>
          {caseRecord.location && <> · {caseRecord.location.name}</>}
        </p>
        {caseRecord.description && (
          <p className="text-sm text-muted whitespace-pre-wrap">{caseRecord.description}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {editable && (
            <Link href={`/cases/${caseRecord.id}/bearbeiten`} className="btn-secondary self-start">
              Bearbeiten
            </Link>
          )}
          <Link
            href={`/api/etiketten?ids=c:${caseRecord.id}&layout=single`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary self-start"
          >
            Etikett (PDF)
          </Link>
        </div>
      </div>

      <LoadSummaryCard summary={last} titel="Gewicht & Strom dieses Cases" />

      <NfcWriteCard url={`${baseUrl}/d/${caseRecord.inventoryNo}`} />

      {/* Geräte im Case */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">Geräte im Case</h2>
          {editable && (
            <Link href={`/cases/${caseRecord.id}/scannen`} className="btn-primary">
              📷 Per Scan befüllen
            </Link>
          )}
        </div>

        {caseRecord.devices.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Geräte in diesem Case.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                {einsatzbereitCount} einsatzbereit
              </span>
              <span className="badge bg-red-500/15 text-red-400 border-red-500/30">
                {defektGesperrtCount} defekt/gesperrt
              </span>
              <span className="badge bg-surface-2 text-muted border-line">{totalDeviceCount} gesamt</span>
            </div>

            {/* Desktop: initial offen wenn Gesamtzahl < 30 */}
            <div className="hidden md:block">
              <CaseDeviceGroups
                devices={caseRecord.devices}
                caseId={caseRecord.id}
                editable={editable}
                defaultOpen={desktopDefaultOpen}
              />
            </div>
            {/* Mobil: Gruppen immer zugeklappt */}
            <div className="md:hidden">
              <CaseDeviceGroups
                devices={caseRecord.devices}
                caseId={caseRecord.id}
                editable={editable}
                defaultOpen={false}
              />
            </div>
          </>
        )}

        {editable && (
          <AddDeviceToCaseForm
            caseId={caseRecord.id}
            candidates={unassignedDevices.map((d) => ({
              id: d.id,
              name: d.name,
              inventoryNo: d.inventoryNo,
            }))}
          />
        )}
      </div>

      {/* Sammel-Umbuchung */}
      {editable && (
        <div className="card flex flex-col gap-4">
          <h2 className="font-semibold">Sammel-Umbuchung</h2>
          <p className="text-sm text-muted">
            Bucht das Case und alle darin enthaltenen Geräte gemeinsam an einen neuen Standort um.
          </p>
          <RelocateCaseForm
            caseId={caseRecord.id}
            currentLocationId={caseRecord.locationId}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </div>
      )}
    </div>
  );
}
