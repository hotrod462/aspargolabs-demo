/**
 * JSON-serializable extraction failure diagnostics for `intake_events.payload`.
 */
import { APICallError, AISDKError, TypeValidationError } from "@ai-sdk/provider";
import { NoObjectGeneratedError } from "ai";

const MAX_STRING_CHARS = 512_000;
const MAX_DEPTH = 8;

export function truncateString(label: string, s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  if (s.length <= MAX_STRING_CHARS) return s;
  return `${s.slice(0, MAX_STRING_CHARS)}\n…[truncated after ${MAX_STRING_CHARS} chars; ${label}]`;
}

function safeJsonSerializable(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[max recursion depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return truncateString("value", value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map((v) => safeJsonSerializable(v, depth + 1));
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    try {
      const v = obj[key];
      out[key] =
        typeof v === "bigint"
          ? v.toString()
          : typeof v === "function"
            ? "[function]"
            : typeof v === "symbol"
              ? String(v)
              : safeJsonSerializable(v, depth + 1);
    } catch {
      out[key] = "[unserializable]";
    }
  }
  return out;
}

function serializeCause(cause: unknown, depth: number): unknown {
  if (cause == null || cause === undefined) return undefined;
  return serializeAiExtractionFailure(cause, depth + 1);
}

export function serializeAiExtractionFailure(error: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[cause chain truncated at depth]";
  if (error == null || error === undefined) return null;
  if (typeof error === "string") return truncateString("string", error);
  if (typeof error === "number" || typeof error === "boolean") return error;

  if (NoObjectGeneratedError.isInstance(error)) {
    const response = error.response as unknown;
    return {
      type: "NoObjectGeneratedError",
      message: error.message,
      text: truncateString("NoObjectGeneratedError.text", error.text),
      finishReason: error.finishReason,
      usage: error.usage != null ? safeJsonSerializable(error.usage, depth) : undefined,
      response: response != null ? safeJsonSerializable(response, depth) : undefined,
      stack: error.stack,
      cause: serializeCause(error.cause, depth),
    };
  }

  if (APICallError.isInstance(error)) {
    return {
      type: "APICallError",
      message: error.message,
      url: error.url,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
      responseHeaders: error.responseHeaders,
      responseBody: truncateString("APICallError.responseBody", error.responseBody),
      requestBodyValues: safeJsonSerializable(error.requestBodyValues, depth),
      data: error.data != null ? safeJsonSerializable(error.data, depth) : undefined,
      stack: error.stack,
      cause: serializeCause(error.cause, depth),
    };
  }

  if (TypeValidationError.isInstance(error)) {
    return {
      type: "TypeValidationError",
      message: error.message,
      value: error.value != null ? safeJsonSerializable(error.value, depth) : undefined,
      context: error.context != null ? safeJsonSerializable(error.context, depth) : undefined,
      stack: error.stack,
      cause: serializeCause(error.cause, depth),
    };
  }

  if (error instanceof Error) {
    const base: Record<string, unknown> = {
      type: AISDKError.isInstance(error) ? "AISDKError" : error.name,
      message: error.message,
      stack: error.stack,
      cause: serializeCause(error.cause, depth),
    };
    try {
      const errObj = error as unknown as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(error)) {
        if (key === "message" || key === "name" || key === "stack" || key === "cause") continue;
        const v = errObj[key];
        if (typeof v === "function") continue;
        base[key] = safeJsonSerializable(v, depth + 1);
      }
    } catch {
      /* ignore broken getters */
    }
    return base;
  }

  return safeJsonSerializable(error, depth);
}

export interface TurnExtractionErrorPersistPayload extends Record<string, unknown> {
  phase: "extractIntakeTurn";
  state: string;
  transcript: string;
  transcript_chars: number;
  serialized_error: unknown;
  /** Groq structured-output attempt duration until failure (ms). */
  llm_latency_ms?: number;
  intake_llm_model?: string;
}

export function buildTurnExtractionErrorPayload(input: {
  state: string;
  transcript: string;
  error: unknown;
  llm_latency_ms?: number;
  intake_llm_model?: string;
}): TurnExtractionErrorPersistPayload {
  const t =
    input.transcript.length > MAX_STRING_CHARS
      ? (truncateString("transcript", input.transcript) ?? "")
      : input.transcript;
  return {
    phase: "extractIntakeTurn",
    state: input.state,
    transcript: t,
    transcript_chars: input.transcript.length,
    serialized_error: serializeAiExtractionFailure(input.error, 0),
    ...(input.llm_latency_ms != null ? { llm_latency_ms: input.llm_latency_ms } : {}),
    ...(input.intake_llm_model != null ? { intake_llm_model: input.intake_llm_model } : {}),
  };
}
