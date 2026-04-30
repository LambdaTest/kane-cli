#!/usr/bin/env node
// Backfill entry point — invoked by .github/workflows/triage-backfill.yml.
// Lists issues and runs lib.mjs::triageIssue on each. Always sequential
// (one issue at a time) for predictable rate-limit behaviour and readable logs.
//
// Inputs (env vars, set by the workflow from workflow_dispatch inputs):
//   STATE             "open" | "closed" | "all"   default "open"
//   ONLY_UNLABELED    "true" | "false"            default "true"  — skip issues that already have a `priority/*` label
//   LIMIT             number                      default 100
//   DRY_RUN           "true" | "false"            default "false"

import { gh, triageIssue } from './lib.mjs';

const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001',
  GITHUB_TOKEN,
  REPO,
  STATE = 'open',
  ONLY_UNLABELED = 'true',
  LIMIT = '100',
  DRY_RUN = 'false',
} = process.env;

if (!ANTHROPIC_API_KEY) {
  console.error('::error::ANTHROPIC_API_KEY not set.');
  process.exit(1);
}
if (!GITHUB_TOKEN || !REPO) {
  console.error('Missing required GitHub env (GITHUB_TOKEN/REPO).');
  process.exit(1);
}

const onlyUnlabeled = ONLY_UNLABELED === 'true';
const dryRun = DRY_RUN === 'true';
const limit = Math.max(1, Math.min(500, Number(LIMIT) || 100));

console.log(
  `Backfill: repo=${REPO} state=${STATE} only_unlabeled=${onlyUnlabeled} limit=${limit} dry_run=${dryRun} model=${ANTHROPIC_MODEL}`,
);

async function listIssues() {
  const out = [];
  let page = 1;
  while (out.length < limit) {
    const batch = await gh({
      token: GITHUB_TOKEN,
      path: `/repos/${REPO}/issues?state=${STATE}&per_page=100&page=${page}`,
    });
    for (const it of batch) {
      // GitHub returns PRs in the issues endpoint too; skip them.
      if (it.pull_request) continue;
      out.push(it);
      if (out.length >= limit) break;
    }
    if (batch.length < 100) break;
    page += 1;
  }
  return out;
}

const issues = await listIssues();
console.log(`Fetched ${issues.length} issues.`);

const summary = { triaged: 0, skipped_no_triage: 0, skipped_already_labeled: 0, errors: 0 };

for (const issue of issues) {
  const labels = issue.labels.map((l) => l.name);
  const hasPriority = labels.some((n) => n.startsWith('priority/'));
  const number = issue.number;
  const tag = `#${number} "${(issue.title || '').slice(0, 60)}"`;

  if (labels.includes('no-triage')) {
    console.log(`SKIP (no-triage)   ${tag}`);
    summary.skipped_no_triage += 1;
    continue;
  }
  if (onlyUnlabeled && hasPriority) {
    console.log(`SKIP (has priority/*) ${tag}`);
    summary.skipped_already_labeled += 1;
    continue;
  }

  try {
    const { action, result } = await triageIssue({
      token: GITHUB_TOKEN,
      apiKey: ANTHROPIC_API_KEY,
      model: ANTHROPIC_MODEL,
      repo: REPO,
      issue: {
        number,
        title: issue.title || '',
        body: issue.body || '',
        author: issue.user?.login || '',
        labels,
      },
      dryRun,
    });
    summary.triaged += 1;
    const tag2 = result
      ? `priority=${result.priority} areas=[${result.areas.join(',')}] type=${result.type}`
      : '';
    console.log(`OK (${action})    ${tag} ${tag2}`);
  } catch (err) {
    summary.errors += 1;
    console.error(`ERROR             ${tag}: ${err.message}`);
  }
}

console.log('\nBackfill summary:', JSON.stringify(summary, null, 2));
if (summary.errors > 0) process.exit(1);
