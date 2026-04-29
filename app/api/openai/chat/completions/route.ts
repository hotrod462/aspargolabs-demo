import { NextResponse } from "next/server";
import { processIntakeTurn } from "@/lib/intake/orchestrator";
import { intakeStore } from "@/lib/storage/supabase-intake-store";
import { validateCustomLlmEnv } from "@/lib/config/custom-llm-env";
import {
  buildChatCompletionResponse,
  buildChatCompletionStreamChunks,
  latestUserText,
  type OpenAiMessage,
} from "@/lib/vapi/custom-llm-contract";

type OpenAiChatRequest = {
  call?: {
    id?: string;
    assistantId?: string;
    customer?: { number?: string };
  };
  callId?: string;
  sessionId?: string;
  conversationId?: string;
  model?: string;
  messages?: OpenAiMessage[];
  stream?: boolean;
  metadata?: {
    callId?: string;
    sessionId?: string;
    conversationId?: string;
    call?: {
      id?: string;
      assistantId?: string;
      customer?: { number?: string };
    };
  };
};

const TRANSCRIPT_LOG_MAX_CHARS = 500;

function clip(value: string, max = TRANSCRIPT_LOG_MAX_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`;
}

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function resolveStableCallId(req: Request, body: OpenAiChatRequest): {
  callId: string;
  source: string;
} {
  const headerCallId = firstNonEmpty(
    req.headers.get("x-vapi-call-id"),
    req.headers.get("x-call-id"),
  );
  if (headerCallId) return { callId: headerCallId, source: "header" };

  const bodyAny = body as Record<string, unknown>;
  const callId = firstNonEmpty(
    body.metadata?.call?.id,
    body.call?.id,
    body.metadata?.callId,
    body.callId,
    body.metadata?.sessionId,
    body.sessionId,
    body.metadata?.conversationId,
    body.conversationId,
    typeof bodyAny.call === "object" && bodyAny.call
      ? (bodyAny.call as Record<string, unknown>).id
      : null,
  );
  if (callId) return { callId, source: "body" };

  return {
    callId: `custom-llm:fallback:${crypto.randomUUID()}`,
    source: "fallback-random",
  };
}

export async function POST(req: Request) {
  validateCustomLlmEnv();
  const expectedSecret = process.env.VAPI_CUSTOM_LLM_SECRET;
  const requestId = crypto.randomUUID();

  if (expectedSecret && req.headers.get("x-vapi-secret") !== expectedSecret) {
    console.warn("[custom-llm] unauthorized request", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const body = (await req.json()) as OpenAiChatRequest;
    const model = body.model ?? "custom-intake-llm";
    const resolvedCall = resolveStableCallId(req, body);
    const callId = resolvedCall.callId;
    const transcript = latestUserText(body.messages);
    console.log("[custom-llm] request.received", {
      requestId,
      callId,
      callIdSource: resolvedCall.source,
      model,
      stream: Boolean(body.stream),
      messageCount: body.messages?.length ?? 0,
      bodyTopLevelKeys: Object.keys(body),
      transcriptChars: transcript.length,
      transcriptPreview: clip(transcript || "(empty)"),
    });

    const result = await processIntakeTurn(intakeStore, {
      callId,
      assistantId: body.metadata?.call?.assistantId ?? body.call?.assistantId ?? null,
      patientPhone:
        body.metadata?.call?.customer?.number ?? body.call?.customer?.number ?? null,
      transcript,
    });

    console.log("[custom-llm] request.processed", {
      requestId,
      callId,
      state: result.state,
      status: result.status,
      end_call: result.end_call,
      sayChars: result.say.length,
      sayPreview: clip(result.say),
      elapsedMs: Date.now() - startedAt,
    });

    const responseInput = {
      model,
      say: result.say,
      endCall: result.end_call,
      state: result.state,
      status: result.status,
    };

    if (body.stream) {
      const chunks = buildChatCompletionStreamChunks(responseInput);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return NextResponse.json(buildChatCompletionResponse(responseInput));
  } catch (error) {
    console.error("[custom-llm] request.failed", { requestId, error });
    const fallback = buildChatCompletionResponse({
      model: "custom-intake-llm",
      say: "Sorry, I am unable to continue this call right now. Please try again in a moment.",
      endCall: true,
      state: "needs_review",
      status: "needs_review",
    });
    return NextResponse.json(fallback);
  }
}

