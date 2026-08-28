"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MISSION_PHASES, type MissionPhase } from "@/lib/constants";
import { endMissionAction, startMissionAction, type ActionState } from "./actions";

export function StartMissionForm({
  eventId,
  phase,
  variant = "secondary",
  weiterText = false,
}: {
  eventId: string;
  phase: MissionPhase;
  variant?: "primary" | "secondary";
  /** Im Abschluss einer Phase heisst der Knopf „… beginnen" statt nur „…". */
  weiterText?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    startMissionAction,
    undefined
  );

  const beschriftung = weiterText
    ? `${MISSION_PHASES[phase].label} beginnen`
    : MISSION_PHASES[phase].label;

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="phase" value={phase} />
      <button
        type="submit"
        disabled={pending}
        className={variant === "primary" ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        {/* Nicht „…", sondern was gerade passiert. Ein Knopf, der nur drei
            Punkte zeigt, sieht aus wie einer, der nichts tut. */}
        {pending ? "Wird gestartet …" : beschriftung}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

/**
 * Der Knopf im Formular, damit er den Absendezustand kennt.
 *
 * `endMissionAction` braucht keine Rückmeldung an die Seite — es leitet
 * weiter. Deshalb hier `useFormStatus` statt `useActionState`: Der Knopf
 * sperrt sich, solange gearbeitet wird, ohne dass die Aktion einen Zustand
 * zurückgeben müsste.
 */
function BeendenKnopf({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={compact ? "btn-secondary" : "btn-secondary w-full"}
    >
      {pending ? "Wird beendet …" : "Einsatz beenden"}
    </button>
  );
}

export function EndMissionForm({ compact = false }: { compact?: boolean }) {
  return (
    <form action={endMissionAction}>
      <BeendenKnopf compact={compact} />
    </form>
  );
}
