import { supabaseAdmin } from "@/utils/supabase/admin";
import type {
  CallSession,
  CallSessionSummary,
  CreateSessionInput,
  IntakeEvent,
  IntakeField,
  IntakeFieldUpdate,
  IntakeStore,
  StateUpdate,
} from "./intake-store";

export class SupabaseIntakeStore implements IntakeStore {
  async createSession(input: CreateSessionInput): Promise<CallSession> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .insert({
        call_id: input.call_id,
        assistant_id: input.assistant_id ?? null,
        patient_phone: input.patient_phone ?? null,
      })
      .select("*")
      .single();

    if (error) throw new Error(`createSession failed: ${error.message}`);
    return data as unknown as CallSession;
  }

  async getSession(callId: string): Promise<CallSession | null> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("call_id", callId)
      .maybeSingle();

    if (error) throw new Error(`getSession failed: ${error.message}`);
    return (data as unknown as CallSession) ?? null;
  }

  async saveEvent(event: IntakeEvent): Promise<void> {
    const { error } = await supabaseAdmin
      .from("intake_events")
      // Database types expect `payload` to be `Json`, while IntakeEvent uses a more convenient object shape.
      // Cast here; callers should keep `payload` JSON-serializable.
      .insert(event as unknown as never);
    if (error) throw new Error(`saveEvent failed: ${error.message}`);
  }

  async updateField(sessionId: string, field: IntakeFieldUpdate): Promise<void> {
    const { error } = await supabaseAdmin
      .from("intake_fields")
      .upsert(
        {
          session_id: sessionId,
          field_key: field.field_key,
          value: field.value,
          status: field.status,
          confidence: field.confidence ?? null,
          evidence: field.evidence ?? null,
          confirmed_at: field.status === "confirmed" ? new Date().toISOString() : null,
        },
        { onConflict: "session_id,field_key" },
      );

    if (error) throw new Error(`updateField failed: ${error.message}`);
  }

  async updateState(sessionId: string, next: StateUpdate): Promise<void> {
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        current_state: next.current_state,
        ...(next.status && { status: next.status }),
        ...(next.completion_pct !== undefined && { completion_pct: next.completion_pct }),
        ...(next.hard_stop_reason && { hard_stop_reason: next.hard_stop_reason }),
        ...(next.needs_review !== undefined && { needs_review: next.needs_review }),
        ...(next.ended_at && { ended_at: next.ended_at }),
      })
      .eq("id", sessionId);

    if (error) throw new Error(`updateState failed: ${error.message}`);
  }

  async listRecentSessions(limit = 50): Promise<CallSessionSummary[]> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .select("id, call_id, status, current_state, patient_phone, started_at, completion_pct, needs_review")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`listRecentSessions failed: ${error.message}`);
    return (data ?? []) as unknown as CallSessionSummary[];
  }

  async getFieldsForSession(sessionId: string): Promise<IntakeField[]> {
    const { data, error } = await supabaseAdmin
      .from("intake_fields")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    if (error) throw new Error(`getFieldsForSession failed: ${error.message}`);
    return (data ?? []) as unknown as IntakeField[];
  }

  async getEventsForSession(sessionId: string): Promise<IntakeEvent[]> {
    const { data, error } = await supabaseAdmin
      .from("intake_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    if (error) throw new Error(`getEventsForSession failed: ${error.message}`);
    return (data ?? []) as unknown as IntakeEvent[];
  }
}

export const intakeStore = new SupabaseIntakeStore();
