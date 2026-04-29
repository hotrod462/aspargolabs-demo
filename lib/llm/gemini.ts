import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Uses the Google Generative AI API (Gemini via AI Studio / generativelanguage.googleapis.com).
 * API key defaults to `GOOGLE_GENERATIVE_AI_API_KEY` per `@ai-sdk/google` (x-goog-api-key header).
 */
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/** Model id for intake extraction when `INTAKE_LLM_BACKEND=google` */
export const GEMINI_INTAKE_MODEL_ID =
  process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

export const geminiIntakeModel = google(GEMINI_INTAKE_MODEL_ID);
