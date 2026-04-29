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
    scenarioId: "session-ready-no",
    title: "Session ready: user declines → declined_start_end",
    description: "User says they are not ready; call should end politely with abandoned status.",
    steps: [{ transcript: "No, not right now." }],
    expect: {
      finalState: "declined_start_end",
      finalStatus: "abandoned",
      lastTurn: { end_call: true, state: "declined_start_end" },
    },
    repeatIntegrationRuns: true,
  },
  {
    scenarioId: "age-gate-no",
    title: "Age gate: under 18 / not for self → proxy_caller_end",
    description: "User declines age / third party; should end as proxy caller.",
    steps: [
      { transcript: "Yes, I'm ready to get started.", label: "session_ready" },
      { transcript: "No, I'm not eighteen and I'm calling for someone else.", label: "age_gate" },
    ],
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
    description: "Eligible caller; readiness then clear age affirmation.",
    steps: [
      { transcript: "Yes, I'm ready.", label: "session_ready" },
      { transcript: "Yes, I'm over 18 and I'm calling for myself today.", label: "age_gate" },
    ],
    expect: {
      finalState: "chief_complaint",
      finalStatus: "in_progress",
      lastTurn: { end_call: false, state: "chief_complaint" },
    },
  },
  {
    scenarioId: "age-gate-emergency",
    title: "Age gate: acute emergency language → emergency_end",
    description: "Chest pain now; extractor should raise emergency interrupt (from session_ready).",
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
      "Three scripted turns: session ready → pass age_gate → chief_complaint; expect next prompt state nitrates_poppers.",
    steps: [
      { transcript: "Yes, I'm ready to get started.", label: "session_ready" },
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
  {
    scenarioId: "multi-age-ed-nitrates-no",
    title: "Multi-turn: age yes → ED yes → nitrates no → recent_ed_medications",
    description:
      "Four scripted turns: ready → age → chief_complaint → nitrates; expect recent_ed_medications.",
    steps: [
      { transcript: "Yes, I'm ready to get started.", label: "session_ready" },
      { transcript: "Yes, I'm over 18 and I'm calling for myself today.", label: "age_gate" },
      {
        transcript: "Yes, I have difficulty getting and maintaining an erection.",
        label: "chief_complaint_ed",
      },
      {
        transcript: "No, I do not take nitrates or recreational drugs known as poppers.",
        label: "nitrates_poppers_no",
      },
    ],
    expect: {
      finalState: "recent_ed_medications",
      finalStatus: "in_progress",
      lastTurn: { end_call: false, state: "recent_ed_medications" },
    },
    repeatIntegrationRuns: true,
  },
  {
    scenarioId: "happy-path-full-intake",
    title: "Full happy path: session_ready through age_gate and all questions to completed",
    description:
      "Eligible male path: ~16 user turns through every active FSM state to completed. " +
      "Relies on Groq extraction; may flake if the model returns unclear answers or invalid futureSlots.",
    steps: [
      { transcript: "Yes, I'm ready to begin.", label: "session_ready" },
      { transcript: "Yes, I'm over 18 and I'm calling for myself today.", label: "age_gate" },
      {
        transcript:
          "Yes, I'm having difficulty getting and maintaining an erection when I want to be intimate.",
        label: "chief_complaint",
      },
      {
        transcript:
          "No, I do not take nitroglycerin or other nitrates, and I do not use poppers.",
        label: "nitrates_poppers",
      },
      {
        transcript: "No, I have not taken any erectile dysfunction drug or sexual enhancement product in the last 48 hours.",
        label: "recent_ed_medications",
      },
      {
        transcript:
          "No, I have not had a heart attack, stroke, or heart surgery in the past six months.",
        label: "recent_major_cardio_event",
      },
      {
        transcript:
          "No, I do not get chest pain or severe shortness of breath with light activity like walking up two flights of stairs.",
        label: "exertional_symptoms",
      },
      {
        transcript:
          "No, I do not have uncontrolled high blood pressure, and I am not taking an alpha blocker like Flomax.",
        label: "bp_alpha_blockers",
      },
      {
        transcript:
          "Yes, my blood pressure was checked in the last six months and it was in a normal range.",
        label: "recent_bp_check",
      },
      {
        transcript:
          "No, I have never been told I have severe liver or kidney disease, a bleeding disorder, an active stomach ulcer, or NAION.",
        label: "organs_bleeding_ulcers_eyes",
      },
      {
        transcript:
          "No, I have never had an erection lasting more than four hours, and I do not have Peyronie's disease.",
        label: "priapism_penile_shape",
      },
      {
        transcript: "No, I do not have sickle cell disease, multiple myeloma, or leukemia.",
        label: "blood_conditions",
      },
      {
        transcript: "No, I am not allergic to sildenafil or any other medications.",
        label: "allergies",
      },
      {
        transcript:
          "No, aside from what we already discussed, I do not take any other daily prescription medications or supplements.",
        label: "daily_meds_supplements",
      },
      {
        transcript:
          "I confirm that everything we discussed is accurate and I have nothing to correct.",
        label: "final_confirmation",
      },
      { transcript: "Yes, thank you — that sounds good.", label: "wrap_up" },
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
  },
];
