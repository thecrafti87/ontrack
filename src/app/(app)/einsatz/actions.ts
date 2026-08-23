"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getActiveMission, type MissionProgress } from "@/lib/mission";
import { extractInventoryNo } from "@/lib/scanCode";
import {
  MISSION_PHASES,
  hasReachedPhase,
  isMissionPhase,
  type MissionPhase,
} from "@/lib/constants";

export type ActionState = { error?: string } | undefined;

/**
 * Ergebnis eines Scans im Einsatzmodus.
 *
 * Bewusst ausführlich: Beim Verladen schaut niemand zweimal hin. Die
 * Rückmeldung muss auf einen Blick sagen, was passiert ist — gebucht, schon
 * erledigt, gehört nicht dazu, oder unbekannt.
 */
export type ScanOutcome =
  | { kind: "gebucht"; name: string; inventoryNo: string; anzahl: number }
  | { kind: "schon"; name: string; inventoryNo: string }
  | { kind: "fremd"; name: string; inventoryNo: string; deviceId: string }
  | { kind: "unbekannt"; code: string }
  | { kind: "fehler"; nachricht: string };

export type ScanAnswer = {
  outcome: ScanOutcome;
  fortschritt: MissionProgress | null;
};

// ── Einsatz starten und beenden ──────────────────────────────────────

export async function startMissionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const eventId = String(formData.get("eventId") ?? "");
  const phase = String(formData.get("phase") ?? "");

  if (!isMissionPhase(phase)) return { error: "Unbekannte Phase." };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: "Veranstaltung nicht gefunden." };

  // Ein Benutzer hat höchstens einen laufenden Einsatz; ein neuer ersetzt den alten.
  await prisma.activeMission.upsert({
    where: { userId: user.id },
    create: { userId: user.id, eventId, phase },
    update: { eventId, phase, startedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    action: `Einsatz gestartet: ${MISSION_PHASES[phase].label}`,
    eventId,
  });

  revalidatePath("/einsatz");
  revalidatePath("/");
  revalidatePath(`/events/${eventId}`);
  return undefined;
}

export async function endMissionAction(): Promise<void> {
  const user = await requireUser();

  const mission = await prisma.activeMission.findUnique({ where: { userId: user.id } });
  if (mission) {
    await prisma.activeMission.delete({ where: { userId: user.id } });
    await logActivity({
      userId: user.id,
      action: `Einsatz beendet: ${MISSION_PHASES[mission.phase as MissionPhase]?.label ?? mission.phase}`,
      eventId: mission.eventId,
    });
    revalidatePath(`/events/${mission.eventId}`);
  }

  revalidatePath("/einsatz");
  revalidatePath("/");
}

// ── Der Scan selbst ──────────────────────────────────────────────────

/**
 * Ein gescannter Code im laufenden Einsatz.
 *
 * Grundregel: Ein Scan bucht **nie rückwärts**. Wer beim Packen ein Gerät
 * scannt, das schon aufgebaut ist, würde es sonst auf „gepackt"
 * zurückstufen — ein stiller Datenverlust mitten in der Arbeit.
 */
