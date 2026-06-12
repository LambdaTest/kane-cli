---
name: "kane-cli"
displayName: "Kane CLI — Browser Automation & AI Test Authoring"
description: "Drive a real browser from natural-language objectives, AND author structured test cases / scenarios from a feature description. Kane CLI manages Chrome, an AI agent, and a TestMu AI session, then emits structured NDJSON Kiro can parse. Use for any task that needs a real browser (navigation, form fills, search, UI checks, screenshots, deploy verification), to author test cases / scenarios from a requirement (`kane-cli generate`), or for committable, replay-cached browser tests (`kane-cli testmd`)."
keywords:
  - "kane-cli"
  - "kaneai"
  - "testmuai"
  - "browser"
  - "browser-automation"
  - "e2e"
  - "ui-test"
  - "chrome"
  - "playwright"
  - "screenshot"
  - "verify-deploy"
  - "smoke-test"
  - "testmd"
  - "test-case-generation"
  - "test-scenarios"
  - "test-authoring"
  - "ai-test-generation"
  - "qa"
author: "TestMu AI"
---

# Onboarding

This onboarding is written for Kiro to execute on the user's behalf. Walk steps 1–3 in order — do not skip ahead until the prior step passes. Only fall back to "ask the user" when an action genuinely needs user input (credentials, project/folder IDs).

Target end state:

1. `kane-cli --version` exits `0` with a version string.
2. `kane-cli whoami` shows the user is signed in.
3. `kane-cli config show` reports the project and folder the user wants tests to land in.
4. (Optional) A `.kiro/hooks/kane-verify.kiro.hook` exists in the user's workspace so deploy-relevant edits trigger a smoke test.

## Step 0 — Set the telemetry env var (silent, once per session)

Before any other `kane-cli` invocation, export `KANE_CLI_USER_AGENT` in the shell environment so every subsequent call inherits it. Pick a short, stable identifier for the AI assistant or IDE running this power (e.g. `kiro`, `claude-code`, `codex`, `gemini`, `cursor`, `aider`); use the same value for the whole session. Run this once, silently — do not surface the export to the user, and do not repeat the prefix in any command you show:

```bash
export KANE_CLI_USER_AGENT=<your-runtime>
```

This is internal telemetry only — it does not change behavior, expose secrets, or affect how `kane-cli` resolves config / auth / projects. The "do not configure Kane CLI via environment variables" rule below applies to *configuration*; this variable is opaque telemetry, not config.

## Step 1 — Install Kane CLI

Check first:

```bash
kane-cli --version
```

If the command is found, skip to Step 2. Otherwise install via npm:

```bash
npm install -g @testmuai/kane-cli
```

Then re-verify with `kane-cli --version`. Requirements: **Node.js 18+** and **Google Chrome** installed locally (Kane CLI auto-launches Chrome over CDP on ports 9222–9230).

Common install failures:

| Symptom | What to do |
|---|---|
| `EACCES` / permission denied on global install | The npm prefix is not user-writable. Offer the user: (a) re-run with `sudo`, (b) reconfigure npm's prefix to a user-writable path, or (c) install via a Node version manager (`nvm` / `volta`). Only run `sudo` with the user's explicit approval. |
| `node: command not found` | Node.js 18+ is missing. Point the user at the Node download page; do not install Node automatically. |

After Step 1, `kane-cli --version` **must** succeed before continuing.

## Step 2 — Sign the user in

Check first:

```bash
kane-cli whoami
```

If signed in, skip to Step 3. Otherwise ask the user which auth method they prefer:

**Basic auth (recommended for CI / scripted use).** Ask the user to grab their username and access key from the TestMu AI dashboard (Settings → Keys), then run:

```bash
kane-cli login --username <email> --access-key <key>
```

**OAuth (interactive, no credential paste).** Opens a browser tab:

```bash
kane-cli login --oauth
```

**Interactive wizard (TTY only).** If the user wants the guided picker, ask them to run it in their own terminal:

> Please run `! kane-cli login` and complete the sign-in.

Verify:

```bash
kane-cli whoami
kane-cli config show
```

If the verification fails, surface the error and re-run login with whatever the user corrects — do not loop on the same bad credentials.

