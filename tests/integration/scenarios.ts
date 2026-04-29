import type { CallStatus } from "@/lib/intake/schema";
import type { OrchestrationStep } from "./helpers";

export interface ScenarioExpect {
  finalState: string;
  finalStatus: CallStatus;
  lastTurn?: { end_call: boolean; state?: string };
}

export interface ScenarioDefinition {
  scenarioId: string;
  /** Shown as the Vitest test name; keep unique. */
  title: string;
  /** Human-readable intent; surfaced in comments / optional logging. */
  description: string;
  steps: OrchestrationStep[];
  expect: ScenarioExpect;
  /**
   * When true, this scenario is run `INTEGRATION_N` times (same script, fresh `call_id` each time).
   * Use for spots where you probe LLM stability.
   */
  repeatIntegrationRuns?: boolean;
}

/**
 * Single source of truth for integration inputs + expected outcomes.
 * `scenarioId` becomes the `itest-<scenarioId>-*` Supabase `call_id` prefix.
 */
export const ORCHESTRATION_SCENARIOS: ScenarioDefinition[] = [
  {
    scenarioId: "age-gate-no",
    title: "Age gate: under 18 / not for self → proxy_caller_end",
    description: "User declines age / third party; should end as proxy caller.",
    steps: [{ transcript: "No, I'm not eighteen and I'm calling for someone else." }],
    expect: {
      finalState: "proxy_caller_end",
      finalStatus: "proxy_caller",
      lastTurn: { end_call: true, state: "proxy_caller_end" },
    },
    repeatIntegrationRuns: true,
  },
  {
    scenarioId: "age-gate-yes",
    title: "Age gate: yes → chief_complaint",
    description: "Eligible caller; one clear affirmative.",
    steps: [{ transcript: "Yes, I'm over 18 and I'm calling for myself today." }],
    expect: {
      finalState: "chief_complaint",
      finalStatus: "in_progress",
      lastTurn: { end_call: false, state: "chief_complaint" },
    },
  },
  {
    scenarioId: "age-gate-emergency",
    title: "Age gate: acute emergency language → emergency_end",
    description: "Chest pain now; extractor should raise emergency interrupt.",
    steps: [{ transcript: "I'm having crushing chest pain right now, it started five minutes ago." }],
    expect: {
      finalState: "emergency_end",
      finalStatus: "emergency",
      lastTurn: { end_call: true, state: "emergency_end" },
    },
  },
  {
    scenarioId: "multi-age-to-nitrates",
    title: "Multi-turn: age yes → ED yes → nitrates_poppers",
    description:
      "Two scripted turns: pass age_gate then chief_complaint; expect next prompt state nitrates_poppers.",
    steps: [
      { transcript: "Yes, I'm over 18 and I'm calling for myself today.", label: "age_gate" },
      {
        transcript: "Yes, I have difficulty getting and maintaining an erection.",
        label: "chief_complaint",
      },
    ],
    expect: {
      finalState: "nitrates_poppers",
      finalStatus: "in_progress",
      lastTurn: { end_call: false, state: "nitrates_poppers" },
    },
  },
];
