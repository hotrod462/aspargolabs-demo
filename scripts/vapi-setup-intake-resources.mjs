import path from "node:path";

import {
  VAPI_API_BASE_URL,
  readJson,
  requireEnv,
  stableStringify,
  stripAssistantForPatch,
  vapiFetchJson,
  writeJson,
} from "./vapi-lib.mjs";

const DEFAULT_ASSISTANT_FILE =
  "vapi/assistants/alex-aspargotest__08c34165-7b51-419f-9873-c54d8c01d4b2.json";
const DEFAULT_TOOL_FILE = "vapi/tools/process-intake-turn.json";
const DEFAULT_STRUCTURED_OUTPUT_FILE = "vapi/structured-outputs/alex-aspargo-intake-output.json";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function isNotFoundError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("404 Not Found");
}

function stripServerFields(value) {
  const { id: _id, orgId: _orgId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = value;
  return rest;
}

function normalizeStructuredOutputForWrite(structuredOutput) {
  return {
    ...structuredOutput,
    schema: {
      ...structuredOutput.schema,
      // Only the chief complaint is mandatory; later answers may be absent if the call ends early.
      required: ["ed_symptoms"],
    },
  };
}

function ensureAssistantId(assistant) {
  const assistantId =
    process.env.VAPI_ASSISTANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ||
    assistant.id;

  if (!assistantId) {
    throw new Error(
      "Missing assistant id. Set VAPI_ASSISTANT_ID/NEXT_PUBLIC_VAPI_ASSISTANT_ID or add id to the assistant JSON."
    );
  }

  return assistantId;
}

async function upsertTool({ apiKey, tool, filePath, dryRun }) {
  const createBody = stripServerFields(tool);
  const patchBody = { ...createBody };
  delete patchBody.type;

  if (tool.id) {
    if (dryRun) {
      process.stdout.write(`DRY RUN: PATCH /tool/${tool.id} from ${path.basename(filePath)}\n`);
      return tool;
    }

    try {
      const updated = await vapiFetchJson(`${VAPI_API_BASE_URL}/tool/${tool.id}`, {
        method: "PATCH",
        apiKey,
        body: patchBody,
      });
      await writeJson(filePath, updated);
      process.stdout.write(`Updated tool ${updated.id} from ${path.basename(filePath)}\n`);
      return updated;
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      process.stdout.write(`Tool ${tool.id} not found in current org; creating a new tool.\n`);
    }
  }

  if (dryRun) {
    process.stdout.write(`DRY RUN: POST /tool from ${path.basename(filePath)}\n${stableStringify(createBody)}`);
    return tool;
  }

  const created = await vapiFetchJson(`${VAPI_API_BASE_URL}/tool`, {
    method: "POST",
    apiKey,
    body: createBody,
  });
  await writeJson(filePath, created);
  process.stdout.write(`Created tool ${created.id} from ${path.basename(filePath)}\n`);
  return created;
}

async function upsertStructuredOutput({ apiKey, structuredOutput, filePath, assistantId, dryRun }) {
  const normalizedStructuredOutput = normalizeStructuredOutputForWrite(structuredOutput);
  const body = {
    ...stripServerFields(normalizedStructuredOutput),
    assistantIds: [assistantId],
  };

  if (structuredOutput.id) {
    if (dryRun) {
      process.stdout.write(
        `DRY RUN: PATCH /structured-output/${structuredOutput.id} from ${path.basename(filePath)}\n`
      );
      return { ...normalizedStructuredOutput, assistantIds: [assistantId] };
    }

    try {
      const updated = await vapiFetchJson(
        `${VAPI_API_BASE_URL}/structured-output/${structuredOutput.id}?schemaOverride=true`,
        {
          method: "PATCH",
          apiKey,
          body,
        }
      );
      await writeJson(filePath, updated);
      process.stdout.write(`Updated structured output ${updated.id} from ${path.basename(filePath)}\n`);
      return updated;
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      process.stdout.write(
        `Structured output ${structuredOutput.id} not found in current org; creating a new structured output.\n`
      );
    }
  }

  if (dryRun) {
    process.stdout.write(
      `DRY RUN: POST /structured-output from ${path.basename(filePath)}\n${stableStringify(body)}`
    );
    return { ...normalizedStructuredOutput, assistantIds: [assistantId] };
  }

  const created = await vapiFetchJson(`${VAPI_API_BASE_URL}/structured-output`, {
    method: "POST",
    apiKey,
    body,
  });
  await writeJson(filePath, created);
  process.stdout.write(`Created structured output ${created.id} from ${path.basename(filePath)}\n`);
  return created;
}

async function syncAssistantArtifactPlanOnly({
  apiKey,
  assistant,
  filePath,
  assistantId,
  structuredOutputId,
  orgId,
  dryRun,
}) {
  const updatedAssistant = {
    ...assistant,
    id: assistantId,
    orgId: orgId ?? assistant.orgId,
    artifactPlan: {
      ...(assistant.artifactPlan ?? {}),
      structuredOutputIds: [structuredOutputId],
    },
  };

  if (dryRun) {
    process.stdout.write(
      `DRY RUN: update ${path.basename(filePath)} with structured output ${structuredOutputId} (artifactPlan only)\n`
    );
    process.stdout.write(`DRY RUN: PATCH /assistant/${assistantId}\n`);
    return updatedAssistant;
  }

  await writeJson(filePath, updatedAssistant);

  await vapiFetchJson(`${VAPI_API_BASE_URL}/assistant/${assistantId}`, {
    method: "PATCH",
    apiKey,
    body: stripAssistantForPatch(updatedAssistant),
  });
  process.stdout.write(`Updated assistant ${assistantId} with structured output ID(s) on artifactPlan\n`);

  return updatedAssistant;
}

async function syncAssistant({ apiKey, assistant, filePath, assistantId, toolId, structuredOutputId, orgId, dryRun }) {
  const updatedAssistant = {
    ...assistant,
    id: assistantId,
    orgId: orgId ?? assistant.orgId,
    artifactPlan: {
      ...(assistant.artifactPlan ?? {}),
      structuredOutputIds: [structuredOutputId],
    },
    model: {
      ...(assistant.model ?? {}),
      toolIds: [toolId],
    },
  };

  if (dryRun) {
    process.stdout.write(
      `DRY RUN: update ${path.basename(filePath)} with tool ${toolId} and structured output ${structuredOutputId}\n`
    );
    process.stdout.write(`DRY RUN: PATCH /assistant/${assistantId}\n`);
    return updatedAssistant;
  }

  await writeJson(filePath, updatedAssistant);

  await vapiFetchJson(`${VAPI_API_BASE_URL}/assistant/${assistantId}`, {
    method: "PATCH",
    apiKey,
    body: stripAssistantForPatch(updatedAssistant),
  });
  process.stdout.write(`Updated assistant ${assistantId} with intake tool and structured output IDs\n`);

  return updatedAssistant;
}

async function main() {
  const apiKey = requireEnv("VAPI_API_KEY");
  const dryRun = process.argv.includes("--dry-run");
  const structuredOutputOnly =
    process.argv.includes("--structured-output-only") ||
    String(process.env.VAPI_STRUCTURED_OUTPUT_ONLY ?? "").trim() === "1";
  const assistantFile = path.resolve(process.cwd(), argValue("assistant-file", DEFAULT_ASSISTANT_FILE));
  const toolFile = path.resolve(process.cwd(), argValue("tool-file", DEFAULT_TOOL_FILE));
  const structuredOutputFile = path.resolve(
    process.cwd(),
    argValue("structured-output-file", DEFAULT_STRUCTURED_OUTPUT_FILE)
  );

  const assistant = await readJson(assistantFile);
  const structuredOutput = await readJson(structuredOutputFile);
  const assistantId = ensureAssistantId(assistant);

  if (structuredOutputOnly) {
    const upsertedStructuredOutput = await upsertStructuredOutput({
      apiKey,
      structuredOutput,
      filePath: structuredOutputFile,
      assistantId,
      dryRun,
    });

    const orgId = upsertedStructuredOutput.orgId ?? assistant.orgId;

    await syncAssistantArtifactPlanOnly({
      apiKey,
      assistant,
      filePath: assistantFile,
      assistantId,
      structuredOutputId: upsertedStructuredOutput.id,
      orgId,
      dryRun,
    });

    process.stdout.write(`Done. assistant=${assistantId} structuredOutput=${upsertedStructuredOutput.id}\n`);
    return;
  }

  const tool = await readJson(toolFile);

  const upsertedTool = await upsertTool({ apiKey, tool, filePath: toolFile, dryRun });
  const upsertedStructuredOutput = await upsertStructuredOutput({
    apiKey,
    structuredOutput,
    filePath: structuredOutputFile,
    assistantId,
    dryRun,
  });

  const orgId = upsertedTool.orgId ?? upsertedStructuredOutput.orgId ?? assistant.orgId;

  await syncAssistant({
    apiKey,
    assistant,
    filePath: assistantFile,
    assistantId,
    toolId: upsertedTool.id,
    structuredOutputId: upsertedStructuredOutput.id,
    orgId,
    dryRun,
  });

  process.stdout.write(
    `Done. assistant=${assistantId} tool=${upsertedTool.id} structuredOutput=${upsertedStructuredOutput.id}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
