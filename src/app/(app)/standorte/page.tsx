import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { CreateLocationForm, LocationRow } from "./StandortForms";
import { EmptyState } from "@/components/EmptyState";

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

      {locations.length === 0 && (
        <EmptyState titel="Noch keine Standorte">
          Ein Standort ist der benannte Platz, an dem etwas steht — „Lager
          Regal 3“, „Bühne links“, „LKW“. Er beantwortet die Frage, die beim
          Suchen zählt: wo liegt das Ding normalerweise? Der GPS-Punkt eines
          Scans sagt nur, wo es zuletzt war.
        </EmptyState>
      )}

      {/* Erst die Liste, dann das Anlegen — es sei denn, es gibt noch nichts
          zu lesen. Ein Formular als Seitenanfang ist eine Datenbankmaske. */}
      {editable &&
        (locations.length === 0 ? (
          <CreateLocationForm />
        ) : (
          <details>
            <summary className="btn-secondary inline-block cursor-pointer list-none">
              + Neuer Standort
            </summary>
            <div className="mt-3">
              <CreateLocationForm />
            </div>
          </details>
        ))}

      <div className="flex flex-col gap-3">
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
