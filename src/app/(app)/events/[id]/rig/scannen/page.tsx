import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { RigScanClient } from "./RigScanClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return event ? { title: `Rig scannen — ${event.name}` } : {};
}

export default async function RigScanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: eventId } = await params;
  if (!canEdit(user)) redirect(`/events/${eventId}/rig`);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const fixtures = await prisma.rigFixture.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      fixtureId: true,
      layerName: true,
      dmxAddresses: true,
      installStatus: true,
      device: { select: { inventoryNo: true, name: true } },
    },
    orderBy: [{ layerName: "asc" }, { name: "asc" }],
  });

  if (fixtures.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Rig scannen — {event.name}</h1>
        <div className="card flex flex-col items-start gap-3">
          <p className="font-semibold">Noch kein Rig importiert</p>
          <p className="text-sm text-muted">
            Zum Scannen braucht es die Liste aus der Zeichnung. Sie sagt, welches Gerät wohin
            gehört — der Scan bestätigt dann, was tatsächlich dort hängt.
          </p>
          <Link href={`/events/${eventId}/rig`} className="btn-primary">
            Rig importieren
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RigScanClient
      eventId={eventId}
      eventName={event.name}
      fixtures={fixtures.map((f) => ({
        id: f.id,
        name: f.name,
        fixtureId: f.fixtureId,
        layerName: f.layerName,
        dmxAddresses: f.dmxAddresses,
        installStatus: f.installStatus,
        zugeordnet: f.device ? `${f.device.inventoryNo} — ${f.device.name}` : null,
      }))}
    />
  );
}
