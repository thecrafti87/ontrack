"use client";

import { useActionState } from "react";
import { createCaseAction, updateCaseAction, type ActionState } from "./actions";

type CaseFormProps = {
  mode: "create" | "edit";
  locations: { id: string; name: string }[];
  initial?: {
    id: string;
    inventoryNo: string;
    name: string;
    description: string | null;
    locationId: string | null;
  };
  nextInventoryNo?: string;
};

export default function CaseForm({ mode, locations, initial, nextInventoryNo }: CaseFormProps) {
  const action = mode === "create" ? createCaseAction : updateCaseAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="inventoryNo">
            Inventarnummer
          </label>
          <input
            id="inventoryNo"
            name="inventoryNo"
            className="input font-mono"
            required
            defaultValue={initial?.inventoryNo ?? nextInventoryNo ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" className="input" required defaultValue={initial?.name ?? ""} />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="description">
            Beschreibung
          </label>
          <input
            id="description"
            name="description"
            className="input"
            defaultValue={initial?.description ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="locationId">
            Standort
          </label>
          <select id="locationId" name="locationId" className="input" defaultValue={initial?.locationId ?? ""}>
            <option value="">Kein Standort</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full md:w-auto md:self-start">
        {pending ? "Speichert…" : mode === "create" ? "Case anlegen" : "Speichern"}
      </button>
    </form>
  );
}
