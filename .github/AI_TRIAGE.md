# AI issue triage

This repo runs an automated triage workflow on every new or edited issue. The
workflow uses Anthropic's Claude API to classify the issue and post a single
bot comment with a root-cause hypothesis and suggested next steps.

## What it does

On `issues: opened`, `reopened`, or `edited`:

1. Reads the issue title and body.
2. Calls the configured Claude model (default: `claude-haiku-4-5-20251001`).
3. Applies labels:
   - `priority/P0`–`priority/P3` (one)
   - `area/<name>` (zero to three, from `cli`, `config`, `auth`, `execution`, `reporting`, `tms`, `docs`)
4. Posts (or updates, on later edits) a single comment marked
   `<!-- ai-triage-bot:v1 -->` containing the priority, type, areas, RCA
   hypothesis, and suggested next steps.

The comment is **clearly marked as automated and not human-reviewed**.
Maintainers may relabel issues, edit the comment, or delete it at any time.

## Setup (one-time)

1. Add an `ANTHROPIC_API_KEY` repository secret
   (`Settings → Secrets and variables → Actions → Repository secrets`).
2. (Optional) Add an `ANTHROPIC_TRIAGE_MODEL` repository **variable** to
   override the default model — for example `claude-sonnet-4-6` for higher-
   quality RCA, or any other current Claude model id.
3. Run the **Bootstrap triage labels** workflow once
   (`Actions → Bootstrap triage labels → Run workflow`) to create the
   `priority/*`, `area/*`, and `no-triage` labels.
4. (Optional) Run **AI Issue Triage (Backfill)** once to triage every
   existing open issue. The per-issue workflow only fires on
   `opened`/`reopened`/`edited`, so issues opened before this workflow
   was added need this one-shot backfill.

## Backfilling existing issues

`Actions → AI Issue Triage (Backfill) → Run workflow` accepts:

- `state` — `open` (default), `closed`, or `all`.
- `only_unlabeled` — when `true` (default), skips issues that already
  have a `priority/*` label. Set to `false` to force re-triage.
- `limit` — max issues to process per run (1–500, default 100).
- `dry_run` — when `true`, prints classifications to the workflow log
  without commenting or labeling. Useful for previewing.

Issues labeled `no-triage` are always skipped. The backfill processes
issues sequentially and prints a summary line at the end.

## Opt-out

Add the `no-triage` label to any issue to skip the workflow. Re-running on
edits will respect the label and not re-comment.

## How it stays idempotent

Each bot comment carries the marker `<!-- ai-triage-bot:v1 -->`. On re-runs
(issue body edits) the workflow finds the existing comment and updates it in
place, and reconciles `priority/*` and `area/*` labels to match the latest
classification.

## Reporting bot mistakes

Comment on the issue describing the misclassification — a maintainer will
correct the label and may delete or override the bot comment. The `no-triage`
label prevents further automated changes.

## Cost

Default model `claude-haiku-4-5-20251001` runs at roughly fractions of a cent
per issue; the system prompt is cached on Anthropic's side to minimise
repeated cost. Concurrency is keyed per issue and the workflow has a 5-minute
timeout.
