import { generateText, Output } from "ai";
import { z } from "zod";
import { intakeModel } from "@/lib/llm/groq";
import { FSM_CONFIG } from "./fsm";
import { FIELD_KEYS } from "./schema";
import type { FieldKey, IntakeState } from "./schema";

const fieldKeySchema = z.enum(FIELD_KEYS as unknown as [string, ...string[]]) as z.ZodType<FieldKey>;

export const turnExtractionSchema = z.object({
  answer: z.enum(["yes", "no", "unclear", "confirmed", "correction"]),
  interrupt: z.enum([
    "none",
    "emergency",
    "proxy_caller",
    "privacy_question",
    "medical_advice",
    "repeat_question",
    "clarification",
    "audio_unclear",
    "human_escalation",
  ]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(500),
  clarificationTopic: z.string().nullable(),
  futureSlots: z.array(
    z.object({
      fieldKey: fieldKeySchema,
      value: z.union([z.string(), z.boolean(), z.null()]),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(500),
    }),
  ),
  suggestedSay: z.string().max(320).nullable(),
});

export type TurnExtraction = z.infer<typeof turnExtractionSchema>;

export async function extractIntakeTurn(input: {
  currentState: IntakeState;
  transcript: string;
  recentContext?: string;
}): Promise<TurnExtraction> {
  const state = FSM_CONFIG[input.currentState];

  const result = await generateText({
    model: intakeModel,
    output: Output.object({ schema: turnExtractionSchema }),
    providerOptions: {
      groq: {
        structuredOutputs: true,
        strictJsonSchema: true,
      },
    },
    system: [
      "You are a bounded clinical intake extraction helper.",
      "Return only the requested JSON object.",
      "Do not decide the next FSM state.",
      "Do not give medical advice.",
      "Classify the caller's latest utterance for the current question.",
      "Emergency means symptoms happening right now, not remote history.",
      "For futureSlots, only include fields clearly volunteered by the caller.",
    ].join("\n"),
    prompt: [
      `Current state: ${input.currentState}`,
      `Current question: ${state.question}`,
      `Expected answer type: ${state.answerType}`,
      input.recentContext ? `Recent context: ${input.recentContext}` : "",
      `Caller transcript: ${input.transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return result.output;
}
