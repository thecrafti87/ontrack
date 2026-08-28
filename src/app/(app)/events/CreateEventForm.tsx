"use client";

import { useActionState, useState } from "react";
import { createEventAction, type ActionState } from "./actions";

export function CreateEventForm() {
  const [art, setArt] = useState<"VERANSTALTUNG" | "OBJEKT">("VERANSTALTUNG");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEventAction,
    undefined
  );

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <h2 className="font-semibold">
        {art === "OBJEKT" ? "Neues Objekt" : "Neue Veranstaltung"}
      </h2>

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
            {art === "OBJEKT" ? "Rückbau geplant (optional)" : "Bis"}
          </label>
          <input
            id="new-event-end"
            name="endDate"
            type="date"
            className="input"
            required={art !== "OBJEKT"}
          />
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
        {pending ? "Wird angelegt…" : art === "OBJEKT" ? "Objekt anlegen" : "Veranstaltung anlegen"}
      </button>
    </form>
  );
}