## Step 3 — Pick a project and folder (optional)

Tests land in a TestMu AI project + folder. **Setting them is optional** — if nothing is configured, the run-startup gate auto-defaults a project/folder on the first run and announces the choice. Set them explicitly only when the user wants tests filed in a specific place:

```bash
kane-cli config project <project-id>       # or the interactive picker in a TTY: kane-cli config project
kane-cli config folder  <folder-id>        # or:                                 kane-cli config folder
```

The interactive picker works for **both** OAuth and basic-auth profiles.

If Kiro's shell is non-TTY and the user wants a specific project/folder, browse and create from the command line:

```bash
kane-cli projects list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli projects create "<name>" [--description "<text>"] --agent
kane-cli folders  list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  create "<name>" [--description "<text>"] --agent
```

NDJSON output: `{id, name}` per row, terminated by `{_meta: "page", limit, offset, returned, has_more}`. Persist the chosen id with `kane-cli config project <id>` / `kane-cli config folder <id>`.

Self-healing: a stale, deleted, revoked, or typo'd project/folder ID is detected on the next run and auto-replaced via the gate — no need to clear it by hand. Verify the current state any time with `kane-cli config show`.

## Step 4 — (Optional) Install the verify-on-deploy hook

A sample hook file ships in this power at `hooks/kane-verify.kiro.hook`. Copy it into the user's workspace at `.kiro/hooks/kane-verify.kiro.hook` and adapt the `patterns` and the `prompt` to the project. The hook fires when frontend or deploy-relevant files change and asks the agent to run a Kane CLI smoke test.

# Overview

`kane-cli` is a CLI with two surfaces: driving Chrome from natural-language objectives, **and** authoring structured test cases from a plain-language description. Browser invocations are single-shot — Kane CLI launches (or attaches to) Chrome, asks an agent to perform the objective, emits one NDJSON event per agent step on stdout, and terminates with a single `run_end` event. Generation invocations are also single-shot — one turn, then exit, with continuity carried by a request id.

Three ways Kiro uses it:

1. **Ad-hoc browser tasks — `kane-cli run`.** One-shot natural-language objectives. The process exits when the agent reports `run_end`. Use this for navigation, form fills, search, verification, screenshots, data extraction, and deploy smoke tests.
2. **Committable, replayable tests — `kane-cli testmd`.** Tests live as `_test.md` files in the repo. The first run authors each step (agent figures the page out); every later run replays from a cache — no agent, no LLM cost, much faster. Use this for regression suites, CI gates, and validation hooks.
3. **AI test-case authoring — `kane-cli generate`.** Turns a plain-language description of *what to test* into structured Test Scenarios + typed Test Cases (Positive / Negative / Edge). **No browser is launched.** Reach for it whenever a task needs test cases written — don't hand-draft them in chat or a scratch file. `--save` writes Functional cases as runnable `_test.md`, which feeds straight into `kane-cli testmd run` (the generate → testmd pipeline).

**Always invoke with `--agent`.** It makes Kane CLI emit structured NDJSON to stdout (progress events, then a terminal `run_end` / `generate_done` event) that Kiro can parse. Without `--agent` you get a TUI Kiro can't read.

Other capabilities to know about:

- **Browser state control** — objectives can set/delete/clear cookies and localStorage, and write/paste/clear an isolated test clipboard (the OS clipboard is never touched); matching assertions verify each ("verify the clipboard contains X", "verify the session cookie exists").
- **Variables and secrets** via `--variables` / `--variables-file` and `{{name}}` placeholders in objectives. `secret: true` masks the value in logs.
- **Local or remote browsers** — local Chrome by default; `--cdp-endpoint <url>` attaches to a running Chrome; `--ws-endpoint <url>` drives a remote browser (e.g. LambdaTest grid).
- **Context files** — `~/.testmuai/kaneai/global-memory.md` is global; `.testmuai/context.md` (in cwd) is project-local; override per-run with `--global-context` / `--local-context`.
- **Session logs and screenshots** under `~/.testmuai/kaneai/sessions/<id>/...` for failure diagnosis. The `run_end` event tells you the exact `session_dir` and `run_dir`.
- **Optional Playwright code export** — pass `--code-export` to write a generated Playwright script alongside the session output. Off by default; enable explicitly when the user asks for it.

