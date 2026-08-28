import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDateTime } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { MeldungAktionen } from "./MeldungForms";

export const metadata: Metadata = { title: "Meldungen von außen" };

/**
 * Der Posteingang für Störungsmeldungen ohne Anmeldung.
 *
 * Jede Meldung ist eine Vorstufe, keine Fehlermeldung — und deshalb steht hier
 * immer eine Entscheidung an: übernehmen oder verwerfen. Ein Eingang, in dem
 * Dinge einfach liegen bleiben, wird nach zwei Wochen nicht mehr gelesen.
 */
export default async function MeldungenPage() {
  const user = await requireUser();
  const editable = canEdit(user);

  const [eingeschaltet, meldungen] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "publicReports" } }),
    prisma.externalReport.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        device: { select: { id: true, name: true, inventoryNo: true } },
        handledBy: { select: { name: true } },
      },
    }),
  ]);

  const neu = meldungen.filter((m) => m.status === "NEU");
  const erledigt = meldungen.filter((m) => m.status !== "NEU");

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Meldungen von außen</h1>
          <p className="text-sm text-muted">
            {neu.length === 0 ? "nichts Offenes" : `${neu.length} offen`}
          </p>
        </div>
        {user.role === "ADMIN" && (
          <Link href="/einstellungen" className="btn-secondary">
            Einstellungen
          </Link>
        )}
      </div>

      {eingeschaltet?.value !== "an" && (
        <p className="card text-sm text-muted">
          Meldungen ohne Anmeldung sind derzeit ausgeschaltet. Es kommen also keine neuen dazu —
          eingeschaltet wird das in den Einstellungen.
        </p>
      )}

      {neu.length === 0 ? (
        <EmptyState titel="Keine offenen Meldungen">
          Hier landet, was jemand ohne Konto per QR-Scan an einem Gerät meldet — typischerweise
          Hauspersonal in einer Festinstallation. Eine solche Meldung sperrt kein Gerät; erst wenn
          jemand aus dem Team sie übernimmt, wird daraus eine Fehlermeldung.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {neu.map((m) => (
            <div key={m.id} className="card flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="font-semibold">
                  {m.device ? (
                    <Link href={`/geraete/${m.device.id}`} className="hover:text-accent">
                      {m.device.name}{" "}
                      <span className="font-mono text-sm text-muted">{m.device.inventoryNo}</span>
                    </Link>
                  ) : (
                    <span className="text-amber-400">
                      Kein Gerät zu <span className="font-mono">{m.code}</span>
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted">{formatDateTime(m.createdAt)}</span>
              </div>

              <p className="whitespace-pre-wrap">{m.description}</p>

              {m.contact && (
                <p className="text-sm text-muted">Rückfragen an: {m.contact}</p>
              )}

              {!m.device && (
                <p className="text-sm text-muted">
                  Die gescannte Nummer steht nicht im Bestand — vermutlich ein Zahlendreher oder ein
                  fremdes Etikett. Ohne Gerät lässt sich keine Fehlermeldung anlegen.
                </p>
              )}

              {editable && <MeldungAktionen id={m.id} zuordenbar={!!m.device} />}
            </div>
          ))}
        </div>
      )}

      {erledigt.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="font-semibold text-muted cursor-pointer select-none">
            Bearbeitet ({erledigt.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {erledigt.map((m) => (
              <li key={m.id} className="rounded-xl border border-line p-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 flex-wrap text-sm">
                  <span>
                    {m.device ? `${m.device.name} · ${m.device.inventoryNo}` : m.code}
                  </span>
                  <span className={m.status === "UEBERNOMMEN" ? "text-emerald-400" : "text-muted"}>
                    {m.status === "UEBERNOMMEN" ? "übernommen" : "verworfen"}
                    {m.handledBy && ` von ${m.handledBy.name}`}
                    {m.handledAt && ` · ${formatDateTime(m.handledAt)}`}
                  </span>
                </div>
                <p className="text-sm text-muted whitespace-pre-wrap">{m.description}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
