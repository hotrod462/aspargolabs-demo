import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

/** Model id for intake extraction when `INTAKE_LLM_BACKEND=groq` */
export const GROQ_INTAKE_MODEL_ID =
  process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export const groqIntakeModel = groq(GROQ_INTAKE_MODEL_ID);
