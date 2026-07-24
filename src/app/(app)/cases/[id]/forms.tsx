"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addDeviceToCaseAction,
  removeDeviceFromCaseAction,
  relocateCaseAction,
  type ActionState,
} from "../actions";

export function AddDeviceToCaseForm({
  caseId,
  candidates,
}: {
  caseId: string;
  candidates: { id: string; name: string; inventoryNo: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addDeviceToCaseAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) formRef.current?.reset();
  }, [state]);

  if (candidates.length === 0) {
    return <p className="text-sm text-muted">Alle Geräte sind bereits einem Case zugeordnet.</p>;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex-1">
        <label className="label" htmlFor="deviceId">
          Gerät hinzufügen
        </label>
        <select id="deviceId" name="deviceId" className="input" defaultValue="">
          <option value="" disabled>
            Gerät auswählen…
          </option>
          {candidates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.inventoryNo})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-secondary shrink-0">
        {pending ? "Wird hinzugefügt…" : "Hinzufügen"}
      </button>
      {state?.error && <p className="text-sm text-red-400 md:hidden">{state.error}</p>}
    </form>
  );
}

export function RemoveDeviceFromCaseForm({
  caseId,
  deviceId,
  compact = false,
}: {
  caseId: string;
  deviceId: string;
  /** Kompakte Variante: kleines ✕ statt breitem Button (Gruppen-Listen bei vielen Geräten). */
  compact?: boolean;
}) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(
    removeDeviceFromCaseAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="deviceId" value={deviceId} />
      {compact ? (
        <button
          type="submit"
          disabled={pending}
          aria-label="Aus Case entfernen"
          className="shrink-0 size-11 flex items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-surface-2 transition-colors disabled:opacity-40"
        >
          {pending ? "…" : "✕"}
        </button>
      ) : (
        <button type="submit" disabled={pending} className="btn-secondary shrink-0">
          {pending ? "…" : "Entfernen"}
        </button>
      )}
    </form>
  );
}

export function RelocateCaseForm({
  caseId,
  currentLocationId,
  locations,
}: {
  caseId: string;
  currentLocationId: string | null;
  locations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    relocateCaseAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 md:flex-row md:items-end">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex-1">
        <label className="label" htmlFor="relocate-locationId">
          Neuer Standort
        </label>
        <select
          id="relocate-locationId"
          name="locationId"
          className="input"
          defaultValue={currentLocationId ?? ""}
        >
          <option value="">Kein Standort</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-primary shrink-0">
        {pending ? "Wird umgebucht…" : "Case + Inhalt umbuchen"}
      </button>
      {state?.error && <p className="text-sm text-red-400 md:basis-full">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400 md:basis-full">{state.success}</p>}
    </form>
  );
}
