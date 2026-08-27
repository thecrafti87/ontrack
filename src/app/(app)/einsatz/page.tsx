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
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Einsatz</h1>
          <EndMissionForm compact />
        </div>

        <EinsatzClient
          missionId={mission.id}
          phase={mission.phase}
          eventId={mission.event.id}
          eventName={mission.event.name}
          erledigt={mission.fortschritt.erledigt}
          gesamt={mission.fortschritt.gesamt}
        />

        {/* Mengenartikel stehen unter der Geräteliste, nicht darin: Sie
            werden nicht gescannt, sondern gezählt. */}
        <MissionBulk
          eventId={mission.event.id}
          phase={mission.phase}
          rows={await missionBulkRows(mission.event.id)}
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
    include: { _count: { select: { items: true } } },
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
                </p>
              </div>
              <Link href={`/events/${event.id}`} className="text-sm text-accent underline">
                Packliste
              </Link>
            </div>

            {event._count.items === 0 ? (
              <p className="text-sm text-amber-400">
                Diese Veranstaltung hat noch keine Geräte — erst die Packliste füllen.
              </p>
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
