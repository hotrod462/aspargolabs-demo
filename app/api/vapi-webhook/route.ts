import { NextResponse } from 'next/server';

/** Fires when the call ends; structured JSON may not be ready yet (race). */
const EVENT_END_CALL_REPORT = "end-of-call-report";
/** Fires slightly later so structured data is more likely to be present. */
const EVENT_CALL_ANALYSIS_COMPLETED = "call.analysis.completed";

const INTAKE_WEBHOOK_EVENTS = new Set([EVENT_END_CALL_REPORT, EVENT_CALL_ANALYSIS_COMPLETED]);

type StructuredOutputsValue = { result?: Record<string, unknown> };
type VapiMessage = {
  type?: string;
  artifact?: {
    structuredData?: Record<string, unknown>;
    structuredOutputs?: Record<string, StructuredOutputsValue>;
  };
  analysis?: { structuredData?: Record<string, unknown> };
};

/**
 * Vapi: prefer `artifact.structuredData` (current), then legacy `analysis.structuredData`,
 * then Structured Outputs (`artifact.structuredOutputs[*].result` merged).
 */
function extractStructuredData(
  message: VapiMessage | undefined
): { data: Record<string, unknown>; source: string } | null {
  if (!message) return null;

  const a = message.artifact?.structuredData;
  if (a && typeof a === "object" && !Array.isArray(a) && Object.keys(a).length > 0) {
    return { data: a, source: "artifact.structuredData" };
  }

  const legacy = message.analysis?.structuredData;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy) && Object.keys(legacy).length > 0) {
    return { data: legacy, source: "analysis.structuredData" };
  }

  const outputs = message.artifact?.structuredOutputs;
  if (outputs && typeof outputs === "object") {
    const merged: Record<string, unknown> = {};
    for (const v of Object.values(outputs)) {
      if (v?.result && typeof v.result === "object" && v.result !== null && !Array.isArray(v.result)) {
        Object.assign(merged, v.result);
      }
    }
    if (Object.keys(merged).length > 0) {
      return { data: merged, source: "artifact.structuredOutputs[*].result" };
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: VapiMessage; type?: string };

    // Event name: Vapi uses `message.type` (see Vapi server URL / webhook docs)
    const eventName =
      body.message?.type ?? (body as { type?: string }).type ?? "unknown";
    // Full body can be large and may include PII/PHI (transcript, etc.)—trim or turn off in production if needed
    console.log("[vapi-webhook] event:", eventName);
    console.log("[vapi-webhook] payload:", JSON.stringify(body));

    if (!INTAKE_WEBHOOK_EVENTS.has(eventName)) {
      return NextResponse.json({ received: true, type: body.message?.type });
    }

    const extracted = extractStructuredData(body.message);

    if (!extracted) {
      const artifact = body.message?.artifact;
      console.warn(
        "[vapi-webhook] No structured data yet. Checked: artifact.structuredData, analysis.structuredData, artifact.structuredOutputs[].result.",
        "artifact keys:",
        artifact && typeof artifact === "object" ? Object.keys(artifact) : "n/a"
      );
      if (eventName === EVENT_END_CALL_REPORT) {
        console.warn(
          "[vapi-webhook] If this was end-of-call-report, the payload may have arrived before the LLM finished (race). A later",
          EVENT_CALL_ANALYSIS_COMPLETED,
          "webhook may contain the data. Ensure Structured Outputs is ON for the assistant."
        );
      }
      return NextResponse.json(
        { received: true, note: "No structured data", event: eventName },
        { status: 200 }
      );
    }

    console.log("[vapi-webhook] using structured data from", extracted.source);

    const structuredData = extracted.data;

    // Helper function to safely join arrays to strings for Airtable
    const formatArray = (arr: unknown) => {
      if (Array.isArray(arr) && arr.length > 0) return arr.join(", ");
      if (typeof arr === "string" && arr.trim() !== "") return arr;
      return "None";
    };

    // Prepare the payload strictly matching your Airtable columns
    const airtablePayload = {
      records: [
        {
          fields: {
            "ED Symptoms": Boolean(structuredData.ed_symptoms),
            "Nitrates/Poppers": Boolean(structuredData.uses_nitrates_or_poppers),
            "Recent Cardio Event": Boolean(structuredData.recent_cardio_event),
            "Chest Pain/SOB": Boolean(structuredData.chest_pain_or_shortness_of_breath),
            "High BP/Alpha Blockers": Boolean(structuredData.high_bp_or_alpha_blockers),
            "Recent Normal BP": Boolean(structuredData.recent_normal_bp),
            "Severe Conditions": Boolean(structuredData.severe_conditions),
            "Penile Conditions": Boolean(structuredData.penile_conditions),
            "Blood Conditions": Boolean(structuredData.blood_conditions),
            Allergies: formatArray(structuredData.allergies),
            "Other Medications": formatArray(structuredData.other_medications),
            // Optional: If Vapi captures the caller's phone number, you can map it here
            // "Phone Number": (body.message as { call?: { customer?: { number?: string } } })?.call?.customer?.number || "Unknown"
          },
        },
      ],
    };

    // Push to Airtable via their REST API
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Patient%20Intake`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(airtablePayload),
      }
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error("Airtable insertion failed:", errorText);
      return NextResponse.json(
        { error: "Failed to push to Airtable" },
        { status: 500 }
      );
    }

    console.log("Successfully pushed patient intake to Airtable! event:", eventName);
    return NextResponse.json({ success: true, event: eventName, source: extracted.source });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
