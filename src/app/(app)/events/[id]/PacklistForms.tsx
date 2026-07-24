"use client";

import { useActionState } from "react";
import {
  removeEventItemAction,
  updateItemPositionTextAction,
  bulkMarkPackedAction,
  bulkMarkReturnedAction,
  deleteEventAction,
  type ActionState,
} from "../actions";

export function ItemPositionForm({
  itemId,
  initialPosition,
}: {
  itemId: string;
  initialPosition: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateItemPositionTextAction,
    undefined
  );

  return (
    <form action={formAction} className="flex gap-2 items-center">
      <input type="hidden" name="itemId" value={itemId} />
      <input
        type="text"
        name="position"
        defaultValue={initialPosition}
        placeholder="z. B. Bühne links"
        className="input w-32 md:w-40 md:min-h-9 md:py-1 md:text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary shrink-0 md:min-h-9 md:px-3 md:py-1 md:text-xs"
      >
        {pending ? "…" : "Speichern"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function RemoveItemForm({
  itemId,
  deviceName,
  compact = false,
}: {
  itemId: string;
  deviceName: string;
  /** Kompakte Variante: kleines ✕ statt breitem Button (gruppierte Packliste). */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    removeEventItemAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`"${deviceName}" wirklich aus der Packliste entfernen?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      {compact ? (
        <button
          type="submit"
          disabled={pending}
          aria-label="Aus Packliste entfernen"
          className="shrink-0 size-11 md:size-9 flex items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-surface-2 transition-colors disabled:opacity-40"
        >
          {pending ? "…" : "✕"}
        </button>
      ) : (
        <button type="submit" disabled={pending} className="btn-danger">
          {pending ? "…" : "Entfernen"}
        </button>
      )}
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function BulkMarkPackedForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    bulkMarkPackedAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Alle noch geplanten Geräte als gepackt markieren?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "…" : "Alle als gepackt markieren"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function BulkMarkReturnedForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    bulkMarkReturnedAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Wirklich ALLE Geräte als zurück im Lager markieren?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "…" : "Alle als zurück markieren"}
      </button>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}

export function DeleteEventForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteEventAction,
    undefined
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Veranstaltung "${eventName}" wirklich unwiderruflich löschen?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={eventId} />
      {state?.error && <p className="text-sm text-red-400 mb-2">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-danger w-full md:w-auto">
        {pending ? "Wird gelöscht…" : "Veranstaltung löschen"}
      </button>
    </form>
  );
}
