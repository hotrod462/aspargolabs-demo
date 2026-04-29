/**
 * Pure helpers for intake monitor UI — safe to import from client components.
 * Mirrors `turnExtractionSchema` interrupt / answer enums without pulling in the LLM extractor.
 */

export const EXTRACTION_INTERRUPTS = [
  "none",
  "emergency",
  "proxy_caller",
  "privacy_question",
  "medical_advice",
  "repeat_question",
  "clarification",
  "audio_unclear",
  "human_escalation",
] as const;

export type ExtractionInterrupt = (typeof EXTRACTION_INTERRUPTS)[number];

/** Short labels for chips in FSM / run trace. */
export const INTERRUPT_DISPLAY: Record<string, string> = {
  none: "No interrupt",
  emergency: "Emergency",
  proxy_caller: "Proxy / minor",
  privacy_question: "Privacy question",
  medical_advice: "Medical advice requested",
  repeat_question: "Repeat question",
  clarification: "Clarification",
  audio_unclear: "Audio unclear",
  human_escalation: "Human escalation",
};

/** Synthetic “conditions” we surface when present in events (not literal FSM nodes). */
export const SYNTHETIC_SIGNAL_IDS = [
  "answer_unclear",
  "low_confidence",
  "extraction_failed",
] as const;

export type SyntheticSignalId = (typeof SYNTHETIC_SIGNAL_IDS)[number];

export const SYNTHETIC_DISPLAY: Record<SyntheticSignalId, string> = {
  answer_unclear: "Unclear answer",
  low_confidence: "Low confidence (<0.7)",
  extraction_failed: "Extraction failed",
};

export interface CallSignalSummary {
  interruptHits: Set<string>;
  answerUnclear: boolean;
  lowConfidence: boolean;
  extractionError: boolean;
}

export function summarizeCallSignalsFromEvents(
  events: Array<{ event_type: string; payload?: Record<string, unknown> }>,
): CallSignalSummary {
  const interruptHits = new Set<string>();
  let answerUnclear = false;
  let lowConfidence = false;
  let extractionError = false;

  for (const e of events) {
    if (e.event_type === "turn_extraction_error") {
      extractionError = true;
      continue;
    }
    if (e.event_type !== "turn_extraction") continue;
    const ex = e.payload?.extraction as Record<string, unknown> | undefined;
    if (!ex) continue;
    if (typeof ex.interrupt === "string" && ex.interrupt !== "none") interruptHits.add(ex.interrupt);
    if (ex.answer === "unclear") answerUnclear = true;
    if (typeof ex.confidence === "number" && ex.confidence < 0.7) lowConfidence = true;
  }

  return { interruptHits, answerUnclear, lowConfidence, extractionError };
}
