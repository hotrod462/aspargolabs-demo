import { extractIntakeTurn, type TurnExtraction } from "./extractor";
import { buildTurnExtractionErrorPayload } from "./serialize-ai-extraction-error";
import { INTAKE_LLM_MODEL_ID } from "@/lib/llm/intake-model";
import { completionPct, FSM_CONFIG, type TransitionKey } from "./fsm";
import { INTAKE_STATES, type AnyState, CallStatus, IntakeState } from "./schema";
import type { IntakeStore } from "@/lib/storage/intake-store";

export interface ProcessTurnInput {
  callId: string;
  assistantId?: string | null;
  patientPhone?: string | null;
  transcript: string;
  toolCallId?: string;
}

export interface ProcessTurnResult {
  say: string;
  end_call: boolean;
  state: AnyState;
  status: CallStatus;
}

const ORCHESTRATOR_LOG_MAX_CHARS = 400;

function clip(value: string, max = ORCHESTRATOR_LOG_MAX_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`;
}

function terminalStatus(state: AnyState): CallStatus {
  if (state === "completed") return "completed";
  if (state === "hard_stop_end") return "hard_stop";
  if (state === "ineligible_end") return "ineligible";
  if (state === "emergency_end") return "emergency";
  if (state === "proxy_caller_end") return "proxy_caller";
  if (state === "needs_review") return "needs_review";
  if (state === "declined_start_end") return "abandoned";
  return "in_progress";
}

function transitionKeyFromAnswer(answer: string): TransitionKey {
  if (answer === "confirmed") return "confirmed";
  if (answer === "correction") return "correction";
  if (answer === "yes" || answer === "no") return answer;
  return "answered";
}

function isActiveIntakeState(state: string): state is IntakeState {
  return (INTAKE_STATES as readonly string[]).includes(state);
}

/** Persist exactly what the voice layer should speak / whether to end the call (matches tool API result). */
async function persistAssistantTurn(
  store: IntakeStore,
  sessionId: string,
  input: ProcessTurnInput,
  result: ProcessTurnResult,
): Promise<void> {
  await store.saveEvent({
    session_id: sessionId,
    event_type: "assistant_turn",
    payload: {
      say: result.say,
      end_call: result.end_call,
      state: result.state,
      status: result.status,
      note:
        "Speak `say` to the caller. If `end_call` is true, end the call after speaking (Vapi/end-call tool).",
    },
    idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:assistant` : null,
  });
}

async function withAssistantLogged(
  store: IntakeStore,
  sessionId: string,
  input: ProcessTurnInput,
  result: ProcessTurnResult,
): Promise<ProcessTurnResult> {
  await persistAssistantTurn(store, sessionId, input, result);
  return result;
}

