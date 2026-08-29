import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canEdit } from "@/lib/auth";
import { DEVICE_STATUS, type DeviceStatus } from "@/lib/constants";
import { codeErklaerung, leseBarcode } from "@/lib/barcode";
import { StoerungMelden } from "./StoerungMelden";

const FALLBACK_OWNER = "OnTrack Veranstaltungstechnik";
const FALLBACK_CONTACT = "Bitte beim Betreiber melden.";

export default async function FoundDevicePage({
  params,
}: {
  params: Promise<{ inventoryNo: string }>;
}) {
  const { inventoryNo: rawInventoryNo } = await params;
  const inventoryNo = decodeURIComponent(rawInventoryNo);

  const user = await getSessionUser();

  // Fall A: eingeloggt & freigeschaltet → direkt zum Gerät (oder Case)
  if (user && user.approved) {
    const device = await prisma.device.findUnique({ where: { inventoryNo } });

    if (device) {
      redirect(`/geraete/${device.id}?scan=1`);
    }

    const caseRecord = await prisma.case.findUnique({ where: { inventoryNo } });

    if (caseRecord) {
      redirect(`/cases/${caseRecord.id}`);
    }

    // Ab hier ist es kein eigenes Etikett mehr, sondern ein fremder Code.
    // Was er bedeutet, entscheidet, was sinnvoll passieren kann.
    const gelesen = leseBarcode(inventoryNo);

    // Seriennummer: meint genau ein Gerät.
    if (gelesen.seriennummer) {
      const bySerial = await prisma.device.findFirst({
        where: { serialNo: gelesen.seriennummer },
      });
      if (bySerial) redirect(`/geraete/${bySerial.id}?scan=1`);
    }

    // Produktcode: meint eine Bauart. Es kann also mehrere Treffer geben —
    // und dann ist die Frage nicht „welches Gerät ist das", sondern „welches
    // von diesen".
    const baugleiche = gelesen.produktcode
      ? await prisma.device.findMany({
          where: { gtin: gelesen.produktcode },
          select: { id: true, inventoryNo: true, name: true, status: true, category: true },
          orderBy: { inventoryNo: "asc" },
        })
      : [];

    if (baugleiche.length === 1) {
      redirect(`/geraete/${baugleiche[0]!.id}?scan=1`);
    }

    const anlegenHref = `/geraete/neu?code=${encodeURIComponent(inventoryNo)}`;
    const editable = canEdit(user);

    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto flex flex-col gap-4">
        <div className="card flex flex-col gap-3">
          <h1 className="text-xl font-bold">
            {baugleiche.length > 1 ? "Mehrere Geräte dieser Bauart" : "Noch kein Gerät zu diesem Code"}
          </h1>
          <p className="font-mono text-accent break-all">{inventoryNo}</p>
          <p className="text-sm text-muted">{codeErklaerung(gelesen)}</p>
        </div>

        {baugleiche.length > 1 && (
          <div className="card flex flex-col gap-2">
            <p className="label">{baugleiche.length} Geräte im Bestand</p>
            <p className="text-sm text-muted">
              Der Code steht auf jedem davon. Welches hast du in der Hand?
            </p>
            <ul className="flex flex-col gap-1">
              {baugleiche.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/geraete/${d.id}?scan=1`}
                    className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2.5 min-h-11 hover:bg-surface-2"
                  >
                    <span>
                      <span className="font-mono">{d.inventoryNo}</span>
                      <span className="text-muted"> · {d.name}</span>
                    </span>
                    <span className="text-sm text-muted shrink-0">
                      {DEVICE_STATUS[d.status as DeviceStatus]?.label ?? d.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted border-t border-line pt-2">
              Damit sich die Geräte künftig am Scan unterscheiden lassen, hilft nur ein eigenes
              Etikett je Gerät — der Produktcode kann das nicht leisten.
            </p>
          </div>
        )}

        <div className="card flex flex-col gap-3">
          {editable ? (
            <>
              <Link href={anlegenHref} className="btn-primary w-full text-center">
                {baugleiche.length > 1 ? "Weiteres Gerät dieser Bauart anlegen" : "Gerät anlegen"}
              </Link>
              {baugleiche.length > 0 && (
                <p className="text-sm text-muted">
                  Name, Kategorie und Gewicht werden von {baugleiche[0]!.inventoryNo} übernommen.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              Zum Anlegen fehlt dir die Berechtigung — melde den Code jemandem mit Schreibrecht.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Link href="/scan" className="btn-secondary flex-1 text-center">
              Erneut scannen
            </Link>
            <Link href="/geraete" className="btn-secondary flex-1 text-center">
              Geräteliste
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fall B: Fundmodus — keine Gerätedaten preisgeben, egal ob das Gerät existiert
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["foundOwner", "foundContact", "publicReports"] } },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const foundOwner = settingsMap.foundOwner || FALLBACK_OWNER;
  const foundContact = settingsMap.foundContact || FALLBACK_CONTACT;
  // Standardmäßig aus: Eine öffentlich erreichbare Instanz bekommt keine
  // offene Schreibmöglichkeit, ohne dass jemand sie ausdrücklich einschaltet.
  const meldenMoeglich = settingsMap.publicReports === "an";

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-accent tracking-tight">OnTrack</h1>
          <p className="mt-1 text-sm text-muted">Veranstaltungstechnik im Griff</p>
        </div>

        <div className="card w-full flex flex-col gap-4 text-center">
          <p className="text-lg font-semibold">
            Du hast ein Gerät der Veranstaltungstechnik gefunden.
          </p>
          <p className="font-mono text-accent text-xl">{inventoryNo}</p>
          <div className="text-sm text-muted flex flex-col gap-2">
            <p>Eigentum von: {foundOwner}</p>
            <p className="whitespace-pre-wrap">Bitte melde den Fund: {foundContact}</p>
          </div>
          <Link
            href="/login"
            className={meldenMoeglich ? "btn-secondary w-full" : "btn-primary w-full"}
          >
            Anmelden
          </Link>
        </div>

        {meldenMoeglich && <StoerungMelden code={inventoryNo} />}
      </div>
    </div>
  );
}
