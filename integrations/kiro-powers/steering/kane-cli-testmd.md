# Kane CLI — `kane-cli testmd` steering

Load this steering file whenever the user wants a **committable, reproducible** browser test rather than a one-shot `kane-cli run`. It is the full reference for the `_test.md` file format, the `kane-cli testmd …` command family, composition via `@import`, the replay-vs-author cache, and `Result.md`.

The single rule governing this framework: **a `_test.md` is a Markdown file a human can edit, the agent can author/replay, and git can version-control. Treat it as a first-class source artifact, not a transient invocation.**

`kane-cli run` is the **primary** mode — one-shot, ephemeral. `testmd` is the **secondary** mode — tests live as `_test.md` files on disk, each step is cached on the first run, and every later run **replays from cache** with no LLM cost.

---

# When to recommend `testmd`

The decision is binary: once a test exists as a `_test.md` file, every later invocation is `testmd run`, never plain `run`.

## User-phrase triggers

| User says | Use |
|---|---|
| "save this test", "commit this", "keep this", "add this to the suite" | ✅ `testmd` |
| "regression test", "smoke test", "make this replayable" | ✅ `testmd` |
| "this is a test", "test the X flow end-to-end" (suite-shaped) | ✅ `testmd` |
| "verify on every commit / in CI" | ✅ `testmd` |
| "I want to re-run this later without paying LLM cost again" | ✅ `testmd` (replay cache) |
| "same login should be reused across tests" | ✅ `testmd` with `@import ./helpers/login.md` |
| "run this once", "check if X works right now", "try X" | ❌ `kane-cli run` |
| "search for X", "click X", "fill X", "verify X" (one-shot phrasing) | ❌ `kane-cli run` |

## When the intent is unclear

Ask, don't guess:

> "Do you want me to save this test so you can re-run it later?"

If yes → use `kane-cli run "<objective>" --agent --name <slug>` (writes `<cwd>/.testmuai/tests/<slug>_test.md` on exit), then offer to move the file into the repo and switch to `testmd run` for the next invocation. If no → plain `kane-cli run` is enough.

**Important: without `--name`, `kane-cli run` is ephemeral.** A one-shot run without `--name` produces a session log under `~/.testmuai/kaneai/sessions/...` but does **not** write a re-runnable `_test.md`. If you suspect the user might want to keep the flow, capture it with `--name <slug>` from the start.

---

# Quick start

Write the file. The filename must end in `_test.md`:

```markdown
---
mode: testing
max_steps: 30
---

# Amazon search

## Open Amazon
Open https://www.amazon.com.

## Search for headphones
Type "wireless headphones" into the search box and submit.
Verify at least one product result is visible.
```

Run it:

```bash
kane-cli testmd run amazon_test.md --agent
```

The first run authors every step (the agent figures the page out). The second run replays each step from `output-amazon/.internal/` in seconds. Commit both the `_test.md` and the `output-amazon/` directory.

Before the test launches, `kane-cli testmd run` validates the cached Test Manager project/folder. If none is configured (or the cached value is stale/invalid), the run-startup gate auto-defaults a project/folder and emits a `project_folder_auto_defaulted` event on stdout. Surface it as a one-line note ("Kane CLI auto-selected project X / folder Y for this test") and continue parsing. Browse / create explicitly with `kane-cli projects list|create` and `kane-cli folders list|create --project <id>` (see the `kane-cli-run` steering file).

Like every session, a `testmd` session starts with the ready check and ends with a result card (POWER.md → Every session). The saved test card is at the end of this file.

---

# Command reference

```bash
kane-cli testmd run <path>             # run a test
kane-cli testmd list                    # list every *_test.md under cwd (NDJSON when stdin is non-TTY; records include tags)
kane-cli testmd status <path>           # show TMS identity + local-sync state
kane-cli testmd delete <path>           # local-only delete: removes source + output-<stem>/. Does NOT delete from Test Manager.
kane-cli testmd export <path> [--language python|javascript]  # regenerate code export from cached recordings
kane-cli testmd sync <path>             # re-push the test bundle (test + imports + outputs) to the cloud; automatic after every authored commit — manual use is for recovering a failed auto-sync
```

**Running several tests at once?** Use `kane-cli testrun run` — one execution, one evidence pack, isolated parallel Chromes. Load the **`kane-cli-testrun`** steering file.

