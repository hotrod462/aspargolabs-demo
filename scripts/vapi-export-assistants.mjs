import path from 'node:path';

import {
  VAPI_API_BASE_URL,
  requireEnv,
  vapiFetchJson,
  safeFilename,
  writeJson,
} from './vapi-lib.mjs';

async function main() {
  const apiKey = requireEnv('VAPI_API_KEY');
  const outDir = path.resolve(process.cwd(), 'vapi/assistants');

  const assistants = await vapiFetchJson(`${VAPI_API_BASE_URL}/assistant?limit=100`, {
    apiKey,
  });

  if (!Array.isArray(assistants)) {
    throw new Error(
      `Unexpected response from list assistants. Expected array, got: ${typeof assistants}`
    );
  }

  const index = [];

  for (const a of assistants) {
    const id = a?.id;
    if (!id) continue;

    const full = await vapiFetchJson(`${VAPI_API_BASE_URL}/assistant/${id}`, { apiKey });
    const name = full?.name ?? a?.name ?? id;
    const filename = `${safeFilename(name)}__${id}.json`;
    await writeJson(path.join(outDir, filename), full);

    index.push({
      id,
      name: full?.name ?? null,
      filename,
      updatedAt: full?.updatedAt ?? a?.updatedAt ?? null,
      createdAt: full?.createdAt ?? a?.createdAt ?? null,
    });
  }

  index.sort((x, y) => String(x.name ?? x.id).localeCompare(String(y.name ?? y.id)));
  await writeJson(path.join(outDir, 'index.json'), {
    exportedAt: new Date().toISOString(),
    count: index.length,
    assistants: index,
  });

  process.stdout.write(
    `Exported ${index.length} assistant(s) to ${path.relative(process.cwd(), outDir)}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

