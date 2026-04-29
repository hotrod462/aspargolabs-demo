export const INTAKE_STATES = [
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
] as const;

export type IntakeState = (typeof INTAKE_STATES)[number];

export const TERMINAL_STATES = [
  "completed",
  "hard_stop_end",
  "ineligible_end",
  "emergency_end",
  "proxy_caller_end",
  "needs_review",
] as const;

export type TerminalState = (typeof TERMINAL_STATES)[number];
export type AnyState = IntakeState | TerminalState;

export type CallStatus =
  | "in_progress"
  | "completed"
  | "hard_stop"
  | "ineligible"
  | "emergency"
  | "proxy_caller"
  | "needs_review"
  | "abandoned";

export type FieldStatus =
  | "pending"
  | "asked"
  | "captured"
  | "confirmed"
  | "unclear"
  | "skipped"
  | "error";

export const FIELD_KEYS = [
  "age_confirmed",
  "ed_symptoms",
  "uses_nitrates_or_poppers",
  "recent_ed_medications",
  "recent_cardio_event",
  "exertional_symptoms",
  "bp_alpha_blockers",
  "recent_bp_check",
  "organs_bleeding_ulcers_eyes",
  "priapism_penile_shape",
  "blood_conditions",
  "allergies",
  "daily_meds_supplements",
  "final_confirmation",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];
