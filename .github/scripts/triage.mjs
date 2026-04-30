#!/usr/bin/env node
// Per-issue entry point — invoked by .github/workflows/issue-triage.yml.
// Reads the current issue from env vars, fetches its labels, and delegates
// to lib.mjs::triageIssue.

import { gh, triageIssue } from './lib.mjs';

const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001',
  GITHUB_TOKEN,
  REPO,
  ISSUE_NUMBER,
  ISSUE_TITLE = '',
  ISSUE_BODY = '',
  ISSUE_AUTHOR = '',
} = process.env;

if (!ANTHROPIC_API_KEY) {
  console.log('::warning::ANTHROPIC_API_KEY not set; skipping AI triage.');
  process.exit(0);
}
if (!GITHUB_TOKEN || !REPO || !ISSUE_NUMBER) {
  console.error('Missing required GitHub env (GITHUB_TOKEN/REPO/ISSUE_NUMBER).');
  process.exit(1);
}

const issueData = await gh({ token: GITHUB_TOKEN, path: `/repos/${REPO}/issues/${ISSUE_NUMBER}` });
const labels = issueData.labels.map((l) => l.name);

const { result, action } = await triageIssue({
  token: GITHUB_TOKEN,
  apiKey: ANTHROPIC_API_KEY,
  model: ANTHROPIC_MODEL,
  repo: REPO,
  issue: {
    number: Number(ISSUE_NUMBER),
    title: ISSUE_TITLE,
    body: ISSUE_BODY,
    author: ISSUE_AUTHOR,
    labels,
  },
});

console.log(`Action: ${action}`);
if (result) console.log('Triage result:', JSON.stringify(result, null, 2));
