"use client";

import { useState } from "react";
import { useActionState } from "react";
import { DEVICE_STATUS, type DeviceStatus } from "@/lib/constants";
import { FIELD_CATALOG, FIELD_GROUPS } from "@/lib/fieldCatalog";
import { createDeviceAction, updateDeviceAction, type ActionState } from "./actions";
import { MAX_SERIE, buildSeries } from "@/lib/series";

type DeviceFormProps = {
  mode: "create" | "edit";
  categories: string[];
  locations: { id: string; name: string }[];
  cases: { id: string; name: string }[];
  initial?: {
    id: string;
    inventoryNo: string;
    name: string;
    category: string | null;
    serialNo: string | null;
    purchaseDate: string | null; // yyyy-mm-dd
    purchasePrice: number | null;
    supplier: string | null;
    weightKg: number | null;
    notes: string | null;
    locationId: string | null;
    caseId: string | null;
    status: DeviceStatus;
  };
  nextInventoryNo?: string;
  /** Nur im Bearbeiten-Modus: aktueller Override-Zustand für "Angezeigte Zusatzfelder". */
  fieldsConfig?: {
    hasOverride: boolean;
    effectiveCodes: string[];
  };
};

function FieldOverrideSection({
  hasOverride,
  effectiveCodes,
}: {
  hasOverride: boolean;
  effectiveCodes: string[];
}) {
  const [mode, setMode] = useState<"standard" | "custom">(hasOverride ? "custom" : "standard");
  const [selected, setSelected] = useState<Set<string>>(new Set(effectiveCodes));

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <h3 className="font-semibold">Angezeigte Zusatzfelder</h3>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="fieldMode"
            value="standard"
            checked={mode === "standard"}
            onChange={() => setMode("standard")}
            className="size-4"
          />
          Standard der Kategorie verwenden
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="fieldMode"
            value="custom"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
            className="size-4"
          />
          Eigene Auswahl
        </label>
      </div>

      {mode === "custom" && (
        <div className="flex flex-col gap-4 mt-2">
          {FIELD_GROUPS.map((group) => {
            const fields = FIELD_CATALOG.filter((f) => f.group === group);
            return (
              <div key={group} className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-muted uppercase tracking-wide">{group}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {fields.map((field) => (
                    <label
                      key={field.code}
                      className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="fieldCodes"
                        value={field.code}
                        checked={selected.has(field.code)}
                        onChange={() => toggle(field.code)}
                        className="size-4 shrink-0"
                      />
                      <span className="text-sm">
                        {field.label}
                        {field.unit && <span className="text-muted"> ({field.unit})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DeviceForm({
  mode,
  categories,
  locations,
  cases,
  initial,
  nextInventoryNo,
  fieldsConfig,
}: DeviceFormProps) {
  const action = mode === "create" ? createDeviceAction : updateDeviceAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  const [inventarNr, setInventarNr] = useState(initial?.inventoryNo ?? nextInventoryNo ?? "");
  const [anzahl, setAnzahl] = useState(1);

  // Vorschau der entstehenden Nummern — vor dem Anlegen sichtbar, nicht danach.
  const serie = buildSeries(inventarNr, anzahl);
  const vorschau = serie.ok
    ? serie.nummern.length <= 3
      ? `Legt an: ${serie.nummern.join(", ")}`
      : `Legt ${serie.nummern.length} Geräte an: ${serie.nummern[0]} bis ${
          serie.nummern[serie.nummern.length - 1]
        }`
    : serie.fehler;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="inventoryNo">
            {mode === "create" && anzahl > 1 ? "Erste Inventarnummer" : "Inventarnummer"}
          </label>
          <input
            id="inventoryNo"
            name="inventoryNo"
            className="input font-mono"
            required
            value={inventarNr}
            onChange={(e) => setInventarNr(e.target.value)}
          />
        </div>

        {/* Serien-Anlage: acht gleiche Scheinwerfer einzeln anzulegen ist der
            Reibungspunkt, den man täglich spürt. */}
        {mode === "create" && (
          <div>
            <label className="label" htmlFor="anzahl">
              Stückzahl
            </label>
            <input
              id="anzahl"
              name="anzahl"
              type="number"
              min={1}
              max={MAX_SERIE}
              className="input"
              value={anzahl}
              onChange={(e) => setAnzahl(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <p className="text-xs text-muted mt-1">
              {anzahl > 1
                ? vorschau
                : "Mehr als 1 legt gleich mehrere Geräte mit fortlaufenden Nummern an."}
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" className="input" required defaultValue={initial?.name ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="category">
            Kategorie
          </label>
          <input
            id="category"
            name="category"
            className="input"
            list="category-list"
            defaultValue={initial?.category ?? ""}
          />
          <datalist id="category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="serialNo">
            Seriennummer
          </label>
          <input id="serialNo" name="serialNo" className="input" defaultValue={initial?.serialNo ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="purchaseDate">
            Kaufdatum
          </label>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            className="input"
            defaultValue={initial?.purchaseDate ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="purchasePrice">
            Kaufpreis (€)
          </label>
          <input
            id="purchasePrice"
            name="purchasePrice"
            type="number"
            step="0.01"
            className="input"
            defaultValue={initial?.purchasePrice ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="supplier">
            Lieferant
          </label>
          <input id="supplier" name="supplier" className="input" defaultValue={initial?.supplier ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="weightKg">
            Gewicht (kg)
          </label>
          <input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.01"
            className="input"
            defaultValue={initial?.weightKg ?? ""}
          />
        </div>

        <div>
          <label className="label" htmlFor="locationId">
            Standort
          </label>
          <select id="locationId" name="locationId" className="input" defaultValue={initial?.locationId ?? ""}>
            <option value="">Kein Standort</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="caseId">
            Case
          </label>
          <select id="caseId" name="caseId" className="input" defaultValue={initial?.caseId ?? ""}>
            <option value="">Kein Case</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" className="input" defaultValue={initial?.status ?? "EINSATZBEREIT"}>
            {Object.entries(DEVICE_STATUS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Notizen
        </label>
        <textarea id="notes" name="notes" className="input min-h-24" defaultValue={initial?.notes ?? ""} />
      </div>

      {mode === "edit" && fieldsConfig && (
        <FieldOverrideSection
          hasOverride={fieldsConfig.hasOverride}
          effectiveCodes={fieldsConfig.effectiveCodes}
        />
      )}

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full md:w-auto md:self-start">
        {pending ? "Speichert…" : mode === "create" ? "Gerät anlegen" : "Speichern"}
      </button>
    </form>
  );
}
