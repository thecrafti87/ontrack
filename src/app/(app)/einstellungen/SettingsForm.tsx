"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "./actions";

export function SettingsForm({
  foundOwner,
  foundContact,
  appUrl,
  registrationCode,
  publicReports,
}: {
  foundOwner: string;
  foundContact: string;
  appUrl: string;
  registrationCode: string;
  publicReports: boolean;
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

      <div>
        <label className="label" htmlFor="registrationCode">
          Einladungscode für die Registrierung
        </label>
        <input
          id="registrationCode"
          name="registrationCode"
          className="input"
          placeholder="leer = jeder darf sich registrieren"
          defaultValue={registrationCode}
          autoComplete="off"
        />
        <p className="text-sm text-muted mt-1">
          Steht hier ein Code, verlangt die Registrierung ihn. Sinnvoll, sobald
          die Instanz öffentlich erreichbar ist — sonst kann jeder, der die
          Adresse kennt, ein Konto beantragen. Groß- und Kleinschreibung sind
          egal. Leeren gibt die Registrierung wieder frei.
        </p>
      </div>

      <div className="border-t border-line pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="publicReports"
            value="an"
            defaultChecked={publicReports}
            className="size-5 mt-0.5"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium">Störungsmeldung ohne Anmeldung erlauben</span>
            <span className="text-sm text-muted">
              Wer einen QR-Code scannt, kann dann melden, was nicht stimmt — ohne Konto. Gedacht
              für Festinstallationen, wo Hausmeister oder Hauspersonal etwas bemerken. Die Meldung
              sperrt kein Gerät: Sie landet als Vorstufe in einer Liste, aus der jemand aus dem
              Team eine echte Fehlermeldung macht. Aus, solange es niemand braucht — es ist die
              einzige Stelle, an der ohne Anmeldung geschrieben werden kann.
            </span>
          </span>
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400">Gespeichert.</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
