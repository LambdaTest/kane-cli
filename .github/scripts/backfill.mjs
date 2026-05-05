#!/usr/bin/env node
// Backfill entry point — invoked by .github/workflows/triage-backfill.yml.
// Lists issues and runs lib.mjs::triageIssue on each. Sequential to keep
// rate-limit behaviour predictable.
//
// Auth failures (401/403 from Anthropic) abort the loop immediately rather
// than burning quota retrying for every issue.
//
// Inputs (env vars, set by the workflow from workflow_dispatch inputs):
//   STATE             "open" | "closed" | "all"   default "open"
//   ONLY_UNLABELED    "true" | "false"            default "true"  — skip issues that already have a `priority/*` label
//   LIMIT             number                      default 100
//   DRY_RUN           "true" | "false"            default "false"
//   FORCE_RELABEL     "true" | "false"            default "false" — overwrite human-applied priority/area labels (destructive)

import { AnthropicError, DEFAULT_MODEL, SchemaError, gh, safeLog, triageIssue } from './lib.mjs';

const {
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  REPO,
} = process.env;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
const STATE = process.env.STATE || 'open';
const ONLY_UNLABELED = process.env.ONLY_UNLABELED || 'true';
const LIMIT = process.env.LIMIT || '100';
const DRY_RUN = process.env.DRY_RUN || 'false';
const FORCE_RELABEL = process.env.FORCE_RELABEL || 'false';

if (!ANTHROPIC_API_KEY) {
  console.error('::error::ANTHROPIC_API_KEY not set.');
  process.exit(1);
}
if (!GITHUB_TOKEN || !REPO) {
  console.error('::error::Missing required GitHub env (GITHUB_TOKEN/REPO).');
  process.exit(1);
}

const onlyUnlabeled = ONLY_UNLABELED === 'true';
const dryRun = DRY_RUN === 'true';
const forceRelabel = FORCE_RELABEL === 'true';
const limit = Math.max(1, Math.min(500, Number(LIMIT) || 100));

console.log(
  `Backfill: repo=${REPO} state=${STATE} only_unlabeled=${onlyUnlabeled} limit=${limit} dry_run=${dryRun} force_relabel=${forceRelabel} model=${ANTHROPIC_MODEL}`,
);
if (forceRelabel && !dryRun) {
  console.warn('::warning::force_relabel=true — bot WILL overwrite human-applied priority/area labels on triaged issues.');
}

async function listIssues() {
  // Stable ordering with sort=created+asc so the page boundary doesn't
  // shift if an issue is edited mid-scan.
  const out = [];
  let page = 1;
  while (out.length < limit) {
    const batch = await gh({
      token: GITHUB_TOKEN,
      path: `/repos/${REPO}/issues?state=${STATE}&sort=created&direction=asc&per_page=100&page=${page}`,
    });
    for (const it of batch) {
      if (it.pull_request) continue; // issues endpoint also returns PRs
      out.push(it);
      if (out.length >= limit) break;
    }
    if (batch.length < 100) break;
    if (page >= 50) {
      console.warn('::warning::Backfill hit 50-page (5000-issue) hard cap.');
      break;
    }
    page += 1;
  }
  return out;
}

const issues = await listIssues();
console.log(`Fetched ${issues.length} issues.`);

const summary = {
  triaged_ok: 0,
  triaged_failed: 0,
  needs_info: 0,
  skipped_no_triage: 0,
  skipped_already_labeled: 0,
  errors_other: 0,
  aborted_at: null,
};

for (const issue of issues) {
  const labels = (issue.labels || []).map((l) => l.name);
  const hasPriority = labels.some((n) => n.startsWith('priority/'));
  const number = issue.number;
  const tag = `#${number} "${(issue.title || '').slice(0, 60)}"`;

  if (labels.includes('no-triage')) {
    console.log(`SKIP (no-triage)        ${tag}`);
    summary.skipped_no_triage += 1;
    continue;
  }
  if (onlyUnlabeled && hasPriority && !forceRelabel) {
    console.log(`SKIP (has priority/*)   ${tag}`);
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
      forceRelabel,
    });
    if (action.startsWith('needs-info')) {
      summary.needs_info += 1;
      console.log(`NEEDS-INFO              ${tag}`);
    } else {
      summary.triaged_ok += 1;
      const tag2 = result && result.priority
        ? `priority=${result.priority} areas=[${(result.areas || []).join(',')}] type=${result.type}`
        : '';
      console.log(`OK (${action.padEnd(16)}) ${tag} ${tag2}`);
    }
  } catch (err) {
    const tagMsg = err instanceof Error ? err.message : String(err);
    if (err instanceof AnthropicError && err.fatal) {
      console.error(`::error::Fatal Anthropic error on ${tag}: ${tagMsg}`);
      console.error('::error::Aborting backfill — check ANTHROPIC_API_KEY secret.');
      summary.aborted_at = number;
      break;
    }
    if (err instanceof SchemaError) {
      summary.triaged_failed += 1;
      console.error(`SCHEMA-FAIL             ${tag}: ${tagMsg}`);
      continue;
    }
    summary.errors_other += 1;
    console.error(`ERROR                   ${tag}: ${tagMsg}`);
  }
}

console.log('\nBackfill summary:');
safeLog('summary:', summary);

if (issues.length === 0) {
  console.log('::warning::No issues matched the filter.');
}
const meaningful = summary.triaged_ok + summary.triaged_failed + summary.needs_info + summary.errors_other;
if (issues.length > 0 && meaningful === 0 && (summary.skipped_no_triage + summary.skipped_already_labeled) > 0) {
  console.log('::warning::No issues triaged — all were skipped. Set only_unlabeled=false to re-triage.');
}
if (summary.aborted_at !== null || summary.errors_other > 0 || summary.triaged_failed > 0) {
  process.exit(1);
}
