import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

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

    // Barcode-Fallback: gescannte Hersteller-Seriennummer (nicht unique → erster Treffer)
    const bySerial = await prisma.device.findFirst({ where: { serialNo: inventoryNo } });

    if (bySerial) {
      redirect(`/geraete/${bySerial.id}?scan=1`);
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-full px-4 py-12">
        <div className="w-full max-w-sm card flex flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-bold">Unbekannter Code</h1>
          <p className="text-muted text-sm">
            Zum Code <span className="font-mono">{inventoryNo}</span> wurde kein Gerät gefunden
            (weder als Inventar- noch als Seriennummer).
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Link href="/scan" className="btn-primary w-full">
              Erneut scannen
            </Link>
            <Link href="/geraete" className="btn-secondary w-full">
              Zur Geräteliste
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fall B: Fundmodus — keine Gerätedaten preisgeben, egal ob das Gerät existiert
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["foundOwner", "foundContact"] } },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const foundOwner = settingsMap.foundOwner || FALLBACK_OWNER;
  const foundContact = settingsMap.foundContact || FALLBACK_CONTACT;

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
          <Link href="/login" className="btn-primary w-full">
            Anmelden
          </Link>
        </div>
      </div>
    </div>
  );
}
