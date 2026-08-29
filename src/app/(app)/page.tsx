import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { laeuftNoch } from "@/lib/eventKind";
import { requireUser } from "@/lib/auth";
import { MISSION_PHASES, formatDateRange, formatDateTime, type MissionPhase } from "@/lib/constants";
import { getMaintenanceDueDate, getMaintenanceUrgency } from "@/lib/maintenance";
import { getActiveMission } from "@/lib/mission";
import { StartMissionForm } from "./einsatz/forms";

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

const PHASEN = Object.keys(MISSION_PHASES) as MissionPhase[];

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const mission = await getActiveMission(user.id);

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [deviceCount, defektGesperrtCount, maintenancePlans, waitingUsers, openFeedbackCount, events, recentLogs] =
    await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: { in: ["DEFEKT_GEMELDET", "GESPERRT"] } } }),
      prisma.maintenancePlan.findMany({ select: { lastDoneAt: true, intervalMonths: true } }),
      isAdmin ? prisma.user.count({ where: { approved: false } }) : Promise.resolve(0),
      isAdmin ? prisma.feedback.count({ where: { status: "OFFEN" } }) : Promise.resolve(0),
      prisma.event.findMany({
        include: {
          items: { select: { status: true } },
          _count: { select: { bulkItems: true } },
        },
      }),
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
    .filter((e) => e.startDate <= todayEnd && laeuftNoch(e.endDate, today))
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
      {/* Die Frage „was ist jetzt zu tun" schlägt jede Kennzahl. Läuft ein
          Einsatz, steht er ganz oben; sonst der schnellste Weg in einen. */}
      {mission ? (
        <Link
          href="/einsatz"
          className="card flex flex-col gap-3 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-300">
                Läuft: {MISSION_PHASES[mission.phase].label}
              </p>
              <p className="text-xl font-bold leading-tight">{mission.event.name}</p>
            </div>
            <p className="text-3xl font-bold tabular-nums shrink-0">
              {mission.fortschritt.erledigt}
              <span className="text-muted text-lg">/{mission.fortschritt.gesamt}</span>
            </p>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${
                  mission.fortschritt.gesamt > 0
                    ? Math.round((mission.fortschritt.erledigt / mission.fortschritt.gesamt) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-sm font-semibold text-emerald-300">Weiterscannen →</span>
        </Link>
      ) : (
        <>
          {laufend.length > 0 ? (
            <div className="card flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">{laufend[0]!.name} läuft gerade</h2>
                <p className="text-sm text-muted">
                  Einsatz starten — danach hakt jeder Scan direkt ab.
                </p>
              </div>
              {/* Eine leere Packliste taugt nicht als Einsatz. Hier fehlte die
                  Prüfung bisher — auf /einsatz gab es sie längst, und genau
                  deshalb liess sich von hier aus ein Einsatz ohne Soll starten. */}
              {laufend[0]!.items.length + laufend[0]!._count.bulkItems === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-amber-400">
                    Die Packliste ist leer — es gäbe nichts abzuhaken.
                  </p>
                  <Link
                    href={`/events/${laufend[0]!.id}`}
                    className="btn-secondary text-center"
                  >
                    Erst Geräte einplanen
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PHASEN.map((phase) => (
                    <StartMissionForm key={phase} eventId={laufend[0]!.id} phase={phase} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/einsatz"
              className="md:hidden card flex items-center justify-center gap-2 text-center bg-accent text-accent-fg border-accent hover:bg-amber-400 transition-colors min-h-16 font-semibold text-lg"
            >
              <span className="text-2xl">📷</span> Einsatz starten
            </Link>
          )}
        </>
      )}

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
            /*
              Zwei Zeilen statt einer: Was passiert ist, steht oben; wer und
              wann, darunter. Und wo ein Gerät beteiligt war, ist die ganze
              Zeile der Weg dorthin — vorher war es ein 18 Pixel hoher Link
              mitten im Satz, den man am Handy dreimal danebentippt.
            */
            <ul className="flex flex-col divide-y divide-line">
              {recentLogs.map((log) => {
                const inhalt = (
                  <>
                    <span className="text-sm">
                      {log.action}
                      {log.device && (
                        <span className="text-accent"> · {log.device.name}</span>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDateTime(log.createdAt)} · {log.user?.name ?? "Unbekannt"}
                    </span>
                  </>
                );

                return (
                  <li key={log.id}>
                    {log.device ? (
                      <Link
                        href={`/geraete/${log.device.id}`}
                        className="flex min-h-11 flex-col justify-center gap-0.5 py-2 hover:text-accent"
                      >
                        {inhalt}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 flex-col justify-center gap-0.5 py-2">
                        {inhalt}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
