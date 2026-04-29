import { NextResponse } from "next/server";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

const FINAL_EVENTS = new Set(["end-of-call-report", "call.analysis.completed"]);

type StructuredOutputsValue = { result?: Record<string, unknown> };

type VapiMessage = {
  type?: string;
  call?: { id?: string; customer?: { number?: string } };
  artifact?: {
    structuredData?: Record<string, unknown>;
    structuredOutputs?: Record<string, StructuredOutputsValue>;
  };
  analysis?: { structuredData?: Record<string, unknown> };
};

function extractStructuredData(message: VapiMessage | undefined) {
  if (!message) return { data: {} as Record<string, unknown>, source: "none" };

  if (message.artifact?.structuredData && Object.keys(message.artifact.structuredData).length) {
    return { data: message.artifact.structuredData, source: "artifact.structuredData" };
  }

  if (message.analysis?.structuredData && Object.keys(message.analysis.structuredData).length) {
    return { data: message.analysis.structuredData, source: "analysis.structuredData" };
  }

  const merged: Record<string, unknown> = {};
  for (const output of Object.values(message.artifact?.structuredOutputs ?? {})) {
    if (output.result) Object.assign(merged, output.result);
  }

  return {
    data: merged,
    source: Object.keys(merged).length ? "artifact.structuredOutputs[*].result" : "none",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: VapiMessage; type?: string };
    const message = body.message;
    const eventName = message?.type ?? body.type ?? "unknown";

    if (!FINAL_EVENTS.has(eventName)) {
      return NextResponse.json({ received: true, event: eventName });
    }

    const callId = message?.call?.id;
    if (!callId) {
      return NextResponse.json({ received: true, event: eventName, note: "missing call id" });
    }

    const session = await intakeStore.getSession(callId);
    if (!session) {
      return NextResponse.json({ received: true, event: eventName, note: "no live session found" });
    }

    const extracted = extractStructuredData(message);

    await intakeStore.saveEvent({
      session_id: session.id,
      event_type: "final_reconciliation",
      payload: { eventName, source: extracted.source, structuredOutput: extracted.data },
      idempotency_key: `${eventName}:${callId}`,
    });

    await intakeStore.saveReconciliation({
      session_id: session.id,
      source: extracted.source,
      live_state: session as unknown as Record<string, unknown>,
      structured_output: extracted.data,
      differences: [],
    });

    return NextResponse.json({
      success: true,
      event: eventName,
      source: extracted.source,
    });
  } catch (error) {
    console.error("[vapi-webhook]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
