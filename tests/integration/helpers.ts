import { randomUUID } from "node:crypto";

import { processIntakeTurn } from "@/lib/intake/orchestrator";
import type { ProcessTurnResult } from "@/lib/intake/orchestrator";
import type { CallStatus } from "@/lib/intake/schema";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

const REQUIRED = [
  "GROQ_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function integrationEnvReady(): boolean {
  return REQUIRED.every((k) => process.env[k] && String(process.env[k]).trim().length > 0);
}

export function missingEnvMessage(): string {
  const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  return `Skip: set in .env.local: ${missing.join(", ")}`;
}

/** Full runs of the same scenario (fresh call each time). Default 1; set INTEGRATION_N. */
export function integrationRunCount(): number {
  const raw = process.env.INTEGRATION_N ?? "1";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 1;
}

export interface OrchestrationStep {
  /** Optional label for logs / docs only. */
  label?: string;
  transcript: string;
}

export interface RunOrchestrationScenarioOptions {
  /** Logical name for call_id prefix (e.g. age-gate-no). */
  scenarioId: string;
  steps: OrchestrationStep[];
}

/**
 * Runs each transcript in order against the same `callId` (session advances).
 * Returns the last turn result and the final session row from the store.
 */
export async function runOrchestrationScenario(
  options: RunOrchestrationScenarioOptions,
): Promise<{
  callId: string;
  turnResults: ProcessTurnResult[];
  finalState: string;
  finalStatus: CallStatus;
}> {
  const suffix = randomUUID().slice(0, 8);
  const callId = `itest-${options.scenarioId}-${suffix}`;

  const turnResults: ProcessTurnResult[] = [];
  for (let i = 0; i < options.steps.length; i++) {
    const { transcript } = options.steps[i];
    const result = await processIntakeTurn(intakeStore, {
      callId,
      transcript,
      toolCallId: `itest-step-${i}-${randomUUID()}`,
    });
    turnResults.push(result);
  }

  const session = await intakeStore.getSession(callId);
  if (!session) {
    throw new Error(`Expected session for call_id ${callId}`);
  }

  return {
    callId,
    turnResults,
    finalState: session.current_state,
    finalStatus: session.status,
  };
}
