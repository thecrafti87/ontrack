"use client";

import { useActionState } from "react";
import { deleteCaseAction, type ActionState } from "../../actions";

export function DeleteCaseForm({ caseId, caseName }: { caseId: string; caseName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteCaseAction, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Case "${caseName}" wirklich unwiderruflich löschen? Die enthaltenen Geräte bleiben erhalten und verlieren nur die Case-Zuordnung.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={caseId} />
      {state?.error && <p className="text-sm text-red-400 mb-3">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-danger w-full md:w-auto">
        {pending ? "Wird gelöscht…" : "Case löschen"}
      </button>
    </form>
  );
}
