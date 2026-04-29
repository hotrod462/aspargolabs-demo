import { NextResponse } from "next/server";
import { processIntakeTurn } from "@/lib/intake/orchestrator";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

type VapiToolCall = {
  id: string;
  name?: string;
  arguments?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  function?: {
    name?: string;
    parameters?: Record<string, unknown>;
  };
};

type VapiToolRequest = {
  message?: {
    type?: string;
    call?: {
      id?: string;
      assistantId?: string;
      customer?: { number?: string };
    };
    toolCallList?: VapiToolCall[];
    toolWithToolCallList?: Array<{ name?: string; toolCall?: VapiToolCall }>;
    artifact?: {
      transcript?: string;
      messages?: Array<{ role?: string; message?: string; content?: string }>;
    };
    assistant?: Record<string, unknown>;
  };
};

const ARTIFACT_LOG_MAX_CHARS = 24_000;

function safeJsonForLog(value: unknown): string {
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= ARTIFACT_LOG_MAX_CHARS) return s;
    return `${s.slice(0, ARTIFACT_LOG_MAX_CHARS)}… [truncated ${s.length - ARTIFACT_LOG_MAX_CHARS} chars]`;
  } catch {
    return String(value);
  }
}

function assistantArtifactPlanSnippet(assistant: unknown): Record<string, unknown> | undefined {
  if (!assistant || typeof assistant !== "object") return undefined;
  const a = assistant as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if ("artifactPlan" in a) out.artifactPlan = a.artifactPlan;
  if ("artifactPlans" in a) out.artifactPlans = a.artifactPlans;
  return Object.keys(out).length ? out : undefined;
}

function transcriptFromArtifactOnly(body: VapiToolRequest): string {
  const artifact = body.message?.artifact;
  if (!artifact) return "";

  const messages = artifact.messages ?? [];
  const lastUser = [...messages]
    .reverse()
    .find((m) => String(m.role ?? "").toLowerCase() === "user");
  const rawTurn = lastUser?.message ?? lastUser?.content;
  if (typeof rawTurn === "string" && rawTurn.trim()) {
    return rawTurn.trim();
  }

  const t = artifact.transcript;
  if (typeof t === "string" && t.trim()) return t.trim();

  return "";
}

function logToolCallArtifactDebug(input: {
  callId?: string;
  toolCallId: string;
  message: VapiToolRequest["message"];
  toolArguments: Record<string, unknown>;
  resolvedTranscript: string;
}): void {
  const assistantSnippet = assistantArtifactPlanSnippet(input.message?.assistant);
  console.log(
    "[vapi-tools] ─── tool call ─── callId=%s toolCallId=%s message.type=%s",
    input.callId ?? "?",
    input.toolCallId,
    input.message?.type ?? "?",
  );
  console.log(
    "[vapi-tools] resolved transcript (artifact only): %s",
    input.resolvedTranscript.length ? JSON.stringify(input.resolvedTranscript) : "(empty)",
  );
  if (assistantSnippet) {
    console.log("[vapi-tools] assistant artifact plan(s) (snippet):\n%s", safeJsonForLog(assistantSnippet));
  } else if (input.message?.assistant) {
    console.log("[vapi-tools] assistant present but no artifactPlan/artifactPlans keys on message.assistant");
  }
  console.log("[vapi-tools] message.artifact:\n%s", safeJsonForLog(input.message?.artifact ?? null));
  console.log("[vapi-tools] tool arguments (ignored for transcript): %s", safeJsonForLog(input.toolArguments));
}

function getToolCalls(body: VapiToolRequest): VapiToolCall[] {
  if (body.message?.toolCallList?.length) return body.message.toolCallList;
  const out: VapiToolCall[] = [];
  for (const item of body.message?.toolWithToolCallList ?? []) {
    const tc = item.toolCall;
    if (!tc) continue;
    const id = tc.id;
    if (typeof id !== "string" || !id) continue;
    out.push({
      ...tc,
      id,
      name: tc.name ?? tc.function?.name ?? item.name,
    });
  }
  return out;
}

function toolArgs(toolCall: VapiToolCall) {
  return toolCall.arguments ?? toolCall.parameters ?? toolCall.function?.parameters ?? {};
}

export async function POST(req: Request) {
  const expectedSecret = process.env.VAPI_TOOL_SERVER_SECRET;
  if (expectedSecret && req.headers.get("x-vapi-secret") !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as VapiToolRequest;
  const callId = body.message?.call?.id;
  const toolCalls = getToolCalls(body);

  if (!callId || toolCalls.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const name = toolCall.name ?? toolCall.function?.name;
      if (name !== "process_intake_turn") {
        return {
          toolCallId: toolCall.id,
          error: `Unsupported tool: ${name ?? "unknown"}`,
        };
      }

      const args = toolArgs(toolCall);
      const transcript = transcriptFromArtifactOnly(body);
      logToolCallArtifactDebug({
        callId,
        toolCallId: toolCall.id,
        message: body.message,
        toolArguments: args,
        resolvedTranscript: transcript,
      });

      const result = await processIntakeTurn(intakeStore, {
        callId,
        assistantId: body.message?.call?.assistantId ?? null,
        patientPhone: body.message?.call?.customer?.number ?? null,
        transcript,
        toolCallId: toolCall.id,
      });

      return {
        toolCallId: toolCall.id,
        result: JSON.stringify(result),
      };
    }),
  );

  return NextResponse.json({ results });
}
