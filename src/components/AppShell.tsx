"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FeedbackButton } from "./FeedbackButton";

type AppShellProps = {
  user: { name: string; role: string };
  /** Läuft gerade ein Einsatz? Dann führt die Bedienung dorthin statt in die Verwaltung. */
  mission: {
    phaseLabel: string;
    eventName: string;
    erledigt: number;
    gesamt: number;
  } | null;
  children: ReactNode;
};

/**
 * Das Menüband ist nach Zweck geordnet, nicht als flache Liste.
 *
 * Vorher standen zwölf gleichrangige Einträge nebeneinander und brachen bei
 * schmalen Fenstern in zwei Reihen um. Alles war sichtbar, aber nichts war
 * gewichtet: Der tägliche Einsatz stand gleichberechtigt neben dem
 * Etikettendruck. Jetzt sind vier Ziele dauerhaft sichtbar, der Rest liegt
 * in zwei benannten Gruppen.
 */
type NavItem = { href: string; label: string };

/** Was man täglich braucht — bleibt immer sichtbar. */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Start" },
  { href: "/einsatz", label: "Einsatz" },
  { href: "/geraete", label: "Geräte" },
  { href: "/events", label: "Events" },
  { href: "/kalender", label: "Kalender" },
];

/** Alles rund um den Bestand — regelmäßig, aber nicht ständig. */
const BESTAND_NAV: NavItem[] = [
  { href: "/mengenartikel", label: "Mengenartikel" },
  { href: "/karte", label: "Karte" },
  { href: "/verleih", label: "Verleih" },
  { href: "/cases", label: "Cases" },
  { href: "/standorte", label: "Standorte" },
  { href: "/wartung", label: "Wartung" },
  { href: "/etiketten", label: "Etiketten" },
  { href: "/import", label: "Import" },
];

/** Nur für Admins, und dort selten. */
const VERWALTUNG_NAV: NavItem[] = [
  { href: "/benutzer", label: "Benutzer" },
  { href: "/einstellungen", label: "Einstellungen" },
  { href: "/feedback", label: "Feedback" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function EventIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-7">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M4 12h16" />
    </svg>
  );
}

function LogoutForm({ className }: { className?: string }) {
  return (
    <form method="post" action="/logout" className={className}>
      <button type="submit" className="btn-secondary">
        Abmelden
      </button>
    </form>
  );
}

/**
 * Eine benannte Menügruppe. Nutzt kein <details>: Das schließt sich nicht,
 * wenn man daneben klickt, und genau das erwartet man von einem Menü.
 */
