"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 300;

export type FilterSelect = {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  /** Anzeigewert, wenn der Query-Parameter in der URL fehlt (Standard ""). */
  defaultValue?: string;
};

type FilterBarProps = {
  /** Query-Parameter-Name des Suchfelds (Standard "q"). */
  searchParam?: string;
  searchPlaceholder: string;
  selects: FilterSelect[];
  /** Serverseitig gerenderte Zusätze im Klappfach, z. B. Status-Chips. */
  panelExtra?: ReactNode;
  /**
   * Gesetzte Filter als abwählbare Marken. Werden auch bei geschlossenem
   * Fach angezeigt — sonst filtert man unbemerkt und wundert sich über
   * fehlende Geräte.
   */
  activeFilters?: { label: string; href: string }[];
};

/**
 * Suchfeld sichtbar, alles Weitere hinter einem Knopf.
 *
 * Vorher standen vier Bedienelemente übereinander — Suche, Kategorie,
 * Sortierung, Status-Chips — bevor ein einziges Gerät erschien. Auf dem Handy
 * war die Chip-Reihe abgeschnitten. Gesucht wird häufig, gefiltert selten;
 * entsprechend ist jetzt nur die Suche ständig sichtbar.
 */
export function FilterBar({
  searchParam = "q",
  searchPlaceholder,
  selects,
  panelExtra,
  activeFilters = [],
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  const [query, setQuery] = useState(() => searchParams.get(searchParam) ?? "");
  const [selectValues, setSelectValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(selects.map((s) => [s.param, searchParams.get(s.param) ?? s.defaultValue ?? ""]))
  );
  const [offen, setOffen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bei externer URL-Änderung (Marke abgewählt, Browser-Zurück) die Anzeige
  // neu abgleichen — direkt beim Rendern statt in einem Effect.
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

  const anzahl = activeFilters.length;

  return (
    /*
      Am Handy bleibt die Suche oben stehen. Die Geräteliste ist mehrere
      tausend Pixel lang; wer nach dem Scrollen etwas anderes sucht, müsste
      sonst erst wieder ganz nach oben. Der eigene Hintergrund verhindert,
      dass durchscrollende Zeilen darunter durchscheinen.
    */
    <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-background px-4 py-2 md:static md:mx-0 md:px-0 md:py-0">
      <div className="flex gap-3">
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
          className="input flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={() => setOffen((v) => !v)}
          aria-expanded={offen}
          className={`btn-secondary shrink-0 flex items-center gap-2 ${
            anzahl > 0 ? "border-accent/40 text-accent" : ""
          }`}
        >
          Filter
          {anzahl > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-accent text-accent-fg text-xs font-bold tabular-nums">
              {anzahl}
            </span>
          )}
        </button>
      </div>

      {/* Gesetzte Filter bleiben sichtbar, auch wenn das Fach zu ist. */}
      {anzahl > 0 && !offen && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((f) => (
            <a
              key={f.label}
              href={f.href}
              className="badge bg-accent/15 text-accent border-accent/30 inline-flex items-center gap-1.5"
            >
              {f.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Filter entfernen</span>
            </a>
          ))}
        </div>
      )}

      {offen && (
        <div className="card flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selects.map((select) => (
              <div key={select.param}>
                <label className="label" htmlFor={`filter-${select.param}`}>
                  {select.label}
                </label>
                <select
                  id={`filter-${select.param}`}
                  value={selectValues[select.param] ?? ""}
                  onChange={(e) => handleSelectChange(select.param, e.target.value)}
                  className="input w-full"
                >
                  {select.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {panelExtra}

          <button
            type="button"
            onClick={() => setOffen(false)}
            className="btn-secondary self-start"
          >
            Fertig
          </button>
        </div>
      )}
    </div>
  );
}
