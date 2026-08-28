"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLocationAction, updateLocationAction, deleteLocationAction, type ActionState } from "./actions";

export function CreateLocationForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLocationAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-4">
      <h2 className="font-semibold">Neuer Standort</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="new-loc-name">
            Name
          </label>
          <input
            id="new-loc-name"
            name="name"
            className="input"
            placeholder="z. B. Lager Regal 3"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-loc-desc">
            Beschreibung
          </label>
          <input id="new-loc-desc" name="description" className="input" />
        </div>
      </div>

      {/* Koordinaten eingeklappt.
          Wer einen Lagerplatz benennt, braucht sie nie — und ein Formular,
          das mit „Breitengrad (lat)" beginnt, sieht aus wie eine
          Datenbankmaske und nicht wie ein Werkzeug. */}
      <details>
        <summary className="cursor-pointer text-sm text-muted list-none underline decoration-dotted">
          Auf der Karte zeigen (optional)
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="label" htmlFor="new-loc-lat">
              Breitengrad
            </label>
            <input
              id="new-loc-lat"
              name="lat"
              type="number"
              step="any"
              className="input"
              placeholder="50.0037"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-loc-lng">
              Längengrad
            </label>
            <input
              id="new-loc-lng"
              name="lng"
              type="number"
              step="any"
              className="input"
              placeholder="9.0744"
            />
          </div>
          <p className="text-xs text-muted md:col-span-2">
            Nur nötig, damit der Ort auf der Karte erscheint. Für einen
            Lagerplatz im eigenen Haus lohnt sich das selten.
          </p>
        </div>
      </details>

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Wird angelegt…" : "Standort anlegen"}
      </button>
    </form>
  );
}

type LocationRowData = {
  id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  deviceCount: number;
};

export function LocationRow({
  location,
  canEdit,
  isAdmin,
}: {
  location: LocationRowData;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [updateState, updateAction, updatePending] = useActionState<ActionState, FormData>(
    updateLocationAction,
    undefined
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(
    deleteLocationAction,
    undefined
  );

  if (!canEdit) {
    return (
      <div className="card flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{location.name}</p>
          {location.description && <p className="text-sm text-muted">{location.description}</p>}
        </div>
        <span className="badge bg-surface-2 text-muted border-line shrink-0">
          {location.deviceCount} Gerät(e)
        </span>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4">
      <form action={updateAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={location.id} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Standort bearbeiten</span>
          <span className="badge bg-surface-2 text-muted border-line shrink-0">
            {location.deviceCount} Gerät(e)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="name" defaultValue={location.name} placeholder="Name" className="input" required />
          <input
            name="description"
            defaultValue={location.description ?? ""}
            placeholder="Beschreibung"
            className="input"
          />
          <input
            name="lat"
            type="number"
            step="any"
            defaultValue={location.lat ?? ""}
            placeholder="Breitengrad (lat)"
            className="input"
          />
          <input
            name="lng"
            type="number"
            step="any"
            defaultValue={location.lng ?? ""}
            placeholder="Längengrad (lng)"
            className="input"
          />
        </div>

        {updateState?.error && <p className="text-sm text-red-400">{updateState.error}</p>}

        <button type="submit" disabled={updatePending} className="btn-secondary md:self-start">
          {updatePending ? "Speichert…" : "Speichern"}
        </button>
      </form>

      {isAdmin && (
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm(`Standort "${location.name}" wirklich löschen?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={location.id} />
          {deleteState?.error && <p className="text-sm text-red-400 mb-2">{deleteState.error}</p>}
          <button type="submit" disabled={deletePending} className="btn-danger w-full md:w-auto">
            {deletePending ? "Wird gelöscht…" : "Standort löschen"}
          </button>
        </form>
      )}
    </div>
  );
}
