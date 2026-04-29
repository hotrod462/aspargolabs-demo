import { IntakeMonitorClient } from "@/app/intake-monitor/IntakeMonitorClient";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

export default async function IntakeMonitorPage() {
  const sessions = await intakeStore.listRecentSessions(200);
  const fieldsBySessionId = await intakeStore.getFieldsBySessionIds(sessions.map((s) => s.id));
  return (
    <IntakeMonitorClient initialSessions={sessions} initialFieldsBySessionId={fieldsBySessionId} />
  );
}