function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  const [offen, setOffen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const enthaeltAktives = items.some((i) => isActive(pathname, i.href));

  useEffect(() => {
    if (!offen) return;
    const beiKlick = (e: MouseEvent) => {
      if (!container.current?.contains(e.target as Node)) setOffen(false);
    };
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  // Beim Seitenwechsel schließen — sonst bleibt das Menü nach dem Klick offen.
  // Während des Renderns statt in einem Effect: das ist die von React
  // vorgesehene Form und spart einen Durchlauf mit noch offenem Menü.
  const [letzterPfad, setLetzterPfad] = useState(pathname);
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname);
    if (offen) setOffen(false);
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          enthaeltAktives || offen
            ? "text-accent bg-surface-2"
            : "text-muted hover:text-foreground hover:bg-surface-2"
        }`}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`transition-transform ${offen ? "rotate-180" : ""}`}
        >
          <path d="M1 3.5 5 7.5 9 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {offen && (
        <div className="absolute left-0 top-full mt-1 min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/50 z-30">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "text-accent bg-surface-2"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ user, mission, children }: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-full flex-col">
      {/* Desktop-Kopfleiste: vier ständige Ziele, der Rest in zwei Gruppen.
          Dadurch passt die Leiste wieder in eine Zeile und gewichtet, was
          täglich gebraucht wird. */}
      {/* min-h statt fester Höhe: Ab etwa 900 px passt alles in eine Zeile.
          Darunter bricht die Leiste um, statt Einträge abzuschneiden — mit
          sechs Elementen bleibt die zweite Zeile kurz. */}
      <header className="hidden md:flex items-center gap-x-6 gap-y-2 flex-wrap border-b border-line bg-surface px-6 min-h-16 py-2.5 sticky top-0 z-20">
        <Link href="/" className="text-xl font-bold text-accent shrink-0">
          OnTrack
        </Link>
        <nav className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive(pathname, item.href)
                  ? "text-accent bg-surface-2"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <span className="mx-2 h-5 w-px bg-line shrink-0" aria-hidden="true" />

          <NavGroup label="Bestand" items={BESTAND_NAV} pathname={pathname} />
          {isAdmin && (
            <NavGroup label="Verwaltung" items={VERWALTUNG_NAV} pathname={pathname} />
          )}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <FeedbackButton variant="icon" />
          <Link
            href="/konto"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {user.name}
          </Link>
          <LogoutForm />
        </div>
      </header>

      {/* Mobile-Kopfleiste */}
      <header className="flex md:hidden items-center justify-between border-b border-line bg-surface px-4 h-14 sticky top-0 z-20">
        <span className="text-lg font-bold text-accent">OnTrack</span>
        <span className="text-sm text-muted truncate max-w-[45%]">{user.name}</span>
      </header>

      {/* Zusätzlicher Freiraum unten: Platz für Bottom-Nav + darüber schwebenden
          Feedback-FAB (mobil bottom-24, size-14) bzw. den Desktop-FAB
          (bottom-6, size-14), damit beide keinen Seiteninhalt verdecken. */}
      {/* Dauerhafter Hinweis auf den laufenden Einsatz — er soll nie in
          Vergessenheit geraten, während man in der Verwaltung unterwegs ist. */}
      {mission && !isActive(pathname, "/einsatz") && (
        <Link
          href="/einsatz"
          className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/15 transition-colors"
        >
          <span className="truncate">
            <span className="font-semibold">{mission.phaseLabel}</span> · {mission.eventName}
          </span>
          <span className="shrink-0 tabular-nums font-semibold">
            {mission.erledigt}/{mission.gesamt}
          </span>
        </Link>
      )}

      <main className="flex-1 pb-40 md:pb-20">{children}</main>


      {/* Mobile Bottom-Nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 min-h-16">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive(pathname, "/") ? "text-accent" : "text-muted"
            }`}
          >
            <HomeIcon />
            Start
          </Link>
          <Link
            href="/geraete"
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive(pathname, "/geraete") ? "text-accent" : "text-muted"
            }`}
          >
            <DeviceIcon />
            Geräte
          </Link>
          <div className="flex items-center justify-center">
            {/* Läuft ein Einsatz, führt der große Knopf dorthin — dann ist der
                Scan ein Arbeitsschritt und kein Nachschlagen. */}
            <Link
              href={mission ? "/einsatz" : "/scan"}
              aria-label={mission ? `Einsatz: ${mission.phaseLabel}` : "QR-Scan"}
              className={`relative flex items-center justify-center size-14 -mt-6 rounded-full shadow-lg shadow-black/40 border-4 border-surface ${
                mission ? "bg-emerald-500 text-black" : "bg-accent text-accent-fg"
              }`}
            >
              <ScanIcon />
              {mission && (
                <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-surface border border-emerald-500/60 text-[10px] font-bold text-emerald-300 flex items-center justify-center tabular-nums">
                  {mission.gesamt - mission.erledigt}
                </span>
              )}
            </Link>
          </div>
          <Link
            href="/events"
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive(pathname, "/events") ? "text-accent" : "text-muted"
            }`}
          >
            <EventIcon />
            Events
          </Link>
          <Link
            href="/mehr"
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              isActive(pathname, "/mehr") ? "text-accent" : "text-muted"
            }`}
          >
            <MoreIcon />
            Mehr
          </Link>
        </div>
      </nav>
    </div>
  );
}
