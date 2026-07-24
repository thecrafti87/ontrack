"use client";

import { useActionState } from "react";
import { uploadPlanImageAction, type ActionState } from "../actions";

export function PlanUploadForm({ eventId, hasExisting }: { eventId: string; hasExisting: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    uploadPlanImageAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex-1">
        <label className="label" htmlFor="plan-file">
          {hasExisting ? "Plan ersetzen" : "Plan hochladen"}
        </label>
        <input
          id="plan-file"
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-secondary shrink-0">
        {pending ? "Lädt hoch…" : hasExisting ? "Ersetzen" : "Hochladen"}
      </button>
    </form>
  );
}
