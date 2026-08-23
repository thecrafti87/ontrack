"use client";

import { useState } from "react";

/**
 * Aufklappbare Gruppe der Packliste.
 *
 * Früher blieb sie auf dem Handy grundsätzlich zugeklappt und öffnete sich
 * nur auf Desktop-Breite. Genau falsch herum: Auf dem Handy steht man vor dem
 * Fahrzeug und will die Liste sehen, nicht erst vier Gruppen aufklappen. Der
 * Anfangszustand hängt jetzt nur noch an der Länge der Liste und nicht mehr an
 * der Bildschirmbreite — dadurch kann er direkt vom Server kommen, ohne
 * Abweichung bei der Hydration.
 */
export function CollapsibleGroup({
  defaultOpen,
  summary,
  children,
}: {
  defaultOpen: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-xl border border-line"
    >
      <summary className="cursor-pointer select-none px-3 py-3 md:py-2 text-sm font-medium bg-surface-2 rounded-xl flex items-center justify-between gap-2 flex-wrap">
        {summary}
      </summary>
      {children}
    </details>
  );
}
