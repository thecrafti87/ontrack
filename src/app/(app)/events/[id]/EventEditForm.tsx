"use client";

import { useActionState, useState } from "react";
import { updateEventAction, type ActionState } from "../actions";

type EventData = {
  id: string;
  name: string;
  kind: string;
  venue: string | null;
  startDate: string; // yyyy-mm-dd
  /** Leer bei einem laufenden Objekt. */
  endDate: string;
  notes: string | null;
};

export function EventEditForm({ event }: { event: EventData }) {
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState<"VERANSTALTUNG" | "OBJEKT">(
    event.kind === "OBJEKT" ? "OBJEKT" : "VERANSTALTUNG"
  );
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
        <div className="md:col-span-2">
          <p className="label">Art</p>
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kind"
                value="VERANSTALTUNG"
                className="size-4"
                checked={art === "VERANSTALTUNG"}
                onChange={() => setArt("VERANSTALTUNG")}
              />
              <span>Veranstaltung</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kind"
                value="OBJEKT"
                className="size-4"
                checked={art === "OBJEKT"}
                onChange={() => setArt("OBJEKT")}
              />
              <span>Objekt (Festinstallation)</span>
            </label>
          </div>
          <p className="text-sm text-muted mt-1">
            {art === "OBJEKT"
              ? "Läuft ab dem Anfang weiter, bis jemand sie zurückbaut. Verbaute Geräte gelten dauerhaft als belegt."
              : "Hat einen Anfang und ein Ende. Danach kommen die Geräte zurück."}
          </p>
        </div>
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
            {art === "OBJEKT" ? "Rückbau geplant (optional)" : "Bis"}
          </label>
          <input
            id="edit-event-end"
            name="endDate"
            type="date"
            className="input"
            defaultValue={event.endDate}
            required={art !== "OBJEKT"}
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
