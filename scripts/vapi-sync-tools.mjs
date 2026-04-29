import path from "node:path";

import {
  VAPI_API_BASE_URL,
  listJsonFiles,
  readJson,
  requireEnv,
  stableStringify,
  vapiFetchJson,
  writeJson,
} from "./vapi-lib.mjs";

function stripToolForWrite(tool) {
  const { id: _id, orgId: _orgId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = tool;
  return rest;
}

async function main() {
  const apiKey = requireEnv("VAPI_API_KEY");
  const dir = path.resolve(process.cwd(), "vapi/tools");
  const dryRun = process.argv.includes("--dry-run");
  const files = await listJsonFiles(dir);

  if (files.length === 0) {
    process.stdout.write(`No tool JSON files found in ${path.relative(process.cwd(), dir)}\n`);
    return;
  }

  for (const filePath of files) {
    const tool = await readJson(filePath);
    const filename = path.basename(filePath);
    const body = stripToolForWrite(tool);
    // PATCH rejects immutable top-level fields on some deployments.
    if (tool.id) delete body.type;

    if (tool.id) {
      if (dryRun) {
        process.stdout.write(`DRY RUN: PATCH /tool/${tool.id} from ${filename}\n${stableStringify(body)}`);
        continue;
      }

      const updated = await vapiFetchJson(`${VAPI_API_BASE_URL}/tool/${tool.id}`, {
        method: "PATCH",
        apiKey,
        body,
      });
      await writeJson(filePath, updated);
      process.stdout.write(`Updated tool ${tool.id} from ${filename}\n`);
      continue;
    }

    if (dryRun) {
      process.stdout.write(`DRY RUN: POST /tool from ${filename}\n${stableStringify(body)}`);
      continue;
    }

    const created = await vapiFetchJson(`${VAPI_API_BASE_URL}/tool`, {
      method: "POST",
      apiKey,
      body,
    });
    await writeJson(filePath, created);
    process.stdout.write(`Created tool ${created.id} from ${filename}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