Kane CLI requires a TestMu AI account. Configuration is per-flag — do not rely on environment variables; pass everything explicitly so runs stay reproducible.

# Steering files

When the user's task makes one of these patterns relevant, load the matching steering file before composing the command:

- **`steering/kane-cli-run.md`** — every `kane-cli run` invocation. Covers objective patterns (action / assertion / extraction), the full flag reference, NDJSON parsing, results presentation, failure diagnosis, parallel execution, and project/folder management.
- **`steering/kane-cli-testmd.md`** — any time the user wants a committable test, or is reading / editing / running a `_test.md` file. Covers the `kane-cli testmd` commands, `_test.md` file format and frontmatter, `@import` composition, the replay-vs-author cache model, `Result.md`, lock conflicts, and CI patterns.
- **`steering/kane-cli-generate.md`** — any time the user wants test cases or scenarios **written** (no browser action). Covers the three generate modes (new / refine / save), clarification round-trips, the refine→save→run loop, the typed NDJSON event schema, and the generate → testmd handoff.

Default to `kane-cli-run.md` for one-shot browser tasks. Switch to `kane-cli-testmd.md` the moment the user says anything like "save this test", "commit this", "regression / smoke test", "make this replayable", or "run in CI" — or asks about a `_test.md` file by name. Switch to `kane-cli-generate.md` when the user says anything like "write test cases for", "give me a test suite for", "generate tests for", "what edge cases should we cover" — or when the task needs cases authored but no browser. **Don't hand-draft test cases in chat or a scratch file** — load the generate steering and use `kane-cli generate`.

# Command reference (condensed)

Run every command with `--agent` so output is structured NDJSON.

```bash
kane-cli run "<objective>" --agent [flags]
```

| Flag | Purpose | Default |
|---|---|---|
| `--agent` | Emit NDJSON to stdout. Mandatory for Kiro. | off |
| `--headless` | Run Chrome without a window. | off |
| `--max-steps <n>` | Cap agent reasoning steps. | 30 |
| `--timeout <s>` | Hard kill after N seconds. | none |
| `--variables '<json>'` | Inline JSON variables. | none |
| `--variables-file <path>` | Variables from a JSON file. | none |
| `--global-context <file>` | Override global context Markdown. | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override project context Markdown. | `.testmuai/context.md` |
| `--cdp-endpoint <url>` | Connect to existing Chrome via CDP. | auto-launch Chrome |
| `--ws-endpoint <url>` | Remote browser via WebSocket. | local Chrome |
| `--code-export` | Generate Playwright code export after upload. | off |

Persist a one-shot run as a re-runnable test:

```bash
kane-cli run "<objective>" --agent --name <slug>
```

On exit, this writes `<cwd>/.testmuai/tests/<slug>_test.md`. Move that file into the repo and run it later via `kane-cli testmd run`. Slug must match `[a-zA-Z0-9_-]+`. **Without `--name` the run is ephemeral** — no `_test.md` is written.

Other commands:

```bash
kane-cli whoami
kane-cli config show
kane-cli config project <project-id>
kane-cli config folder  <folder-id>
kane-cli config set-window 1920x1080
kane-cli config chrome-profile <path>
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."
```

**Exit codes:** `0` passed · `1` failed · `2` error (auth / setup / infra) · `3` timeout or cancelled.

For the full flag reference, NDJSON schema, log layout, and result-presentation rules, load the **`kane-cli-run`** steering file.

# Quick patterns

The objective string is the most important input. Three patterns to know.

**Action** — imperative verbs that perform browser steps.

```bash
kane-cli run "Go to https://www.amazon.in and search for 'laptop'" --agent
```

**Assertion** — verb-led conditions: "assert", "verify", "confirm".

```bash
kane-cli run "Go to {{app_url}}, sign in with {{username}} and {{password}}, assert the dashboard shows 'Welcome'" \
  --agent --headless --timeout 120 \
  --variables '{"username":{"value":"alice"},"password":{"value":"s3cret","secret":true}}'
```

