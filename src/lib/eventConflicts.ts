import "server-only";
import { prisma } from "./prisma";

export type EventConflict = {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
} | null;

/**
 * Prüft, ob ein Gerät in einem ANDEREN Event mit überlappendem Zeitraum verplant ist
 * (Status != ZURUECK zählt als aktive Planung).
 */
export async function findEventConflict(
  deviceId: string,
  excludeEventId: string,
  start: Date,
  end: Date
): Promise<EventConflict> {
  const conflictItem = await prisma.eventItem.findFirst({
    where: {
      deviceId,
      eventId: { not: excludeEventId },
      status: { not: "ZURUECK" },
      event: { startDate: { lte: end }, endDate: { gte: start } },
    },
    include: { event: true },
  });

  if (!conflictItem) return null;

  return {
    eventId: conflictItem.event.id,
    eventName: conflictItem.event.name,
    startDate: conflictItem.event.startDate,
    endDate: conflictItem.event.endDate,
  };
}
