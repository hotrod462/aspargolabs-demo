import { extractIntakeTurn } from "./extractor";
import { completionPct, FSM_CONFIG, type TransitionKey } from "./fsm";
import type { AnyState, CallStatus, IntakeState } from "./schema";
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

function terminalStatus(state: AnyState): CallStatus {
  if (state === "completed") return "completed";
  if (state === "hard_stop_end") return "hard_stop";
  if (state === "ineligible_end") return "ineligible";
  if (state === "emergency_end") return "emergency";
  if (state === "proxy_caller_end") return "proxy_caller";
  if (state === "needs_review") return "needs_review";
  return "in_progress";
}

function transitionKeyFromAnswer(answer: string): TransitionKey {
  if (answer === "confirmed") return "confirmed";
  if (answer === "correction") return "correction";
  if (answer === "yes" || answer === "no") return answer;
  return "answered";
}

export async function processIntakeTurn(
  store: IntakeStore,
  input: ProcessTurnInput,
): Promise<ProcessTurnResult> {
  const session =
    (await store.getSession(input.callId)) ??
    (await store.createSession({
      call_id: input.callId,
      assistant_id: input.assistantId,
      patient_phone: input.patientPhone,
    }));

  const currentState = session.current_state as IntakeState;
  const stateConfig = FSM_CONFIG[currentState];

  await store.saveEvent({
    session_id: session.id,
    event_type: "transcript",
    payload: { state: currentState, transcript: input.transcript },
    idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:transcript` : null,
  });

  const extraction = await extractIntakeTurn({
    currentState,
    transcript: input.transcript,
  });

  await store.saveEvent({
    session_id: session.id,
    event_type: "turn_extraction",
    payload: { state: currentState, extraction },
    idempotency_key: input.toolCallId ? `tool:${input.toolCallId}:extraction` : null,
  });

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
    return { say, end_call: true, state: "emergency_end", status: "emergency" };
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
    return { say, end_call: true, state: "proxy_caller_end", status: "proxy_caller" };
  }

  if (extraction.interrupt === "privacy_question") {
    return {
      say: `I am an AI clinical intake assistant, and this intake is used for clinician review. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    };
  }

  if (extraction.interrupt === "medical_advice") {
    return {
      say: `I cannot give medical advice, but I will make sure the doctor sees that in your file. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    };
  }

  if (extraction.answer === "unclear" || extraction.confidence < 0.7) {
    await store.updateField(session.id, {
      field_key: stateConfig.fieldKey,
      value: null,
      status: "unclear",
      confidence: extraction.confidence,
      evidence: extraction.evidence || input.transcript,
    });
    return {
      say: extraction.suggestedSay ?? `To ensure your safety, I need a definitive answer. ${stateConfig.question}`,
      end_call: false,
      state: currentState,
      status: session.status,
    };
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
    hard_stop_reason: status === "in_progress" ? null : (stateConfig.hardStopMessage ?? null),
    needs_review: status === "needs_review",
  });

  if (status !== "in_progress") {
    const say =
      stateConfig.hardStopMessage ??
      (nextState === "completed"
        ? "Thank you, that is all the medical information I need. I am sending your file to our licensed doctor for review."
        : "I cannot proceed with this intake. I am going to end the call now.");
    return { say, end_call: true, state: nextState, status };
  }

  const nextConfig = FSM_CONFIG[nextState as IntakeState];
  return {
    say: nextConfig.question,
    end_call: false,
    state: nextState,
    status,
  };
}
