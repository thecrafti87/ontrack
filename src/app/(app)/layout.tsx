import { requireUser } from "@/lib/auth";
import { getActiveMission } from "@/lib/mission";
import { MISSION_PHASES } from "@/lib/constants";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const mission = await getActiveMission(user.id);

  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      mission={
        mission
          ? {
              phaseLabel: MISSION_PHASES[mission.phase].label,
              eventName: mission.event.name,
              erledigt: mission.fortschritt.erledigt,
              gesamt: mission.fortschritt.gesamt,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
