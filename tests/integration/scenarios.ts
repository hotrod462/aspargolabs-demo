import type { CallStatus } from "@/lib/intake/schema";
import type { OrchestrationStep } from "./helpers";

/** Full happy path (16 steps) — coherent natural voice; reused for replay + interrupt recoveries. */
export const FULL_HAPPY_NATURAL_STEPS: OrchestrationStep[] = [
  { transcript: "Yeah, I'm ready. Let's start.", label: "session_ready" },
  { transcript: "Yes. I'm over eighteen, and I'm calling for myself today.", label: "age_gate" },
  {
    transcript:
      "Yeah. It's hard for me to get and keep an erection when my wife and I try to have sex. That's why I'm calling.",
    label: "chief_complaint",
  },
  {
    transcript: "No — I don't use nitroglycerin or other nitrate medicines, and I don't use poppers.",
    label: "nitrates_poppers",
  },
  {
    transcript: "No. I haven't taken Viagra, Cialis, or anything like that in the last forty-eight hours.",
    label: "recent_ed_medications",
  },
  {
    transcript: "No heart attack, no stroke, and no surgery on my heart in the past six months.",
    label: "recent_major_cardio_event",
  },
  {
    transcript:
      "No, I don't get chest pain or shortness of breath from light stuff like walking up two flights of stairs.",
    label: "exertional_symptoms",
  },
  {
    transcript: "No. My blood pressure is fine, and I'm not on Flomax or another alpha blocker like that.",
    label: "bp_alpha_blockers",
  },
  {
    transcript:
      "Yes — my doctor checked my blood pressure in the last six months, and they said it was in the normal range.",
    label: "recent_bp_check",
  },
  {
    transcript:
      "No kidney or liver disease like that. No bleeding disorder. No ulcer. I haven't been told I have NAION.",
    label: "organs_bleeding_ulcers_eyes",
  },
  {
    transcript: "I've never had an erection stuck for hours, and I've never had Peyronie's.",
    label: "priapism_penile_shape",
  },
  { transcript: "No sickle cell, multiple myeloma, or leukemia.", label: "blood_conditions" },
  { transcript: "No allergy to Viagra, sildenafil, or related drugs.", label: "allergies" },
  {
    transcript:
      "No — aside from what we talked about already, I'm not on other daily prescriptions or supplements.",
    label: "daily_meds_supplements",
  },
  {
    transcript: "Yes. What we discussed is accurate. I don't have any corrections.",
    label: "final_confirmation",
  },
  { transcript: "Okay. Sounds good — thank you.", label: "wrap_up" },
];

const HEAD_READY_AGE_ED: OrchestrationStep[] = [
  FULL_HAPPY_NATURAL_STEPS[0]!,
  FULL_HAPPY_NATURAL_STEPS[1]!,
  FULL_HAPPY_NATURAL_STEPS[2]!,
];

const COMMON_NITRATES_NO: OrchestrationStep = {
  transcript: "No — I don't use nitroglycerin or other nitrate medicines, and I don't use poppers.",
  label: "nitrates_clear",
};

/** Gates after chief through `daily_meds` (excludes final_confirmation + wrap_up). */
const TAIL_POST_NITRATES_THROUGH_DAILY: OrchestrationStep[] = FULL_HAPPY_NATURAL_STEPS.slice(4, 14);

/** Gates from `recent_ed_medications` through wrap (for paths that already answered nitrates). */
const SHARED_TAIL_AFTER_NITRATES: OrchestrationStep[] = FULL_HAPPY_NATURAL_STEPS.slice(4);

export interface ScenarioExpect {
  finalState: string;
  finalStatus: CallStatus;
  lastTurn?: { end_call: boolean; state?: string };
  /** Last turn `say` must include this substring (e.g. replay on completed session). */
  lastSayIncludes?: string;
}

export interface Tier2TurnCheck {
  /** 1-based index into `steps` (matches integration log turn numbering). */
  turnOneBased: number;
  allowedInterrupts: readonly string[];
}

export interface ScenarioDefinition {
  scenarioId: string;
  title: string;
  description: string;
  steps: OrchestrationStep[];
  expect: ScenarioExpect;
  tier2Checks?: Tier2TurnCheck[];
  repeatIntegrationRuns?: boolean;
}

