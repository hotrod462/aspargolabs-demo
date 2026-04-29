import { describe, expect, it } from "vitest";

import {
  integrationEnvReady,
  integrationRunCount,
  missingEnvMessage,
  runOrchestrationScenario,
} from "./helpers";
import { ORCHESTRATION_SCENARIOS, type ScenarioDefinition } from "./scenarios";

/**
 * Inputs + expectations: see `tests/integration/scenarios.ts` (`ORCHESTRATION_SCENARIOS`).
 * Vitest prints each `it` title — that is the scenario name. `call_id` prefix in Supabase: `itest-<scenarioId>-*`.
 *
 * `npm run test:integration`
 * `INTEGRATION_N=3 npm run test:integration` (repeats scenarios with `repeatIntegrationRuns: true`)
 * `INTEGRATION_VERBOSE=1 npm run test:integration -- --reporter=verbose` logs each turn (stdout may be hidden without `--reporter=verbose`).
 */
const RUN = integrationEnvReady();
if (!RUN) {
  console.warn(missingEnvMessage());
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
      }
    });
  }
});
