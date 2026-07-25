"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyRigToPacklistAction,
  applyRigPositionsToPlanAction,
  deleteRigAction,
} from "./actions";

export function ApplyToPacklistForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const res = await applyRigToPacklistAction(eventId);
      const parts = [`${res.added} übernommen`, ...res.skippedReasons];
      setMessage(parts.join(", "));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={run} className="btn-secondary">
        {pending ? "Wird übernommen…" : "Zugeordnete Geräte in Packliste übernehmen"}
      </button>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}

export function ApplyPositionsToPlanForm({ eventId, disabled }: { eventId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const res = await applyRigPositionsToPlanAction(eventId);
      setMessage(res.error ?? res.success ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={run}
        className="btn-secondary"
        title={disabled ? "Für dieses Event ist kein Veranstaltungsplan hochgeladen." : undefined}
      >
        {pending ? "Wird übertragen…" : "Positionen auf Plan übertragen"}
      </button>
      {disabled && <p className="text-xs text-muted">Kein Veranstaltungsplan hochgeladen.</p>}
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}

export function DeleteRigForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    if (
      !window.confirm(
        "Rig wirklich löschen? Alle importierten Fixtures dieses Events werden entfernt."
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteRigAction(eventId);
      router.refresh();
    });
  }

  return (
    <button type="button" disabled={pending} onClick={run} className="btn-danger">
      {pending ? "Wird gelöscht…" : "Rig löschen"}
    </button>
  );
}
