"use client";

import { useMemo, useState } from "react";

/**
 * Auswahl der zu druckenden Plaketten.
 *
 * Vorausgewählt ist nichts: Ein Bogen mit 24 Plaketten, von denen 20 ungewollt
 * sind, kostet echtes Material. Stattdessen zwei schnelle Wege zur Auswahl —
 * Suche und „alle gefilterten".
 */

type Plan = {
  id: string;
  inventoryNo: string;
  deviceName: string;
  titel: string;
  geprueft: string;
  faellig: string;
  abgelaufen: boolean;
};

export function PlakettenPicker({ plaene }: { plaene: Plan[] }) {
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [suche, setSuche] = useState("");
  const [layout, setLayout] = useState<"a4" | "single">("a4");

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return plaene;
    return plaene.filter(
      (p) =>
        p.deviceName.toLowerCase().includes(q) ||
        p.inventoryNo.toLowerCase().includes(q) ||
        p.titel.toLowerCase().includes(q)
    );
  }, [suche, plaene]);

  const alleGefiltertGewaehlt =
    gefiltert.length > 0 && gefiltert.every((p) => gewaehlt.has(p.id));

  function umschalten(id: string) {
    setGewaehlt((vorher) => {
      const naechste = new Set(vorher);
      if (naechste.has(id)) naechste.delete(id);
      else naechste.add(id);
      return naechste;
    });
  }

  function alleSetzen(ids: string[], wert: boolean) {
    setGewaehlt((vorher) => {
      const naechste = new Set(vorher);
      for (const id of ids) {
        if (wert) naechste.add(id);
        else naechste.delete(id);
      }
      return naechste;
    });
  }

  const auswahlIds = plaene.filter((p) => gewaehlt.has(p.id)).map((p) => p.id);
  const href = `/api/plaketten?plaene=${auswahlIds.join(",")}&layout=${layout}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">Prüfungen ({plaene.length})</h2>
          <button
            type="button"
            className="btn-secondary"
            disabled={gefiltert.length === 0}
            onClick={() => alleSetzen(gefiltert.map((p) => p.id), !alleGefiltertGewaehlt)}
          >
            {alleGefiltertGewaehlt ? "Alle gefilterten abwählen" : "Alle gefilterten auswählen"}
          </button>
        </div>

        <input
          type="search"
          className="input"
          placeholder="Suche nach Gerät, Inventarnummer oder Prüfung…"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />

        <p className="text-xs text-muted">
          {auswahlIds.length} von {plaene.length} ausgewählt
        </p>

        <div className="flex flex-col gap-0.5 max-h-96 overflow-y-auto rounded-xl border border-line p-1.5">
          {gefiltert.length === 0 && <p className="text-sm text-muted p-2">Keine Treffer.</p>}
          {gefiltert.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 min-h-11 hover:bg-surface-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={gewaehlt.has(p.id)}
                onChange={() => umschalten(p.id)}
                className="size-5 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{p.deviceName}</span>
                <span className="text-sm text-muted"> · </span>
                <span className="text-sm font-mono">{p.inventoryNo}</span>
                <span className="block text-xs text-muted">{p.titel}</span>
              </span>
              <span className={`text-xs shrink-0 ${p.abgelaufen ? "text-amber-400" : "text-muted"}`}>
                fällig {p.faellig}
                {p.abgelaufen && " · abgelaufen"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="card flex flex-col gap-3">
        <p className="label">Format</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className={layout === "a4" ? "btn-primary" : "btn-secondary"}
            onClick={() => setLayout("a4")}
          >
            A4-Bogen (3 × 8)
          </button>
          <button
            type="button"
            className={layout === "single" ? "btn-primary" : "btn-secondary"}
            onClick={() => setLayout("single")}
          >
            Einzeletiketten (62 × 29 mm)
          </button>
        </div>

        {auswahlIds.length === 0 ? (
          <p className="text-sm text-muted">Zuerst auswählen, was gedruckt werden soll.</p>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary self-start">
            {auswahlIds.length} {auswahlIds.length === 1 ? "Plakette" : "Plaketten"} als PDF öffnen
          </a>
        )}
      </div>
    </div>
  );
}
