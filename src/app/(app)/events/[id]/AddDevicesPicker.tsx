"use client";

import { useActionState, useMemo, useState } from "react";
import { addDevicesToEventAction, addCaseToEventAction, type ActionState } from "../actions";

type Candidate = {
  id: string;
  name: string;
  inventoryNo: string;
  /** Fertig formulierter Grund vom Server — Doppelbuchung oder Verleih. */
  conflict: { label: string } | null;
};

export function AddDevicesPicker({
  eventId,
  candidates,
  cases,
}: {
  eventId: string;
  candidates: Candidate[];
  cases: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addDevicesToEventAction,
    undefined
  );
  const [caseState, caseFormAction, casePending] = useActionState<ActionState, FormData>(
    addCaseToEventAction,
    undefined
  );

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.inventoryNo.toLowerCase().includes(q)
    );
  }, [query, candidates]);

  const hasConflictSelected = candidates.some((c) => selected.has(c.id) && c.conflict);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {cases.length > 0 && (
        <div className="flex flex-col gap-2">
          <form action={caseFormAction} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <input type="hidden" name="eventId" value={eventId} />
            <div className="flex-1">
              <label className="label" htmlFor="caseId">
                Ganzes Case hinzufügen
              </label>
              <select id="caseId" name="caseId" className="input" defaultValue="">
                <option value="" disabled>
                  Case auswählen…
                </option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={casePending} className="btn-secondary shrink-0">
              {casePending ? "Wird hinzugefügt…" : "Case hinzufügen"}
            </button>
          </form>
          {caseState?.error && <p className="text-sm text-red-400">{caseState.error}</p>}
          {caseState?.success && <p className="text-sm text-emerald-400">{caseState.success}</p>}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="eventId" value={eventId} />

        <input
          type="text"
          className="input"
          placeholder="Gerät suchen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div
          tabIndex={0}
          role="region"
          aria-label="Geräteliste"
          className="flex flex-col gap-1 max-h-80 overflow-y-auto rounded-xl border border-line p-2"
        >
          {filtered.length === 0 && <p className="text-sm text-muted p-2">Keine passenden Geräte.</p>}
          {filtered.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-3 rounded-lg p-2 hover:bg-surface-2 cursor-pointer"
            >
              <input
                type="checkbox"
                name="deviceIds"
                value={c.id}
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-1 size-5 shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block">
                  {c.name} <span className="font-mono text-muted text-sm">{c.inventoryNo}</span>
                </span>
                {c.conflict && (
                  <span className="block text-xs text-amber-400">⚠️ {c.conflict.label}</span>
                )}
              </span>
            </label>
          ))}
        </div>

        {hasConflictSelected && (
          <label className="flex items-center gap-2 text-sm text-amber-400">
            <input type="checkbox" name="override" className="size-5" />
            Konflikte ignorieren und trotzdem einplanen
          </label>
        )}

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="btn-primary md:self-start"
        >
          {pending
            ? "Wird hinzugefügt…"
            : selected.size > 0
              ? `${selected.size} Gerät(e) hinzufügen`
              : "Geräte hinzufügen"}
        </button>
      </form>
    </div>
  );
}
