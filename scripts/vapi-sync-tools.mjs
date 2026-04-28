console.error(
  "[vapi:sync-tools] Not implemented yet. This script will be added in Part 2 (Vapi Integration & Orchestrator).",
);
process.exit(1);

import path from 'node:path';
import {
  VAPI_API_BASE_URL,
  requireEnv,
  vapiFetchJson,
  listJsonFiles,
  readJson,
} from './vapi-lib.mjs';

async function main() {
  const apiKey = requireEnv('VAPI_API_KEY');
  const dir = path.resolve(process.cwd(), 'vapi/tools');
  const dryRun = process.argv.includes('--dry-run');

  const files = await listJsonFiles(dir);
  if (files.length === 0) {
    process.stdout.write(`No tool JSON files in ${path.relative(process.cwd(), dir)}\n`);
    return;
  }

  for (const filePath of files) {
    const tool = await readJson(filePath);
    const id = tool?.id;
    const name = path.basename(filePath);

    if (id) {
      // Update existing tool
      const { id: _, orgId: _o, createdAt: _c, updatedAt: _u, ...patch } = tool;
      if (dryRun) {
        process.stdout.write(`DRY RUN: would PATCH tool ${id}\n`);
        continue;
      }
      await vapiFetchJson(`${VAPI_API_BASE_URL}/tool/${id}`, {
        method: 'PATCH',
        apiKey,
        body: patch,
      });
      process.stdout.write(`Updated tool ${id} from ${name}\n`);
    } else {
      // Create new tool
      if (dryRun) {
        process.stdout.write(`DRY RUN: would POST new tool from ${name}\n`);
        continue;
      }
      const created = await vapiFetchJson(`${VAPI_API_BASE_URL}/tool`, {
        method: 'POST',
        apiKey,
        body: tool,
      });
      process.stdout.write(`Created tool ${created?.id} from ${name}\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import path from 'node:path';

import {
  requireEnv,
  listJsonFiles,
  readJson,
  stableStringify,
} from './vapi-lib.mjs';

/**
 * Minimal tool-sync script.
 *
 * This repo keeps tool definitions in `vapi/tools/*.json`.
 * Vapi’s tool APIs and per-assistant wiring can vary; rather than guessing your
 * exact org setup, this script validates the JSON and supports `--dry-run`.
 *
 * If you later decide how you want tools pushed (org-global vs assistant-scoped),
 * we can extend this to call the proper Vapi endpoint(s) using `vapiFetchJson`.
 */
async function main() {
  // Ensure env is present (consistent with other scripts).
  // Not used yet, but keeps UX consistent and prevents accidental “worked” runs without auth.
  requireEnv('VAPI_API_KEY');

  const dir = path.resolve(process.cwd(), 'vapi/tools');
  const dryRun = process.argv.includes('--dry-run');

  const files = await listJsonFiles(dir);
  if (files.length === 0) {
    process.stdout.write(
      `No tool JSON files found in ${path.relative(process.cwd(), dir)}\n`
    );
    return;
  }

  for (const filePath of files) {
    const tool = await readJson(filePath);
    const name = tool?.name ?? path.basename(filePath);

    if (dryRun) {
      process.stdout.write(
        `DRY RUN: validated tool ${name} from ${path.basename(filePath)}\n`
      );
      continue;
    }

    // For now, we just print the canonical JSON so you can paste/import it into Vapi.
    // (No API call until we confirm your desired tool wiring.)
    process.stdout.write(
      `Tool ${name} (${path.basename(filePath)}):\n${stableStringify(tool)}\n`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

