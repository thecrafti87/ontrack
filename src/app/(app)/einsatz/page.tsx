import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActiveMission } from "@/lib/mission";
import { MISSION_PHASES, formatDateRange, type MissionPhase } from "@/lib/constants";
import { EinsatzClient } from "./EinsatzClient";
import { MissionBulk, type MissionBulkRow } from "./MissionBulk";
import { einsatzBilanz } from "@/lib/bulk";
import { EndMissionForm, StartMissionForm } from "./forms";

export const metadata: Metadata = { title: "Einsatz" };

const PHASEN = Object.keys(MISSION_PHASES) as MissionPhase[];

/**
 * Mengenartikel der Veranstaltung samt Bilanz.
 *
 * Was mitging und was zurückkam, ergibt sich aus den Bewegungen dieser
 * Veranstaltung — nicht aus einem eigenen Zählerfeld, das mit dem Bestand
 * auseinanderlaufen könnte.
 */
async function missionBulkRows(eventId: string): Promise<MissionBulkRow[]> {
  const eintraege = await prisma.eventBulkItem.findMany({
    where: { eventId },
    include: { item: true },
    orderBy: { item: { name: "asc" } },
  });
  if (eintraege.length === 0) return [];

  const bewegungen = await prisma.bulkMovement.findMany({
    where: { eventId },
    select: { itemId: true, delta: true, reason: true },
  });

  return eintraege.map((eintrag) => {
    const bilanz = einsatzBilanz(bewegungen.filter((b) => b.itemId === eintrag.bulkItemId));
    return {
      bulkItemId: eintrag.bulkItemId,
      name: eintrag.item.name,
      unit: eintrag.item.unit,
      geplant: eintrag.plannedQty,
      mitgenommen: bilanz.mitgenommen,
      offen: bilanz.offen,
      bestand: eintrag.item.quantity,
    };
  });
}

export default async function EinsatzPage() {
  const user = await requireUser();
  const mission = await getActiveMission(user.id);

  // ── Läuft ein Einsatz? Dann nur noch arbeiten. ──
  if (mission) {
    const mengenZeilen = await missionBulkRows(mission.event.id);

    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Einsatz</h1>
          <EndMissionForm compact />
        </div>

        {/* Der Schlüssel enthält die Phase.
            Ein Phasenwechsel leitet auf dieselbe Route weiter; ohne
            Neumontage behielte der Bildschirm den Fortschritt der alten
            Phase und meldete „alles erledigt", obwohl in der neuen Phase
            noch nichts gebucht ist. Zugleich beginnt der Verlauf leer —
            eine neue Phase ist eine neue Aufgabe. */}
        <EinsatzClient
          key={`${mission.id}-${mission.phase}`}
          missionId={mission.id}
          phase={mission.phase}
          eventId={mission.event.id}
          eventName={mission.event.name}
          erledigt={mission.fortschritt.erledigt}
          gesamt={mission.fortschritt.gesamt}
          offeneMengen={mengenZeilen.reduce((summe, zeile) => summe + zeile.offen, 0)}
        />

        {/* Mengenartikel stehen unter der Geräteliste, nicht darin: Sie
            werden nicht gescannt, sondern gezählt. */}
        <MissionBulk
          eventId={mission.event.id}
          phase={mission.phase}
          rows={mengenZeilen}
        />
      </div>
    );
  }

  // ── Kein Einsatz: einen auswählen. ──
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  // Alles, was noch nicht vorbei ist — die nächsten zehn. Bewusst ohne feste
  // Tagesgrenze: Wer eine Tournee drei Monate im Voraus packt, soll sie hier
  // finden und nicht erst über den Umweg der Eventliste.
  const events = await prisma.event.findMany({
    where: { endDate: { gte: heute } },
    include: { _count: { select: { items: true, bulkItems: true } } },
    orderBy: { startDate: "asc" },
    take: 10,
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Einsatz starten</h1>
        <p className="text-muted mt-1">
          Wähle Veranstaltung und Phase. Danach hakt jeder Scan das Gerät direkt ab
          — ohne Zwischenklick.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card flex flex-col gap-3 items-start">
          <p className="text-muted">
            Keine anstehende Veranstaltung. Ein Einsatz braucht eine
            Veranstaltung mit Packliste.
          </p>
          <Link href="/events" className="btn-primary">
            Zu den Veranstaltungen
          </Link>
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="card flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-lg">{event.name}</h2>
                <p className="text-sm text-muted">
                  {formatDateRange(event.startDate, event.endDate)}
                  {event.venue && <> · {event.venue}</>} · {event._count.items} Geräte
                  {event._count.bulkItems > 0 && (
                    <> · {event._count.bulkItems} Mengenartikel</>
                  )}
                </p>
              </div>
              <Link href={`/events/${event.id}`} className="text-sm text-accent underline">
                Packliste
              </Link>
            </div>

            {event._count.items + event._count.bulkItems === 0 ? (
              /* Kein Soll, nichts abzuhaken. Statt einer Warnung, die man
                 wegliest, der Weg dorthin, wo es weitergeht. */
              <div className="flex flex-col gap-2">
                <p className="text-sm text-amber-400">
                  Die Packliste ist leer — es gäbe nichts abzuhaken.
                </p>
                <Link href={`/events/${event.id}`} className="btn-secondary text-center">
                  Erst Geräte einplanen
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {PHASEN.map((phase) => (
                  <StartMissionForm key={phase} eventId={event.id} phase={phase} />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
