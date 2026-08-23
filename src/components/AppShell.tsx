"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FeedbackButton } from "./FeedbackButton";

type AppShellProps = {
  user: { name: string; role: string };
  children: ReactNode;
};

const MAIN_NAV = [
  { href: "/", label: "Start" },
  { href: "/geraete", label: "Geräte" },
  { href: "/events", label: "Events" },
  { href: "/cases", label: "Cases" },
  { href: "/standorte", label: "Standorte" },
  { href: "/wartung", label: "Wartung" },
  { href: "/etiketten", label: "Etiketten" },
  { href: "/import", label: "Import" },
];

const ADMIN_NAV = [
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

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-full flex-col">
      {/* Desktop-Kopfleiste */}
      <header className="hidden md:flex items-center gap-6 border-b border-line bg-surface px-6 h-16 sticky top-0 z-20">
        <Link href="/" className="text-xl font-bold text-accent shrink-0">
          OnTrack
        </Link>
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {[...MAIN_NAV, ...(isAdmin ? ADMIN_NAV : [])].map((item) => (
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
        </nav>
        <div className="flex items-center gap-4 shrink-0">
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
      <main className="flex-1 pb-40 md:pb-20">{children}</main>

      <FeedbackButton />

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
            <Link
              href="/scan"
              aria-label="QR-Scan"
              className="flex items-center justify-center size-14 -mt-6 rounded-full bg-accent text-accent-fg shadow-lg shadow-black/40 border-4 border-surface"
            >
              <ScanIcon />
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
