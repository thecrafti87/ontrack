"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createMaintenancePlanAction,
  recordMaintenanceAction,
  deleteMaintenancePlanAction,
  deleteMaintenanceRecordAction,
  type ActionState,
} from "./actions";
import { MAINTENANCE_RESULT, type MaintenanceResult } from "@/lib/constants";

const TITLE_SUGGESTIONS = ["DGUV V3-Prüfung", "Sichtprüfung", "Reinigung"];

export function AddMaintenancePlanForm({ deviceId }: { deviceId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createMaintenancePlanAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 border-t border-line pt-4">
      <h3 className="font-medium text-sm text-muted">Wartungsplan hinzufügen</h3>
      <input type="hidden" name="deviceId" value={deviceId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="maint-title">
            Titel
          </label>
          <input
            id="maint-title"
            name="title"
            className="input"
            list="maint-title-suggestions"
            required
          />
          <datalist id="maint-title-suggestions">
            {TITLE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="maint-interval">
            Intervall (Monate)
          </label>
          <input
            id="maint-interval"
            name="intervalMonths"
            type="number"
            min={1}
            max={120}
            className="input"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="maint-last-done">
            Zuletzt durchgeführt
          </label>
          <input id="maint-last-done" name="lastDoneAt" type="date" className="input" />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="maint-notes">
            Notizen
          </label>
          <textarea id="maint-notes" name="notes" className="input min-h-20" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-secondary md:self-start">
        {pending ? "Wird angelegt…" : "Plan hinzufügen"}
      </button>
    </form>
  );
}

/**
 * Erfassung einer durchgeführten Prüfung.
 *
 * Bewusst ein Formular statt eines Ein-Klick-Knopfes: Der Sinn der Sache ist
 * der Nachweis, und der besteht aus Datum, Ergebnis, Prüfer und Protokoll.
 * Für den einfachen Fall bleibt es trotzdem schnell — Datum und Ergebnis sind
 * vorbelegt, es genügt ein Klick auf "Prüfung speichern".
 */
export function RecordMaintenanceForm({
  planId,
  deviceIsBlocked,
}: {
  planId: string;
  /** Ist das Gerät gerade gesperrt? Dann kann eine bestandene Prüfung es freigeben. */
  deviceIsBlocked: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    recordMaintenanceAction,
    undefined
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Nach dem Speichern zuklappen — reine DOM-Anweisung, kein Zustandswechsel.
  useEffect(() => {
    if (state?.success && detailsRef.current) detailsRef.current.open = false;
  }, [state]);

  return (
    <details ref={detailsRef}>
      <summary className="btn-secondary inline-block cursor-pointer list-none">
        Prüfung erfassen
      </summary>

      {/* Was gespeichert wurde, bleibt stehen.
          Bisher klappte das Formular nach dem Speichern nur zu — und wer
          nicht sicher war, ob es geklappt hat, öffnete es und speicherte
          erneut. Genau so entstanden zwei Nachweise derselben Prüfung im
          Abstand von elf Sekunden. */}
      {state?.success && state.message && (
        <p
          className="mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
          role="status"
        >
          ✓ {state.message}
        </p>
      )}
      {/* Der Schlüssel wechselt bei jedem Erfolg: die Felder werden frisch
          montiert, statt ihren Zustand nachträglich zurückzusetzen. */}
      <RecordMaintenanceFields
        key={state?.token ?? 0}
        planId={planId}
        deviceIsBlocked={deviceIsBlocked}
        formAction={formAction}
        pending={pending}
        error={state?.error}
      />
    </details>
  );
}

function RecordMaintenanceFields({
  planId,
  deviceIsBlocked,
  formAction,
  pending,
  error,
}: {
  planId: string;
  deviceIsBlocked: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  const [result, setResult] = useState<MaintenanceResult>("BESTANDEN");
  const [blockDevice, setBlockDevice] = useState(false);
  const [unblockDevice, setUnblockDevice] = useState(true);
  const dateRef = useRef<HTMLInputElement>(null);

  // Erst nach dem Mounten setzen — ein serverseitig gerendertes "heute" würde
  // beim Hydrieren abweichen.
  useEffect(() => {
    if (dateRef.current) dateRef.current.value = new Date().toISOString().slice(0, 10);
  }, []);

  const failed = result === "DURCHGEFALLEN";

  return (
    <>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="planId" value={planId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor={`rec-date-${planId}`}>
              Prüfdatum
            </label>
            <input
              ref={dateRef}
              id={`rec-date-${planId}`}
              name="performedAt"
              type="date"
              className="input"
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div>
            <label className="label" htmlFor={`rec-result-${planId}`}>
              Ergebnis
            </label>
            <select
              id={`rec-result-${planId}`}
              name="result"
              className="input"
              value={result}
              onChange={(e) => {
                const next = e.target.value as MaintenanceResult;
                setResult(next);
                // Vorbelegen, nicht erzwingen: bei "nicht bestanden" ist das
                // Sperren fast immer richtig, entscheiden soll es der Mensch.
                setBlockDevice(next === "DURCHGEFALLEN");
              }}
            >
              {Object.entries(MAINTENANCE_RESULT).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor={`rec-tester-${planId}`}>
              Prüfer <span className="text-muted font-normal">(Person oder Firma)</span>
            </label>
            <input
              id={`rec-tester-${planId}`}
              name="testerName"
              className="input"
              placeholder="z. B. Elektro Müller GmbH"
            />
          </div>

          <div>
            <label className="label" htmlFor={`rec-file-${planId}`}>
              Protokoll <span className="text-muted font-normal">(PDF oder Foto)</span>
            </label>
            <input
              id={`rec-file-${planId}`}
              name="file"
              type="file"
              accept=".pdf,image/*"
              className="input"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label" htmlFor={`rec-notes-${planId}`}>
              Bemerkung
            </label>
            <textarea
              id={`rec-notes-${planId}`}
              name="notes"
              className="input min-h-16"
              placeholder={failed ? "Welcher Mangel? Was ist zu tun?" : "Optional"}
            />
          </div>
        </div>

        {!MAINTENANCE_RESULT[result].resetsInterval && (
          <p className="text-xs text-amber-400">
            Eine nicht bestandene Prüfung setzt das Intervall nicht zurück — das Gerät
            bleibt fällig, bis es die Prüfung besteht.
          </p>
        )}

        {/* Sperren und Entsperren schließen sich aus: Ist das Gerät gesperrt
            und die Prüfung bestanden, ist die Freigabe die naheliegende
            Handlung — aber auch sie geschieht nie von allein. */}
        {deviceIsBlocked && MAINTENANCE_RESULT[result].resetsInterval ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="unblockDevice"
              checked={unblockDevice}
              onChange={(e) => setUnblockDevice(e.target.checked)}
              className="size-4 accent-emerald-500"
            />
            Sperre aufheben (Gerät wieder einsatzbereit)
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="blockDevice"
              checked={blockDevice}
              onChange={(e) => setBlockDevice(e.target.checked)}
              className="size-4 accent-red-500"
            />
            Gerät sperren (nicht mehr für Veranstaltungen einplanbar)
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={pending} className="btn-primary md:self-start">
          {pending ? "Wird gespeichert…" : "Prüfung speichern"}
        </button>
      </form>
    </>
  );
}

export function DeleteMaintenanceRecordForm({ recordId }: { recordId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteMaintenanceRecordAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Prüfnachweis wirklich löschen? Er dient als Beleg gegenüber Versicherung und Aufsicht."
          )
        )
          e.preventDefault();
      }}
      className="inline-flex flex-col"
    >
      <input type="hidden" name="recordId" value={recordId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center text-xs text-muted underline hover:text-red-400"
      >
        {pending ? "Wird gelöscht…" : "Nachweis löschen"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function DeleteMaintenancePlanForm({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteMaintenancePlanAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Wartungsplan wirklich löschen?")) e.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      <input type="hidden" name="planId" value={planId} />
      <button type="submit" disabled={pending} className="btn-danger">
        {pending ? "Wird gelöscht…" : "Plan löschen"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
