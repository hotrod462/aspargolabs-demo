import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

/** Model id string for logging / metadata (matches `intakeModel`). */
export const INTAKE_LLM_MODEL_ID = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export const intakeModel = groq(INTAKE_LLM_MODEL_ID);
