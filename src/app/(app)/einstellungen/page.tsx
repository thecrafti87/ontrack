import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { herkunft } from "@/lib/originKey";
import { MAX_PER_ORIGIN, MAX_REPORTS_PER_ORIGIN, WINDOW_MS } from "@/lib/rateLimit";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  await requireRole("ADMIN");

  const settings = await prisma.setting.findMany({
    where: {
      key: { in: ["foundOwner", "foundContact", "appUrl", "registrationCode", "publicReports"] },
    },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  // Was die Instanz als Herkunft sieht, entscheidet über die Bremsen: Fehlt
  // der Proxy-Header, zählen alle Besucher gemeinsam.
  const woher = await herkunft();
  const bremsFenster = Math.round(WINDOW_MS / 60000);

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
          registrationCode={settingsMap.registrationCode ?? ""}
          publicReports={settingsMap.publicReports === "an"}
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

      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Missbrauchsbremsen</h2>
        <p className="text-sm text-muted max-w-prose">
          Fehlversuche bei der Anmeldung und Meldungen ohne Konto werden je Herkunftsadresse
          gezählt: {MAX_PER_ORIGIN} Anmeldeversuche und {MAX_REPORTS_PER_ORIGIN} Meldungen je{" "}
          {bremsFenster} Minuten. Dazu muss der Server wissen, von wo eine Anfrage kommt — und das
          weiß er nur, wenn der Reverse Proxy davor es ihm sagt.
        </p>
        <p className="text-sm">
          Erkannte Herkunft dieser Anfrage: <span className="font-mono">{woher.key}</span>{" "}
          <span className="text-muted">
            ({woher.quelle === "unbekannt" ? "kein Proxy-Header" : `aus ${woher.quelle}`})
          </span>
        </p>
        {woher.quelle === "unbekannt" ? (
          <p className="text-sm text-amber-400 max-w-prose">
            Der Server sieht keine Absenderadresse. Solange OnTrack nur im eigenen Netz läuft, ist
            das unkritisch. Ist die Instanz aus dem Internet erreichbar, zählen dagegen{" "}
            <strong>alle Besucher gemeinsam</strong> — dann sperren {MAX_PER_ORIGIN} Fehlversuche
            von irgendwoher die Anmeldung für alle. Abhilfe: im vorgeschalteten Proxy{" "}
            <span className="font-mono">X-Forwarded-For</span> setzen lassen.
          </p>
        ) : (
          <p className="text-sm text-muted max-w-prose">
            Der Proxy reicht die Absenderadresse durch — die Bremsen wirken je Besucher, wie
            gedacht.
          </p>
        )}
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
