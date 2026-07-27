import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { CreateLocationForm, LocationRow } from "./StandortForms";

export const metadata: Metadata = { title: "Standorte" };

export default async function StandortePage() {
  const user = await requireUser();

  const locations = await prisma.location.findMany({
    include: { _count: { select: { devices: true } } },
    orderBy: { name: "asc" },
  });

  const editable = canEdit(user);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Standorte</h1>

      {editable && <CreateLocationForm />}

      <div className="flex flex-col gap-3">
        {locations.length === 0 && <p className="text-muted">Noch keine Standorte angelegt.</p>}
        {locations.map((loc) => (
          <LocationRow
            key={loc.id}
            location={{
              id: loc.id,
              name: loc.name,
              description: loc.description,
              lat: loc.lat,
              lng: loc.lng,
              deviceCount: loc._count.devices,
            }}
            canEdit={editable}
            isAdmin={user.role === "ADMIN"}
          />
        ))}
      </div>
    </div>
  );
}
