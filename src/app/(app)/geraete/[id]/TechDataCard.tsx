"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveFieldValuesAction, type ActionState } from "../actions";

export type DisplayField = {
  code: string;
  label: string;
  unit?: string;
  value: string;
  isExtra: boolean;
};

export type DisplayGroup = { group: string; fields: DisplayField[] };

export type ActiveField = { code: string; label: string; unit?: string; value: string };

export function TechDataCard({
  deviceId,
  deviceCategory,
  editable,
  isAdmin,
  displayGroups,
  activeFields,
}: {
  deviceId: string;
  deviceCategory: string | null;
  editable: boolean;
  isAdmin: boolean;
  displayGroups: DisplayGroup[];
  activeFields: ActiveField[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveFieldValuesAction,
    undefined
  );

  // Nach erfolgreichem Speichern zurück in die Anzeige. Bewusst während des
  // Renderns statt in einem Effect: so entfällt der zusätzliche Durchlauf, in
  // dem das Formular noch offen wäre, obwohl es schon gespeichert ist.
  const [letztesToken, setLetztesToken] = useState<number | undefined>(undefined);
  if (state?.token !== letztesToken) {
    setLetztesToken(state?.token);
    if (state?.success && editing) setEditing(false);
  }

  const hasAnything = displayGroups.length > 0;

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Technische Daten</h2>
        {editable && activeFields.length > 0 && (
          <button type="button" className="btn-secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Abbrechen" : "Bearbeiten"}
          </button>
        )}
      </div>

      {!hasAnything && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Keine Zusatzfelder für Kategorie {deviceCategory ?? "–"} konfiguriert.
          </p>
          {isAdmin && (
            <Link href="/einstellungen/felder" className="text-sm text-accent self-start">
              Zur Konfiguration
            </Link>
          )}
        </div>
      )}

      {hasAnything && !editing && (
        <div className="flex flex-col gap-4">
          {displayGroups.map((g) => (
            <div key={g.group} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">{g.group}</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {g.fields.map((f) => (
                  <div key={f.code} className="flex justify-between md:block">
                    <dt className="text-muted">
                      {f.label}
                      {f.unit && <> ({f.unit})</>}
                      {f.isExtra && (
                        <span
                          title="Wert vorhanden, Feld nicht in aktueller Auswahl"
                          className="ml-1 text-muted cursor-help"
                        >
                          *
                        </span>
                      )}
                    </dt>
                    <dd>{f.value || "–"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {editing && activeFields.length > 0 && (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="deviceId" value={deviceId} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeFields.map((f) => (
              <div key={f.code}>
                <label className="label" htmlFor={`field-${f.code}`}>
                  {f.label}
                  {f.unit && <> ({f.unit})</>}
                </label>
                <input
                  id={`field-${f.code}`}
                  name={f.code}
                  className="input"
                  defaultValue={f.value}
                />
              </div>
            ))}
          </div>

          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button type="submit" disabled={pending} className="btn-primary md:self-start">
            {pending ? "Speichert…" : "Speichern"}
          </button>
        </form>
      )}
    </div>
  );
}
