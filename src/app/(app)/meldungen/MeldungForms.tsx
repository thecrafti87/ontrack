"use client";

import { useActionState } from "react";
import {
  uebernehmeMeldungAction,
  verwerfeMeldungAction,
  type MeldungAktionState,
} from "./actions";

export function MeldungAktionen({ id, zuordenbar }: { id: string; zuordenbar: boolean }) {
  const [uebernahme, uebernehmen, uebernahmeLaeuft] = useActionState<MeldungAktionState, FormData>(
    uebernehmeMeldungAction,
    undefined
  );
  const [verwurf, verwerfen, verwurfLaeuft] = useActionState<MeldungAktionState, FormData>(
    verwerfeMeldungAction,
    undefined
  );

  const fehler = uebernahme?.fehler ?? verwurf?.fehler;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <form action={uebernehmen}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="btn-primary"
            disabled={uebernahmeLaeuft || !zuordenbar}
            title={zuordenbar ? undefined : "Zu dieser Nummer gibt es kein Gerät"}
          >
            {uebernahmeLaeuft ? "…" : "Als Fehler übernehmen"}
          </button>
        </form>
        <form action={verwerfen}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn-secondary" disabled={verwurfLaeuft}>
            {verwurfLaeuft ? "…" : "Verwerfen"}
          </button>
        </form>
      </div>
      {fehler && <p className="text-sm text-red-400">{fehler}</p>}
    </div>
  );
}
