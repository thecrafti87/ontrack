import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Ein Leerzustand, der erklärt.
 *
 * „Keine Cases gefunden" beantwortet die Frage nicht, die jemand hat, der
 * gerade zum ersten Mal hier steht: Wofür gibt es das überhaupt, und was ist
 * der erste Schritt? Eine leere Seite ist die beste Gelegenheit, das zu sagen
 * — später schaut niemand mehr hin.
 *
 * Bewusst ohne Symbolschmuck: Der Satz trägt die Erklärung, nicht ein Bild
 * daneben.
 */
export function EmptyState({
  titel,
  children,
  aktion,
}: {
  /** Was hier stünde, wenn es etwas gäbe. */
  titel: string;
  /** Wofür es das gibt — ein bis zwei Sätze in der Sprache der Arbeit. */
  children: ReactNode;
  /** Der erste Schritt. Entfällt, wo es nichts anzulegen gibt. */
  aktion?: { href: string; text: string };
}) {
  return (
    <div className="card flex flex-col items-start gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{titel}</p>
        <p className="text-sm text-muted max-w-prose">{children}</p>
      </div>
      {aktion && (
        <Link href={aktion.href} className="btn-primary">
          {aktion.text}
        </Link>
      )}
    </div>
  );
}

/**
 * Der andere leere Fall: Es gibt Einträge, nur keinen passenden.
 *
 * Das ist kein Leerzustand, sondern ein Filterergebnis — und verlangt eine
 * andere Antwort. Wer hier „Lege dein erstes Gerät an" liest, während 300 im
 * Bestand stehen, hält die App für kaputt.
 */
export function NoMatches({
  was,
  zuruecksetzen,
}: {
  /** Plural dessen, wonach gesucht wurde: „Geräte", „Cases". */
  was: string;
  /** Link, der die Filter räumt. */
  zuruecksetzen?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <p className="text-muted">Keine {was} passen zu dieser Suche.</p>
      {zuruecksetzen && (
        <Link href={zuruecksetzen} className="text-sm text-accent underline">
          Filter zurücksetzen
        </Link>
      )}
    </div>
  );
}
