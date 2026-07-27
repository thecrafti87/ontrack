import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  await requireRole("ADMIN");

  const settings = await prisma.setting.findMany({
    where: { key: { in: ["foundOwner", "foundContact", "appUrl"] } },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const exampleDevice = await prisma.device.findFirst({ orderBy: { createdAt: "asc" } });
  const exampleInventoryNo = exampleDevice?.inventoryNo ?? "OT-0000";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <div className="card flex flex-col gap-4">
        <h2 className="font-semibold">Fundmodus</h2>
        <p className="text-sm text-muted">
          Diese Angaben sieht jede Person, die einen QR-Code scannt, ohne dabei angemeldet zu sein.
        </p>
        <SettingsForm
          foundOwner={settingsMap.foundOwner ?? ""}
          foundContact={settingsMap.foundContact ?? ""}
          appUrl={settingsMap.appUrl ?? ""}
        />
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Zusatzfelder pro Kategorie</h2>
        <p className="text-sm text-muted">
          Lege fest, welche technischen Zusatzfelder (z. B. DMX-Adresse, Leistung, Traglast) für
          welche Gerätekategorie gelten. Pro Gerät individuell überschreibbar.
        </p>
        <Link href="/einstellungen/felder" className="btn-secondary self-start">
          Zusatzfelder konfigurieren
        </Link>
      </div>

      <div className="card flex flex-col gap-2 text-sm text-muted">
        <p>
          Vorschau der Finder-Ansicht:{" "}
          <Link
            href={`/d/${exampleInventoryNo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-mono"
          >
            /d/{exampleInventoryNo}
          </Link>
        </p>
        <p>
          In privatem Fenster öffnen, um die Finder-Ansicht zu sehen — sonst wirst du als
          angemeldete Person direkt zum Gerät weitergeleitet.
        </p>
      </div>
    </div>
  );
}
