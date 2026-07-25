"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRigInstallStatusAction } from "./actions";

const STATUS_BADGE: Record<string, string> = {
  GEPLANT: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  MONTIERT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ABWEICHEND: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};
const STATUS_LABEL: Record<string, string> = {
  GEPLANT: "Geplant",
  MONTIERT: "Montiert",
  ABWEICHEND: "Abweichend",
};

/** Soll/Ist-Montagestatus einer Rig-Fixture: Badge + (editierbar) Aktionen. */
export function RigInstallStatusForm({
  fixtureId,
  status,
  actualPosition,
  editable,
}: {
  fixtureId: string;
  status: string;
  actualPosition: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState(actualPosition ?? "");
  const [error, setError] = useState<string | null>(null);

  function apply(next: "GEPLANT" | "MONTIERT" | "ABWEICHEND", actual?: string) {
    setError(null);
    startTransition(async () => {
      const res = await setRigInstallStatusAction(fixtureId, next, actual);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={`badge w-fit ${STATUS_BADGE[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span>
      {status === "ABWEICHEND" && actualPosition && (
        <span className="text-xs text-amber-400">→ tatsächlich: {actualPosition}</span>
      )}

      {editable && (
        <div className="flex flex-col gap-1">
          {!showForm ? (
            <div className="flex flex-wrap items-center gap-1">
              {status !== "MONTIERT" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply("MONTIERT")}
                  className="btn-secondary min-h-8 px-2 text-xs"
                >
                  Montiert
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowForm(true)}
                className="btn-secondary min-h-8 px-2 text-xs"
              >
                Abweichend…
              </button>
              {status !== "GEPLANT" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => apply("GEPLANT")}
                  className="text-xs text-muted hover:text-accent underline"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Wo stattdessen?"
                className="input min-h-9 py-1 text-xs w-40"
              />
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  disabled={pending || !text.trim()}
                  onClick={() => apply("ABWEICHEND", text)}
                  className="btn-secondary min-h-8 px-2 text-xs"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-muted underline"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
