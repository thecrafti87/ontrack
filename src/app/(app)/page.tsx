import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateRange, formatDateTime } from "@/lib/constants";
import { getMaintenanceDueDate, getMaintenanceUrgency } from "@/lib/maintenance";

export const metadata: Metadata = { title: "Start" };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [deviceCount, defektGesperrtCount, maintenancePlans, waitingUsers, openFeedbackCount, events, recentLogs] =
    await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: { in: ["DEFEKT_GEMELDET", "GESPERRT"] } } }),
      prisma.maintenancePlan.findMany({ select: { lastDoneAt: true, intervalMonths: true } }),
      isAdmin ? prisma.user.count({ where: { approved: false } }) : Promise.resolve(0),
      isAdmin ? prisma.feedback.count({ where: { status: "OFFEN" } }) : Promise.resolve(0),
      prisma.event.findMany({ include: { items: { select: { status: true } } } }),
      prisma.activityLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { user: true, device: true },
      }),
    ]);

  const overdueMaintenance = maintenancePlans.filter((plan) => {
    const due = getMaintenanceDueDate(plan.lastDoneAt, plan.intervalMonths);
    return getMaintenanceUrgency(due) === "overdue";
  }).length;

  const laufend = events
    .filter((e) => e.startDate <= todayEnd && e.endDate >= today)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const anstehend = events
    .filter((e) => e.startDate > todayEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .slice(0, 3);
  const dashboardEvents = [...laufend, ...anstehend];

  const kpis = [
    { label: "Geräte gesamt", value: deviceCount, href: "/geraete", color: "text-foreground" },
    {
      label: "Defekt / gesperrt",
      value: defektGesperrtCount,
      href: "/geraete?status=DEFEKT_GEMELDET",
      color: "text-red-400",
    },
    { label: "Wartung überfällig", value: overdueMaintenance, href: "/wartung", color: "text-amber-400" },
    ...(isAdmin
      ? [
          { label: "Benutzer wartend", value: waitingUsers, href: "/benutzer", color: "text-amber-400" },
          {
            label: "Offene Feedbacks",
            value: openFeedbackCount,
            href: "/feedback",
            color: openFeedbackCount > 0 ? "text-amber-400" : "text-foreground",
          },
        ]
      : []),
  ];

  const kpiGridClass =
    kpis.length >= 5 ? "md:grid-cols-5" : kpis.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Mobil: Scan-Button prominent oben */}
      <Link
        href="/scan"
        className="md:hidden card flex items-center justify-center gap-2 text-center bg-accent text-accent-fg border-accent hover:bg-amber-400 transition-colors min-h-16 font-semibold text-lg"
      >
        <span className="text-2xl">📷</span> QR-/Barcode-Scan
      </Link>

      <h1 className="text-2xl font-bold">Willkommen, {user.name}</h1>

      <div className={`grid grid-cols-2 gap-4 ${kpiGridClass}`}>
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="card flex flex-col gap-1 hover:bg-surface-2 transition-colors"
          >
            <span className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</span>
            <span className="text-sm text-muted">{kpi.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aktuelle & nächste Events */}
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold">Aktuelle &amp; nächste Events</h2>
          {dashboardEvents.length === 0 ? (
            <p className="text-sm text-muted">Keine aktuellen oder anstehenden Events.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dashboardEvents.map((event) => {
                const total = event.items.length;
                const packedOrLater = event.items.filter((i) => i.status !== "GEPLANT").length;
                return (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.id}`}
                      className="flex flex-col gap-0.5 rounded-xl border border-line p-3 hover:bg-surface-2 transition-colors"
                    >
                      <span className="font-medium">{event.name}</span>
                      <span className="text-sm text-muted">
                        {formatDateRange(event.startDate, event.endDate)} · {packedOrLater}/{total}{" "}
                        Geräte gepackt
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Letzte Aktivitäten */}
        <div className="card flex flex-col gap-3">
          <h2 className="font-semibold">Letzte Aktivitäten</h2>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Einträge.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {recentLogs.map((log) => (
                <li key={log.id} className="border-b border-line last:border-0 pb-2 last:pb-0">
                  <span className="text-muted">{formatDateTime(log.createdAt)}</span> —{" "}
                  {log.user?.name ?? "Unbekannt"}: {log.action}
                  {log.device && (
                    <>
                      {" "}
                      (
                      <Link
                        href={`/geraete/${log.device.id}`}
                        className="text-accent underline underline-offset-2"
                      >
                        {log.device.name}
                      </Link>
                      )
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
