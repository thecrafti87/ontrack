import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

function NavRow({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 min-h-16 hover:bg-surface-2 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
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

      <NavRow href="/cases" icon="📦" label="Cases" />
      <NavRow href="/standorte" icon="📍" label="Standorte" />
      <NavRow href="/wartung" icon="🛠️" label="Wartung" />
      <NavRow href="/etiketten" icon="🏷️" label="Etiketten" />
      <NavRow href="/import" icon="📥" label="Import" />

      {isAdmin && (
        <>
          <div className="mt-2 mb-1 text-sm font-semibold text-muted uppercase tracking-wide">
            Administration
          </div>
          <NavRow href="/benutzer" icon="👤" label="Benutzer" />
          <NavRow href="/einstellungen" icon="⚙️" label="Einstellungen" />
          <NavRow href="/feedback" icon="💬" label="Feedback" />
        </>
      )}

      <form method="post" action="/logout" className="mt-4">
        <button type="submit" className="btn-danger w-full">
          Abmelden
        </button>
      </form>
    </div>
  );
}
