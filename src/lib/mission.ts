import "server-only";
import { prisma } from "./prisma";
import { hasReachedPhase, type MissionPhase } from "./constants";

/**
 * Der laufende Einsatz eines Benutzers.
 *
 * Ein Einsatz ist ein Event plus eine Phase. Solange er läuft, hakt ein Scan
 * das Gerät direkt ab, statt nur dessen Detailseite zu öffnen — das ist der
 * Kern des Einsatzmodus.
 */

export type MissionProgress = {
  erledigt: number;
  gesamt: number;
};

export type ActiveMissionView = {
  id: string;
  phase: MissionPhase;
  startedAt: Date;
  event: {
    id: string;
    name: string;
    kind: string;
    venue: string | null;
    startDate: Date;
    /** Fehlt bei laufenden Objekten. */
    endDate: Date | null;
  };
  fortschritt: MissionProgress;
};

/** Laufenden Einsatz des Benutzers laden, inklusive Fortschritt. */
export async function getActiveMission(userId: string): Promise<ActiveMissionView | null> {
  const mission = await prisma.activeMission.findUnique({
    where: { userId },
    include: {
      event: {
        include: { items: { select: { status: true } } },
      },
    },
  });

  if (!mission) return null;

  const phase = mission.phase as MissionPhase;
  const items = mission.event.items;

  return {
    id: mission.id,
    phase,
    startedAt: mission.startedAt,
    event: {
      id: mission.event.id,
      name: mission.event.name,
      kind: mission.event.kind,
      venue: mission.event.venue,
      startDate: mission.event.startDate,
      endDate: mission.event.endDate,
    },
    fortschritt: {
      erledigt: items.filter((i) => hasReachedPhase(i.status, phase)).length,
      gesamt: items.length,
    },
  };
}
