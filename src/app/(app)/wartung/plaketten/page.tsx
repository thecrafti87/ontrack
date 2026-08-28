import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { teilePlaketten, ABLEHNUNG_TEXT, monatJahr } from "@/lib/pruefplakette";
import { PlakettenPicker } from "./PlakettenPicker";

export const metadata: Metadata = { title: "Prüfplaketten drucken" };

/**
 * Plaketten drucken — der Schritt nach der Prüfung.
 *
 * Die Ablehnungen stehen hier auf derselben Seite und nicht in einer Fußnote:
 * Wer 40 Geräte prüfen ließ und 38 Plaketten bekommt, muss die zwei fehlenden
 * hier sehen, nicht später an einem Gerät ohne Aufkleber.
 */
export default async function PlakettenPage() {
  await requireUser();

  const plans = await prisma.maintenancePlan.findMany({
    include: {
      device: { select: { name: true, inventoryNo: true } },
      records: {
        orderBy: { performedAt: "desc" },
        take: 1,
        select: { result: true, testerName: true },
      },
    },
    orderBy: [{ device: { name: "asc" } }],
  });

  const eingaben = plans.map((plan) => ({
    id: plan.id,
    inventoryNo: plan.device.inventoryNo,
    deviceName: plan.device.name,
    titel: plan.title,
    intervalMonths: plan.intervalMonths,
    lastDoneAt: plan.lastDoneAt,
    letztesErgebnis: plan.records[0]?.result ?? null,
    pruefer: plan.records[0]?.testerName ?? null,
  }));

  const { druckbar, abgelehnt } = teilePlaketten(eingaben);

  const jetzt = new Date();
  const auswahl = druckbar.map((p) => ({
    id: p.id,
    inventoryNo: p.inventoryNo,
    deviceName: p.deviceName,
    titel: p.titel,
    geprueft: monatJahr(p.geprueftAm),
    faellig: monatJahr(p.naechsteFaellig),
    // Abgelaufen heißt nicht „darf nicht gedruckt werden" — die letzte Prüfung
    // war bestanden. Es heißt nur: Diese Plakette ist schon jetzt überholt.
    abgelaufen: p.naechsteFaellig < jetzt,
  }));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Prüfplaketten drucken</h1>
        <Link href="/wartung" className="btn-secondary">
          Zur Wartung
        </Link>
      </div>

      <p className="text-sm text-muted max-w-prose">
        Eine Plakette bescheinigt, dass ein Gerät geprüft wurde und bis wann die nächste Prüfung
        fällig ist. Gedruckt wird auf denselben Etikettenbögen wie die Inventaretiketten.
      </p>

      {auswahl.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p className="font-semibold">Nichts zu drucken</p>
          <p className="text-sm text-muted max-w-prose">
            Eine Plakette gibt es erst, wenn eine Prüfung erfasst und bestanden ist. Solange nur
            Prüftermine geplant sind, gibt es nichts zu bescheinigen.
          </p>
          <Link href="/wartung" className="btn-primary">
            Zu den Prüfungen
          </Link>
        </div>
      ) : (
        <PlakettenPicker plaene={auswahl} />
      )}

      {abgelehnt.length > 0 && (
        <div className="card flex flex-col gap-2">
          <h2 className="font-semibold text-amber-400">
            Ohne Plakette ({abgelehnt.length})
          </h2>
          <p className="text-sm text-muted max-w-prose">
            Für diese Geräte wird bewusst nichts gedruckt — eine Plakette wäre eine Aussage, die
            die Daten nicht hergeben.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {abgelehnt.map((a) => (
              <li key={`${a.inventoryNo}-${a.grund}`} className="flex justify-between gap-3">
                <span>
                  <span className="font-mono">{a.inventoryNo}</span> · {a.deviceName}
                </span>
                <span className="text-muted shrink-0">{ABLEHNUNG_TEXT[a.grund]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
