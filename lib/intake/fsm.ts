import type { AnyState, IntakeState } from "./schema";

export interface StateConfig {
  question: string;
  fieldKey: string;
  answerType: "yes_no" | "free_text" | "confirmation";
  transitions: Record<string, AnyState>;
  hardStopMessage?: string;
}

export const FSM_CONFIG: Record<IntakeState, StateConfig> = {
  age_gate: {
    question:
      "Before we begin, I need to confirm — are you at least 18 years old and calling for yourself today?",
    fieldKey: "age_confirmed",
    answerType: "yes_no",
    transitions: {
      yes: "chief_complaint",
      proxy_or_minor: "proxy_caller_end",
      emergency: "emergency_end",
    },
  },
  chief_complaint: {
    question:
      "To ensure this medication is appropriate, are you currently experiencing difficulty getting or maintaining an erection?",
    fieldKey: "ed_symptoms",
    answerType: "yes_no",
    transitions: { yes: "nitrates_poppers", no: "ineligible_end", emergency: "emergency_end" },
    hardStopMessage:
      "Because this medication is only prescribed for erectile dysfunction, I cannot proceed.",
  },
  nitrates_poppers: {
    question:
      "Are you currently taking any medications containing nitrates, like nitroglycerin, or using recreational drugs known as poppers?",
    fieldKey: "uses_nitrates_or_poppers",
    answerType: "yes_no",
    transitions: { no: "recent_ed_medications", yes: "hard_stop_end", emergency: "emergency_end" },
    hardStopMessage:
      "Because you take those, sildenafil is not safe. Mixing them can cause a dangerous drop in blood pressure.",
  },
  recent_ed_medications: {
    question: "Have you used any ED medications such as Viagra, Cialis, or Levitra in the past 72 hours?",
    fieldKey: "recent_ed_medications",
    answerType: "free_text",
    transitions: { answered: "recent_major_cardio_event" },
  },
  recent_major_cardio_event: {
    question: "In the past six months, have you had a heart attack, a stroke, or surgery on your heart?",
    fieldKey: "recent_cardio_event",
    answerType: "yes_no",
    transitions: { no: "exertional_symptoms", yes: "hard_stop_end", emergency: "emergency_end" },
    hardStopMessage: "Due to your recent cardiovascular event, our doctor will need to review this further.",
  },
  exertional_symptoms: {
    question:
      "Do you experience chest pain or severe shortness of breath when doing light exercise, like walking up two flights of stairs?",
    fieldKey: "exertional_symptoms",
    answerType: "yes_no",
    transitions: { no: "bp_alpha_blockers", yes: "hard_stop_end", current_chest_pain: "emergency_end" },
    hardStopMessage:
      "Because of those symptoms, our doctor will need to review this before we can proceed.",
  },
  bp_alpha_blockers: {
    question: "Do you currently have uncontrolled high blood pressure, or take alpha-blocker medications like Flomax?",
    fieldKey: "bp_alpha_blockers",
    answerType: "free_text",
    transitions: { answered: "recent_bp_check" },
  },
  recent_bp_check: {
    question: "Have you had your blood pressure checked in the last six months, and was it in a normal range?",
    fieldKey: "recent_bp_check",
    answerType: "yes_no",
    transitions: { answered: "organs_bleeding_ulcers_eyes" },
  },
  organs_bleeding_ulcers_eyes: {
    question:
      "Have you ever been told you have severe liver or kidney disease, a bleeding disorder, active stomach ulcers, or a rare eye condition called NAION?",
    fieldKey: "organs_bleeding_ulcers_eyes",
    answerType: "yes_no",
    transitions: { answered: "priapism_penile_shape" },
  },
  priapism_penile_shape: {
    question:
      "Have you ever had an erection lasting more than 4 hours, or a condition affecting the shape of your penis, like Peyronie's disease?",
    fieldKey: "priapism_penile_shape",
    answerType: "yes_no",
    transitions: { answered: "blood_conditions", priapism_now: "emergency_end" },
  },
  blood_conditions: {
    question: "Do you have a blood condition like sickle cell anemia, multiple myeloma, or leukemia?",
    fieldKey: "blood_conditions",
    answerType: "yes_no",
    transitions: { answered: "allergies" },
  },
  allergies: {
    question: "Are you allergic to sildenafil or any other medications?",
    fieldKey: "allergies",
    answerType: "free_text",
    transitions: { answered: "daily_meds_supplements" },
  },
  daily_meds_supplements: {
    question:
      "Aside from what we've discussed, are there any other prescription medications or supplements you take daily?",
    fieldKey: "daily_meds_supplements",
    answerType: "free_text",
    transitions: { answered: "final_confirmation" },
  },
  final_confirmation: {
    question:
      "I have all the information I need. Before I send this to our doctor, is everything we discussed accurate?",
    fieldKey: "final_confirmation",
    answerType: "confirmation",
    transitions: { confirmed: "wrap_up", correction: "needs_review" },
  },
  wrap_up: {
    question:
      "Thank you! I am securely sending your file to our licensed doctor now. You will receive a text message with a secure link to finalize your shipping details. Have a great day!",
    fieldKey: "final_confirmation",
    answerType: "confirmation",
    transitions: { done: "completed" },
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
  return Math.round((idx / STATE_ORDER.length) * 100);
}
