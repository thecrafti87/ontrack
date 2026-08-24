"use client";

import { useActionState, useState } from "react";
import {
  createLoanAction,
  deleteLoanAction,
  returnItemsAction,
  type ActionState,
} from "./actions";

export function LoanForm({
  devices,
}: {
  devices: { id: string; name: string; inventoryNo: string; category: string | null }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createLoanAction,
    undefined
  );
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());

  const gefiltert = devices.filter((d) => {
    const t = suche.trim().toLowerCase();
    if (!t) return true;
    return (
      d.name.toLowerCase().includes(t) ||
      d.inventoryNo.toLowerCase().includes(t) ||
      (d.category ?? "").toLowerCase().includes(t)
    );
  });

  function umschalten(id: string) {
    setGewaehlt((bisher) => {
      const neu = new Set(bisher);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="borrower">
            An wen
          </label>
          <input
            id="borrower"
            name="borrower"
            className="input"
            required
            placeholder="Person oder Firma"
          />
        </div>
        <div>
          <label className="label" htmlFor="contact">
            Kontakt
          </label>
          <input id="contact" name="contact" className="input" placeholder="Telefon oder E-Mail" />
        </div>
        <div>
          <label className="label" htmlFor="dueAt">
            Rückgabe bis
          </label>
          <input id="dueAt" name="dueAt" type="date" className="input" required />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="notes">
            Notizen
          </label>
          <textarea id="notes" name="notes" className="input min-h-20" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="label mb-0">Geräte auswählen</p>
          <p className="text-sm text-muted">{gewaehlt.size} ausgewählt</p>
        </div>

        {devices.length === 0 ? (
          <p className="text-sm text-amber-400">
            Kein Gerät verfügbar — alle sind bereits verliehen, defekt oder gesperrt.
          </p>
        ) : (
          <>
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suchen …"
              className="input"
            />
            <div className="rounded-xl border border-line divide-y divide-line max-h-72 overflow-auto">
              {gefiltert.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    name="deviceIds"
                    value={d.id}
                    checked={gewaehlt.has(d.id)}
                    onChange={() => umschalten(d.id)}
                    className="size-4 accent-amber-500"
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted text-sm">
                      {" "}
                      · <span className="font-mono">{d.inventoryNo}</span>
                      {d.category && <> · {d.category}</>}
                    </span>
                  </span>
                </label>
              ))}
              {gefiltert.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted">Kein Treffer.</p>
              )}
            </div>
          </>
        )}
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || gewaehlt.size === 0}
        className="btn-primary md:self-start"
      >
        {pending ? "Wird angelegt…" : `${gewaehlt.size} Geräte herausgeben`}
      </button>
    </form>
  );
}

export function ReturnForm({
  loanId,
  offen,
}: {
  loanId: string;
  offen: { id: string; name: string; inventoryNo: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    returnItemsAction,
    undefined
  );
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());

  if (offen.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="loanId" value={loanId} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold">Rücknahme</p>
        <button
          type="button"
          className="text-sm text-accent underline"
          onClick={() =>
            setGewaehlt((b) => (b.size === offen.length ? new Set() : new Set(offen.map((o) => o.id))))
          }
        >
          {gewaehlt.size === offen.length ? "Auswahl aufheben" : "Alle auswählen"}
        </button>
      </div>

      <div className="rounded-xl border border-line divide-y divide-line">
        {offen.map((o) => (
          <label key={o.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-2">
            <input
              type="checkbox"
              name="itemIds"
              value={o.id}
              checked={gewaehlt.has(o.id)}
              onChange={() =>
                setGewaehlt((b) => {
                  const n = new Set(b);
                  if (n.has(o.id)) n.delete(o.id);
                  else n.add(o.id);
                  return n;
                })
              }
              className="size-4 accent-emerald-500"
            />
            <span>
              {o.name} <span className="text-muted font-mono text-sm">{o.inventoryNo}</span>
            </span>
          </label>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || gewaehlt.size === 0}
        className="btn-primary self-start"
      >
        {pending ? "…" : `${gewaehlt.size} zurücknehmen`}
      </button>
    </form>
  );
}

export function DeleteLoanForm({ id, borrower }: { id: string; borrower: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteLoanAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Verleih an „${borrower}" wirklich löschen?`)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "…" : "Löschen"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
