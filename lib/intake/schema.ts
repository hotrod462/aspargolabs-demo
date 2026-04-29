export const INTAKE_STATES = [
  "session_ready",
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

/** First active FSM step for new sessions; also set on `createSession` (not the database default). */
export const DEFAULT_INTAKE_STATE: IntakeState = "session_ready";

export const TERMINAL_STATES = [
  "completed",
  "hard_stop_end",
  "ineligible_end",
  "emergency_end",
  "proxy_caller_end",
  "needs_review",
  "declined_start_end",
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

/** All bucket values for filtering / analytics (call_sessions.status). */
export const CALL_STATUSES: readonly CallStatus[] = [
  "in_progress",
  "completed",
  "hard_stop",
  "ineligible",
  "emergency",
  "proxy_caller",
  "needs_review",
  "abandoned",
] as const;

export type FieldStatus =
  | "pending"
  | "asked"
  | "captured"
  | "confirmed"
  | "unclear"
  | "skipped"
  | "error";

export const FIELD_KEYS = [
  "ready_to_continue",
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
