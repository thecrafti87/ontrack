import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FeedbackButton } from "@/components/FeedbackButton";
import {
  BoxIcon,
  CalendarIcon,
  MapPinIcon,
  WrenchIcon,
  TagIcon,
  DownloadIcon,
  PersonIcon,
  GearIcon,
  SpeechBubbleIcon,
} from "./icons";

export const metadata: Metadata = { title: "Mehr" };

function NavRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 min-h-16 hover:bg-surface-2 transition-colors"
    >
      <span className="text-muted">{icon}</span>
      <span className="font-medium text-lg">{label}</span>
    </Link>
  );
}

export default async function MehrPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.approved) redirect("/warten");

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="p-4 md:hidden flex flex-col gap-3 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-1">Mehr</h1>

      {/* Dieselbe Ordnung wie im Menüband am Desktop: Bestand, dann
          Verwaltung, dann das eigene Konto. */}
      <NavRow href="/kalender" icon={<CalendarIcon />} label="Kalender" />

      <div className="mt-4 mb-1 text-sm font-semibold text-muted uppercase tracking-wide">
        Bestand
      </div>
      <NavRow href="/cases" icon={<BoxIcon />} label="Cases" />
      <NavRow href="/standorte" icon={<MapPinIcon />} label="Standorte" />
      <NavRow href="/wartung" icon={<WrenchIcon />} label="Wartung" />
      <NavRow href="/etiketten" icon={<TagIcon />} label="Etiketten" />
      <NavRow href="/import" icon={<DownloadIcon />} label="Import" />

      {isAdmin && (
        <>
          <div className="mt-4 mb-1 text-sm font-semibold text-muted uppercase tracking-wide">
            Verwaltung
          </div>
          <NavRow href="/benutzer" icon={<PersonIcon />} label="Benutzer" />
          <NavRow href="/einstellungen" icon={<GearIcon />} label="Einstellungen" />
          <NavRow href="/feedback" icon={<SpeechBubbleIcon />} label="Feedback" />
        </>
      )}

      <div className="mt-4 mb-1 text-sm font-semibold text-muted uppercase tracking-wide">
        Konto
      </div>
      <NavRow href="/konto" icon={<PersonIcon />} label="Mein Konto" />
      <FeedbackButton variant="row" />

      <form method="post" action="/logout" className="mt-4">
        <button type="submit" className="btn-danger w-full">
          Abmelden
        </button>
      </form>
    </div>
  );
}
