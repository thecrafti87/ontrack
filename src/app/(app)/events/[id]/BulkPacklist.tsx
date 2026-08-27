"use client";

import { useActionState, useState } from "react";
import {
  addBulkItemToEventAction,
  removeBulkItemFromEventAction,
  bookEventBulkAction,
  type ActionState,
} from "../actions";
import { EINSATZ_STATUS_BADGE, EINSATZ_STATUS_LABEL, type EinsatzStatus } from "@/lib/bulk";

export type BulkRow = {
  id: string;
  bulkItemId: string;
  name: string;
  unit: string;
  geplant: number;
  mitgenommen: number;
  zurueck: number;
  offen: number;
  status: EinsatzStatus;
  /** Was gerade im Lager liegt — Obergrenze fürs Mitnehmen. */
  bestand: number;
};

export type BulkCandidate = { id: string; name: string; unit: string; quantity: number };

/**
 * Mengenartikel auf der Packliste.
 *
 * Bewusst ohne die vier Phasen der Geräte: 40 Kabel werden nicht einzeln
 * aufgebaut und abgebaut. Was zählt, sind zwei Zeitpunkte — was ging mit, und
 * was kam zurück. Die Lücke dazwischen ist der Fehlbestand.
 */
export function BulkPacklist({
  eventId,
  rows,
  candidates,
  editable,
}: {
  eventId: string;
  rows: BulkRow[];
  candidates: BulkCandidate[];
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addBulkItemToEventAction,
    undefined
  );
  const [ausgewaehlt, setAusgewaehlt] = useState("");

  const offenGesamt = rows.reduce((summe, row) => summe + row.offen, 0);
  const verfuegbar = candidates.filter((c) => !rows.some((r) => r.bulkItemId === c.id));

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          Noch keine Mengenartikel eingeplant. Kabel, Schellen und Kleinteile gehören hierher —
          sie haben keinen eigenen QR-Code, gehen aber am ehesten verloren.
        </p>
      ) : (
        <>
          {offenGesamt > 0 && (
            <p className="text-sm text-amber-400">
              ⚠️ {offenGesamt} Stück noch nicht zurück im Lager
            </p>
          )}

          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{row.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${EINSATZ_STATUS_BADGE[row.status]}`}
                  >
                    {EINSATZ_STATUS_LABEL[row.status]}
                  </span>
                </div>

                <p className="text-sm text-muted">
                  Geplant {row.geplant} {row.unit} · mit {row.mitgenommen} · zurück {row.zurueck}
                  {row.offen > 0 && (
                    <span className="text-amber-400"> · {row.offen} noch draußen</span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <BuchungsForm
                    eventId={eventId}
                    bulkItemId={row.bulkItemId}
                    richtung="ENTNAHME"
                    beschriftung="Mitnehmen"
                    vorschlag={Math.max(0, row.geplant - row.mitgenommen)}
                    grenze={row.bestand}
                  />
                  <BuchungsForm
                    eventId={eventId}
                    bulkItemId={row.bulkItemId}
                    richtung="RUECKGABE"
                    beschriftung="Zurück"
                    vorschlag={row.offen}
                    grenze={row.offen}
                  />
                  {editable && <EntfernenForm id={row.id} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editable && verfuegbar.length > 0 && (
        <form action={formAction} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <input type="hidden" name="eventId" value={eventId} />
          <div className="flex-1">
            <label className="label" htmlFor="bulkItemId">
              Mengenartikel einplanen
            </label>
            <select
              id="bulkItemId"
              name="bulkItemId"
              className="input"
              value={ausgewaehlt}
              onChange={(e) => setAusgewaehlt(e.target.value)}
            >
              <option value="">Bitte wählen …</option>
              {verfuegbar.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.quantity} {c.unit} im Lager)
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="label" htmlFor="plannedQty">
              Menge
            </label>
            <input
              id="plannedQty"
              name="plannedQty"
              type="number"
              min={1}
              defaultValue={1}
              className="input"
            />
          </div>
          <button type="submit" disabled={pending || !ausgewaehlt} className="btn-secondary">
            {pending ? "…" : "Hinzufügen"}
          </button>
        </form>
      )}

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </div>
  );
}

function BuchungsForm({
  eventId,
  bulkItemId,
  richtung,
  beschriftung,
  vorschlag,
  grenze,
}: {
  eventId: string;
  bulkItemId: string;
  richtung: "ENTNAHME" | "RUECKGABE";
  beschriftung: string;
  vorschlag: number;
  grenze: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    bookEventBulkAction,
    undefined
  );

  // Nichts anzubieten, wenn nichts zu buchen ist — ein Knopf, der nur eine
  // Fehlermeldung erzeugen kann, ist keine Hilfe.
  if (grenze <= 0) return null;

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="bulkItemId" value={bulkItemId} />
      <input type="hidden" name="richtung" value={richtung} />
      <input
        type="number"
        name="menge"
        min={1}
        max={grenze}
        defaultValue={Math.min(Math.max(1, vorschlag), grenze)}
        className="input w-20 md:min-h-9 md:py-1 md:text-sm"
        aria-label={`Menge ${beschriftung}`}
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary shrink-0 md:min-h-9 md:px-3 md:py-1 md:text-xs"
      >
        {pending ? "…" : beschriftung}
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}

function EntfernenForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    removeBulkItemFromEventAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-muted hover:text-red-400 underline"
      >
        {pending ? "…" : "Von der Planung nehmen"}
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
