#!/usr/bin/env node
// Idempotently create or update the labels defined in .github/scripts/labels.json.
// Existing labels with the same name get their color/description patched.

import { readFile } from 'node:fs/promises';

const { GITHUB_TOKEN, REPO } = process.env;
if (!GITHUB_TOKEN || !REPO) {
  console.error('Missing GITHUB_TOKEN or REPO env.');
  process.exit(1);
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

const labels = JSON.parse(await readFile(new URL('./labels.json', import.meta.url), 'utf8'));

for (const label of labels) {
  const existing = await gh(`/repos/${REPO}/labels/${encodeURIComponent(label.name)}`);
  if (existing.status === 200) {
    const patch = await gh(`/repos/${REPO}/labels/${encodeURIComponent(label.name)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        new_name: label.name,
        color: label.color,
        description: label.description,
      }),
    });
    if (patch.status >= 300) {
      console.error(`PATCH ${label.name} -> ${patch.status}: ${JSON.stringify(patch.body)}`);
      process.exitCode = 1;
    } else {
      console.log(`updated: ${label.name}`);
    }
  } else if (existing.status === 404) {
    const created = await gh(`/repos/${REPO}/labels`, {
      method: 'POST',
      body: JSON.stringify(label),
    });
    if (created.status >= 300) {
      console.error(`POST ${label.name} -> ${created.status}: ${JSON.stringify(created.body)}`);
      process.exitCode = 1;
    } else {
      console.log(`created: ${label.name}`);
    }
  } else {
    console.error(`GET ${label.name} -> ${existing.status}: ${JSON.stringify(existing.body)}`);
    process.exitCode = 1;
  }
}
