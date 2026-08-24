"use client";

import { useActionState, useState } from "react";
import { BULK_REASONS, BULK_UNITS, type BulkReason } from "@/lib/constants";
import { pruefeBewegung } from "@/lib/bulk";
import {
  createBulkItemAction,
  deleteBulkItemAction,
  recordMovementAction,
  updateBulkItemAction,
  type ActionState,
} from "./actions";

type ItemFormProps = {
  mode: "create" | "edit";
  categories: string[];
  locations: { id: string; name: string }[];
  initial?: {
    id: string;
    name: string;
    category: string | null;
    unit: string;
    minQuantity: number | null;
    notes: string | null;
    locationId: string | null;
  };
};

export function BulkItemForm({ mode, categories, locations, initial }: ItemFormProps) {
  const action = mode === "create" ? createBulkItemAction : updateBulkItemAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label" htmlFor="name">
            Bezeichnung
          </label>
          <input
            id="name"
            name="name"
            className="input"
            required
            placeholder="z. B. DMX-Kabel 3 m"
            defaultValue={initial?.name ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="category">
            Kategorie
          </label>
          <input
            id="category"
            name="category"
            className="input"
            list="bulk-categories"
            defaultValue={initial?.category ?? ""}
          />
          <datalist id="bulk-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="unit">
            Einheit
          </label>
          <input
            id="unit"
            name="unit"
            className="input"
            list="bulk-units"
            defaultValue={initial?.unit ?? "Stück"}
          />
          <datalist id="bulk-units">
            {BULK_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="locationId">
            Standort
          </label>
          <select
            id="locationId"
            name="locationId"
            className="input"
            defaultValue={initial?.locationId ?? ""}
          >
            <option value="">Kein Standort</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="minQuantity">
            Warnen ab Bestand
          </label>
          <input
            id="minQuantity"
            name="minQuantity"
            type="number"
            min={0}
            className="input"
            placeholder="leer = keine Warnung"
            defaultValue={initial?.minQuantity ?? ""}
          />
        </div>

        {mode === "create" && (
          <div>
            <label className="label" htmlFor="quantity">
              Anfangsbestand
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              className="input"
              defaultValue={0}
            />
            <p className="text-xs text-muted mt-1">
              Wird als Zugang gebucht — der Bestand hat damit von Anfang an eine
              Herkunft.
            </p>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="label" htmlFor="notes">
            Notizen
          </label>
          <textarea id="notes" name="notes" className="input min-h-20" defaultValue={initial?.notes ?? ""} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Wird gespeichert…" : mode === "create" ? "Anlegen" : "Speichern"}
      </button>
    </form>
  );
}

/**
 * Entnahme, Rückgabe, Zugang oder Korrektur.
 *
 * Die Vorschau des neuen Bestands steht direkt am Formular: Bei einer
 * Korrektur ist die Eingabe der Zielbestand, bei allem anderen eine
 * Veränderung — dieser Unterschied ist die naheliegendste Fehlbedienung.
 */
export function MovementForm({
  itemId,
  bestand,
  einheit,
  events,
  darfKorrigieren,
}: {
  itemId: string;
  bestand: number;
  einheit: string;
  events: { id: string; name: string }[];
  darfKorrigieren: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    recordMovementAction,
    undefined
  );
  const [reason, setReason] = useState<BulkReason>("ENTNAHME");
  const [menge, setMenge] = useState("");

  const zahl = parseInt(menge, 10);
  const pruefung = Number.isFinite(zahl) ? pruefeBewegung(reason, zahl, bestand) : null;
  const gruende = (Object.keys(BULK_REASONS) as BulkReason[]).filter(
    (r) => r !== "KORREKTUR" || darfKorrigieren
  );

  return (
    <form action={formAction} key={state?.success ? "neu" : "form"} className="flex flex-col gap-3">
      <input type="hidden" name="itemId" value={itemId} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`reason-${itemId}`}>
            Vorgang
          </label>
          <select
            id={`reason-${itemId}`}
            name="reason"
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value as BulkReason)}
          >
            {gruende.map((r) => (
              <option key={r} value={r}>
                {BULK_REASONS[r].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor={`menge-${itemId}`}>
            {reason === "KORREKTUR" ? `Tatsächlicher Bestand (${einheit})` : `Menge (${einheit})`}
          </label>
          <input
            id={`menge-${itemId}`}
            name="menge"
            type="number"
            min={0}
            step={1}
            className="input"
            required
            value={menge}
            onChange={(e) => setMenge(e.target.value)}
          />
        </div>

        {events.length > 0 && reason !== "KORREKTUR" && (
          <div>
            <label className="label" htmlFor={`event-${itemId}`}>
              Für welche Veranstaltung?
            </label>
            <select id={`event-${itemId}`} name="eventId" className="input" defaultValue="">
              <option value="">Ohne Zuordnung</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor={`note-${itemId}`}>
            Notiz
          </label>
          <input id={`note-${itemId}`} name="note" className="input" placeholder="optional" />
        </div>
      </div>

      {pruefung && (
        <p className={`text-sm ${pruefung.ok ? "text-muted" : "text-red-400"}`}>
          {pruefung.ok
            ? `Neuer Bestand: ${bestand + pruefung.delta} ${einheit}`
            : pruefung.fehler}
        </p>
      )}

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || (pruefung != null && !pruefung.ok)}
        className="btn-primary self-start"
      >
        {pending ? "Wird gebucht…" : "Buchen"}
      </button>
    </form>
  );
}

export function DeleteBulkItemForm({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteBulkItemAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `„${name}" wirklich löschen? Die gesamte Bewegungshistorie geht mit verloren.`
          )
        )
          e.preventDefault();
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
