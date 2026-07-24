"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "./actions";

export function SettingsForm({
  foundOwner,
  foundContact,
  appUrl,
}: {
  foundOwner: string;
  foundContact: string;
  appUrl: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveSettingsAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="foundOwner">
          Eigentümer-Anzeige
        </label>
        <input id="foundOwner" name="foundOwner" className="input" defaultValue={foundOwner} />
      </div>

      <div>
        <label className="label" htmlFor="foundContact">
          Kontakt-Hinweis für Finder
        </label>
        <textarea
          id="foundContact"
          name="foundContact"
          className="input min-h-24"
          defaultValue={foundContact}
        />
      </div>

      <div>
        <label className="label" htmlFor="appUrl">
          App-Adresse für QR-Codes
        </label>
        <input
          id="appUrl"
          name="appUrl"
          className="input"
          placeholder="https://ontrack.beispiel.de"
          defaultValue={appUrl}
        />
        <p className="text-sm text-muted mt-1">
          Leer = automatisch. Vor dem Etikettendruck auf die echte Server-Adresse setzen, sonst
          zeigen QR-Codes und NFC-Tags auf localhost.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400">Gespeichert.</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
