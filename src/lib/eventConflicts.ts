import "server-only";
import { prisma } from "./prisma";
import { verleihUeberschneidet, tageUeberfaellig } from "./loan";

export type EventConflict = {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
} | null;

export type LoanConflict = {
  loanId: string;
  borrower: string;
  dueAt: Date;
  ueberfaellig: boolean;
  tage: number;
} | null;

/**
 * Ein Gerät kann aus zwei Gründen nicht einplanbar sein: Es ist auf einer
 * anderen Veranstaltung, oder es ist gar nicht im Haus.
 */
export type PlanningConflict =
  | { art: "event"; event: NonNullable<EventConflict> }
  | { art: "verleih"; verleih: NonNullable<LoanConflict> }
  | null;

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

/**
 * Prüft, ob ein Gerät im Zeitraum verliehen ist.
 *
 * Nur offene Positionen zählen — ein zurückgegebenes Gerät steht wieder zur
 * Verfügung, auch wenn der Verleih als Ganzes noch läuft. Bei mehreren
 * offenen Verleihen gewinnt der, der am längsten blockiert.
 */
export async function findLoanConflict(
  deviceId: string,
  start: Date,
  end: Date,
  heute: Date = new Date()
): Promise<LoanConflict> {
  const offenePositionen = await prisma.loanItem.findMany({
    where: { deviceId, returnedAt: null },
    include: { loan: true },
  });

  const treffer = offenePositionen
    .filter((position) =>
      verleihUeberschneidet(
        {
          issuedAt: position.loan.issuedAt,
          dueAt: position.loan.dueAt,
          itemReturnedAt: position.returnedAt,
        },
        start,
        end,
        heute
      )
    )
    .sort((a, b) => b.loan.dueAt.getTime() - a.loan.dueAt.getTime())[0];

  if (!treffer) return null;

  const tage = tageUeberfaellig(treffer.loan.dueAt, treffer.returnedAt, heute);

  return {
    loanId: treffer.loanId,
    borrower: treffer.loan.borrower,
    dueAt: treffer.loan.dueAt,
    ueberfaellig: tage > 0,
    tage,
  };
}

/**
 * Beide Prüfungen in der Reihenfolge, in der sie sich lohnen: Die
 * Doppelbuchung ist der häufigere Fall, der Verleih der teurere — wer ein
 * verliehenes Gerät einplant, merkt es erst beim Verladen.
 */
export async function findPlanningConflict(
  deviceId: string,
  excludeEventId: string,
  start: Date,
  end: Date,
  heute: Date = new Date()
): Promise<PlanningConflict> {
  const event = await findEventConflict(deviceId, excludeEventId, start, end);
  if (event) return { art: "event", event };

  const verleih = await findLoanConflict(deviceId, start, end, heute);
  if (verleih) return { art: "verleih", verleih };

  return null;
}

/** Kurzbegründung für Fehlermeldungen und Protokolleinträge. */
export function konfliktText(conflict: NonNullable<PlanningConflict>): string {
  if (conflict.art === "event") {
    return `bereits auf „${conflict.event.eventName}“`;
  }

  const { borrower, dueAt, ueberfaellig, tage } = conflict.verleih;
  if (ueberfaellig) {
    return `verliehen an ${borrower}, seit ${tage} Tag${tage === 1 ? "" : "en"} überfällig`;
  }
  return `verliehen an ${borrower} bis ${dueAt.toLocaleDateString("de-DE")}`;
}
