const REQUIRED_FOR_PROD = ["VAPI_CUSTOM_LLM_URL"] as const;

export function validateCustomLlmEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const missing = REQUIRED_FOR_PROD.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[custom-llm] missing required env var(s): ${missing.join(", ")}`,
    );
  }
}

