#!/usr/bin/env node
// Idempotently create or update the labels defined in labels.json. Existing
// labels with the same name get color/description patched.

import { readFile } from 'node:fs/promises';
import { gh, GhError } from './lib.mjs';

const { GITHUB_TOKEN, REPO } = process.env;
if (!GITHUB_TOKEN || !REPO) {
  console.error('::error::Missing GITHUB_TOKEN or REPO env.');
  process.exit(1);
}

// Fail fast on a typo in REPO instead of getting confusing per-label 404s.
try {
  await gh({ token: GITHUB_TOKEN, path: `/repos/${REPO}` });
} catch (err) {
  console.error(`::error::Repo ${REPO} not accessible: ${err.message}`);
  process.exit(1);
}

const labels = JSON.parse(await readFile(new URL('./labels.json', import.meta.url), 'utf8'));
const result = { created: [], updated: [], failed: [] };

for (const label of labels) {
  try {
    const existing = await gh({
      token: GITHUB_TOKEN,
      path: `/repos/${REPO}/labels/${encodeURIComponent(label.name)}`,
      allowedStatuses: [200, 404],
    });
    if (existing.status === 200) {
      await gh({
        token: GITHUB_TOKEN,
        path: `/repos/${REPO}/labels/${encodeURIComponent(label.name)}`,
        init: {
          method: 'PATCH',
          body: JSON.stringify({ new_name: label.name, color: label.color, description: label.description }),
        },
      });
      result.updated.push(label.name);
      console.log(`updated: ${label.name}`);
    } else {
      await gh({
        token: GITHUB_TOKEN,
        path: `/repos/${REPO}/labels`,
        init: { method: 'POST', body: JSON.stringify(label) },
      });
      result.created.push(label.name);
      console.log(`created: ${label.name}`);
    }
  } catch (err) {
    result.failed.push({ name: label.name, error: err instanceof GhError ? `${err.status} ${err.message}` : String(err) });
    console.error(`::error::failed ${label.name}: ${err.message}`);
  }
}

console.log(`\nSummary: ${result.created.length} created, ${result.updated.length} updated, ${result.failed.length} failed`);
if (result.failed.length) {
  console.error('Failed labels:', JSON.stringify(result.failed, null, 2));
  process.exit(1);
}
