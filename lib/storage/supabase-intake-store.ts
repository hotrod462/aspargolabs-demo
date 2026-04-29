import { supabaseAdmin } from "@/utils/supabase/admin";
import type { Json } from "@/types/database.types";
import type {
  CallSession,
  CreateSessionInput,
  FutureSlotInput,
  IntakeEvent,
  IntakeField,
  IntakeFieldUpdate,
  IntakeStore,
  ReconciliationInput,
  StateUpdate,
} from "./intake-store";

export class SupabaseIntakeStore implements IntakeStore {
  async createSession(input: CreateSessionInput): Promise<CallSession> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .upsert(
        {
          call_id: input.call_id,
          assistant_id: input.assistant_id ?? null,
          patient_phone: input.patient_phone ?? null,
          metadata: (input.metadata ?? {}) as Json,
        },
        { onConflict: "call_id" },
      )
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

  async getSessionById(sessionId: string): Promise<CallSession | null> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) throw new Error(`getSessionById failed: ${error.message}`);
    return (data as unknown as CallSession) ?? null;
  }

  async saveEvent(event: IntakeEvent): Promise<void> {
    const row = {
      session_id: event.session_id,
      event_type: event.event_type,
      payload: event.payload,
      idempotency_key: event.idempotency_key ?? null,
    };

    if (event.idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from("intake_events")
        .select("id")
        .eq("session_id", event.session_id)
        .eq("idempotency_key", event.idempotency_key)
        .maybeSingle();
      if (existing) return;
    }

    const { error } = await supabaseAdmin.from("intake_events").insert(row as never);
    if (error) throw new Error(`saveEvent failed: ${error.message}`);
  }

  async updateField(sessionId: string, field: IntakeFieldUpdate): Promise<void> {
    const { error } = await supabaseAdmin.from("intake_fields").upsert(
      {
        session_id: sessionId,
        field_key: field.field_key,
        value: field.value,
        status: field.status,
        confidence: field.confidence ?? null,
        source: field.source ?? "voice",
        evidence: field.evidence ?? null,
        confirmed_at: field.status === "confirmed" ? new Date().toISOString() : null,
      } as never,
      { onConflict: "session_id,field_key" },
    );

    if (error) throw new Error(`updateField failed: ${error.message}`);
  }

  async updateState(sessionId: string, next: StateUpdate): Promise<void> {
    const patch: Record<string, unknown> = {
      current_state: next.current_state,
    };
    if (next.status !== undefined) patch.status = next.status;
    if (next.completion_pct !== undefined) patch.completion_pct = next.completion_pct;
    if (next.hard_stop_reason !== undefined) patch.hard_stop_reason = next.hard_stop_reason;
    if (next.needs_review !== undefined) patch.needs_review = next.needs_review;
    if (next.ended_at !== undefined) patch.ended_at = next.ended_at;

    const { error } = await supabaseAdmin.from("call_sessions").update(patch as never).eq("id", sessionId);

    if (error) throw new Error(`updateState failed: ${error.message}`);
  }

  async upsertFutureSlot(input: FutureSlotInput): Promise<void> {
    const { error } = await supabaseAdmin.from("captured_future_slots").upsert(
      {
        session_id: input.session_id,
        field_key: input.field_key,
        value: input.value,
        confidence: input.confidence ?? null,
        evidence: input.evidence ?? null,
      } as never,
      { onConflict: "session_id,field_key" },
    );

    if (error) throw new Error(`upsertFutureSlot failed: ${error.message}`);
  }

  async saveReconciliation(input: ReconciliationInput): Promise<void> {
    const { error } = await supabaseAdmin.from("final_reconciliations").insert({
      session_id: input.session_id,
      source: input.source,
      live_state: input.live_state,
      structured_output: input.structured_output,
      differences: input.differences,
    } as never);
    if (error) throw new Error(`saveReconciliation failed: ${error.message}`);
  }

  async listRecentSessions(limit = 50): Promise<CallSession[]> {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`listRecentSessions failed: ${error.message}`);
    return (data ?? []) as unknown as CallSession[];
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

  async recordExtractionLlmTiming(sessionId: string, llmLatencyMs: number, modelId: string): Promise<void> {
    const row = await this.getSessionById(sessionId);
    if (!row) return;
    const m = (row.metadata ?? {}) as Record<string, unknown>;
    const totalPrev = typeof m.llm_extraction_ms_total === "number" ? m.llm_extraction_ms_total : 0;
    const turnsPrev = typeof m.llm_extraction_turns === "number" ? m.llm_extraction_turns : 0;

    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        metadata: {
          ...m,
          llm_extraction_ms_total: totalPrev + llmLatencyMs,
          llm_extraction_turns: turnsPrev + 1,
          last_llm_latency_ms: llmLatencyMs,
          intake_llm_model: modelId,
        } as Json,
      } as never)
      .eq("id", sessionId);

    if (error) throw new Error(`recordExtractionLlmTiming failed: ${error.message}`);
  }
}

export const intakeStore = new SupabaseIntakeStore();
