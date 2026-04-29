import { IntakeMonitorClient } from "@/app/intake-monitor/IntakeMonitorClient";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

export default async function IntakeMonitorPage() {
  const sessions = await intakeStore.listRecentSessions(50);
  return <IntakeMonitorClient initialSessions={sessions} />;
}
