import { randomUUID } from "node:crypto";
import { inspect } from "node:util";

import { processIntakeTurn } from "@/lib/intake/orchestrator";
import type { ProcessTurnResult } from "@/lib/intake/orchestrator";
import { intakeLlmBackend } from "@/lib/llm/intake-model";
import type { CallStatus } from "@/lib/intake/schema";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

function requiredIntakeLlmKey(): "GROQ_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY" {
  return intakeLlmBackend() === "groq" ? "GROQ_API_KEY" : "GOOGLE_GENERATIVE_AI_API_KEY";
}

function requiredIntegrationEnvKeys(): readonly string[] {
  return [
    requiredIntakeLlmKey(),
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
}

export function integrationEnvReady(): boolean {
  return requiredIntegrationEnvKeys().every((k) => process.env[k] && String(process.env[k]).trim().length > 0);
}

export function missingEnvMessage(): string {
  const missing = requiredIntegrationEnvKeys().filter((k) => !process.env[k] || !String(process.env[k]).trim());
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

function integrationVerbose(): boolean {
  return process.env.INTEGRATION_VERBOSE === "1";
}

/** Optional pause between LLM calls (helps avoid rate limits on large suites). `INTEGRATION_STEP_DELAY_MS`. */
function integrationStepDelayMs(): number {
  const raw = process.env.INTEGRATION_STEP_DELAY_MS;
  const n = raw != null ? Number.parseInt(String(raw), 10) : 0;
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 60_000) : 0;
}

/**
 * Runs each transcript in order against the same `callId` (session advances).
 * Returns the last turn result and the final session row from the store.
 *
 * On errors, prints `[itest] FAIL …` with turn index (1-based), label, `stateBefore`, transcript
 * preview, message, optional `cause`, and deep `inspect(err)` (schema/LLM failures may nest under
 * `cause`).
 *
 * Per-turn `[itest] … start/ok` lines need `INTEGRATION_VERBOSE=1`; use `vitest --reporter=verbose`
 * if stdout does not appear (default reporter may omit it).
 *
 * **`INTEGRATION_STEP_DELAY_MS`**: optional pause (ms) between successful turns to reduce LLM TPM
 * rate-limit hits on long multi-turn suites.
 */
export async function runOrchestrationScenario(
  options: RunOrchestrationScenarioOptions,
): Promise<{
  callId: string;
  sessionId: string;
  turnResults: ProcessTurnResult[];
  finalState: string;
  finalStatus: CallStatus;
}> {
  const suffix = randomUUID().slice(0, 8);
  const callId = `itest-${options.scenarioId}-${suffix}`;

  const turnResults: ProcessTurnResult[] = [];
  const stepCount = options.steps.length;

  for (let i = 0; i < stepCount; i++) {
    const step = options.steps[i];
    const { transcript } = step;
    const label = step.label ?? `step_${i}`;
    const sessionBefore = await intakeStore.getSession(callId);

    if (integrationVerbose()) {
      console.log(
        `[itest] ${options.scenarioId} turn ${i + 1}/${stepCount} start label=${label} stateBefore=${sessionBefore?.current_state ?? "(new call → session_ready via createSession)"}`,
      );
    }

    try {
      const result = await processIntakeTurn(intakeStore, {
        callId,
        transcript,
        toolCallId: `itest-step-${i}-${randomUUID()}`,
      });
      turnResults.push(result);
      if (integrationVerbose()) {
        console.log(
          `[itest] ${options.scenarioId} turn ${i + 1}/${stepCount} ok label=${label} stateAfter=${result.state} status=${result.status} end_call=${result.end_call}`,
        );
      }
      const gap = integrationStepDelayMs();
      if (gap > 0 && i < stepCount - 1) {
        await new Promise((r) => setTimeout(r, gap));
      }
    } catch (err) {
      const preview = transcript.length > 160 ? `${transcript.slice(0, 160)}…` : transcript;
      console.error(
        `[itest] FAIL ${options.scenarioId} turn ${i + 1}/${stepCount} (1-based index: ${i + 1})`,
      );
      console.error(
        `[itest]   label=${label} stateBefore=${sessionBefore?.current_state ?? "(no session yet)"} toolCallId_prefix=itest-step-${i}-<uuid>`,
      );
      console.error(`[itest]   transcript preview: ${preview}`);
      console.error("[itest]   error (message):", err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.cause != null) {
        console.error("[itest]   error.cause:", inspect(err.cause, { depth: 8, colors: false }));
      }
      console.error(
        "[itest]   error (full inspect):",
        inspect(err, { depth: 10, colors: false, maxArrayLength: 30 }),
      );
      throw err;
    }
  }

  const session = await intakeStore.getSession(callId);
  if (!session) {
    throw new Error(`Expected session for call_id ${callId}`);
  }

  return {
    callId,
    sessionId: session.id,
    turnResults,
    finalState: session.current_state,
    finalStatus: session.status,
  };
}
