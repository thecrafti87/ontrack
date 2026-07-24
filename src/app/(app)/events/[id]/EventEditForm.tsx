"use client";

import { useActionState, useState } from "react";
import { updateEventAction, type ActionState } from "../actions";

type EventData = {
  id: string;
  name: string;
  venue: string | null;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  notes: string | null;
};

export function EventEditForm({ event }: { event: EventData }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEventAction,
    undefined
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary self-start">
        Bearbeiten
      </button>
    );
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <input type="hidden" name="id" value={event.id} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="edit-event-name">
            Name
          </label>
          <input id="edit-event-name" name="name" className="input" defaultValue={event.name} required />
        </div>
        <div>
          <label className="label" htmlFor="edit-event-venue">
            Ort
          </label>
          <input id="edit-event-venue" name="venue" className="input" defaultValue={event.venue ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="edit-event-start">
            Von
          </label>
          <input
            id="edit-event-start"
            name="startDate"
            type="date"
            className="input"
            defaultValue={event.startDate}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="edit-event-end">
            Bis
          </label>
          <input
            id="edit-event-end"
            name="endDate"
            type="date"
            className="input"
            defaultValue={event.endDate}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="edit-event-notes">
            Notizen
          </label>
          <textarea
            id="edit-event-notes"
            name="notes"
            className="input min-h-20"
            defaultValue={event.notes ?? ""}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Speichert…" : "Speichern"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Abbrechen
        </button>
      </div>
    </form>
  );
}
