import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { getMaintenanceDueDate, getMaintenanceUrgency, type MaintenanceUrgency } from "@/lib/maintenance";
import { RecordMaintenanceForm } from "../geraete/maintenanceForms";

export const metadata: Metadata = { title: "Wartung" };

type PlanRow = {
  id: string;
  title: string;
  intervalMonths: number;
  lastDoneAt: Date | null;
  notes: string | null;
  dueDate: Date | null;
  urgency: MaintenanceUrgency;
  device: { id: string; name: string; inventoryNo: string; status: string };
};

function byDueDateAsc(a: PlanRow, b: PlanRow): number {
  return (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0);
}

function PlanGroupTable({ plans, editable }: { plans: PlanRow[]; editable: boolean }) {
  if (plans.length === 0) {
    return <p className="text-sm text-muted">Keine Einträge.</p>;
  }

  return (
    <>
      {/* Desktop: echte Tabelle */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Gerät</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Fällig</th>
              {editable && <th className="px-4 py-3 font-medium">Aktion</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="px-4 py-3">
                  <Link href={`/geraete/${plan.device.id}`} className="hover:text-accent">
                    <span className="font-medium">{plan.device.name}</span>{" "}
                    <span className="font-mono text-muted">{plan.device.inventoryNo}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">{plan.title}</td>
                <td className="px-4 py-3">{plan.dueDate ? formatDate(plan.dueDate) : "sofort fällig"}</td>
                {editable && (
                  <td className="px-4 py-3">
                    <RecordMaintenanceForm
                      planId={plan.id}
                      deviceIsBlocked={plan.device.status === "GESPERRT"}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil: Karten */}
      <div className="md:hidden flex flex-col gap-2">
        {plans.map((plan) => (
          <div key={plan.id} className="card flex flex-col gap-2">
            <Link href={`/geraete/${plan.device.id}`} className="font-medium hover:text-accent">
              {plan.device.name}{" "}
              <span className="font-mono text-muted text-sm">{plan.device.inventoryNo}</span>
            </Link>
            <p className="text-sm text-muted">{plan.title}</p>
            <p className="text-sm">
              {plan.dueDate ? `fällig am ${formatDate(plan.dueDate)}` : "sofort fällig"}
            </p>
            {editable && <RecordMaintenanceForm
                      planId={plan.id}
                      deviceIsBlocked={plan.device.status === "GESPERRT"}
                    />}
          </div>
        ))}
      </div>
    </>
  );
}

export default async function WartungPage() {
  const user = await requireUser();
  const editable = canEdit(user);

  const plans = await prisma.maintenancePlan.findMany({
    include: { device: { select: { id: true, name: true, inventoryNo: true, status: true } } },
  });

  const rows: PlanRow[] = plans.map((plan) => {
    const dueDate = getMaintenanceDueDate(plan.lastDoneAt, plan.intervalMonths);
    return { ...plan, dueDate, urgency: getMaintenanceUrgency(dueDate) };
  });

  const overdue = rows.filter((r) => r.urgency === "overdue").sort(byDueDateAsc);
  const soon = rows.filter((r) => r.urgency === "soon").sort(byDueDateAsc);
  const later = rows.filter((r) => r.urgency === "later").sort(byDueDateAsc);

  const lockedDevicesCount = await prisma.device.count({
    where: { status: { in: ["DEFEKT_GEMELDET", "GESPERRT"] } },
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Wartung</h1>
        {/* Für die Berufsgenossenschaft, die Versicherung oder eine Übergabe
            zählt nicht die Fälligkeitsliste, sondern der Nachweis. */}
        <p className="text-sm text-muted">
          Prüfnachweise:{" "}
          <a
            href="/api/export/pruefnachweise?format=pdf"
            className="text-accent underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF
          </a>{" "}
          ·{" "}
          <a href="/api/export/pruefnachweise?format=csv" className="text-accent underline">
            CSV
          </a>
          {" · "}
          <Link href="/wartung/plaketten" className="text-accent underline">
            Plaketten drucken
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="#ueberfaellig" className="card flex flex-col gap-1 hover:bg-surface-2 transition-colors">
          <span className="text-3xl font-bold text-red-400">{overdue.length}</span>
          <span className="text-sm text-muted">überfällig / sofort fällig</span>
        </a>
        <a href="#baldfaellig" className="card flex flex-col gap-1 hover:bg-surface-2 transition-colors">
          <span className="text-3xl font-bold text-amber-400">{soon.length}</span>
          <span className="text-sm text-muted">bald fällig (30 Tage)</span>
        </a>
        <Link
          href="/geraete?status=DEFEKT_GEMELDET"
          className="card flex flex-col gap-1 hover:bg-surface-2 transition-colors"
        >
          <span className="text-3xl font-bold text-foreground">{lockedDevicesCount}</span>
          <span className="text-sm text-muted">Geräte gesperrt/defekt</span>
        </Link>
      </div>

      <section id="ueberfaellig" className="flex flex-col gap-3 scroll-mt-4">
        <h2 className="font-semibold text-red-400">Überfällig / sofort fällig</h2>
        <PlanGroupTable plans={overdue} editable={editable} />
      </section>

      <section id="baldfaellig" className="flex flex-col gap-3 scroll-mt-4">
        <h2 className="font-semibold text-amber-400">Fällig in den nächsten 30 Tagen</h2>
        <PlanGroupTable plans={soon} editable={editable} />
      </section>

      <details className="flex flex-col gap-3">
        <summary className="font-semibold text-muted cursor-pointer select-none">
          Später ({later.length})
        </summary>
        <div className="mt-3">
          <PlanGroupTable plans={later} editable={editable} />
        </div>
      </details>
    </div>
  );
}
