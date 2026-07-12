<!-- Read this when you need the full NDJSON event schema for kane-cli --agent output, or when SKILL.md §5's summary is not enough. Owns event types (progress / bifurcation / child_agent_start|end / ask_user / error), parsing strategy, run_end terminal-event schema, and ask_user/cancel responses. -->

# Parsing --agent Output

> **Internal reference only.** Everything in this section (field names, event types, JSON structure) is for you to parse programmatically. **Never expose these internal terms to the user.** The user should see plain-language summaries, not `run_end`, `final_state`, `bifurcation`, `NDJSON`, `session_dir`, or any raw JSON fields.

With `--agent`, kane-cli outputs one JSON object per line to **stdout**. Progress UI renders to **stderr**.

## Event Types

**Progress events** (bulk of the output — one per step):

```json
{"step": 1, "status": "passed", "remark": "Navigated to amazon.in"}
{"step": 2, "status": "passed", "remark": "Typed 'laptop' in search box"}
{"step": 3, "status": "failed", "remark": "Could not find Add to Cart button"}
```

| Field | Type | Description |
|-------|------|-------------|
| `step` | number | Step index (1-based) |
| `status` | string | `"passed"` or `"failed"` |
| `remark` | string | What the agent did or why it failed |

These are **untyped** — they have no `type` field. Do **not** key on `event.type === 'step_start'` or `'step_end'`; those event types are not emitted.

**Flow events:**

| Event (`type` field) | Key Fields | Purpose |
|-------|-----------|---------|
| `project_folder_auto_defaulted` | resolved project + folder (id, name) | Run-startup gate auto-resolved a project/folder when none was configured (or the cached one was stale/invalid). Fires before any progress event on `run` / `testmd run` / `generate`. Translate to plain language (see `references/test-manager.md`). |
| `bifurcation` | `flows[]`, `count` | Agent split objective into sub-flows |
| `child_agent_start` | `child_id`, `objective`, `parent_step` | Child agent spawned |
| `child_agent_end` | `child_id`, `success`, `steps_taken`, `summary` | Child agent finished |
| `ask_user` | `question`, `step_index`, `options?` | Agent needs user input |
| `error` | `message` | Error occurred |
| `test_md_evidence_ingest` | `status: "ok"\|"failed"`, `evidence_id`, `stage?` (failure only) | `testmd run` only: a replay's evidence pack published to the dashboard. Informational. |
| `test_md_bundle_sync` | `status: "ok"\|"failed"`, `commit_id`, `bytes?` (success) / `stage?` (failure) | `testmd run` / `testmd sync`: test bundle pushed to the cloud after an authored commit. Informational. |
| `testrun_*` family | see `references/testrun.md` | Emitted only by `kane-cli testrun run`; terminal event is `testrun_done`, not `run_end`. |

**Note:** There is no `run_start` event — the first line is either a `bifurcation` or a progress object.

**Note:** `ask_user` is auto-disabled when stdin is not a TTY. Since agents typically run kane-cli as a subprocess, ask_user events will not be emitted. Write objectives that don't require interactive input.

## Parsing Strategy

Since progress events lack a `type` field, distinguish them from typed events like this:

```
for each line of NDJSON:
  if obj.type === "run_end"    → terminal event, stop parsing
  if obj.type === "bifurcation" → flow split
  if obj.type exists           → other typed event
  if obj.step exists           → progress event (step/status/remark)
```

**Build automation on `run_end`** — it is the only event guaranteed to have a stable schema across versions. Use progress events for live status display only.

**Terminal event** (always the last line):

```json
{
  "type": "run_end",
  "status": "passed",
  "summary": "Searched for laptop and added first result to cart",
  "one_liner": "Searched for laptop on Amazon and added to cart",
  "reason": "Objective completed",
  "duration": 45.2,
  "credits": 12,
  "final_state": {
    "price": "$29.99",
    "product_name": "Wireless Headphones"
  },
  "context": {
    "memory": {},
    "variables": {},
    "pointer": "(passed) Searched for laptop and added first result to cart"
  },
  "session_dir": "~/.testmuai/kaneai/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "run_dir": "~/.testmuai/kaneai/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/runs/0",
  "test_url": "https://test-manager.lambdatest.com/projects/123/test-cases/456"
}
```

Key `run_end` fields:
- `status` — `"passed"` or `"failed"`
- `summary` — what the agent did
- `one_liner` — short summary for display
- `reason` — why it stopped
- `credits` — credits consumed by the run (when reported)
- `final_state` — extracted values from "store as" objectives
- `test_url` — link to KaneAI dashboard (if upload succeeded)
- `session_dir` — session directory (session log + the sealed evidence pack under `evidence/`)
- `run_dir` — **legacy**: this directory is no longer created; run logs and screenshots live inside the evidence pack (`references/debug.md` has the layout)
- `result_code` (string, optional) — machine result classification. Under `--bug-detection`, a **confirmed product bug** arrives as `result_code: "740"` plus a `verdict` object (`confirmed`, `family`, `category`, `severity`, `one_liner`, `confidence`). Report it to the user as a product bug found, distinct from a test failure.

**The evidence hint is not an event.** After a run, kane-cli prints `` evidence: view locally with `kane-cli evidence serve <path>` `` on **stderr**. Never look for it on stdout; see `references/evidence.md` for how to act on it. `run_end` itself carries no evidence-pack field.

## Responding to `ask_user` (if stdin is a TTY)

```json
{"type": "user_response", "answer": "Medium size"}
```

To cancel a run:

```json
{"type": "cancel"}
```