export async function scanIntoMissionAction(code: string): Promise<ScanAnswer> {
  const user = await requireUser();

  const mission = await prisma.activeMission.findUnique({ where: { userId: user.id } });
  if (!mission) {
    return { outcome: { kind: "fehler", nachricht: "Kein Einsatz aktiv." }, fortschritt: null };
  }

  const phase = mission.phase as MissionPhase;
  const nummer = extractInventoryNo(code);
  if (!nummer) {
    return { outcome: { kind: "unbekannt", code }, fortschritt: null };
  }

  // Ein Case bucht seinen ganzen Inhalt — beim Verladen der Normalfall.
  const caseRecord = await prisma.case.findUnique({
    where: { inventoryNo: nummer },
    include: { devices: { select: { id: true, name: true } } },
  });

  if (caseRecord) {
    const gebucht = await buchePhase(
      mission.eventId,
      caseRecord.devices.map((d) => d.id),
      phase,
      user.id
    );
    const fortschritt = await ladeFortschritt(mission.eventId, phase);

    if (gebucht === 0) {
      return {
        outcome: { kind: "schon", name: caseRecord.name, inventoryNo: nummer },
        fortschritt,
      };
    }
    return {
      outcome: {
        kind: "gebucht",
        name: caseRecord.name,
        inventoryNo: nummer,
        anzahl: gebucht,
      },
      fortschritt,
    };
  }

  // Gerät über Inventarnummer, ersatzweise über die Seriennummer (Hersteller-Barcode).
  const device =
    (await prisma.device.findUnique({ where: { inventoryNo: nummer } })) ??
    (await prisma.device.findFirst({ where: { serialNo: nummer } }));

  if (!device) {
    return { outcome: { kind: "unbekannt", code: nummer }, fortschritt: null };
  }

  const item = await prisma.eventItem.findFirst({
    where: { eventId: mission.eventId, deviceId: device.id },
  });

  if (!item) {
    const fortschritt = await ladeFortschritt(mission.eventId, phase);
    return {
      outcome: {
        kind: "fremd",
        name: device.name,
        inventoryNo: device.inventoryNo,
        deviceId: device.id,
      },
      fortschritt,
    };
  }

  if (hasReachedPhase(item.status, phase)) {
    const fortschritt = await ladeFortschritt(mission.eventId, phase);
    return {
      outcome: { kind: "schon", name: device.name, inventoryNo: device.inventoryNo },
      fortschritt,
    };
  }

  await prisma.eventItem.update({ where: { id: item.id }, data: { status: phase } });
  await logActivity({
    userId: user.id,
    action: `Einsatz (${MISSION_PHASES[phase].label}): ${device.name} → ${MISSION_PHASES[phase].action}`,
    eventId: mission.eventId,
    deviceId: device.id,
  });

  const fortschritt = await ladeFortschritt(mission.eventId, phase);
  revalidatePath(`/events/${mission.eventId}`);

  return {
    outcome: {
      kind: "gebucht",
      name: device.name,
      inventoryNo: device.inventoryNo,
      anzahl: 1,
    },
    fortschritt,
  };
}

/** Alle noch nicht so weit gebuchten Geräte auf die Phase setzen. Gibt die Anzahl zurück. */
async function buchePhase(
  eventId: string,
  deviceIds: string[],
  phase: MissionPhase,
  userId: string
): Promise<number> {
  if (deviceIds.length === 0) return 0;

  const items = await prisma.eventItem.findMany({
    where: { eventId, deviceId: { in: deviceIds } },
    include: { device: { select: { name: true } } },
  });

  const offen = items.filter((i) => !hasReachedPhase(i.status, phase));
  if (offen.length === 0) return 0;

  await prisma.eventItem.updateMany({
    where: { id: { in: offen.map((i) => i.id) } },
    data: { status: phase },
  });

  await logActivity({
    userId,
    action: `Einsatz (${MISSION_PHASES[phase].label}): ${offen.length} Geräte per Case-Scan → ${MISSION_PHASES[phase].action}`,
    eventId,
  });

  revalidatePath(`/events/${eventId}`);
  return offen.length;
}

async function ladeFortschritt(
  eventId: string,
  phase: MissionPhase
): Promise<MissionProgress> {
  const items = await prisma.eventItem.findMany({
    where: { eventId },
    select: { status: true },
  });
  return {
    erledigt: items.filter((i) => hasReachedPhase(i.status, phase)).length,
    gesamt: items.length,
  };
}

/** Ein versehentlich fremdes Gerät nachträglich in die Packliste aufnehmen. */
export async function addToMissionAction(deviceId: string): Promise<ScanAnswer> {
  const user = await requireUser();

  const mission = await prisma.activeMission.findUnique({ where: { userId: user.id } });
  if (!mission) {
    return { outcome: { kind: "fehler", nachricht: "Kein Einsatz aktiv." }, fortschritt: null };
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return { outcome: { kind: "fehler", nachricht: "Gerät nicht gefunden." }, fortschritt: null };
  }

  const phase = mission.phase as MissionPhase;
  const vorhanden = await prisma.eventItem.findFirst({
    where: { eventId: mission.eventId, deviceId },
  });

  if (!vorhanden) {
    await prisma.eventItem.create({
      data: { eventId: mission.eventId, deviceId, status: phase },
    });
    await logActivity({
      userId: user.id,
      action: `Einsatz: ${device.name} nachträglich aufgenommen (${MISSION_PHASES[phase].action})`,
      eventId: mission.eventId,
      deviceId,
    });
  }

  revalidatePath(`/events/${mission.eventId}`);
  const fortschritt = await ladeFortschritt(mission.eventId, phase);

  return {
    outcome: {
      kind: "gebucht",
      name: device.name,
      inventoryNo: device.inventoryNo,
      anzahl: 1,
    },
    fortschritt,
  };
}

/** Für Server-Komponenten, die den Einsatz anzeigen wollen. */
export async function currentMission() {
  const user = await requireUser();
  return getActiveMission(user.id);
}