## `kane-cli testmd run` — flag reference

Many flags are shared with `run`, but not all; check `kane-cli testmd run --help`. The flags below are `testmd`-specific.

| Flag | Default | Description |
|---|---|---|
| `--url <url>` | frontmatter `url:` / config `default_url` | Start URL for the first step. Overrides the `url:` frontmatter key and config `default_url`; bare domains get `https://`. |
| `--allow-missing-url` | off | Non-TTY only: start from the browser's current page instead of failing when the first step has no start URL. |
| `--name <name>` | none | Persist the run under this name. Slug: `[a-zA-Z0-9_-]+`. |
| `--on-lock-conflict <readonly\|fail\|wait>` | none | Behavior when another user holds the test's edit lock. `readonly` = replay-only / no upload; `fail` = exit `2`; `wait` = block until released. |
| `--no-adaptive-heal` | healing enabled | Disable adaptive healing after replay failure |
| `--author` | off | Force authorable steps to re-author; replay-only steps still replay. |
| `--bug-detection <off\|stop\|continue>` | config (`off`) | Flag suspected product bugs while **authoring** (`stop` halts on a confirmed bug; `continue` records it). Replay failures always investigate regardless. |

**Flag vs frontmatter precedence:** flags win for everything **except** `variables`, where the file wins (a test's data stays close to the test). CLI variables can still **add** keys the file doesn't define.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All non-optional steps passed |
| `1` | At least one non-optional step failed |
| `2` | Parse error / auth / Chrome launch failure / `--on-lock-conflict fail` hit |
| `3` | Ctrl+C confirmed, timeout, or `--on-lock-conflict wait` timed out |

---

# File format

## Naming

- **Tests** — filenames ending in `_test.md`. Only these are valid arguments to `kane-cli testmd run`.
- **Helpers** — any other `.md` file. Only reachable via `@import` from a test. Trying to run a helper directly is rejected with a clear error.

## Anatomy

```markdown
---
key: value        # frontmatter (YAML) — run-wide settings
---

# Optional title (decorative — ignored by the parser)

## Step 1 heading
Plain prose objective.

## Step 2 heading
```yaml
timeout: 60       # optional per-step config — overrides frontmatter for THIS step
optional: true
```
Another prose objective.

## Step 3 heading
@import ./helpers/login.md
```

Four pieces, in order:

1. **Frontmatter** — YAML inside `---…---` at the top. All keys optional.
2. **`## Step heading`** — every step starts with an H2. Anything before the first `##` is silently ignored, so a `# Title` line is decorative.
3. **Optional ` ```yaml ``` ` block** — directly under the heading. Overrides frontmatter for this one step.
4. **Step body** — exactly one of: a prose objective **or** a single `@import <path>` line. Never both.

## Frontmatter keys

Every key is optional. Unrecognised keys are rejected at parse time.

| Key | Scope | Description |
|---|---|---|
| `mode` | **root only** | `testing` (default) pushes through auth walls and error pages so negative-test assertions can fire. `action` halts on those pages so a human can intervene. |
| `url` | **root only** | Start URL for the test's first step (bare domains get `https://`). Overridden by `--url`; falls back to config `default_url`. |
| `tags` | **root only** | Labels for batch selection: YAML list, `[a, b]`, or bare `a, b`. Trimmed, lowercased, deduped. Selected with `testrun --tags`; shown by `testmd list`. Empty → parse error (`tags must be a non-empty list of non-empty strings`); per-step → parse error. |
| `max_steps` | root + per-step | Max agent reasoning steps. Engine fallback `30` when neither step config nor CLI supplies a value; CLI default is `50`. |
| `timeout` | root + per-step | Hard kill timer per step, seconds. No default. |
| `headless` | **root only** | Launch Chrome without a window. |
| `variables` | root + per-step | `{{name}}` parameters, same shape as `kane-cli run`, with `secret: true` for credentials. |
| `global_context` / `local_context` | root + per-step | Inline Markdown or a path to a file. |
| `code_export` / `code_language` | root + per-step | Generate Playwright after the run; language `python` (default) or `javascript`. |
| `on_lock_conflict` | **root only** | Policy when another user holds the TMS lock for this test. |

**Auth keys (`username`, `access_key`, etc.) are CLI-only.** They are rejected from frontmatter with `auth/identity keys are CLI-only: <key>`.

## Per-step `yaml` block

A step can carry its own settings in a fenced `yaml` block immediately under its `##` heading. Allowed keys are any root-or-per-step key from the table above, plus:

- **`optional: true`** — marks the step as soft-failing. If it fails, the run continues, subsequent steps still execute, and the step is reported as `failed (optional)` in `Result.md`.

Root-only keys (`mode`, `on_lock_conflict`, Chrome / `headless`) are rejected from per-step blocks with a clear error.

## Variables

Inside a `_test.md`, variables can be set in three places, in order of increasing specificity (later wins):

1. Frontmatter `variables:` — run-wide.
2. Per-step `yaml` `variables:` — step-local.
3. `--variables` / `--variables-file` flags. **Exception:** for keys defined in the file, the file wins over CLI. CLI can only **add** new keys.

Shape:

```yaml
variables:
  tester_email:
    value: "alice@example.com"
  tester_password:
    value: "s3cret-pa55"
    secret: true
  tenant: "staging-eu"        # shorthand — { value: "staging-eu" }
```

| Field | Required | Default | Description |
|---|---|---|---|
| `value`  | yes | — | The variable's value. Entries without `value` are rejected. |
| `secret` | no  | `false` | When `true`, masked in logs, redacted in `Result.md`, routed through TestMu AI's secrets store. |

Use `secret: true` for any credential, API key, or token. **Never** echo a secret's value back to the user.

## Recording a `_test.md` from a live session

When the user fires a one-shot `kane-cli run` and decides partway through (or after) that they want to keep it, the **only** way to capture it is the `--name` flag:

```bash
kane-cli run "Search for noise-cancelling headphones on amazon.com" \
  --agent --name amazon-search
```

On exit, Kane CLI writes the session to `<cwd>/.testmuai/tests/amazon-search_test.md`. Move that file into the repo (e.g. `tests/`) and re-run it as any other test. The recorded file is a regular `_test.md` and can be edited freely.

Slug rules: `[a-zA-Z0-9_-]+`. Pick a slug that reads as a filename — e.g. `login-smoke`, `checkout-happy-path`, `dashboard-regression`.

## Authoring `_test.md` from a description — the generate → testmd pipeline

When the user wants test cases written from scratch — from a feature spec, a requirement, or just a description of what to test — **don't hand-draft them and don't capture them via a live `--name` session.** Use `kane-cli generate` to author structured Functional cases first, save them as runnable `_test.md`, then run them here:

```bash
# 1. Author scenarios + cases from a description
kane-cli generate "checkout flow on a shopping site" --agent
#    → capture the request id (e.g. 23271)

# 2. Refine if needed (repeat as often as needed)
kane-cli generate "also cover an expired card and an out-of-stock item" --refine --req 23271 --agent

# 3. Save the Functional cases as runnable _test.md files
kane-cli generate --save --req 23271 --agent
#    → <cwd>/.testmuai/tests/<suite>/<scenario>/<case>_test.md

# 4. Run them — back in testmd territory
kane-cli testmd run .testmuai/tests/<suite>/<scenario>/<case>_test.md --agent
```

Full mechanics (the three modes, clarification round-trips, presenting scenarios + cases, the typed event schema) live in the **`kane-cli-generate`** steering file. Load that file the moment the user asks for cases to be written; come back here to run them.

---

# Composition with `@import`

## Helper files

Any `.md` file whose name does **not** end in `_test.md` is a helper. Helpers are only reachable via `@import` from a test — they cannot be run directly.

```markdown
---
mode: testing
---

# Login helper

## Open the login page
Open https://app.example.com/login.

## Sign in
Type "{{tester_email}}" in the email field and "{{tester_password}}" in the password field, then submit. Verify the URL contains /home.
```

Save as e.g. `helpers/login.md`.

## `@import` syntax

```markdown
## Sign in
@import ./helpers/login.md
```

Rules:

- The step body must be **only** the `@import` line — no prose mixed in.
- Paths are resolved relative to the **importing file**, not the shell's cwd.
- The target file must exist; missing paths fail at parse time.
- The `yaml` block of an `@import` step may contain **only** `optional`. Anything else is rejected.

## Optional imports

```markdown
## Skip the tour if it shows up
```yaml
optional: true
```
@import ./helpers/dismiss-product-tour.md
```

`optional: true` on `@import` is allowed only at the **root test**. Nested helpers cannot decide to skip themselves.

## What propagates through `@import`

**Propagates to imported steps:** `variables` (root-defined and CLI-added), `global_context`, `local_context`, per-step settings on individual steps inside helpers.

**Does NOT propagate (root-only):** `target`, `chrome_profile`, `cdp_endpoint`, `ws_endpoint`, `headless`, `mode`, `on_lock_conflict`, authentication. There is **one browser per run** with **one auth context**.

## Resolver guarantees

| Rule | Error if broken |
|---|---|
| Only helpers may be imported. | `cannot @import a test file: only helpers may be imported (got <path>)` |
| No cycles. | `cyclic reference: a.md → b.md → a.md` |
| Imports must resolve. | `@import path not found: <path>` |
| `optional` only at the root file. | `intermediate-ref 'optional' is not supported in v1: <file>:<line>` |
| `@import` steps may only carry `optional` in their `yaml` block. | `step config on @import may only contain 'optional': got <key>` |

Helpers can import helpers can import helpers — keep nesting shallow.

---

# Replay vs author (the cache model)

The first run of every step **authors**: the agent figures out the page and saves a recording in `output-<stem>/.internal/`. On every subsequent run, Kane CLI tries to **replay** — no agent, no LLM cost.

## A step replays iff

- A recording exists for it on disk,
- The step's prose is unchanged since the recording,
- The step's `yaml` block is unchanged,
- No earlier step in the same file was edited.

Otherwise the step authors again.

## Edits cascade

Each step starts where the previous one left off (same browser, URL, logged-in state). When step 3 changes, the state step 4 expected may no longer be there — so authorable steps 4 (and 5, 6, …) re-author automatically; replay-only marked steps still replay.

Practical consequence: a one-line tweak at the top of a long test re-authors the authorable steps in the file. If you're iterating and want only the last step to re-record, edit only the last step.

## Forcing fresh authoring

- **`--author`** — bypass the replay decision for one run. Every authorable step authors; replay-only marked steps still replay.
- Preserve output recordings for replay-only marked steps; deleting them cannot force fresh authoring.

## Recovering replay failures

A replay can fail when the site shifts under you:

- **Adaptive healing** — enabled by default: three shrinking replay windows, then re-author authorable steps. Use `--no-adaptive-heal` to disable it.

Every failed replay is also **investigated automatically** — a failure record (error, page state, console/network pointers) is written into the run's evidence pack, so you can explain *why* the replay broke.

## Replays are self-sufficient

A pure replay (all steps cached) needs no project/folder configuration — no picker, no auto-default event, no exit-`2` setup dead end. It also publishes its evidence pack to the test's own project automatically (`test_md_evidence_ingest` event, informational), so the dashboard shows execution history even for cache-replayed runs.

## Edits inside helpers cascade too

Editing a step in `helpers/login.md` invalidates:
- That step inside every helper-output call site,
- Subsequent steps in the same helper invocation,
- The root tests' steps **after** the `@import`, because helper changes alter the state on return.

---

# Run mode

The `--mode` flag (and `mode:` frontmatter, root-only) controls how the agent handles auth walls, blocked pages, and error pages:

- **`testing`** (default) — the agent treats those pages as part of the run and continues. Negative-test cases ("verify the error message is shown") work because the run doesn't bail on the first error page.
- **`action`** — the agent hard-stops on auth, blocked, and error pages so a human can intervene before the run continues.

`testing` is the right default for automated suites and CI. `action` is for one-off authoring where the user wants manual control.

---

# Lock conflicts

Each test in Test Manager has a single-writer lock so two engineers can't author the same test simultaneously. When you run a test someone else holds the lock for, `--on-lock-conflict` decides what to do:

| Policy | Behaviour | Exit |
|---|---|---|
| `readonly` | Proceed in replay-only mode — no commit, no upload. | `0` on success |
| `fail`     | Abort immediately. Use in CI to flag contention rather than wait. | `2` |
| `wait`     | Block until the lock releases (or times out). Use for serialised CI lanes. | `0` on success, `3` on timeout |

The lock is acquired **before Chrome launches**, so `fail` aborts with zero side effects.

---

# Output directory layout

A successful run writes everything needed to replay next time into `output-<stem>/` next to the test file, where `<stem>` is the filename without `_test.md`:

```
amazon_test.md
output-amazon/
├── Result.md                       # human-readable run report
├── .internal/                      # cached recordings — do not edit by hand
└── playwright-python-code/         # only if code export is enabled
```

For tests that `@import` helpers, Kane CLI also writes one `helper-output-<helper>-<test>-<step-index>/` directory next to each helper, one per call site.

**Commit `output-<stem>/` and `helper-output-...` directories to git.** That is what makes the test reproducibly replayable on a teammate's machine and in CI.

Every `testmd run` also seals an **evidence pack** into `<cwd>/.testmuai/evidence/` — screenshots, per-step console/network logs, failure records. It's the richer artifact for debugging a failure (load the **`kane-cli-testrun`** steering file for the evidence surface). Packs are run artifacts: do **not** commit `.testmuai/evidence/`.

---

# `Result.md` schema

`Result.md` is generated on every run. It's intended for human reading — open in any Markdown viewer.

```markdown
---
test: ../amazon_test.md
status: passed
started: 2026-05-13T06:22:43.641Z
duration_s: 78
session_id: 1de66066-fc38-4ed4-9427-f28b2e081171
---

## Open Amazon ✓ passed (3s)
Open https://www.amazon.com.

## Search ✓ passed (15s)
Type "wireless headphones" into the search box and submit.

## Add to cart ✗ failed (12s)
Click "Add to Cart" on the product page.
```

Status icons:

| Icon | Meaning |
|---|---|
| `✓ passed` | The step completed successfully. |
| `✗ failed` | The step failed and the run did not continue. |
| `⏭ skipped` | The step did not run because an earlier non-optional step failed. |
| `(optional)` | Suffix when a step marked `optional: true` failed but the run continued. |

When an `@import` step fails, the badge points to the failing leaf inside the helper, e.g.:

```
✗ failed (via @import ./helpers/login.md — at sub-step 2 → 3, 8s → ./helpers/helper-output-login-checkout-3)
```

## Reading `Result.md` from Kiro

When the user asks "did the test pass?" or "where did it fail?" for a previously-run test, read `Result.md` rather than re-running the test.

1. Read `output-<stem>/Result.md`.
2. Show the frontmatter as a compact summary (`status`, `duration_s`, `started`).
3. Show each step with its icon, name, and duration.
4. For failed steps, also read the screenshot from `.internal/` (look for the latest step subdirectory) and render it inline. **Never paste raw `.internal/` paths.**

---

# CI patterns

Standard CI-friendly invocation:

```bash
kane-cli testmd run ./tests/checkout_test.md \
  --agent \
  --headless \
  --on-lock-conflict wait
```

Why each flag:

- `--agent` — NDJSON to stdout, no TUI. Auto-enabled when stdin is non-TTY but pass it explicitly.
- `--headless` — Chrome runs without a window.
- `--on-lock-conflict wait` — block instead of failing if a teammate is editing the same test.
- Adaptive healing recovers replay failures by default; `--no-adaptive-heal` opts out.

Two non-TTY behaviors to know (Kiro always runs Kane CLI non-TTY): interactive `ask_user` prompts are disabled, so a step that would wait for input fails cleanly instead of hanging; and the first step needs a resolvable start URL (the `url:` frontmatter key, the `--url` flag, or a site named in the step's prose) or the run fails — pass `--allow-missing-url` to start from the current page instead.

Capturing the exit code in shell:

```bash
kane-cli testmd run ./tests/checkout_test.md --agent --headless
status=$?
case $status in
  0) echo "passed" ;;
  1) echo "failed — check output-<stem>/Result.md" ; exit 1 ;;
  2) echo "error (parse/auth/Chrome/lock-fail)"   ; exit 1 ;;
  3) echo "cancelled or timeout"                  ; exit 1 ;;
esac
```

## Kiro validation-loop pattern

When Kiro modifies UI code in a project that already has `_test.md` smoke tests:

1. Identify the matching `_test.md` (e.g. `tests/login_smoke_test.md`).
2. Run it with the CI-friendly invocation above.
3. On exit `0` — narrate success and continue.
4. On exit `1` — read `Result.md`, find the first failing step, surface its screenshot from `.internal/`, propose a concrete code fix.
5. On exit `2` or `3` — diagnose (auth? Chrome? lock? timeout?) before suggesting a code fix; the test framework didn't even reach the assertion.

---

# Common parse errors

The parser catches these **before any browser launches** — exit `2`, no side effects.

| Message | Cause |
|---|---|
| `frontmatter is missing closing '---'` | The `---` fence was opened but not closed. |
| `invalid YAML in frontmatter: <details>` | Frontmatter is not valid YAML. |
| `step-config fenced ` + "```yaml block is not closed" | A per-step `yaml` block is missing its closing ` ``` `. |
| `invalid YAML in step config: <details>` | Per-step YAML is malformed. |
| `step body must be exactly one of prose / @import` | The step mixes prose and an `@import`. |
| `step config 'optional' must be boolean: got <type>` | `optional` was set to a non-boolean. |
| `variable '<k>' must be a string or { value: ... } object` | A variable entry is the wrong shape. |
| `auth/identity keys are CLI-only: <key>` | `username`, `access_key`, or another auth key appeared in frontmatter. |
| `unknown config key: <key>` | A frontmatter or per-step key is not recognised. |
| `chrome config is global-only: <key>` | A Chrome-related key was set on an individual step. |
| `'<key>' is run-level and cannot be set per-step` | `mode`, `tags`, or `on_lock_conflict` was set on an individual step. |
| `tags must be a non-empty list of non-empty strings` | `tags:` is present but empty, or one of its entries is empty. |
| `step config on @import may only contain 'optional': got <key>` | An `@import` step's `yaml` block contains anything other than `optional`. |
| `cannot @import a test file: only helpers may be imported (got <path>)` | An `@import` referenced a file ending in `_test.md`. |
| `cyclic reference: a.md → b.md → a.md` | Import graph contains a cycle. |
| `@import path not found: <path>` | The target file doesn't exist. |

When the agent surfaces a parse error, repeat the message verbatim, point at the file + line if available, and **translate the cause into plain English** ("Your frontmatter is missing the closing `---` line").

---

# Decision tree (use before any `kane-cli testmd` command)

**Does a `_test.md` already exist for this flow?**

- Yes → `kane-cli testmd run <file>` (replay path).
- No → either author from scratch (write the `_test.md`, then `kane-cli testmd run` it), or author from a live session: `kane-cli run "<one-shot objective>" --agent --name <name>` → move `<cwd>/.testmuai/tests/<name>_test.md` into the repo → run via `kane-cli testmd run`.

**Has the test ever run before?**

- No → first-run authoring; expect every step to take agent time.
- Yes → expect replay; budget seconds, not minutes. If a step re-authors, find out why (was something edited?) before re-running.

**Did the run fail?**

- Exit `1` (assertion / step failure) → read `Result.md`, find the failing step, surface its screenshot, propose a fix.
- Exit `2` (parse / auth / Chrome / lock-fail) → diagnose **first**; the run never reached the test logic. Pay attention to the exact parse-error message.
- Exit `3` (cancelled or `lock wait` timeout) → check for a teammate holding the lock (`kane-cli testmd status <path>` shows TMS identity); consider re-running with a longer wait.

---

# Things to never do

- **Never** invent `_test.md` files in a directory the user didn't ask you to. Helper files and tests both touch git history.
- **Never** put `username`, `access-key`, OAuth tokens, or any auth identifier in frontmatter — they are CLI-only and will fail parse.
- **Never** put `mode`, `on_lock_conflict`, or Chrome keys in a per-step `yaml` block — they are root-only.
- **Never** mix prose and `@import` in the same step body.
- **Never** point `@import` at a `_test.md`. Only helpers may be imported.
- **Never** echo a `secret: true` variable's value back to the user.
- **Never** delete `output-<stem>/` or `helper-output-...` without explicit consent — those are checked-in artifacts other tests / teammates may rely on.
- **Never** rename a `_test.md` casually — the output directory is keyed on the stem and the cache will not follow. If renaming is unavoidable, also rename the matching `output-<stem>/` directory.

## Replay policy and completion

Adaptive healing is enabled by default: after a replay failure the runner tries up to three shrinking replay windows, then full re-authoring of authorable steps. `--no-adaptive-heal` disables this recovery. Retired `--retry` and `--retry-count` are accepted only to print a notice; they do not enable healing or change the fixed budget.

Headings marked `@db`, `@api`, `@js`, `@smartui`, `@network_query`, or `@network_assertion` are replay-only. They still replay under `--author`, downstream divergence and adaptive healing. Missing recordings cannot be re-authored through these markers: restore the recording or recreate it through the originating workflow. Do not delete their tapes to force authoring; adding a marker does not create an operation.

Structured control flow uses balanced heading markers: `@if`, `@elif`, `@else`, `@end-if`, `@while`, `@end-while`. An `@else` must be last in its conditional; end markers must match the opened block type. These are distinct from natural-language conditionals. Markers are excluded from the step body hash. Only one replay-only kind is allowed per step, and an import cannot also be marked replay-only.

Under `--agent`, wait for `test_md_done` (file-level `overall_status`, `duration_s`, `session_id`, optional `share_url`) and process exit. Individual `run_end` events do not complete the file.

## The saved-test stream (what `testmd run --agent` prints)

> **Internal reference only.** Never show these event or field names to the user.

This stream is **not** the one-shot `run` stream. Every line is typed, and the file-level events wrap a small inner stream per step. Read it for the saved test card below.

| Event | Key fields | Use |
|---|---|---|
| `stream_start` *(0.8.17+)* | `cli_version`, `surface: "testmd"` | First line (see the stream contract in the `kane-cli-run` steering file) |
| `test_md_step_start` | `step_index` (1-based), `heading`, `ref` | A `## ` step began. `heading` is its title |
| inner step events | `bifurcation`, `run_start`, `step_start {index}`, `step_event {index, event, detail}`, `step_end {index, status, summary, kind}`, `describe_trigger`, `run_end` | What happened inside the step. A `step_event` with `event: "replay_started"` means the step is replaying its recording. A `bifurcation` instead means it is being authored. The inner `run_end` closes the step, not the file |
| `test_md_step_end` | `step_index`, `status`, `duration_s`, `failed_sub_step_index` | The step finished. `status` is `passed`, `failed` or `skipped` |
| `test_md_evidence_ingest`, `test_md_bundle_sync` | `status` | Informational, before the summary |
| `test_md_summary` | `overall_status`, `duration_s`, `steps: {total, passed, failed, skipped, replay_decisions, author_decisions}` | The numbers for the card. `replay_decisions` is how many steps replayed, `author_decisions` how many were authored |
| `test_md_done` | `overall_status`, `duration_s`, `session_id`, `share_url?` | Completion. Always the last line. `share_url` is absent on a pure replay |

Most lines are inner `step_event`s (screenshots, reasoning, actions). Skip them unless you are diagnosing a failure: for the card you need only the step starts and ends, the summary and the completion event. On a failure, the failing step is the `test_md_step_end` with `status: "failed"`, its title comes from the matching `test_md_step_start`, and the last inner `step_end` or `step_event` before it says what went wrong.

On kane-cli 0.8.17+ every line also carries `v` and `ts`. Ignore fields and event types you do not know.

## The saved test card

Present every `testmd run` result as this card. The rules for every card in the `kane-cli-run` steering file (Presenting results) apply here too.

```markdown
| | |
|---|---|
| 🟢 **Result** | Passed · <passed> of <total> steps |
| 🧾 **Test** | <file name> |
| ⏱️ **Duration** | <21s> |
| 🔁 **How it ran** | <see below> |
| 🔗 **Share link** | [Open](<share link>) · valid 7 days |
| 📁 **Evidence** | Want to open the run evidence in your browser? |
| ➡️ **Next** | <offer one> · <offer two> |
```

**🔁 How it ran**, from the replayed and authored step counts in the summary:

| Counts | Say |
|---|---|
| All replayed | `Replayed from its recording, no AI cost` |
| All authored | `Recorded for the first time. The next run replays in seconds` |
| Both | `<r> steps replayed, <a> re-recorded because the test changed from there` |

The 🔗 row appears only when there is a share link (pure replays have none). After a first authoring run, a good ➡️ offer is: `Commit output-<stem>/ so teammates and CI replay the same recording`.

A failed saved test uses the failed-run rows (🔴 `Failed at step <n> of <total> · "<step heading>"`, 📝 What happened, 🔍 Likely cause) and says how many later steps were skipped. Failed replays are always investigated: read the finding from the evidence pack before writing 🔍.
