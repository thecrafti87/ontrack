"use client";

import { useActionState } from "react";
import { advanceItemStatusAction, type ActionState } from "./actions";

/** Statuswechsel-Button — für ALLE Rollen (auch HELFER), da es das Abhaken der Packliste ist. */
export function AdvanceStatusButton({
  itemId,
  nextLabel,
}: {
  itemId: string;
  nextLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    advanceItemStatusAction,
    undefined
  );

  if (!nextLabel) return null;

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary md:min-h-9 md:px-3 md:py-1 md:text-xs"
      >
        {pending ? "…" : nextLabel}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
