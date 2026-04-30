# AI issue triage

This repo runs an automated triage workflow on every new or edited issue.
The workflow uses Anthropic's Claude API to classify the issue and post a
single bot comment with a root-cause hypothesis and suggested next steps.

## What it does

On `issues: opened`, `reopened`, or `edited` (only when title or body
actually changed):

1. Reads the issue title and body via the runner's event payload.
2. If the issue is too short (empty body and a title under ~40 chars), the
   bot applies the `needs-info` label and asks the reporter for more
   detail. No model call is made.
3. Otherwise, calls the configured Claude model
   (default: `claude-haiku-4-5-20251001`) with title and body clamped to
   reasonable bounds.
4. **Validates the model's response strictly.** If priority, type, or
   confidence are missing or out of range, the bot applies the
   `triage-failed` label and posts a failure comment instead of guessing.
5. On a valid response, the bot:
   - Applies `priority/<P0..P3>` and 1–3 `area/*` labels — but only if no
     human-applied `priority/*` or `area/*` already exists. See
     [Label ownership](#label-ownership) below.
   - Posts a single comment marked `<!-- ai-triage-bot:v1 -->` containing
     the priority, type, areas, RCA hypothesis, and next steps.

The comment is **clearly marked as automated and not human-reviewed**.
Maintainers may relabel issues, edit the comment, or delete it at any
time.

## Label ownership

The bot is assistive, not authoritative. The bot tracks **the labels it
last applied** by embedding them in the marker comment as
`<!-- ai-triage-applied: priority/Pn,area/x -->`. On every re-run the
workflow re-fetches the issue's current labels and compares them with
what the bot last applied:

- **Bot can refresh its own classification.** If the issue's
  `priority/*` and `area/*` labels exactly match what the bot last
  applied, the bot is free to update them when the model's
  classification changes (e.g. reporter added repro detail that bumps
  priority).
- **Human-touched labels are preserved.** If a maintainer has changed a
  `priority/*` or `area/*` label since the bot last wrote, the labels
  no longer match the bot's recorded set, and the bot will **not**
  overwrite them. The comment body still updates with the latest RCA,
  so RCA stays fresh even when labels are frozen.
- **The comment marker stays frozen on preservation.** When the bot
  preserves human labels, the `ai-triage-applied` marker is left at the
  bot's last-written set — not the current human-touched set — so the
  bot keeps recognising the human's labels as not-its-own on later runs.
- **Stale `triage-failed` / `needs-info` markers** are bot-owned and
  cleared on a successful classification.
- **Label state is re-fetched immediately before mutation**, so a
  maintainer label change racing with the workflow's Anthropic call
  is observed before the bot decides what to do.
- **To force re-apply** (overwriting human corrections), run the
  **AI Issue Triage (Backfill)** workflow with `force_relabel: true`.
  This is destructive and is logged as a warning.

If a maintainer corrects a label and the bot re-applies it anyway, treat
that as a bug and report it — the contract is that any label the bot
didn't itself apply is sticky.

## Setup (one-time)

1. Add an `ANTHROPIC_API_KEY` repository secret
   (`Settings → Secrets and variables → Actions → Repository secrets`).
2. (Optional) Add an `ANTHROPIC_TRIAGE_MODEL` repository **variable** to
   override the default model — for example `claude-sonnet-4-6` for
   higher-quality RCA, or any other current Claude model id.
3. Run the **Bootstrap triage labels** workflow once
   (`Actions → Bootstrap triage labels → Run workflow`) to create the
   `priority/*`, `area/*`, `no-triage`, `triage-failed`, and `needs-info`
   labels.
4. (Optional) Run **AI Issue Triage (Backfill)** once to triage every
   existing open issue. The per-issue workflow only fires on
   `opened`/`reopened`/`edited`, so issues opened before this workflow
   was added need this one-shot backfill.

## Backfilling existing issues

`Actions → AI Issue Triage (Backfill) → Run workflow` accepts:

- `state` — `open` (default), `closed`, or `all`.
- `only_unlabeled` — when `true` (default), skips issues that already
  have a `priority/*` label. Set to `false` to re-evaluate all issues
  (still respects label ownership unless `force_relabel` is also set).
- `limit` — max issues to process per run (1–500, default 100).
- `dry_run` — when `true`, prints classifications to the workflow log
  without commenting or labeling. Useful for previewing.
- `force_relabel` — **destructive**. When `true`, the bot will
  overwrite human-applied `priority/*` and `area/*` labels with the
  model's classification. Default `false` (assistive). The workflow logs
  a warning when this is set.

Issues labeled `no-triage` are always skipped. The backfill processes
issues sequentially in stable creation order. A summary block is printed
at the end with counts for triaged_ok / triaged_failed / needs_info /
skipped / errors.

## Opt-out

Add the `no-triage` label to any issue to skip the workflow. Re-runs on
edits will respect the label and not re-comment.

## How idempotency works

Each bot comment carries the marker `<!-- ai-triage-bot:v1 -->`. Lookup
matches both the marker AND the comment author (`github-actions[bot]`),
so an attacker cannot redirect the bot's PATCH by forging the marker on
their own comment. On re-runs the workflow finds the existing bot
comment and updates it in place.

Order of operations is **labels first, comment second** — a missing
comment with correct labels is less misleading than a confident-looking
comment with stale labels.

## Reporting bot mistakes

Comment on the issue describing the misclassification — a maintainer
will correct the label and may delete or override the bot comment. The
bot will respect the human-applied labels on subsequent edits. Add the
`no-triage` label to halt all future automated changes on that issue.

## Cost

Default model `claude-haiku-4-5-20251001` runs at roughly fractions of a
cent per issue. The system prompt is cached on Anthropic's side to
minimise repeated cost. Issue title and body are clamped to ~500 and
~8000 characters respectively before sending to the model.

Concurrency is keyed per issue (per-issue workflow) and globally for the
backfill. Timeouts: 5 minutes for per-issue triage, 30 minutes for
backfill, 5 minutes for label bootstrap.

## Prompt-injection hardening

- System prompt instructs the model to treat issue text as untrusted.
- Output is JSON-only with strict schema validation (closed enum for
  priority/type/area; out-of-range confidence rejected).
- Model output printed to the runner is wrapped in
  `::stop-commands::<token>` blocks so prompt-injected workflow
  commands (`::add-mask::`, `::error::`, etc.) are inert.
- All third-party Actions are pinned to a full commit SHA.
