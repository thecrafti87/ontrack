"use client";

import { useMemo, useState } from "react";

type Item = { id: string; name: string; inventoryNo: string };

function SelectableGroup({
  title,
  items,
  selected,
  onToggle,
  onSetAll,
}: {
  title: string;
  items: Item[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetAll: (ids: string[], value: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.inventoryNo.toLowerCase().includes(q)
    );
  }, [query, items]);

  const filteredIds = filtered.map((i) => i.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectedInGroup = items.filter((i) => selected.has(i.id)).length;

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          className="btn-secondary"
          disabled={filteredIds.length === 0}
          onClick={() => onSetAll(filteredIds, !allFilteredSelected)}
        >
          {allFilteredSelected ? "Alle gefilterten abwählen" : "Alle gefilterten auswählen"}
        </button>
      </div>

      <input
        type="search"
        className="input"
        placeholder="Suche nach Name oder Inventarnummer…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <p className="text-xs text-muted">
        {selectedInGroup} von {items.length} ausgewählt
      </p>

      <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto rounded-xl border border-line p-1.5">
        {filtered.length === 0 && <p className="text-sm text-muted p-2">Keine Treffer.</p>}
        {filtered.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 min-h-11 hover:bg-surface-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => onToggle(item.id)}
              className="size-5 shrink-0"
            />
            <span className="flex-1 min-w-0 truncate text-sm">
              {item.name} <span className="font-mono text-muted">{item.inventoryNo}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function EtikettenPicker({ devices, cases }: { devices: Item[]; cases: Item[] }) {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());

  function toggleDevice(id: string) {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCase(id: string) {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllDevices(ids: string[], value: boolean) {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function setAllCases(ids: string[], value: boolean) {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const totalSelected = selectedDevices.size + selectedCases.size;

  function buildUrl(layout: "a4" | "single"): string {
    const parts = [
      ...Array.from(selectedDevices, (id) => `d:${id}`),
      ...Array.from(selectedCases, (id) => `c:${id}`),
    ];
    return `/api/etiketten?ids=${encodeURIComponent(parts.join(","))}&layout=${layout}`;
  }

  function openLayout(layout: "a4" | "single") {
    if (totalSelected === 0) return;
    window.open(buildUrl(layout), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-6">
      <SelectableGroup
        title="Geräte"
        items={devices}
        selected={selectedDevices}
        onToggle={toggleDevice}
        onSetAll={setAllDevices}
      />

      <SelectableGroup
        title="Cases"
        items={cases}
        selected={selectedCases}
        onToggle={toggleCase}
        onSetAll={setAllCases}
      />

      <div className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          disabled={totalSelected === 0}
          onClick={() => openLayout("a4")}
          className="btn-primary flex-1"
        >
          A4-Bogen (24 Etiketten)
        </button>
        <button
          type="button"
          disabled={totalSelected === 0}
          onClick={() => openLayout("single")}
          className="btn-secondary flex-1"
        >
          Einzeletiketten
        </button>
      </div>

      <p className="text-sm text-muted">{totalSelected} ausgewählt</p>
    </div>
  );
}
