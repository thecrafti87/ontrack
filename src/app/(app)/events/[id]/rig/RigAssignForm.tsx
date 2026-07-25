"use client";

import { useActionState } from "react";
import { setRigFixtureDeviceAction, type ActionState } from "./actions";

/** Zeilen-Formular zur Geräte-Zuordnung einer Rig-Fixture (datalist "rig-device-options"). */
export function RigAssignForm({
  fixtureId,
  currentInventoryNo,
}: {
  fixtureId: string;
  currentInventoryNo: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setRigFixtureDeviceAction,
    undefined
  );

  return (
    <form action={formAction} className="flex items-center gap-1 flex-wrap">
      <input type="hidden" name="fixtureId" value={fixtureId} />
      <input
        list="rig-device-options"
        name="inventoryNo"
        defaultValue={currentInventoryNo}
        placeholder="OT-0000"
        className="input min-h-9 py-1 text-xs w-32"
      />
      <button type="submit" disabled={pending} className="btn-secondary min-h-9 px-2 text-xs">
        {pending ? "…" : "Speichern"}
      </button>
      {state?.error && <p className="text-xs text-red-400 basis-full">{state.error}</p>}
    </form>
  );
}
