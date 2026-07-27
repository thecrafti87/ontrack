"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 300;

export type FilterSelect = {
  param: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
  className?: string;
  /** Anzeigewert, wenn der Query-Parameter in der URL fehlt (Standard ""). */
  defaultValue?: string;
};

type FilterBarProps = {
  /** Query-Parameter-Name des Suchfelds (Standard "q"). */
  searchParam?: string;
  searchPlaceholder: string;
  searchClassName?: string;
  selects: FilterSelect[];
};

/**
 * Live-Filterleiste ohne "Filtern"-Button: Das Suchfeld aktualisiert die URL
 * entprellt (300ms) via router.replace, Enter löst sofort aus. Selects lösen
 * sofort bei onChange aus. Andere bestehende Query-Parameter (z. B. ein
 * Status-Filter aus separaten Badge-Links) bleiben erhalten, "page" wird bei
 * jeder Filteränderung zurückgesetzt.
 */
export function FilterBar({
  searchParam = "q",
  searchPlaceholder,
  searchClassName = "input flex-1",
  selects,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  const [query, setQuery] = useState(() => searchParams.get(searchParam) ?? "");
  const [selectValues, setSelectValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(selects.map((s) => [s.param, searchParams.get(s.param) ?? s.defaultValue ?? ""]))
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bei externer URL-Änderung (z. B. Statusfilter-Badge, Browser-Zurück) die
  // Anzeige neu synchronisieren — direkt beim Rendern statt in einem Effect
  // ("adjusting state when a prop changes", vermeidet einen zusätzlichen
  // Render-Durchlauf nach dem Mount).
  const [syncedParamsKey, setSyncedParamsKey] = useState(paramsKey);
  if (paramsKey !== syncedParamsKey) {
    setSyncedParamsKey(paramsKey);
    setQuery(searchParams.get(searchParam) ?? "");
    setSelectValues(
      Object.fromEntries(selects.map((s) => [s.param, searchParams.get(s.param) ?? s.defaultValue ?? ""]))
    );
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ [searchParam]: value || undefined });
    }, DEBOUNCE_MS);
  }

  function commitQueryNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate({ [searchParam]: query || undefined });
  }

  function handleSelectChange(param: string, value: string) {
    setSelectValues((prev) => ({ ...prev, [param]: value }));
    navigate({ [param]: value || undefined });
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitQueryNow();
          }
        }}
        placeholder={searchPlaceholder}
        className={searchClassName}
      />
      {selects.map((select) => (
        <select
          key={select.param}
          value={selectValues[select.param] ?? ""}
          aria-label={select.ariaLabel}
          onChange={(e) => handleSelectChange(select.param, e.target.value)}
          className={select.className ?? "input md:w-48"}
        >
          {select.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
