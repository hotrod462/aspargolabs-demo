import type { AnyState, FieldKey, IntakeState } from "./schema";

export type TransitionKey =
  | "yes"
  | "no"
  | "answered"
  | "confirmed"
  | "correction"
  | "emergency"
  | "proxy_or_minor"
  | "current_chest_pain"
  | "priapism_now";

export interface StateConfig {
  question: string;
  fieldKey: FieldKey;
  answerType: "yes_no" | "free_text" | "confirmation";
  transitions: Partial<Record<TransitionKey, AnyState>>;
  hardStopMessage?: string;
}

export const FSM_CONFIG: Record<IntakeState, StateConfig> = {
  age_gate: {
    question: "Are you 18 or older and calling for yourself today?",
    fieldKey: "age_confirmed",
    answerType: "yes_no",
    transitions: {
      yes: "chief_complaint",
      no: "proxy_caller_end",
      proxy_or_minor: "proxy_caller_end",
      emergency: "emergency_end",
    },
  },
  chief_complaint: {
    question: "Are you currently experiencing difficulty getting or maintaining an erection?",
    fieldKey: "ed_symptoms",
    answerType: "yes_no",
    transitions: { yes: "nitrates_poppers", no: "ineligible_end", emergency: "emergency_end" },
    hardStopMessage:
      "This medication is only for erectile dysfunction, so I cannot proceed with this intake.",
  },
  nitrates_poppers: {
    question:
      "Are you taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?",
    fieldKey: "uses_nitrates_or_poppers",
    answerType: "yes_no",
    transitions: { no: "recent_ed_medications", yes: "hard_stop_end", emergency: "emergency_end" },
    hardStopMessage:
      "Sildenafil is not safe to use with nitrates or poppers, so I cannot proceed with this intake.",
  },
  recent_ed_medications: {
    question:
      "In the last 48 hours, have you taken any erectile dysfunction medication or sexual enhancement product?",
    fieldKey: "recent_ed_medications",
    answerType: "yes_no",
    transitions: {
      yes: "recent_major_cardio_event",
      no: "recent_major_cardio_event",
      answered: "recent_major_cardio_event",
    },
  },
  recent_major_cardio_event: {
    question: "In the past six months, have you had a heart attack, stroke, or surgery on your heart?",
    fieldKey: "recent_cardio_event",
    answerType: "yes_no",
    transitions: { no: "exertional_symptoms", yes: "hard_stop_end", emergency: "emergency_end" },
    hardStopMessage: "Because of that recent heart or stroke history, I cannot proceed with this intake.",
  },
  exertional_symptoms: {
    question:
      "Do you get chest pain or severe shortness of breath with light activity, like walking up two flights of stairs?",
    fieldKey: "exertional_symptoms",
    answerType: "yes_no",
    transitions: {
      no: "bp_alpha_blockers",
      yes: "hard_stop_end",
      current_chest_pain: "emergency_end",
    },
    hardStopMessage: "Because of those symptoms, I cannot proceed with this intake.",
  },
  bp_alpha_blockers: {
    question: "Do you have uncontrolled high blood pressure, or do you take an alpha blocker like Flomax?",
    fieldKey: "bp_alpha_blockers",
    answerType: "yes_no",
    transitions: { yes: "recent_bp_check", no: "recent_bp_check", answered: "recent_bp_check" },
  },
  recent_bp_check: {
    question:
      "Have you had your blood pressure checked in the last six months, and was it in a normal range?",
    fieldKey: "recent_bp_check",
    answerType: "yes_no",
    transitions: {
      yes: "organs_bleeding_ulcers_eyes",
      no: "organs_bleeding_ulcers_eyes",
      answered: "organs_bleeding_ulcers_eyes",
    },
  },
  organs_bleeding_ulcers_eyes: {
    question:
      "Have you ever been told you have severe liver or kidney disease, a bleeding disorder, an active stomach ulcer, or NAION?",
    fieldKey: "organs_bleeding_ulcers_eyes",
    answerType: "yes_no",
    transitions: {
      yes: "priapism_penile_shape",
      no: "priapism_penile_shape",
      answered: "priapism_penile_shape",
    },
  },
  priapism_penile_shape: {
    question:
      "Have you ever had an erection lasting more than 4 hours, or a condition affecting penis shape like Peyronie's disease?",
    fieldKey: "priapism_penile_shape",
    answerType: "yes_no",
    transitions: {
      yes: "blood_conditions",
      no: "blood_conditions",
      answered: "blood_conditions",
      priapism_now: "emergency_end",
    },
  },
  blood_conditions: {
    question: "Do you have a blood condition like sickle cell disease, multiple myeloma, or leukemia?",
    fieldKey: "blood_conditions",
    answerType: "yes_no",
    transitions: { yes: "allergies", no: "allergies", answered: "allergies" },
  },
  allergies: {
    question: "Are you allergic to sildenafil or any other medications?",
    fieldKey: "allergies",
    answerType: "yes_no",
    transitions: {
      yes: "daily_meds_supplements",
      no: "daily_meds_supplements",
      answered: "daily_meds_supplements",
    },
  },
  daily_meds_supplements: {
    question:
      "Aside from what we discussed, do you take any prescription medications or supplements daily?",
    fieldKey: "daily_meds_supplements",
    answerType: "yes_no",
    transitions: {
      yes: "final_confirmation",
      no: "final_confirmation",
      answered: "final_confirmation",
    },
  },
  final_confirmation: {
    question: "Before I send this to the doctor, is everything we discussed accurate?",
    fieldKey: "final_confirmation",
    answerType: "confirmation",
    transitions: { confirmed: "wrap_up", correction: "needs_review" },
  },
  wrap_up: {
    question:
      "Thank you, that is all the medical information I need. I am sending your file to our licensed doctor for review.",
    fieldKey: "final_confirmation",
    answerType: "confirmation",
    transitions: { answered: "completed", confirmed: "completed" },
  },
};

const STATE_ORDER: IntakeState[] = [
  "age_gate",
  "chief_complaint",
  "nitrates_poppers",
  "recent_ed_medications",
  "recent_major_cardio_event",
  "exertional_symptoms",
  "bp_alpha_blockers",
  "recent_bp_check",
  "organs_bleeding_ulcers_eyes",
  "priapism_penile_shape",
  "blood_conditions",
  "allergies",
  "daily_meds_supplements",
  "final_confirmation",
  "wrap_up",
];

export function completionPct(state: AnyState): number {
  const idx = STATE_ORDER.indexOf(state as IntakeState);
  if (idx === -1) return 100;
  return Math.round(((idx + 1) / STATE_ORDER.length) * 100);
}
