import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/constants";
import { KarteClient, type Kartenpunkt } from "./KarteClient";

export const metadata: Metadata = { title: "Karte" };

/**
 * „Zuletzt gesehen" auf der Karte.
 *
 * Im Konzept seit V1 zugesagt, umgesetzt war bisher nur ein Verweis auf einen
 * fremden Kartendienst. Gezeigt werden die letzten Scan-Positionen der Geräte
 * und die Standorte, für die Koordinaten gepflegt sind.
 */
export default async function KartePage() {
  await requireUser();

  const [geraete, standorte] = await Promise.all([
    prisma.device.findMany({
      where: { lastLat: { not: null }, lastLng: { not: null } },
      select: {
        id: true,
        name: true,
        inventoryNo: true,
        lastLat: true,
        lastLng: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.location.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, description: true, lat: true, lng: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const punkte: Kartenpunkt[] = [
    ...geraete.map((d) => ({
      id: `d-${d.id}`,
      art: "geraet" as const,
      name: d.name,
      untertitel: `${d.inventoryNo} · zuletzt gesehen ${formatDateTime(d.lastSeenAt)}`,
      href: `/geraete/${d.id}`,
      lat: d.lastLat!,
      lng: d.lastLng!,
    })),
    ...standorte.map((l) => ({
      id: `l-${l.id}`,
      art: "standort" as const,
      name: l.name,
      untertitel: l.description ?? "Standort",
      href: `/standorte`,
      lat: l.lat!,
      lng: l.lng!,
    })),
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Karte</h1>
        <p className="text-muted mt-1">
          {punkte.length === 0
            ? "Noch nichts zu zeigen."
            : `${geraete.length} ${geraete.length === 1 ? "Gerät" : "Geräte"} mit letzter Position · ${standorte.length} ${standorte.length === 1 ? "Standort" : "Standorte"} mit Koordinaten`}
        </p>
      </div>

      {punkte.length === 0 ? (
        <div className="card flex flex-col gap-3 items-start">
          <p className="text-muted">
            Positionen entstehen beim Scannen: Wird ein Gerät über HTTPS gescannt und
            der Standortzugriff erlaubt, merkt sich OnTrack, wo das war. Zusätzlich
            lassen sich bei Standorten Koordinaten hinterlegen.
          </p>
          <p className="text-sm text-amber-400">
            Ohne HTTPS liefert der Browser keinen Standort — im Desktop-Betrieb und
            über die Netzwerkfreigabe bleibt diese Karte deshalb leer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/standorte" className="btn-secondary">
              Zu den Standorten
            </Link>
            <Link href="/scan" className="btn-primary">
              Zum Scan
            </Link>
          </div>
        </div>
      ) : (
        <>
          <KarteClient punkte={punkte} />
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-full bg-amber-500" aria-hidden="true" />
              Gerät (zuletzt gesehen)
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-full bg-sky-400" aria-hidden="true" />
              Standort
            </span>
          </div>
          <p className="text-xs text-muted">
            Kartendaten © OpenStreetMap-Mitwirkende. Die Kacheln werden von
            openstreetmap.org geladen und brauchen eine Verbindung.
          </p>
        </>
      )}
    </div>
  );
}
