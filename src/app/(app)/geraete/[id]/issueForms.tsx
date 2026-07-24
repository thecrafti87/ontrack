"use client";

import { useActionState, useEffect, useRef } from "react";
import type { IssueStatus } from "@/lib/constants";
import { createIssueAction, setIssueStatusAction, type ActionState } from "../actions";

/** Fehler melden — für ALLE Rollen sichtbar, auch HELFER. */
export function ReportIssueForm({ deviceId }: { deviceId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createIssueAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-medium text-sm text-muted">Fehler melden</h3>
      <input type="hidden" name="deviceId" value={deviceId} />

      <div>
        <label className="label" htmlFor="issue-description">
          Beschreibung
        </label>
        <textarea
          id="issue-description"
          name="description"
          className="input min-h-20"
          required
          placeholder="Was ist defekt?"
        />
      </div>

      <div>
        <label className="label" htmlFor="issue-file">
          Foto (optional)
        </label>
        <input id="issue-file" type="file" name="file" accept="image/*" capture="environment" className="input" />
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Wird gemeldet…" : "Fehler melden"}
      </button>
    </form>
  );
}

export function IssueStatusForm({
  issueId,
  status,
}: {
  issueId: string;
  status: IssueStatus;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setIssueStatusAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="issueId" value={issueId} />
      {status === "OFFEN" && (
        <button type="submit" name="status" value="IN_REPARATUR" disabled={pending} className="btn-secondary">
          In Reparatur
        </button>
      )}
      <button type="submit" name="status" value="ERLEDIGT" disabled={pending} className="btn-secondary">
        Erledigt
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
