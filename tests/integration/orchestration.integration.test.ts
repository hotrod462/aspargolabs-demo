import { describe, expect, it } from "vitest";

import {
  integrationEnvReady,
  integrationRunCount,
  missingEnvMessage,
  runOrchestrationScenario,
} from "./helpers";
import { ORCHESTRATION_SCENARIOS, type ScenarioDefinition } from "./scenarios";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

/**
 * Inputs + expectations: see `tests/integration/scenarios.ts` (`ORCHESTRATION_SCENARIOS`).
 *
 * Tier 2: when `scenario.tier2Checks` is set, each `(turnOneBased, allowedInterrupts)` asserts
 * `payload.extraction.interrupt` on the nth `turn_extraction` event (1-based; matches log turn).
 */

const RUN = integrationEnvReady();
if (!RUN) {
  console.warn(missingEnvMessage());
}

async function assertTier2(
  scenario: ScenarioDefinition,
  sessionId: string,
  scenarioIdLabel: string,
) {
  const checks = scenario.tier2Checks;
  if (!checks?.length) return;

  const events = await intakeStore.getEventsForSession(sessionId);
  const extractions = events
    .filter((e) => e.event_type === "turn_extraction")
    .sort((a, b) => {
      const ta = String(a.created_at ?? "");
      const tb = String(b.created_at ?? "");
      return ta.localeCompare(tb);
    });

  const tag = `[${scenario.scenarioId}]${scenarioIdLabel}`;

  for (const check of checks) {
    const idx = check.turnOneBased - 1;
    expect(
      extractions[idx],
      `${tag}: expected turn_extraction at turn ${check.turnOneBased} (${extractions.length} extraction events persisted)`,
    ).toBeDefined();
    const payload = extractions[idx]!.payload as Record<string, unknown>;
    const extraction = payload.extraction as Record<string, unknown> | undefined;
    const interrupt = extraction?.interrupt;
    expect(interrupt, `${tag}: extract interrupt missing at turn ${check.turnOneBased}`).toBeTruthy();
    expect(
      check.allowedInterrupts,
      `${tag}: turn ${check.turnOneBased}, interrupt="${String(interrupt)}"`,
    ).toContain(String(interrupt));
  }
}

function assertOutcome(
  scenario: ScenarioDefinition,
  outcome: Awaited<ReturnType<typeof runOrchestrationScenario>>,
  runLabel: string,
) {
  const tag = `[${scenario.scenarioId}]${runLabel}`;
  expect(outcome.finalState, `${tag} DB current_state`).toBe(scenario.expect.finalState);
  expect(outcome.finalStatus, `${tag} DB status`).toBe(scenario.expect.finalStatus);
  const last = outcome.turnResults.at(-1);
  if (scenario.expect.lastTurn?.end_call !== undefined) {
    expect(last?.end_call, `${tag} last turn end_call`).toBe(scenario.expect.lastTurn.end_call);
  }
  if (scenario.expect.lastTurn?.state !== undefined) {
    expect(last?.state, `${tag} last turn state`).toBe(scenario.expect.lastTurn.state);
  }
  if (scenario.expect.lastSayIncludes !== undefined && last?.say !== undefined) {
    expect(last.say.toLowerCase(), `${tag} last turn say`).toContain(scenario.expect.lastSayIncludes.toLowerCase());
  }
}

describe.skipIf(!RUN)("orchestration + FSM + Groq + Supabase", () => {
  for (const scenario of ORCHESTRATION_SCENARIOS) {
    it(scenario.title, async () => {
      const repeat = scenario.repeatIntegrationRuns ? integrationRunCount() : 1;
      for (let r = 0; r < repeat; r++) {
        const runLabel = repeat > 1 ? ` run ${r + 1}/${repeat}` : "";
        const outcome = await runOrchestrationScenario({
          scenarioId: scenario.scenarioId,
          steps: scenario.steps,
        });
        assertOutcome(scenario, outcome, runLabel);
        await assertTier2(scenario, outcome.sessionId, runLabel);
      }
    });
  }
});