export const ORCHESTRATION_SCENARIOS: ScenarioDefinition[] = [
  {
    scenarioId: "happy-path-natural-voice",
    title: "Full happy path → completed (coherent natural voice)",
    description: "Straight path through every active FSM state.",
    steps: [...FULL_HAPPY_NATURAL_STEPS],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
  },

  {
    scenarioId: "session-ready-declined",
    title: "Session ready: caller declines → declined_start_end",
    description: "Polite decline before clinical content.",
    steps: [
      {
        transcript: "Actually, I'd rather not continue right now — maybe another time.",
        label: "session_ready_decline",
      },
    ],
    expect: {
      finalState: "declined_start_end",
      finalStatus: "abandoned",
      lastTurn: { end_call: true, state: "declined_start_end" },
    },
    tier2Checks: [{ turnOneBased: 1, allowedInterrupts: ["none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "age-proxy-minor-third-party",
    title: "Age gate: minor / third party → proxy_caller_end",
    description: "Readiness ok, then caller is not eligible to complete for self.",
    steps: [
      { transcript: "Sure, let's go.", label: "session_ready" },
      {
        transcript:
          "I'm seventeen. My girlfriend's dad told me I had to call, but she's supposed to be on the line for this, not me.",
        label: "age_gate_proxy",
      },
    ],
    expect: {
      finalState: "proxy_caller_end",
      finalStatus: "proxy_caller",
      lastTurn: { end_call: true, state: "proxy_caller_end" },
    },
    tier2Checks: [{ turnOneBased: 2, allowedInterrupts: ["none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "chief-complaint-ineligible-no-ed",
    title: "Chief complaint: not ED → ineligible_end",
    description: "Eligible by age but not a candidate for ED product.",
    steps: [
      { transcript: "Yes, let's do it.", label: "session_ready" },
      { transcript: "I'm fifty-three. Yeah, I'm the patient.", label: "age_gate" },
      {
        transcript:
          "Truthfully — no — I don't have erectile dysfunction. I misunderstood what this call was.",
        label: "chief_complaint_no",
      },
    ],
    expect: {
      finalState: "ineligible_end",
      finalStatus: "ineligible",
      lastTurn: { end_call: true, state: "ineligible_end" },
    },
    tier2Checks: [{ turnOneBased: 3, allowedInterrupts: ["none"] }],
  },

  {
    scenarioId: "acute-emergency-after-age",
    title: "Emergency: chest pain NOW after age → emergency_end",
    description: "Acute cardiac language after readiness and age.",
    steps: [
      { transcript: "Yeah, okay — ready.", label: "session_ready" },
      { transcript: "I'm fifty-six, and I'm calling for myself.", label: "age_gate" },
      {
        transcript:
          "Wait — hang on — I'm having crushing chest pressure right now, it started maybe five minutes ago. I think I'm having a heart attack.",
        label: "emergency_chest_now",
      },
    ],
    expect: {
      finalState: "emergency_end",
      finalStatus: "emergency",
      lastTurn: { end_call: true, state: "emergency_end" },
    },
    tier2Checks: [{ turnOneBased: 3, allowedInterrupts: ["emergency"] }],
  },

  {
    scenarioId: "nitrates-yes-hard-stop",
    title: "Nitrates yes → hard_stop_end",
    description: "Discloses ongoing nitrate use after ED yes.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript:
          "I still have nitroglycerin tablets from my cardiologist from a few years ago, and yes, I still use them sometimes when my chest acts up.",
        label: "nitrates_yes",
      },
    ],
    expect: {
      finalState: "hard_stop_end",
      finalStatus: "hard_stop",
      lastTurn: { end_call: true, state: "hard_stop_end" },
    },
    tier2Checks: [{ turnOneBased: 4, allowedInterrupts: ["none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "recent-cardio-yes-hard-stop",
    title: "Recent major cardio yes → hard_stop_end",
    description: "Recent heart event in past six months.",
    steps: [
      ...HEAD_READY_AGE_ED,
      COMMON_NITRATES_NO,
      {
        transcript: "No, nothing like Viagra or Cialis in the last forty-eight hours.",
        label: "recent_ed_meds",
      },
      {
        transcript:
          "Yes — I had a heart attack about four months ago, and I've been seeing a cardiologist since then.",
        label: "recent_cardio_yes",
      },
    ],
    expect: {
      finalState: "hard_stop_end",
      finalStatus: "hard_stop",
      lastTurn: { end_call: true, state: "hard_stop_end" },
    },
    tier2Checks: [{ turnOneBased: 6, allowedInterrupts: ["none"] }],
  },

  {
    scenarioId: "exertional-symptoms-yes-hard-stop",
    title: "Exertional symptoms yes (stable limitation) → hard_stop_end",
    description: "Chest tightness with light activity without 'right now' acute emergency wording.",
    steps: [
      ...HEAD_READY_AGE_ED,
      COMMON_NITRATES_NO,
      { transcript: "No ED pills or anything like that lately.", label: "recent_ed_meds" },
      {
        transcript: "No heart attack or stroke recently, thank God.",
        label: "recent_major_cardio_event",
      },
      {
        transcript:
          "Yeah — honestly, I've been getting winded climbing even one flight lately, and my chest gets tight when I push myself.",
        label: "exertional_yes",
      },
    ],
    expect: {
      finalState: "hard_stop_end",
      finalStatus: "hard_stop",
      lastTurn: { end_call: true, state: "hard_stop_end" },
    },
    tier2Checks: [{ turnOneBased: 7, allowedInterrupts: ["none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "exertional-live-chest-emergency",
    title: "Chest pain LIVE at exertional gate → emergency_end",
    description: "Pivot from exertional question to acute unfolding emergency.",
    steps: [
      ...HEAD_READY_AGE_ED,
      COMMON_NITRATES_NO,
      { transcript: "No, I haven't taken any ED medication in the last couple of days.", label: "recent_ed_meds" },
      {
        transcript: "No — not a heart attack or stroke in the past six months that I'm aware of.",
        label: "recent_major_cardio_event",
      },
      {
        transcript:
          "Hold on — this isn't about walking upstairs. I've got crushing chest pain spreading to my jaw right now, as we're speaking.",
        label: "exertional_emergency_now",
      },
    ],
    expect: {
      finalState: "emergency_end",
      finalStatus: "emergency",
      lastTurn: { end_call: true, state: "emergency_end" },
    },
    tier2Checks: [{ turnOneBased: 7, allowedInterrupts: ["emergency"] }],
  },

  {
    scenarioId: "acute-urologic-emergency-early",
    title: "Urologic emergency wording after ED yes → emergency_end",
    description: "Severe acute genital emergency may end call before later gates.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript:
          "This might be TMI, but I'm having an erection that's been painful for hours, and it won't go down. It's getting worse by the minute.",
        label: "priapism_emergency",
      },
    ],
    expect: {
      finalState: "emergency_end",
      finalStatus: "emergency",
      lastTurn: { end_call: true, state: "emergency_end" },
    },
    tier2Checks: [{ turnOneBased: 4, allowedInterrupts: ["emergency", "none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "human-escalation-mid-intake",
    title: "Human escalation → needs_review",
    description: "Caller asks for a real person after several clear answers.",
    steps: [
      ...HEAD_READY_AGE_ED,
      COMMON_NITRATES_NO,
      { transcript: "No, I haven't taken Viagra or similar in the last two days.", label: "recent_ed_meds" },
      {
        transcript:
          "Listen — I appreciate what you're doing, but I need to talk to a real person on your team, not keep going with the automated questions.",
        label: "human_escalation",
      },
    ],
    expect: {
      finalState: "needs_review",
      finalStatus: "needs_review",
      lastTurn: { end_call: true, state: "needs_review" },
    },
    tier2Checks: [{ turnOneBased: 6, allowedInterrupts: ["human_escalation"] }],
  },

  {
    scenarioId: "final-confirmation-correction-needs-review",
    title: "Final confirmation: correction → needs_review",
    description: "Completes clinical gates through daily meds, then declines to confirm.",
    steps: [
      ...HEAD_READY_AGE_ED,
      COMMON_NITRATES_NO,
      ...TAIL_POST_NITRATES_THROUGH_DAILY,
      {
        transcript:
          "Wait — I can't say it's all accurate. I need someone from your clinic to call me back before this goes to a doctor.",
        label: "final_correction",
      },
    ],
    expect: {
      finalState: "needs_review",
      finalStatus: "needs_review",
      lastTurn: { end_call: true, state: "needs_review" },
    },
    tier2Checks: [{ turnOneBased: 15, allowedInterrupts: ["none"] }],
    repeatIntegrationRuns: true,
  },
  {
    scenarioId: "interrupt-clarification-nitrates-recover",
    title: "Interrupt: clarification at nitrates → recover → completed",
    description: "Scoped question, clear answer, full tail.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript:
          "I'm sorry — I'm not sure I'm following. Are you asking whether I've ever used that kind of medicine in my life, or only what I'm using right now?",
        label: "clarify_scope",
      },
      COMMON_NITRATES_NO,
      ...SHARED_TAIL_AFTER_NITRATES,
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
    tier2Checks: [
      { turnOneBased: 4, allowedInterrupts: ["clarification", "repeat_question", "none"] },
    ],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "interrupt-repeat-question-nitrates-recover",
    title: "Interrupt: repeat question at nitrates → recover → completed",
    description: "Caller asks to hear the nitrates question again, then completes.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript: "Sorry — I didn't quite catch the middle of that. Could you ask me the whole thing again?",
        label: "repeat_question",
      },
      COMMON_NITRATES_NO,
      ...SHARED_TAIL_AFTER_NITRATES,
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
    tier2Checks: [{ turnOneBased: 4, allowedInterrupts: ["repeat_question", "clarification", "none"] }],
  },

  {
    scenarioId: "interrupt-audio-unclear-recover",
    title: "Interrupt: mumbled line → recover → completed",
    description: "Poor audio then clear nitrates answer and full completion.",
    steps: [
      ...HEAD_READY_AGE_ED,
      { transcript: "Uh… … …", label: "mumble" },
      COMMON_NITRATES_NO,
      ...SHARED_TAIL_AFTER_NITRATES,
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
    tier2Checks: [
      { turnOneBased: 4, allowedInterrupts: ["audio_unclear", "repeat_question", "clarification", "none"] },
    ],
  },

  {
    scenarioId: "interrupt-privacy-recover",
    title: "Interrupt: privacy concern → recover → completed",
    description: "Recording / who-sees-data concern, then substantive answers through wrap.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript:
          "Before I answer that — who actually sees this? Are you recording me, and is my information going to a real doctor?",
        label: "privacy",
      },
      COMMON_NITRATES_NO,
      ...SHARED_TAIL_AFTER_NITRATES,
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
    tier2Checks: [{ turnOneBased: 4, allowedInterrupts: ["privacy_question", "clarification", "none"] }],
  },

  {
    scenarioId: "interrupt-medical-advice-recover",
    title: "Interrupt: seeks medical advice → recover → completed",
    description: "Medical-advice frame, then factual answers only through completion.",
    steps: [
      ...HEAD_READY_AGE_ED,
      {
        transcript:
          "I know you're not supposed to give medical advice, but if I've been dizzy on blood pressure meds, would that change how I'm supposed to answer your next question?",
        label: "medical_advice",
      },
      COMMON_NITRATES_NO,
      ...SHARED_TAIL_AFTER_NITRATES,
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
    },
    tier2Checks: [{ turnOneBased: 4, allowedInterrupts: ["medical_advice", "clarification", "none"] }],
    repeatIntegrationRuns: true,
  },

  {
    scenarioId: "replay-second-turn-after-completed",
    title: "Second turn after completed session (replay guard)",
    description: "No LLM on second hit; canned already-ended reply.",
    steps: [
      ...FULL_HAPPY_NATURAL_STEPS,
      { transcript: "Hello? Is anyone still on the line?", label: "replay_ping" },
    ],
    expect: {
      finalState: "completed",
      finalStatus: "completed",
      lastTurn: { end_call: true, state: "completed" },
      lastSayIncludes: "already ended",
    },
  },
];
