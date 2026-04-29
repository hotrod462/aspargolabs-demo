import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { GEMINI_INTAKE_MODEL_ID, geminiIntakeModel } from "@/lib/llm/gemini";
import { GROQ_INTAKE_MODEL_ID, groqIntakeModel } from "@/lib/llm/groq";

/** Which LLM backs `extractIntakeTurn` / the intake FSM. */
export type IntakeLlmBackend = "groq" | "google";

export function intakeLlmBackend(): IntakeLlmBackend {
  const raw = process.env.INTAKE_LLM_BACKEND?.trim().toLowerCase();
  if (raw === "groq") return "groq";
  if (raw === "google") return "google";
  return "google";
}

const backend = intakeLlmBackend();

export const INTAKE_LLM_BACKEND: IntakeLlmBackend = backend;

export const intakeModel =
  backend === "google" ? geminiIntakeModel : groqIntakeModel;

/** Model id string for logging / metadata (matches `intakeModel`). */
export const INTAKE_LLM_MODEL_ID =
  backend === "google" ? GEMINI_INTAKE_MODEL_ID : GROQ_INTAKE_MODEL_ID;

console.log("[intake-llm] backend.selected", {
  backend: INTAKE_LLM_BACKEND,
  model: INTAKE_LLM_MODEL_ID,
});

/** Provider knobs for structured JSON extraction alongside `Output.object`. */
export function intakeGenerateTextProviderOptions():
  | { groq: { structuredOutputs: true; strictJsonSchema: boolean } }
  | { google: GoogleLanguageModelOptions } {
  if (backend === "google") {
    return {
      google: {
        structuredOutputs: true,
      },
    };
  }

  return {
    groq: {
      structuredOutputs: true,
      strictJsonSchema: true,
    },
  };
}
