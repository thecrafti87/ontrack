"use client";

import { useActionState } from "react";
import { BESCHREIBUNG_MAX } from "@/lib/externalReport";
import { meldeStoerungAction, type MeldungsState } from "./actions";

/**
 * Das Formular für jemanden, der die App nicht kennt und nie kennen wird.
 *
 * Deshalb: aufgeklappt statt versteckt, eine Pflichtangabe statt vier, und
 * eine Beschriftung, die nach der Sache fragt („Was stimmt nicht?") und nicht
 * nach einem Vorgang („Fehlermeldung erfassen").
 */
export function StoerungMelden({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<MeldungsState, FormData>(
    meldeStoerungAction,
    undefined
  );

  if (state && "erfolg" in state) {
    return (
      <div className="card w-full flex flex-col gap-2 text-center">
        <p className="font-semibold text-emerald-400">Meldung abgeschickt</p>
        <p className="text-sm text-muted">{state.erfolg}</p>
      </div>
    );
  }

  const fehler = state && "fehler" in state ? state : null;

  return (
    <form action={formAction} className="card w-full flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />

      <div className="flex flex-col gap-1">
        <label htmlFor="stoerung-text" className="label">
          Was stimmt nicht?
        </label>
        <textarea
          id="stoerung-text"
          name="beschreibung"
          rows={3}
          maxLength={BESCHREIBUNG_MAX}
          required
          placeholder="z. B. flackert seit gestern, oder: geht gar nicht mehr an"
          className="input resize-y"
          aria-invalid={fehler?.feld === "beschreibung" || undefined}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="stoerung-kontakt" className="label">
          Rückfragen an (freiwillig)
        </label>
        <input
          id="stoerung-kontakt"
          name="kontakt"
          autoComplete="email"
          placeholder="E-Mail oder Telefon"
          className="input"
        />
      </div>

      {fehler && <p className="text-sm text-red-400">{fehler.fehler}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Wird gesendet…" : "Störung melden"}
      </button>
    </form>
  );
}
