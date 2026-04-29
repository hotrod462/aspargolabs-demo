import type { CallStatus, FieldKey, FieldStatus } from "@/lib/intake/schema";

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
  field_key: FieldKey;
  value: unknown;
  status: FieldStatus;
  confidence: number | null;
  source: string;
  evidence: string | null;
  confirmed_at: string | null;
}

export interface IntakeEvent {
  id?: string;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key?: string | null;
  created_at?: string;
}

export interface CreateSessionInput {
  call_id: string;
  assistant_id?: string | null;
  patient_phone?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IntakeFieldUpdate {
  field_key: FieldKey;
  value: unknown;
  status: FieldStatus;
  confidence?: number | null;
  evidence?: string | null;
  source?: string;
}

export interface StateUpdate {
  current_state: string;
  status?: CallStatus;
  completion_pct?: number;
  hard_stop_reason?: string | null;
  needs_review?: boolean;
  ended_at?: string | null;
}

export interface FutureSlotInput {
  session_id: string;
  field_key: FieldKey;
  value: unknown;
  confidence?: number | null;
  evidence?: string | null;
}

export interface ReconciliationInput {
  session_id: string;
  source: string;
  live_state: Record<string, unknown>;
  structured_output: Record<string, unknown>;
  differences: unknown[];
}

export interface IntakeStore {
  createSession(input: CreateSessionInput): Promise<CallSession>;
  getSession(callId: string): Promise<CallSession | null>;
  getSessionById(sessionId: string): Promise<CallSession | null>;
  saveEvent(event: IntakeEvent): Promise<void>;
  updateField(sessionId: string, field: IntakeFieldUpdate): Promise<void>;
  updateState(sessionId: string, next: StateUpdate): Promise<void>;
  upsertFutureSlot(input: FutureSlotInput): Promise<void>;
  saveReconciliation(input: ReconciliationInput): Promise<void>;
  listRecentSessions(limit?: number): Promise<CallSession[]>;
  getFieldsForSession(sessionId: string): Promise<IntakeField[]>;
  getEventsForSession(sessionId: string): Promise<IntakeEvent[]>;
}
