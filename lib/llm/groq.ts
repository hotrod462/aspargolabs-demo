import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const intakeModel = groq(process.env.GROQ_MODEL ?? "openai/gpt-oss-120b");
