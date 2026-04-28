export type CallStatus =
  | "in_progress"
  | "completed"
  | "hard_stop"
  | "ineligible"
  | "emergency"
  | "proxy_caller"
  | "needs_review"
  | "abandoned";

export type FieldStatus = "pending" | "captured" | "confirmed" | "skipped" | "error";

export interface CallSession {
  id: string;
  call_id: string;
  assistant_id: string | null;
  status: CallStatus;
  current_state: string;
  patient_phone: string | null;
  started_at: string;
  ended_at: string | null;
  completion_pct: number;
  hard_stop_reason: string | null;
  needs_review: boolean;
  metadata: Record<string, unknown>;
}

export interface IntakeField {
  id: string;
  session_id: string;
  field_key: string;
  value: string | null;
  status: FieldStatus;
  confidence: number | null;
  source: string;
  evidence: string | null;
  confirmed_at: string | null;
}

export interface IntakeEvent {
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface CreateSessionInput {
  call_id: string;
  assistant_id?: string;
  patient_phone?: string;
}

export interface IntakeFieldUpdate {
  field_key: string;
  value: string;
  status: FieldStatus;
  confidence?: number;
  evidence?: string;
}

export interface StateUpdate {
  current_state: string;
  status?: CallStatus;
  completion_pct?: number;
  hard_stop_reason?: string;
  needs_review?: boolean;
  ended_at?: string;
}

export interface CallSessionSummary {
  id: string;
  call_id: string;
  status: CallStatus;
  current_state: string;
  patient_phone: string | null;
  started_at: string;
  completion_pct: number;
  needs_review: boolean;
}

export interface IntakeStore {
  createSession(input: CreateSessionInput): Promise<CallSession>;
  getSession(callId: string): Promise<CallSession | null>;
  saveEvent(event: IntakeEvent): Promise<void>;
  updateField(sessionId: string, field: IntakeFieldUpdate): Promise<void>;
  updateState(sessionId: string, next: StateUpdate): Promise<void>;
  listRecentSessions(limit?: number): Promise<CallSessionSummary[]>;
  getFieldsForSession(sessionId: string): Promise<IntakeField[]>;
  getEventsForSession(sessionId: string): Promise<IntakeEvent[]>;
}
