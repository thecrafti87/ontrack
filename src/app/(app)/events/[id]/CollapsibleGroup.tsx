"use client";

import { useEffect, useState } from "react";

/**
 * Aufklappbare Gruppe (details/summary) mit responsivem Initialzustand.
 * SSR liefert immer "zugeklappt" (kein Hydration-Mismatch); erst nach dem
 * Mount wird auf Desktop-Breite (>= 768px, Tailwind-`md`) bei Bedarf
 * automatisch geöffnet. Manuelles Auf-/Zuklappen bleibt über onToggle erhalten.
 */
export function CollapsibleGroup({
  defaultOpenDesktop,
  summary,
  children,
}: {
  defaultOpenDesktop: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!defaultOpenDesktop) return;
    // Entscheidung erst, wenn das Layout eine echte Breite hat (innerWidth 0 =
    // noch nicht gelayoutet, z. B. Prerender/Hintergrund-Kontext).
    let raf = 0;
    const decide = () => {
      if (window.innerWidth === 0) {
        raf = requestAnimationFrame(decide);
        return;
      }
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(true);
    };
    decide();
    return () => cancelAnimationFrame(raf);
  }, [defaultOpenDesktop]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-xl border border-line"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium bg-surface-2 rounded-xl flex items-center justify-between gap-2 flex-wrap">
        {summary}
      </summary>
      {children}
    </details>
  );
}
