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
  };
};

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

function latestUserText(body: VapiToolRequest, args: Record<string, unknown>) {
  if (typeof args.transcript === "string" && args.transcript.trim()) return args.transcript;
  const messages = body.message?.artifact?.messages ?? [];
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  return lastUser?.message ?? lastUser?.content ?? body.message?.artifact?.transcript ?? "";
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
      const result = await processIntakeTurn(intakeStore, {
        callId,
        assistantId: body.message?.call?.assistantId ?? null,
        patientPhone: body.message?.call?.customer?.number ?? null,
        transcript: latestUserText(body, args),
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
