import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const VAPI_API_BASE_URL = process.env.VAPI_API_BASE_URL ?? 'https://api.vapi.ai';

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(v).trim();
}

export function getAuthHeaderValue(apiKey) {
  const trimmed = String(apiKey).trim();
  return trimmed.toLowerCase().startsWith('bearer ') ? trimmed : `Bearer ${trimmed}`;
}

export async function vapiFetchJson(url, { method = 'GET', apiKey, body } = {}) {
  const headers = {
    Authorization: getAuthHeaderValue(apiKey),
  };

  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Vapi API ${method} ${url} failed: ${res.status} ${res.statusText}\n` +
        (text ? `Body: ${text.slice(0, 4000)}` : '')
    );
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function stableStringify(value) {
  const seen = new WeakSet();
  const sorter = (k, v) => {
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return v;
    seen.add(v);

    if (Array.isArray(v)) return v.map((x) => x);
    return Object.keys(v)
      .sort()
      .reduce((acc, key) => {
        acc[key] = v[key];
        return acc;
      }, {});
  };

  return JSON.stringify(value, sorter, 2) + '\n';
}

export function safeFilename(input) {
  const base = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'assistant';
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, stableStringify(data), 'utf8');
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function listJsonFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json') && e.name !== 'index.json')
    .map((e) => path.join(dirPath, e.name))
    .sort();
}

export function stripAssistantForPatch(assistant) {
  if (!assistant || typeof assistant !== 'object') return assistant;

  // Keep `id` separately for URL construction; do not send it in body.
  // Remove common server-managed fields defensively.
  const {
    id: _id,
    orgId: _orgId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = assistant;

  return rest;
}

