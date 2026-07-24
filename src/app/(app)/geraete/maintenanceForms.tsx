"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createMaintenancePlanAction,
  completeMaintenanceAction,
  deleteMaintenancePlanAction,
  type ActionState,
} from "./actions";

const TITLE_SUGGESTIONS = ["DGUV V3-Prüfung", "Sichtprüfung", "Reinigung"];

export function AddMaintenancePlanForm({ deviceId }: { deviceId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createMaintenancePlanAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 border-t border-line pt-4">
      <h3 className="font-medium text-sm text-muted">Wartungsplan hinzufügen</h3>
      <input type="hidden" name="deviceId" value={deviceId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="maint-title">
            Titel
          </label>
          <input
            id="maint-title"
            name="title"
            className="input"
            list="maint-title-suggestions"
            required
          />
          <datalist id="maint-title-suggestions">
            {TITLE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="maint-interval">
            Intervall (Monate)
          </label>
          <input
            id="maint-interval"
            name="intervalMonths"
            type="number"
            min={1}
            max={120}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="maint-last-done">
            Zuletzt durchgeführt
          </label>
          <input id="maint-last-done" name="lastDoneAt" type="date" className="input" />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="maint-notes">
            Notizen
          </label>
          <textarea id="maint-notes" name="notes" className="input min-h-20" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-secondary md:self-start">
        {pending ? "Wird angelegt…" : "Plan hinzufügen"}
      </button>
    </form>
  );
}

export function CompleteMaintenanceForm({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    completeMaintenanceAction,
    undefined
  );

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="planId" value={planId} />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Wird erfasst…" : "Wartung durchgeführt"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function DeleteMaintenancePlanForm({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteMaintenancePlanAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Wartungsplan wirklich löschen?")) e.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      <input type="hidden" name="planId" value={planId} />
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "Wird gelöscht…" : "Löschen"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
