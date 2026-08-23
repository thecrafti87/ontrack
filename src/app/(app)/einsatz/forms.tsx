"use client";

import { useActionState } from "react";
import { MISSION_PHASES, type MissionPhase } from "@/lib/constants";
import { endMissionAction, startMissionAction, type ActionState } from "./actions";

export function StartMissionForm({
  eventId,
  phase,
  variant = "secondary",
}: {
  eventId: string;
  phase: MissionPhase;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    startMissionAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="phase" value={phase} />
      <button
        type="submit"
        disabled={pending}
        className={variant === "primary" ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        {pending ? "…" : MISSION_PHASES[phase].label}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function EndMissionForm({ compact = false }: { compact?: boolean }) {
  return (
    <form action={endMissionAction}>
      <button type="submit" className={compact ? "btn-secondary" : "btn-secondary w-full"}>
        Einsatz beenden
      </button>
    </form>
  );
}
