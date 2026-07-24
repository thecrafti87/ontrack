"use client";

import { useActionState, useState } from "react";
import { FIELD_CATALOG, FIELD_GROUPS } from "@/lib/fieldCatalog";
import { saveCategoryFieldsAction, type ActionState } from "./actions";

export function FieldConfigForm({
  category,
  selectedCodes,
}: {
  category: string;
  selectedCodes: string[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveCategoryFieldsAction,
    undefined
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedCodes));

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="category" value={category} />

      {FIELD_GROUPS.map((group) => {
        const fields = FIELD_CATALOG.filter((f) => f.group === group);
        return (
          <div key={group} className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm text-muted uppercase tracking-wide">{group}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {fields.map((field) => (
                <label
                  key={field.code}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="fieldCodes"
                    value={field.code}
                    checked={selected.has(field.code)}
                    onChange={() => toggle(field.code)}
                    className="size-5 shrink-0"
                  />
                  <span>
                    {field.label}
                    {field.unit && <span className="text-muted"> ({field.unit})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-400">{state.success}</p>}

      <button type="submit" disabled={pending} className="btn-primary md:self-start">
        {pending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