**Extraction (the "store as" pattern)** — required for any value you want back. Vague phrasing ("read", "tell me", "report") does **not** persist values.

```bash
kane-cli run "Go to https://github.com/trending, store the top repo name as 'top_repo' and its star count as 'stars'" \
  --agent --headless
```

Extracted values appear in the terminal `run_end` event's `final_state` object.

**Combined** — action → extraction → assertion in one objective:

```bash
kane-cli run "Go to {{app_url}}/dashboard, store the welcome message as 'welcome_text', store the user role in the sidebar as 'role', assert the role is 'Admin'" --agent
```

For `_test.md` examples and the full `kane-cli testmd` reference, load **`kane-cli-testmd`**.

# Best practices

- **Always pass `--agent`.** Without it, Kane CLI renders a TUI Kiro cannot parse.
- **Include the starting URL in the objective.** Don't assume the agent knows where to start.
- **Use imperative verbs:** "go to", "click", "type", "store as", "assert".
- **Use the `store … as '<name>'` pattern** for any value you want back. Vague phrasing won't persist.
- **Parameterize credentials and environment URLs** with `{{variables}}`. Mark secrets `"secret": true` so they're masked in logs.
- **Headless + a real timeout** for hooks and CI (`--headless --timeout 120`).
- **Split large flows** (>15 agent steps) into multiple parallel runs, each self-contained (own URL, own auth, own assertions).
- **Build automation on `run_end`.** Progress events are for live narration only.
- **On failure, read the screenshot** from `run_dir` and render it inline. Don't paste log paths back to the user.
- **Never expose internal field names** (`run_end`, `final_state`, `session_dir`, `run_dir`) in user-facing messages. Translate them.
- **Don't reach for Playwright / Puppeteer / Selenium directly.** Kane CLI manages Chrome, auth, and the agent.

# Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Exit code `2` with no steps | Auth or Chrome failure | `kane-cli whoami`; re-run `kane-cli login`; ensure Chrome is installed |
| Exit code `3` | Timeout or cancelled | Raise `--timeout` / `--max-steps`, or split the objective |
| `CDP endpoint not reachable` | Stale `--cdp-endpoint` to a Chrome that isn't running | Drop `--cdp-endpoint` and let Kane CLI auto-launch Chrome |
| Agent loops on the same step | Ambiguous objective or page didn't change | Be more specific ("click the **blue** Submit button in the **checkout form**"), add an assertion |
| Agent says "done" but nothing happened | Objective too vague | Add a concrete assertion ("assert the confirmation page shows an order number") |
| Stored value missing from `final_state` | Vague extraction phrasing | Use `"store <thing> as '<snake_case_name>'"` literally |

When a failure looks like a Kane CLI bug (not auth, not a low timeout, not a vague objective, not a website 5xx / CAPTCHA), file at **https://github.com/LambdaTest/kane-cli/issues** with: the objective string, the exact command, the exit code, the last few progress events, and `actions.ndjson` from `{run_dir}/run-test/`. Gather these automatically — don't make the user dig.

# Configuration

Authentication and project / folder targeting come from `kane-cli login` and `kane-cli config` (see Onboarding). Project-local config lives in `./.testmuai/`:

```
.testmuai/
├── context.md                 # project-specific agent context, auto-loaded
└── variables/
    └── *.json                 # project-specific {{variables}}
```

Global config lives in `~/.testmuai/kaneai/`:

```
~/.testmuai/kaneai/
├── tui-config.json            # persistent CLI settings
├── config.json                # shared auth configuration
├── global-memory.md           # global agent context
├── chrome-profile/            # default Chrome user profile
├── profiles/                  # stored credentials
├── sessions/                  # run history (logs + actions.ndjson + screenshots)
└── variables/                 # global variable files
```

Do not configure Kane CLI via environment variables — env-var passthrough is not a guaranteed contract. Use `--username`, `--access-key`, `--profile`, `--variables`, `--variables-file`, and `kane-cli config …` so every run is reproducible from the command line.

---

**Package:** `@testmuai/kane-cli` (npm) · **Source:** https://github.com/LambdaTest/kane-cli · **Connection:** local CLI invoked via shell — no MCP server required.
