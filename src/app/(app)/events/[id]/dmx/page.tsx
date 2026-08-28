import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  belegungenAus,
  findeBelegung,
  findeKonflikte,
  formatAdresse,
  letzterKanal,
  parseAdresse,
  ungeprueft,
  type Belegung,
  type Konflikt,
} from "@/lib/dmx";
import { EmptyState } from "@/components/EmptyState";

/**
 * Die Seite für den Moment, in dem etwas nicht tut: „Kanal 145 im zweiten
 * Universum zuckt — was ist das und wo hängt es?"
 *
 * Bewusst server-gerendert und über die Adresszeile gesteuert (`?a=2.145`):
 * Das funktioniert auf einem Handy im Keller ohne JavaScript-Gedöns, lässt
 * sich als Link weitergeben und überlebt einen Reload.
 */

function Quelle({ belegung }: { belegung: Belegung }) {
  if (belegung.kanaele == null) {
    return <span className="text-amber-400">Kanalzahl unbekannt</span>;
  }
  const ende = letzterKanal(belegung)!;
  const bereich = `${belegung.adresse.kanal}–${ende}`;
  return (
    <span>
      {belegung.kanaele} Kanäle ({bereich})
      {belegung.kanalQuelle === "modus" && (
        <span className="text-muted"> · aus dem Modusnamen geschätzt</span>
      )}
    </span>
  );
}

function BelegungsKarte({ belegung, eventId }: { belegung: Belegung; eventId: string }) {
  return (
    <li className="rounded-xl border border-line p-3 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="font-semibold">{belegung.name}</span>
        <span className="font-mono text-sm">{formatAdresse(belegung.adresse)}</span>
      </div>
      <p className="text-sm">{belegung.ort ?? <span className="text-muted">Ort unbekannt</span>}</p>
      <p className="text-sm text-muted">
        <Quelle belegung={belegung} />
      </p>
      {belegung.geraeteId ? (
        <Link
          href={`/geraete/${belegung.geraeteId}`}
          className="text-sm text-accent underline underline-offset-2 self-start"
        >
          {belegung.inventarnummer ?? "Zum Gerät"}
        </Link>
      ) : (
        <Link
          href={`/events/${eventId}/rig`}
          className="text-sm text-muted underline underline-offset-2 self-start"
        >
          Noch keinem Gerät zugeordnet
        </Link>
      )}
    </li>
  );
}

function beteiligteZeile(belegungen: Belegung[]): string {
  return belegungen.map((b) => (b.ort ? `${b.name} (${b.ort})` : b.name)).join(" · ");
}

function KonfliktKarte({ konflikt }: { konflikt: Konflikt }) {
  const kopf =
    konflikt.art === "gleiche_adresse"
      ? `Gleiche Adresse ${konflikt.universum}.${konflikt.kanal}`
      : konflikt.art === "ueberlappung"
        ? `Überschneidung ${konflikt.universum}.${konflikt.von}–${konflikt.bis}`
        : `Läuft über das Universum hinaus (bis ${konflikt.bis})`;

  const erklaerung =
    konflikt.art === "gleiche_adresse"
      ? `${konflikt.beteiligte.length} Geräte starten auf demselben Kanal und reagieren gemeinsam.`
      : konflikt.art === "ueberlappung"
        ? "Zwei Geräte teilen sich Kanäle — das hintere reagiert auf Befehle für das vordere."
        : `Universum ${konflikt.universum} endet bei Kanal 512. Die Kanäle darüber kommen nicht an.`;

  return (
    <li className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 flex flex-col gap-1">
      <p className="font-semibold text-red-300">{kopf}</p>
      <p className="text-sm">{beteiligteZeile(konflikt.beteiligte)}</p>
      <p className="text-sm text-muted">{erklaerung}</p>
    </li>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { name: true } });
  return event ? { title: `DMX — ${event.name}` } : {};
}

