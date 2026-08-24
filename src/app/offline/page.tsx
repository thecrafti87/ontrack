import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kein Netz" };

/**
 * Rückfallebene des Service Workers.
 *
 * Sie wird ohne Datenbankzugriff gerendert — sonst wäre sie genau dann nicht
 * verfügbar, wenn sie gebraucht wird.
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-sm card flex flex-col items-center gap-4 text-center">
        <span className="text-4xl" aria-hidden="true">
          ⚡
        </span>
        <h1 className="text-xl font-bold">Kein Netz</h1>
        <p className="text-muted text-sm">
          Diese Seite braucht eine Verbindung. Ein bereits geöffneter Einsatz läuft
          weiter — dort werden Scans vorgemerkt und nachgebucht, sobald wieder
          Verbindung besteht.
        </p>
        <a href="/einsatz" className="btn-primary w-full">
          Zum Einsatz
        </a>
      </div>
    </div>
  );
}
