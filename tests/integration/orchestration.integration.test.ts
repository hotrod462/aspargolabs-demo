import { describe, expect, it } from "vitest";

import {
  integrationEnvReady,
  integrationRunCount,
  missingEnvMessage,
  runOrchestrationScenario,
} from "./helpers";

/**
 * Loads real Groq + Supabase (`itest-*` call_id prefix). Rows persist for manual cleanup.
 *
 * Load env before Vitest starts, e.g.:
 * `npm run test:integration`
 *
 * Tune repeat runs per scenario: `INTEGRATION_N=3 npm run test:integration`
 */
const RUN = integrationEnvReady();
if (!RUN) {
  console.warn(missingEnvMessage());
}

describe.skipIf(!RUN)("orchestration + FSM + Groq + Supabase", () => {
  it("age gate No → proxy_caller terminal (INTEGRATION_N runs)", async () => {
    const runs = integrationRunCount();
    for (let r = 0; r < runs; r++) {
      const outcome = await runOrchestrationScenario({
        scenarioId: "age-gate-no",
        steps: [{ transcript: "No, I'm not eighteen and I'm calling for someone else." }],
      });

      expect(outcome.finalState, `run ${r + 1}/${runs}: final store state`).toBe(
        "proxy_caller_end",
      );
      expect(outcome.finalStatus, `run ${r + 1}/${runs}: final DB status`).toBe("proxy_caller");

      const last = outcome.turnResults.at(-1);
      expect(last?.end_call, `run ${r + 1}/${runs}: end_call`).toBe(true);
      expect(last?.state, `run ${r + 1}/${runs}: last turn state`).toBe("proxy_caller_end");
    }
  });

  it("age gate Yes → advances to chief_complaint", async () => {
    const outcome = await runOrchestrationScenario({
      scenarioId: "age-gate-yes",
      steps: [
        {
          transcript: "Yes, I'm over 18 and I'm calling for myself today.",
        },
      ],
    });

    expect(outcome.finalState).toBe("chief_complaint");
    expect(outcome.finalStatus).toBe("in_progress");
    const last = outcome.turnResults.at(-1);
    expect(last?.end_call).toBe(false);
    expect(last?.state).toBe("chief_complaint");
  });

  it("age gate emergency symptom → emergency_end", async () => {
    const outcome = await runOrchestrationScenario({
      scenarioId: "age-gate-emergency",
      steps: [{ transcript: "I'm having crushing chest pain right now, it started five minutes ago." }],
    });

    expect(outcome.finalState).toBe("emergency_end");
    expect(outcome.finalStatus).toBe("emergency");
    const last = outcome.turnResults.at(-1);
    expect(last?.end_call).toBe(true);
    expect(last?.state).toBe("emergency_end");
  });
});
