import { NextResponse } from "next/server";

type IntakeFormPayload = {
  edSymptoms?: "yes" | "no";
  usesNitratesOrPoppers?: "yes" | "no";
  recentCardioEvent?: "yes" | "no";
  chestPainOrShortnessOfBreath?: "yes" | "no";
  highBpOrAlphaBlockers?: "yes" | "no";
  recentNormalBp?: "yes" | "no";
  severeConditions?: "yes" | "no";
  penileConditions?: "yes" | "no";
  bloodConditions?: "yes" | "no";
  allergies?: string;
  otherMedications?: string;
};

function toBooleanAnswer(value: "yes" | "no" | undefined) {
  return value === "yes";
}

function normalizeList(value: string | undefined) {
  if (!value?.trim()) return "None";
  const items = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length ? items.join(", ") : "None";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntakeFormPayload;

    const airtablePayload = {
      records: [
        {
          fields: {
            "ED Symptoms": toBooleanAnswer(body.edSymptoms),
            "Nitrates/Poppers": toBooleanAnswer(body.usesNitratesOrPoppers),
            "Recent Cardio Event": toBooleanAnswer(body.recentCardioEvent),
            "Chest Pain/SOB": toBooleanAnswer(body.chestPainOrShortnessOfBreath),
            "High BP/Alpha Blockers": toBooleanAnswer(body.highBpOrAlphaBlockers),
            "Recent Normal BP": toBooleanAnswer(body.recentNormalBp),
            "Severe Conditions": toBooleanAnswer(body.severeConditions),
            "Penile Conditions": toBooleanAnswer(body.penileConditions),
            "Blood Conditions": toBooleanAnswer(body.bloodConditions),
            Allergies: normalizeList(body.allergies),
            "Other Medications": normalizeList(body.otherMedications),
          },
        },
      ],
    };

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
      console.error("Airtable insertion failed for intake-form:", errorText);
      return NextResponse.json({ error: "Failed to push to Airtable" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Intake form submission error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
