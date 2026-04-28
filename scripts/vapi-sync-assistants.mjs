import path from 'node:path';

import {
  VAPI_API_BASE_URL,
  requireEnv,
  vapiFetchJson,
  listJsonFiles,
  readJson,
  stripAssistantForPatch,
} from './vapi-lib.mjs';

async function main() {
  const apiKey = requireEnv('VAPI_API_KEY');
  const dir = path.resolve(process.cwd(), 'vapi/assistants');
  const dryRun = process.argv.includes('--dry-run');

  const files = await listJsonFiles(dir);
  if (files.length === 0) {
    process.stdout.write(
      `No assistant JSON files found in ${path.relative(process.cwd(), dir)}\n`
    );
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const filePath of files) {
    const assistant = await readJson(filePath);
    const id = assistant?.id;

    if (!id) {
      skipped++;
      process.stdout.write(
        `Skipping ${path.basename(filePath)} (missing assistant.id)\n`
      );
      continue;
    }

    const patch = stripAssistantForPatch(assistant);

    if (dryRun) {
      process.stdout.write(`DRY RUN: would PATCH assistant ${id} from ${path.basename(filePath)}\n`);
      continue;
    }

    try {
      await vapiFetchJson(`${VAPI_API_BASE_URL}/assistant/${id}`, {
        method: 'PATCH',
        apiKey,
        body: patch,
      });

      updated++;
      process.stdout.write(`Updated assistant ${id} from ${path.basename(filePath)}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('404 Not Found')) {
        skipped++;
        process.stdout.write(
          `Skipping ${path.basename(filePath)} (assistant ${id} not found in current org)\n`
        );
        continue;
      }
      throw err;
    }
  }

  if (!dryRun) {
    process.stdout.write(`Done. Updated ${updated} assistant(s). Skipped ${skipped}.\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

