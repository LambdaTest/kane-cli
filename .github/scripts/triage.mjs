#!/usr/bin/env node
// Per-issue entry point — invoked by .github/workflows/issue-triage.yml.
// Reads the full issue payload from GITHUB_EVENT_PATH (no env-var fan-out
// for attacker-controlled fields), then delegates to lib.mjs::triageIssue.
//
// Force-relabel is hard-coded to false here. The per-issue trigger is for
// new and edited issues; once a maintainer has touched labels the bot
// must not overwrite them. Force-relabel is only available via the
// backfill workflow with an explicit operator opt-in.

import { readFile } from 'node:fs/promises';
import { AnthropicError, DEFAULT_MODEL, SchemaError, safeLog, triageIssue } from './lib.mjs';

const { ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_EVENT_PATH, REPO } = process.env;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

if (!ANTHROPIC_API_KEY) {
  console.error('::error::ANTHROPIC_API_KEY is not set. Add it as a repository secret to enable AI triage.');
  process.exit(1);
}
if (!GITHUB_TOKEN || !REPO || !GITHUB_EVENT_PATH) {
  console.error('::error::Missing required GitHub env (GITHUB_TOKEN/REPO/GITHUB_EVENT_PATH).');
  process.exit(1);
}

const event = JSON.parse(await readFile(GITHUB_EVENT_PATH, 'utf8'));
const issue = event.issue;
if (!issue) {
  console.error('::error::Event payload has no `issue` field.');
  process.exit(1);
}

const issueArg = {
  number: issue.number,
  title: issue.title || '',
  body: issue.body || '',
  author: issue.user?.login || '',
  labels: (issue.labels || []).map((l) => l.name),
};

try {
  const { result, action, labels } = await triageIssue({
    token: GITHUB_TOKEN,
    apiKey: ANTHROPIC_API_KEY,
    model: ANTHROPIC_MODEL,
    repo: REPO,
    issue: issueArg,
    forceRelabel: false,
  });
  console.log(`Action: ${action}`);
  if (labels) console.log(`Labels applied=${JSON.stringify(labels.applied)} preserved=${JSON.stringify(labels.preserved)}`);
  if (result) safeLog('Triage result:', result);
} catch (err) {
  console.error(`::error::Triage failed for issue #${issueArg.number}: ${err.message}`);
  if (err instanceof AnthropicError && err.fatal) {
    console.error('::error::Fatal Anthropic error — check ANTHROPIC_API_KEY secret.');
  }
  if (err instanceof SchemaError) {
    safeLog('Schema-failed raw:', err.raw);
  }
  console.error(err.stack);
  process.exit(1);
}
