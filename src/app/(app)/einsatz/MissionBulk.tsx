"use client";

import { useActionState, useState } from "react";
import { bookEventBulkAction, type ActionState } from "../events/actions";

export type MissionBulkRow = {
  bulkItemId: string;
  name: string;
  unit: string;
  geplant: number;
  mitgenommen: number;
  offen: number;
  /** Bestand im Lager — Obergrenze beim Mitnehmen. */
  bestand: number;
};

/**
 * Kabel und Kleinteile im laufenden Einsatz.
 *
 * Nur in den beiden Phasen sichtbar, in denen sich an der Menge etwas ändert:
 * beim Packen geht etwas mit, beim Zurückräumen kommt etwas zurück. Beim Auf-
 * und Abbau gibt es nichts zu buchen — 40 Kabel werden nicht einzeln
 * aufgebaut.
 *
 * Gescannt wird hier nichts: Mengenartikel haben keinen eigenen QR-Code. Statt
 * dessen große Schaltflächen mit vorbelegter Menge, bedienbar mit Handschuhen.
 */
export function MissionBulk({
  eventId,
  phase,
  rows,
}: {
  eventId: string;
  phase: string;
  rows: MissionBulkRow[];
}) {
  const packen = phase === "GEPACKT";
  const zurueck = phase === "ZURUECK";

  if (!packen && !zurueck) return null;
  if (rows.length === 0) return null;

  // Beim Packen alles anzeigen, was noch nicht vollständig mit ist; beim
  // Zurückräumen alles, was noch draußen ist. Erledigte Zeilen verschwinden —
  // im Dunkeln zählt, was noch zu tun ist.
  const offeneZeilen = rows.filter((row) =>
    packen ? row.geplant > row.mitgenommen : row.offen > 0
  );

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Kabel & Kleinteile</h2>
        <span className="text-sm text-muted">
          {offeneZeilen.length === 0 ? "erledigt" : `${offeneZeilen.length} offen`}
        </span>
      </div>

      {offeneZeilen.length === 0 ? (
        <p className="text-sm text-muted">
          {packen ? "Alles eingepackt." : "Alles zurück im Lager."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {offeneZeilen.map((row) => (
            <MengenZeile
              key={row.bulkItemId}
              eventId={eventId}
              row={row}
              richtung={packen ? "ENTNAHME" : "RUECKGABE"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MengenZeile({
  eventId,
  row,
  richtung,
}: {
  eventId: string;
  row: MissionBulkRow;
  richtung: "ENTNAHME" | "RUECKGABE";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    bookEventBulkAction,
    undefined
  );

  const grenze =
    richtung === "ENTNAHME" ? Math.min(row.bestand, row.geplant - row.mitgenommen) : row.offen;
  const [menge, setMenge] = useState(Math.max(1, grenze));

  function aendern(schritt: number) {
    setMenge((vorher) => Math.min(Math.max(1, vorher + schritt), Math.max(1, grenze)));
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{row.name}</span>
        <span className="text-sm text-muted">
          {richtung === "ENTNAHME"
            ? `${row.geplant - row.mitgenommen} von ${row.geplant} ${row.unit} offen`
            : `${row.offen} ${row.unit} noch draußen`}
        </span>
      </div>

      {richtung === "ENTNAHME" && row.bestand < row.geplant - row.mitgenommen && (
        <p className="text-sm text-amber-400">
          ⚠️ Nur {row.bestand} {row.unit} im Lager
        </p>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="bulkItemId" value={row.bulkItemId} />
        <input type="hidden" name="richtung" value={richtung} />
        <input type="hidden" name="menge" value={menge} />

        {/* Große Flächen: das hier wird mit Handschuhen in einer dunklen
            Halle bedient, nicht am Schreibtisch. */}
        <button
          type="button"
          onClick={() => aendern(-1)}
          className="btn-secondary size-12 shrink-0 text-xl"
          aria-label="Weniger"
        >
          −
        </button>
        <span className="min-w-14 text-center text-2xl font-bold tabular-nums">{menge}</span>
        <button
          type="button"
          onClick={() => aendern(1)}
          className="btn-secondary size-12 shrink-0 text-xl"
          aria-label="Mehr"
        >
          +
        </button>
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "…" : richtung === "ENTNAHME" ? "Mitnehmen" : "Zurück ins Lager"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </li>
  );
}
