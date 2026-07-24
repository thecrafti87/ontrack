"use client";

import { useActionState } from "react";
import { deleteDeviceAction, type ActionState } from "../../actions";

export function DeleteDeviceForm({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteDeviceAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Gerät "${deviceName}" wirklich unwiderruflich löschen?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={deviceId} />
      {state?.error && <p className="text-sm text-red-400 mb-3">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-danger w-full md:w-auto">
        {pending ? "Wird gelöscht…" : "Gerät löschen"}
      </button>
    </form>
  );
}