export async function processIntakeTurn(
  store: IntakeStore,
  input: ProcessTurnInput,
): Promise<ProcessTurnResult> {
  const turnStartedAt = Date.now();
  console.log("[intake-orchestrator] turn.start", {
    callId: input.callId,
    toolCallId: input.toolCallId ?? null,
    transcriptChars: input.transcript.length,
    transcriptPreview: clip(input.transcript || "(empty)"),
    llmModel: INTAKE_LLM_MODEL_ID,
  });

  const session =
    (await store.getSession(input.callId)) ??
    (await store.createSession({
      call_id: input.callId,
      assistant_id: input.assistantId,
      patient_phone: input.patientPhone,
    }));

  if (!isActiveIntakeState(session.current_state)) {
    console.log("[intake-orchestrator] turn.already_ended", {
      callId: input.callId,
      sessionId: session.id,
      state: session.current_state,
      status: session.status,
      elapsedMs: Date.now() - turnStartedAt,
    });
    return withAssistantLogged(store, session.id, input, {
      say: "This intake has already ended. Thank you for calling.",
      end_call: true,
      state: session.current_state as AnyState,
      status: session.status,
    });
  }

  const currentState = session.current_state;
  const stateConfig = FSM_CONFIG[currentState];

  await store.saveEvent({
    session_id: session.id,
    event_type: "transcript",
    payload: {
      state: currentState,
      transcript: input.transcript,
      /** Wall-clock receipt (epoch ms); for correlation with webhook / Vapi traces. */
      received_at_epoch_ms: Date.now(),
    },
    idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:transcript` : null,
  });

  let extraction: TurnExtraction;
  let llmLatencyMs: number;

  const extractStarted = performance.now();
  try {
    const result = await extractIntakeTurn({
      currentState,
      transcript: input.transcript,
    });
    extraction = result.extraction;
    llmLatencyMs = result.llmLatencyMs;
    console.log("[intake-orchestrator] turn.extracted", {
      callId: input.callId,
      sessionId: session.id,
      currentState,
      answer: extraction.answer,
      interrupt: extraction.interrupt,
      confidence: extraction.confidence,
      llmLatencyMs,
      evidencePreview: clip(extraction.evidence || "(none)"),
    });
  } catch (error) {
    const elapsedToFailMs = Math.round(performance.now() - extractStarted);
    await store.saveEvent({
      session_id: session.id,
      event_type: "turn_extraction_error",
      payload: buildTurnExtractionErrorPayload({
        state: currentState,
        transcript: input.transcript,
        error,
        llm_latency_ms: elapsedToFailMs,
        intake_llm_model: INTAKE_LLM_MODEL_ID,
      }),
      idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:extraction_error` : null,
    });
    console.error("[intake-orchestrator] turn.extraction_failed", {
      callId: input.callId,
      sessionId: session.id,
      currentState,
      llmModel: INTAKE_LLM_MODEL_ID,
      elapsedToFailMs,
      error,
    });
    throw error;
  }

  await store.saveEvent({
    session_id: session.id,
    event_type: "turn_extraction",
    payload: {
      state: currentState,
      extraction,
      llm_latency_ms: llmLatencyMs,
      intake_llm_model: INTAKE_LLM_MODEL_ID,
    },
    idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:extraction` : null,
  });

  await store.recordExtractionLlmTiming(session.id, llmLatencyMs, INTAKE_LLM_MODEL_ID);

  for (const slot of extraction.futureSlots) {
    await store.upsertFutureSlot({
      session_id: session.id,
      field_key: slot.fieldKey,
      value: slot.value,
      confidence: slot.confidence,
      evidence: slot.evidence,
    });
  }

  if (extraction.interrupt === "emergency") {
    const say =
      "Because you are experiencing that right now, please hang up and dial 911 or go to an emergency room immediately.";
    await store.updateState(session.id, {
      current_state: "emergency_end",
      status: "emergency",
      completion_pct: 100,
      ended_at: new Date().toISOString(),
      hard_stop_reason: "current_emergency_symptoms",
    });
    return withAssistantLogged(store, session.id, input, {
      say,
      end_call: true,
      state: "emergency_end",
      status: "emergency",
    });
  }

  if (extraction.interrupt === "proxy_caller") {
    const say =
      "For privacy and safety, I can only complete this intake with the patient directly, so I cannot proceed on this call.";
    await store.updateState(session.id, {
      current_state: "proxy_caller_end",
      status: "proxy_caller",
      completion_pct: 100,
      ended_at: new Date().toISOString(),
      hard_stop_reason: "proxy_caller",
    });
    return withAssistantLogged(store, session.id, input, {
      say,
      end_call: true,
      state: "proxy_caller_end",
      status: "proxy_caller",
    });
  }

  if (extraction.interrupt === "privacy_question") {
    return withAssistantLogged(store, session.id, input, {
      say: `I am an AI clinical intake assistant, and this intake is used for clinician review. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  if (extraction.interrupt === "medical_advice") {
    return withAssistantLogged(store, session.id, input, {
      say: `I cannot give medical advice, but I will make sure the doctor sees that in your file. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  if (extraction.interrupt === "human_escalation") {
    const say =
      "I've noted that you'd like to speak with someone. A member of our team will follow up with you. I'll end the call now.";
    await store.updateState(session.id, {
      current_state: "needs_review",
      status: "needs_review",
      completion_pct: completionPct("needs_review"),
      ended_at: new Date().toISOString(),
      hard_stop_reason: "human_escalation",
      needs_review: true,
    });
    return withAssistantLogged(store, session.id, input, {
      say,
      end_call: true,
      state: "needs_review",
      status: "needs_review",
    });
  }

  if (extraction.interrupt === "clarification") {
    return withAssistantLogged(store, session.id, input, {
      say:
        extraction.suggestedSay ??
        `Sorry for the confusion. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  if (extraction.interrupt === "repeat_question") {
    return withAssistantLogged(store, session.id, input, {
      say: extraction.suggestedSay ?? stateConfig.question,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  if (extraction.interrupt === "audio_unclear") {
    await store.updateField(session.id, {
      field_key: stateConfig.fieldKey,
      value: null,
      status: "unclear",
      confidence: extraction.confidence,
      evidence: extraction.evidence || input.transcript,
    });
    return withAssistantLogged(store, session.id, input, {
      say:
        extraction.suggestedSay ??
        `I didn't quite catch that. Could you say that again? ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  if (extraction.answer === "unclear" || extraction.confidence < 0.7) {
    await store.updateField(session.id, {
      field_key: stateConfig.fieldKey,
      value: null,
      status: "unclear",
      confidence: extraction.confidence,
      evidence: extraction.evidence || input.transcript,
    });
    return withAssistantLogged(store, session.id, input, {
      say:
        extraction.suggestedSay ??
        `To ensure your safety, I need a definitive answer. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    });
  }

  const transitionKey = transitionKeyFromAnswer(extraction.answer);
  const nextState =
    stateConfig.transitions[transitionKey] ?? stateConfig.transitions.answered ?? currentState;
  const status = terminalStatus(nextState);

  await store.updateField(session.id, {
    field_key: stateConfig.fieldKey,
    value: extraction.answer,
    status: "confirmed",
    confidence: extraction.confidence,
    evidence: extraction.evidence || input.transcript,
  });

  await store.updateState(session.id, {
    current_state: nextState,
    status,
    completion_pct: completionPct(nextState),
    ended_at: status === "in_progress" ? null : new Date().toISOString(),
    hard_stop_reason:
      status === "in_progress"
        ? null
        : nextState === "declined_start_end"
          ? "declined_start"
          : (stateConfig.hardStopMessage ?? null),
    needs_review: status === "needs_review",
  });

  if (status !== "in_progress") {
    const say =
      nextState === "declined_start_end"
        ? "Understood. Thank you for calling. Goodbye."
        : stateConfig.hardStopMessage ??
          (nextState === "completed"
            ? "Thank you, that is all the medical information I need. I am sending your file to our licensed doctor for review."
            : "I cannot proceed with this intake. I am going to end the call now.");
    const terminalResult = {
      say,
      end_call: true,
      state: nextState,
      status,
    } as const;
    console.log("[intake-orchestrator] turn.terminal", {
      callId: input.callId,
      sessionId: session.id,
      nextState,
      status,
      end_call: true,
      sayPreview: clip(say),
      elapsedMs: Date.now() - turnStartedAt,
    });
    return withAssistantLogged(store, session.id, input, terminalResult);
  }

  const nextConfig = FSM_CONFIG[nextState as IntakeState];
  const inProgressResult = {
    say: nextConfig.question,
    end_call: false,
    state: nextState,
    status,
  } as const;
  console.log("[intake-orchestrator] turn.next_question", {
    callId: input.callId,
    sessionId: session.id,
    previousState: currentState,
    nextState,
    status,
    sayPreview: clip(nextConfig.question),
    elapsedMs: Date.now() - turnStartedAt,
  });
  return withAssistantLogged(store, session.id, input, inProgressResult);
}
