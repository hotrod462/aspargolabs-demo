import { NextResponse } from "next/server";
import { intakeStore } from "@/lib/storage/supabase-intake-store";

type IntakeFormPayload = {
  edSymptoms?: "almost_never" | "sometimes" | "often" | "almost_every_time";
  usesNitratesOrPoppers?: "yes" | "no";
  recentCardioEvent?: "yes" | "no";
  chestPainOrShortnessOfBreath?: "no" | "mild_on_exertion" | "frequent_or_severe";
  highBpOrAlphaBlockers?: "yes" | "no";
  recentNormalBp?: "normal" | "low" | "high";
  severeConditions?: "yes" | "no";
  penileConditions?: "yes" | "no";
  bloodConditions?: "yes" | "no";
  allergies?: string[];
  otherMedications?: string[];
};

function toBooleanAnswer(value: "yes" | "no" | undefined) {
  if (!value) return null;
  return value === "yes";
}

function toEdSymptomsBoolean(value: IntakeFormPayload["edSymptoms"]) {
  if (!value) return null;
  return true;
}

function toRecentNormalBp(value: IntakeFormPayload["recentNormalBp"]) {
  if (!value) return null;
  if (value === "normal") return true;
  if (value === "low" || value === "high") return false;
  return null;
}

function toChestSymptomsBoolean(value: IntakeFormPayload["chestPainOrShortnessOfBreath"]) {
  if (!value) return null;
  return value !== "no";
}

function toHighBpBoolean(value: IntakeFormPayload["highBpOrAlphaBlockers"]) {
  return toBooleanAnswer(value);
}

function normalizeList(value: string[] | undefined) {
  if (!value?.length) return "None";
  const items = value.map((v) => v.trim()).filter(Boolean);
  if (!items.length || items.includes("none")) return "None";
  return items.join(", ");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntakeFormPayload;
    const submittedAt = new Date().toISOString();
    const callId = `form:${crypto.randomUUID()}`;

    const session = await intakeStore.createSession({
      call_id: callId,
      assistant_id: null,
      patient_phone: null,
      metadata: {
        source: "manual_intake_form",
        submitted_at: submittedAt,
      },
    });

    const normalized = {
      ed_symptoms: toEdSymptomsBoolean(body.edSymptoms),
      ed_symptoms_response: body.edSymptoms ?? "unanswered",
      uses_nitrates_or_poppers: toBooleanAnswer(body.usesNitratesOrPoppers),
      uses_nitrates_or_poppers_response: body.usesNitratesOrPoppers ?? "unanswered",
      recent_cardio_event: toBooleanAnswer(body.recentCardioEvent),
      recent_cardio_event_response: body.recentCardioEvent ?? "unanswered",
      chest_pain_or_shortness_of_breath: toChestSymptomsBoolean(body.chestPainOrShortnessOfBreath),
      chest_pain_or_shortness_of_breath_response:
        body.chestPainOrShortnessOfBreath ?? "unanswered",
      high_bp_or_alpha_blockers: toHighBpBoolean(body.highBpOrAlphaBlockers),
      high_bp_or_alpha_blockers_response: body.highBpOrAlphaBlockers ?? "unanswered",
      recent_normal_bp: toRecentNormalBp(body.recentNormalBp),
      recent_normal_bp_response: body.recentNormalBp ?? "unanswered",
      severe_conditions: toBooleanAnswer(body.severeConditions),
      severe_conditions_response: body.severeConditions ?? "unanswered",
      penile_conditions: toBooleanAnswer(body.penileConditions),
      penile_conditions_response: body.penileConditions ?? "unanswered",
      blood_conditions: toBooleanAnswer(body.bloodConditions),
      blood_conditions_response: body.bloodConditions ?? "unanswered",
      allergies: normalizeList(body.allergies),
      other_medications: normalizeList(body.otherMedications),
    };

    await intakeStore.saveEvent({
      session_id: session.id,
      event_type: "manual_form_submission",
      payload: normalized,
      idempotency_key: `manual_form_submission:${callId}`,
    });

    await intakeStore.saveReconciliation({
      session_id: session.id,
      source: "manual_intake_form",
      live_state: session as unknown as Record<string, unknown>,
      structured_output: normalized,
      differences: [],
    });

    await intakeStore.updateState(session.id, {
      current_state: "completed",
      status: "completed",
      completion_pct: 100,
      ended_at: submittedAt,
      hard_stop_reason: null,
      needs_review: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Intake form submission error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
