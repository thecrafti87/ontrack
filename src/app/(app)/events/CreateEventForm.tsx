"use client";

import { useActionState } from "react";
import { createEventAction, type ActionState } from "./actions";

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    undefined
  );

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <h2 className="font-semibold">Neue Veranstaltung</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="new-event-name">
            Name
          </label>
          <input id="new-event-name" name="name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="new-event-venue">
            Ort
          </label>
          <input id="new-event-venue" name="venue" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="new-event-start">
            Von
          </label>
          <input id="new-event-start" name="startDate" type="date" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="new-event-end">
            Bis
          </label>
          <input id="new-event-end" name="endDate" type="date" className="input" required />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="new-event-notes">
            Notizen
          </label>
          <textarea id="new-event-notes" name="notes" className="input min-h-20" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Wird angelegt…" : "Veranstaltung anlegen"}
      </button>
    </form>
  );
}