export default async function DmxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  await requireUser();
  const { id: eventId } = await params;
  const { a: sucheRoh } = await searchParams;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  const fixtures = await prisma.rigFixture.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      dmxAddresses: true,
      gdtfMode: true,
      gdtfChannels: true,
      layerName: true,
      actualPosition: true,
      device: { select: { id: true, inventoryNo: true } },
    },
    orderBy: [{ layerName: "asc" }, { name: "asc" }],
  });

  const belegungen = belegungenAus(fixtures);
  const konflikte = findeKonflikte(belegungen);
  const offen = ungeprueft(belegungen);

  const suche = (sucheRoh ?? "").trim();
  const gesucht = suche ? parseAdresse(suche) : null;
  const fund = gesucht ? findeBelegung(belegungen, gesucht) : null;

  const universen = [...new Set(belegungen.map((b) => b.adresse.universum))].sort((x, y) => x - y);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">DMX — {event.name}</h1>
          <p className="text-sm text-muted">
            {belegungen.length === 0
              ? "Noch keine Adressen im Rig"
              : `${belegungen.length} Adressen in ${universen.length} ${universen.length === 1 ? "Universum" : "Universen"}`}
          </p>
        </div>
        <Link href={`/events/${eventId}/rig`} className="btn-secondary">
          Zum Rig
        </Link>
      </div>

      {belegungen.length === 0 ? (
        <EmptyState
          titel="Keine DMX-Adressen vorhanden"
          aktion={{ href: `/events/${eventId}/rig`, text: "Rig importieren" }}
        >
          Die Adressen kommen aus der MVR-Datei aus Vectorworks. Sobald ein Rig importiert ist,
          lässt sich hier nachschlagen, welches Gerät auf einer Adresse sitzt und wo es hängt — und
          ob sich zwei Geräte in die Quere kommen.
        </EmptyState>
      ) : (
        <>
          <form method="get" className="card flex flex-col gap-3">
            <label htmlFor="dmx-suche" className="label">
              Adresse suchen
            </label>
            <div className="flex gap-2 flex-wrap">
              <input
                id="dmx-suche"
                name="a"
                defaultValue={suche}
                inputMode="decimal"
                autoComplete="off"
                placeholder="z. B. 2.145"
                className="input font-mono flex-1 min-w-40"
              />
              <button type="submit" className="btn-primary">
                Suchen
              </button>
            </div>
            <p className="text-sm text-muted">
              Universum und Kanal, etwa <span className="font-mono">2.145</span>. Eine einzelne Zahl
              gilt als Kanal im ersten Universum.
            </p>
          </form>

          {suche && !gesucht && (
            <p className="card text-sm text-amber-400">
              „{suche}“ ist keine DMX-Adresse. Erwartet wird etwas wie 2.145 oder 145.
            </p>
          )}

          {gesucht && fund && (
            <div className="card flex flex-col gap-4">
              <h2 className="font-semibold">Adresse {formatAdresse(gesucht)}</h2>

              {fund.genau.length === 0 && fund.imBereich.length === 0 ? (
                <p className="text-sm text-muted">
                  Auf dieser Adresse startet kein Gerät, und kein Gerät mit bekannter Kanalzahl
                  reicht bis hierher.
                  {offen > 0 &&
                    ` Bei ${offen} Adresse${offen === 1 ? "" : "n"} ist die Kanalzahl unbekannt — dort könnte der Kanal trotzdem belegt sein.`}
                </p>
              ) : (
                <>
                  {fund.genau.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="label">Startet hier</p>
                      <ul className="flex flex-col gap-2">
                        {fund.genau.map((b) => (
                          <BelegungsKarte key={`${b.id}-genau`} belegung={b} eventId={eventId} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {fund.imBereich.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="label">Belegt diesen Kanal mit</p>
                      <ul className="flex flex-col gap-2">
                        {fund.imBereich.map((b) => (
                          <BelegungsKarte key={`${b.id}-bereich`} belegung={b} eventId={eventId} />
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-semibold">Konflikte</h2>
              <span className="text-sm text-muted">
                {konflikte.length === 0 ? "keine gefunden" : `${konflikte.length} gefunden`}
              </span>
            </div>

            {konflikte.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {konflikte.map((k, i) => (
                  <KonfliktKarte key={i} konflikt={k} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Keine doppelten Startadressen und keine Überschneidungen zwischen Geräten mit
                bekannter Kanalzahl.
              </p>
            )}

            {offen > 0 && (
              <p className="text-sm text-amber-400 border-t border-line pt-3">
                Bei {offen} von {belegungen.length} Adressen ist die Kanalzahl unbekannt. Diese
                Geräte werden nur auf gleiche Startadresse geprüft, nicht auf Überschneidung — die
                Liste oben ist deshalb möglicherweise unvollständig.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
