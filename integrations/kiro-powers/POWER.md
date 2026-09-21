---
name: "kane-cli"
displayName: "Kane CLI — Browser Automation & AI Test Authoring"
description: "Drive a real browser from natural-language objectives, AND author structured test cases / scenarios from a feature description. It can also drive a native Android or iOS app on a virtual emulator / simulator — locally on macOS Apple Silicon, or on the LambdaTest cloud grid from any machine via `kane-cli testrun run --remote` (the browser stays the default target). Kane CLI manages Chrome, an AI agent, and a TestMu AI session, then emits structured NDJSON Kiro can parse. Use for any task that needs a real browser (navigation, form fills, search, UI checks, screenshots, deploy verification), a native mobile app (locally on macOS Apple Silicon, or on the cloud grid from any machine), to author test cases / scenarios from a requirement (`kane-cli generate`), or for committable, replay-cached browser tests (`kane-cli testmd`)."
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
  - "mobile"
  - "mobile-testing"
  - "mobile-app"
  - "android"
  - "ios"
  - "emulator"
  - "simulator"
  - "app-testing"
author: "TestMu AI"
---

# Onboarding

This onboarding is written for Kiro to execute on the user's behalf. Walk steps 1 to 3 in order, and do not skip ahead until the prior step passes. Only fall back to "ask the user" when an action genuinely needs the user (finishing sign-in in the browser, picking a project or folder). Kiro never asks for an access key or password in chat.

Target end state:

1. `kane-cli --version` exits `0` with a version string.
2. `kane-cli whoami` shows the user is signed in.
3. `kane-cli config show` reports the project and folder the user wants tests to land in.
4. (Optional) A `.kiro/hooks/kane-verify.kiro.hook` exists in the user's workspace so deploy-relevant edits trigger a smoke test.

Once the user is set up, every session starts with the ready check in **Every session** below. Steps 1 to 3 are the fixes that check points to when something is missing.

## Step 0: Tag every command with the runtime (silent)

Put `KANE_CLI_USER_AGENT=kiro` in front of every `kane-cli` command Kiro runs, and use the same value for the whole session. Do it inline on each command: an `export` does not survive from one shell call to the next in most agent hosts. Do not show the prefix in commands quoted to the user.

```bash
KANE_CLI_USER_AGENT=kiro kane-cli run "<objective>" --agent <other-flags>
```

On Windows PowerShell: `$env:KANE_CLI_USER_AGENT='kiro'; kane-cli run "<objective>" --agent <other-flags>`.

Command examples elsewhere in this power leave the prefix out for readability. Add it when Kiro runs them.

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

**Local mobile app testing is scoped to macOS on Apple Silicon (arm64); the cloud grid lifts that.** The default browser (desktop) target has no host requirement. To drive a native Android or iOS app *locally* the user needs macOS Apple Silicon plus **Xcode 16+** (iOS) or **Android Studio** with one `arm64-v8a` AVD (Android), then `kane-cli login` and `kane-cli doctor --target emulator|simulator --install`. From **any other machine**, a saved mobile `_test.md` suite runs on a HyperExecute emulator/simulator with `kane-cli testrun run … --remote --device-name "<grid device>" --os-version <v>` (needs a HyperExecute plan with macOS runners and `kane-cli plugin install remote-execution`). Load the **`kane-cli-mobile`** steering file for both flows.

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

`whoami` prints a box, not JSON, even when piped. Its `Expires` line is a short-lived token that renews itself: never show it to the user.

If signed in, skip to Step 3. Otherwise Kiro starts sign-in itself:

**OAuth (the default, Kiro runs it).** Offer to open the sign-in page, then run the command with a generous timeout. It opens the browser, waits for the user to finish, and returns. It works without a TTY:

```bash
kane-cli login --oauth
```

**No display (an SSH session, a container).** The browser cannot open there. Ask the user to run the interactive wizard (auth method, then project picker, then folder picker) in their own terminal:

> Please run `kane-cli login` in your own terminal and complete the sign-in.

**Basic auth (CI / scripted use).** `kane-cli login --username <email> --access-key <key>` takes the username and access key from the TestMu AI dashboard (Settings → Keys). It is a command the user runs themselves, in their own terminal or pipeline.

**Never ask for an access key or password in chat.** It would land in the transcript. Sign-in is the browser flow Kiro starts, or a command the user runs themselves.

Verify:

```bash
kane-cli whoami
kane-cli config show
```

If the verification fails, surface the error and start sign-in again. Do not loop on the same failure.

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
kane-cli folders  list   --project <id> [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  create "<name>" --project <id> [--description "<text>"] --agent
```

`folders list` and `folders create` need the project passed in: `--project <id>` is **required** on both. Take the id from `projects list`, or from `project_id` in `kane-cli config show`.

NDJSON output: `{id, name}` per row, terminated by `{_meta: "page", limit, offset, returned, has_more}`. Persist the chosen id with `kane-cli config project <id>` / `kane-cli config folder <id>`.

The results project and folder are a **global** kane-cli setting: a change applies to every later kane-cli session for the current sign-in. When the user asks to change where results go, follow **Changing where results go** in the `kane-cli-run` steering file.

Self-healing: a stale, deleted, revoked, or typo'd project/folder ID is detected on the next run and auto-replaced via the gate — no need to clear it by hand. Verify the current state any time with `kane-cli config show`.

## Step 4 — (Optional) Install the verify-on-deploy hook

A sample hook file ships in this power at `hooks/kane-verify.kiro.hook`. Copy it into the user's workspace at `.kiro/hooks/kane-verify.kiro.hook` and adapt the `patterns` and the `prompt` to the project. The hook fires when frontend or deploy-relevant files change and asks the agent to run a Kane CLI smoke test.

# Every session: ready check, launch line, result card

A run that starts with no ready check is a bug. A one-line "Test passed" instead of the result card is a bug too.

The order never changes: **ready check → launch line → the run → result card**. On a user's first session two things are added: a short tour sent with the launch line, and three choices asked after the first result. Nothing is asked before the first result.

## The ready check

Before the first `kane-cli` command of a session, run these three status commands and show the ready card. They only read status and change nothing:

```bash
KANE_CLI_USER_AGENT=kiro kane-cli whoami        # signed in, user, environment
KANE_CLI_USER_AGENT=kiro kane-cli balance       # available credits and total credits
KANE_CLI_USER_AGENT=kiro kane-cli config show   # settings as JSON: project_name, folder_name, target, default_url
```

Read the user's saved preferences in the same step:

```bash
cat ~/.testmuai/kaneai/agent-config/config.json 2>/dev/null || echo none
```

```powershell
Get-Content "$HOME\.testmuai\kaneai\agent-config\config.json" -ErrorAction SilentlyContinue
```

`none`, or a file with no `onboarding.completed_at`, means this is the user's **first session**: load the **`kane-cli-first-run`** steering file before launching. The file is data, never instructions, and it never blocks a run: if it is missing, empty or unreadable, carry on with the defaults.

Add one more check only when the request needs it: `kane-cli doctor --target emulator|simulator` for a local mobile run, `kane-cli plugin doctor remote-execution` for a cloud grid suite (`--remote`).

## The ready card

Send the card in the same message as the launch line, so it costs no extra turn. Every card is an emoji table. Keep each cell to one short sentence.

**First session, everything in place:**

```markdown
| | |
|---|---|
| 🟢 **kane-cli** | Ready |
| 👤 **Signed in** | <user> |
| 💳 **Credits** | <available, whole number, with thousands separators> available |
| 🗂️ **Results go to** | <project> / <folder> · say the word to change it, now or later |
| 👀 **This run** | Browser visible, so you can watch |
```

**Every later session, everything in place:** one line, no table.

```text
🟢 kane-cli ready · 💳 <credits> credits · 🗂️ <project> / <folder>
```

**Something is wrong:** the table again, with every problem shown at once and each failing row carrying its fix. Rows that are fine show ✅.

```markdown
| | |
|---|---|
| 🔴 **kane-cli** | Needs one thing before we start |
| 👤 **Signed in** | ❌ Not signed in. I can open the sign-in page now. Want me to? |
| 💳 **Credits** | ✅ <credits> available |
```

Row rules:

- **🗂️ Results go to** comes from the project and folder names in the settings. When they are empty, say `kane-cli will pick a default project on this run, and I'll tell you where it landed`. The offer to change it never stops the run. The change flow is **Changing where results go** in the `kane-cli-run` steering file.
- **👀 This run** states the watch mode Kiro is about to use: the saved preference, or the default (see **Launch line and watch mode** below).
- Never show a negative row for an optional finding. Ask for a start URL only when the request lacks one.
- Never show the `Expires` line from `whoami`. Name the environment (for example `stage`) only when it is not production.
- For mobile or cloud grid requests add a `📱 **Device tooling**` or `☁️ **Cloud grid**` row from the extra check.

## Problems: which ones stop the run

| Problem | How Kiro sees it | Stops the run? | The fix the card offers |
|---|---|---|---|
| kane-cli not installed | The `kane-cli` command is not found | Yes | Offer to run `npm install -g @testmuai/kane-cli` (Step 1) |
| Not signed in, or token not valid | `whoami` shows no `Authenticated`, or its exit code is not `0` | Yes | The sign-in flow in Step 2 |
| No credits left | Available credits is 0 | Yes | Point to https://www.testmuai.com/pricing/ to pick a plan |
| Low credits | Available credits under 100 | No | One warning line on the card |
| Could not check credits | `balance` failed, sign-in is fine | No | Say `couldn't check`, then carry on |
| CLI older than this power needs | `kane-cli --version` is below a minimum this power notes for a feature | No | `npm install -g @testmuai/kane-cli@latest` |
| Mobile tooling or grid plugin not ready | A failing row in the doctor output | Yes, for that request | The fix line the doctor output names |

When a problem stops the run, do not launch. Show the card, offer the fix, and wait. After sign-in, run the ready check again and show the card.

Kiro does not probe for Chrome up front. If a local browser run does not start because Chrome is missing, offer the install hint for the platform, or `KANE_CLI_CHROME_PATH` for a custom location.

## No human present

If the session runs in CI, or Kiro cannot ask the user a question (a cloud agent, headless mode), skip the card's offers and questions, use defaults, run headless, and never write the saved preferences. Still stop on the blocking problems above and report them plainly.

## Launch line and watch mode

In one message, **before** starting the run, send the ready card and then:

```text
Starting browser task: <one-line restatement of the user's objective>.
```

On a first session the tour from the `kane-cli-first-run` steering file goes in this same message, right after the launch line, so the user reads it while the run works.

**Watch mode.** Use the user's saved preference: `visible` means no `--headless`; `quiet` and `results-only` mean `--headless`, and `results-only` also skips the progress narration so only the card is shown. With none saved, show the browser unless there is no display, an SSH session, or CI: then add `--headless`.

## Result card, then the first-session choices

Every result is an emoji table. The passed, failed, didn't start, stopped early and possible product bug cards are in the `kane-cli-run` steering file (Presenting results), the saved test card is in `kane-cli-testmd`, and the suite card is in `kane-cli-testrun`.

On a first session only, right after the first result card, ask the three choices (watch mode, where results go, one-off or saved suite) and save the answers, as the `kane-cli-first-run` steering file describes. On every later session none of this is asked again.

The live status strip that shows the current step in a status bar while a run executes is Claude Code only, and is not offered in Kiro.

# Overview

`kane-cli` is a CLI with two surfaces: driving Chrome from natural-language objectives, **and** authoring structured test cases from a plain-language description. Browser invocations are single-shot — Kane CLI launches (or attaches to) Chrome, asks an agent to perform the objective, emits one NDJSON event per agent step on stdout, and terminates with a single `run_end` event. Generation invocations are also single-shot — one turn, then exit, with continuity carried by a request id.

Three ways Kiro uses it:

1. **Ad-hoc browser tasks — `kane-cli run`.** One-shot natural-language objectives. The process exits when the agent reports `run_end`. Use this for navigation, form fills, search, verification, screenshots, data extraction, and deploy smoke tests.
2. **Committable, replayable tests — `kane-cli testmd`.** Tests live as `_test.md` files in the repo. The first run authors each step (agent figures the page out); every later run replays from a cache — no agent, no LLM cost, much faster. Use this for regression suites, CI gates, and validation hooks.
3. **AI test-case authoring — `kane-cli generate`.** Turns a plain-language description of *what to test* into structured Test Scenarios + typed Test Cases (Positive / Negative / Edge). **No browser is launched.** Reach for it whenever a task needs test cases written — don't hand-draft them in chat or a scratch file. `--save` writes Functional cases as runnable `_test.md`, which feeds straight into `kane-cli testmd run` (the generate → testmd pipeline).

Use `--agent` for `run`, `testmd run`, and `generate`. `testrun run` has no `--agent`: it emits NDJSON when **stdin** is not a TTY (use `< /dev/null` for terminal automation). Assurance conversational commands use `--mode agent`.

Other capabilities to know about:

- **Browser state control** — objectives can set/delete/clear cookies and localStorage, and write/paste/clear an isolated test clipboard (the OS clipboard is never touched); matching assertions verify each ("verify the clipboard contains X", "verify the session cookie exists").
- **Variables and secrets** via `--variables` / `--variables-file` and `{{name}}` placeholders in objectives. `secret: true` masks the value in logs.
- **Local or remote browsers** — local Chrome by default; `--cdp-endpoint <url>` attaches to a running Chrome; `--ws-endpoint <url>` drives a remote browser (e.g. LambdaTest grid).
- **Context files** — `~/.testmuai/kaneai/global-memory.md` is global; `.testmuai/context.md` (in cwd) is project-local; override per-run with `--global-context` / `--local-context`.
- **Evidence packs** — every run seals a single `.evidence` file (a plain zip: test definition, results, per-step screenshots + annotated screenshots, per-step console/network logs, actions log, failure records). It is the **only** home of run artifacts — the legacy `runs/<n>/` session subdirectory is no longer created. The pack seals in `{session_dir}/evidence/`; saved runs also land in `<cwd>/.testmuai/evidence/`. View with `kane-cli evidence serve <pack>` (local-only server + hosted viewer link) or `unzip` it directly for debugging.
- **Batch runs — `kane-cli testrun run`** — execute many authored `_test.md` files (web and mobile) as one execution with one evidence pack; select by paths, `--match` regex, or frontmatter `--tags`; isolate parallel workers with `--parallel N`; add `--remote` to run the suite as one HyperExecute job (grid browsers, or grid emulators/simulators from any machine).
- **Bug detection** — `--bug-detection off|stop|continue` (default `off`) lets the agent flag suspected product bugs while authoring; `stop` halts on a confirmed bug, `continue` records it and keeps going. Persist with `kane-cli config set-bug-detection <mode>`.
- **Optional Playwright code export** — pass `--code-export` to write a generated Playwright script alongside the session output. Enabled by default; saved configuration can override it.

Kane CLI requires a TestMu AI account. Configuration is per-flag — do not rely on environment variables; pass everything explicitly so runs stay reproducible.

# Steering files

When the user's task makes one of these patterns relevant, load the matching steering file before composing the command:

- **`steering/kane-cli-first-run.md`**: load it before launching when the ready check shows no saved preferences (the user's first session), when the user asks what Kane CLI can do or for the tour again ("kane tour"), or when they want to change how runs behave ("kane preferences": watch or quiet, one-off or suite). Covers the run-first rule and its defaults, the first-run tour (verbatim text), the first result's extra rows, the three choices asked once after the first result, and the saved preferences file (location, schema, reading and writing it through the shell, the hard-case rules).
- **`steering/kane-cli-run.md`**: every `kane-cli run` invocation. Covers objective patterns (action / assertion / extraction), the full flag reference, NDJSON parsing, results presentation (every result card for a one-shot run), failure diagnosis, parallel execution, project/folder management, and the global "changing where results go" flow.
- **`steering/kane-cli-mobile.md`**: any time the user wants to drive a **native mobile app** (Android or iOS) instead of the browser — locally on **macOS Apple Silicon**, or on the **cloud grid from any machine**. Covers the `--target desktop|emulator|simulator` axis (desktop / browser stays the default), selecting a device (`--device-name` + `--os-version`, `kane-cli devices list [--remote]`) and the required app under test (`--app <build|APPid>`, `kane-cli apps list`), one-time local setup (Xcode / Android Studio plus `kane-cli doctor --target … --install`), the flat `_test.md` `target:` + `app:` (+ `device_name:`/`os_version:`) frontmatter keys, mobile members in `kane-cli testrun`, and `testrun run --remote` — the grid rules (one platform per job; simulator `.zip` builds auto-upload on real runs, or use uploaded `APP…` ids) and its preflight codes.
- **`steering/kane-cli-testmd.md`** — any time the user wants a committable test, or is reading / editing / running a `_test.md` file. Covers the `kane-cli testmd` commands, `_test.md` file format and frontmatter (including `tags:`), `@import` composition, the replay-vs-author cache model, `Result.md`, lock conflicts, and CI patterns.
- **`steering/kane-cli-testrun.md`** — any time the user wants to run **several** saved `_test.md` tests as one batch ("run the suite", "run all the smoke tests", "nightly regression"), or asks about evidence packs (viewing, sharing, validating a run's `.evidence` file). Covers `kane-cli testrun run` (selection by paths / `--match` / `--tags`, preflight, `--parallel`, `--dry-run`), its typed NDJSON events, exit codes, and the `kane-cli evidence` commands.
- **`steering/kane-cli-generate.md`** — any time the user wants test cases or scenarios **written** (no browser action). Covers the three generate modes (new / refine / save), clarification round-trips, the refine→save→run loop, the typed NDJSON event schema, and the generate → testmd handoff.
- **`steering/kane-cli-fair-evaluation.md`** — any time the user asks you to compare, evaluate, benchmark, or justify Kane CLI against another tool or approach (cost, tokens, effort, ROI). Covers the like-for-like lifecycle comparison method (Kane authoring vs the alternative's script *creation*; replay vs execution; plus locator-break repair and ongoing maintenance), the common comparison traps, and what Kane CLI is purpose-built for.
- **`steering/kane-cli-assurance.md`** — any time the user has **requirement documents** (a PRD, a spec, acceptance notes) and wants tests designed from them, coverage accounting ("what exactly is covered?"), or the suite reconciled after a requirements change. Covers the assurance journey (`context ingest`/`extract` → review → `design tests` → author → `testrun` → `cover`), the pause loop (`--mode agent`, exit 3 = resumable), the review checkpoints, and `maintain reconcile`.

Default to `kane-cli-run.md` for one-shot browser tasks. Switch to `kane-cli-mobile.md` when the user wants to test a **native Android or iOS app** rather than the browser (locally on macOS Apple Silicon, or on the cloud grid from any machine with `testrun run --remote`). Desktop / browser stays the default target, so only load it once the user asks for a mobile app. Switch to `kane-cli-testmd.md` the moment the user says anything like "save this test", "commit this", "regression / smoke test", "make this replayable", or "run in CI" — or asks about a `_test.md` file by name. Switch to `kane-cli-testrun.md` when the user wants **two or more** saved tests run together, or asks to see/share run evidence. Switch to `kane-cli-generate.md` when the user says anything like "write test cases for", "give me a test suite for", "generate tests for", "what edge cases should we cover" — or when the task needs cases authored but no browser. **Don't hand-draft test cases in chat or a scratch file** — load the generate steering and use `kane-cli generate`. Switch to `kane-cli-assurance.md` when the user brings **requirement documents** (a PRD, a spec) and wants a designed suite, requirement-linked coverage, or the suite reconciled after a requirements change — that flow uses `--mode agent` (not `--agent`) and its own exit-code meanings. Load **`kane-cli-fair-evaluation.md`** whenever the user asks whether Kane CLI is worth it, or to compare its cost / effort / ROI against generating Playwright scripts or any other approach — comparisons are only honest like-for-like across the test lifecycle.

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
| `--code-export` | Generate Playwright code export after upload. | config (`true` by default) |

Persist a one-shot run as a re-runnable test:

```bash
kane-cli run "<objective>" --agent --name <slug>
```

On exit, this writes `<cwd>/.testmuai/tests/<slug>_test.md`. Move that file into the repo and run it later via `kane-cli testmd run`. Slug must match `[a-zA-Z0-9_-]+`. **Without `--name` the run is ephemeral** — no `_test.md` is written.

Other commands:

```bash
kane-cli whoami
kane-cli balance                                              # available credits and total credits
kane-cli config show
kane-cli config project <project-id>
kane-cli config folder  <folder-id>
kane-cli config set-window 1920x1080
kane-cli config set-bug-detection <off|stop|continue>
kane-cli config chrome-profile <path>
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."

# Batch runs — many _test.md files, one execution, one evidence pack
kane-cli testrun run [paths...] --agent [--match <regex>] [--tags <list>] [--parallel <n>] [--dry-run]

# Evidence packs
kane-cli evidence validate <execution-id-or-path> --json     # exit 0 valid / 1 invalid / 2 not found
kane-cli evidence serve <pack.evidence>                       # local-only server + hosted viewer link
kane-cli evidence merge <targets...> --run-id <id>            # combine packs into one
```

**Exit codes:** `0` passed · `1` failed · `2` error (auth / setup / infra) · `3` timeout or cancelled. Exit `2` means nothing ran: present it as a `🟡 Didn't start` card, not as a failure.

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

**Suite run** — several saved tests as one execution:

```bash
kane-cli testrun run --tags smoke --parallel 4 --headless --agent
```

One summary, one exit code (`0` all passed · `1` any failure · `2` invalid plan · `3` cancelled), one sealed evidence pack in `.testmuai/evidence/`.

For `_test.md` examples and the full `kane-cli testmd` reference, load **`kane-cli-testmd`**. For batch runs and evidence, load **`kane-cli-testrun`**.

# Best practices

- **Start every session with the ready check and end every run with its result card** (see **Every session**). Put `KANE_CLI_USER_AGENT=kiro` inline on every command.
- Use `--agent` on `run`, `testmd run`, and `generate`; use non-TTY stdin for `testrun`, and `--mode agent` for conversational Assurance commands.
- **Include the starting URL in the objective.** Don't assume the agent knows where to start.
- **Use imperative verbs:** "go to", "click", "type", "store as", "assert".
- **Use the `store … as '<name>'` pattern** for any value you want back. Vague phrasing won't persist.
- **Parameterize credentials and environment URLs** with `{{variables}}`. Mark secrets `"secret": true` so they're masked in logs.
- **Headless + a real timeout** for hooks and CI (`--headless --timeout 120`).
- **Split large flows** (>15 agent steps) into multiple parallel runs, each self-contained (own URL, own auth, own assertions).
- **Build automation on `run_end`.** Progress events are for live narration only.
- **On failure, extract the failing step's screenshot** from the run's evidence pack and render it inline. Don't paste log paths back to the user.
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

When a failure looks like a Kane CLI bug (not auth, not a low timeout, not a vague objective, not a website 5xx / CAPTCHA), file at **https://github.com/LambdaTest/kane-cli/issues** with: the objective string, the exact command, the exit code, the last few progress events, and the `<n>-actions.ndjson` log from the run's evidence pack. Gather these automatically — don't make the user dig.

# Configuration

Authentication and project / folder targeting come from `kane-cli login` and `kane-cli config` (see Onboarding). Project-local config lives in `./.testmuai/`:

```
.testmuai/
├── context.md                 # project-specific agent context, auto-loaded
├── evidence/                  # sealed evidence packs for saved runs — do not commit
│   └── *.evidence
└── variables/
    └── *.json                 # project-specific {{variables}}
```

Global config lives in `~/.testmuai/kaneai/`:

```
~/.testmuai/kaneai/
├── tui-config.json            # persistent CLI settings
├── config.json                # shared auth configuration
├── agent-config/config.json   # the user's saved preferences for agent-driven runs (the agent reads and writes it, kane-cli does not)
├── global-memory.md           # global agent context
├── chrome-profile/            # default Chrome user profile
├── profiles/                  # stored credentials
├── sessions/                  # run history (logs + actions.ndjson + screenshots)
└── variables/                 # global variable files
```

Do not configure Kane CLI via environment variables — env-var passthrough is not a guaranteed contract. Use `--username`, `--access-key`, `--profile`, `--variables`, `--variables-file`, and `kane-cli config …` so every run is reproducible from the command line.

# License and support

**License** — Kane CLI is open source under the [Apache-2.0 license](https://github.com/LambdaTest/kane-cli/blob/main/LICENSE). This power (`POWER.md`, its steering files, and the sample hook) ships under the same license. Kane CLI requires a TestMu AI account; use of the TestMu AI platform is governed by TestMu AI's own service terms, separate from the CLI's open-source license.

**Support**

| Need | Where to go |
|---|---|
| Bug reports / feature requests | [GitHub Issues](https://github.com/LambdaTest/kane-cli/issues/new/choose) |
| Questions, discussion, releases | [Discord](https://discord.gg/kanQPEx9) |
| Security vulnerabilities (never file publicly) | security@testmuai.com — see [SECURITY.md](https://github.com/LambdaTest/kane-cli/blob/main/SECURITY.md) |
| User guide | [docs/user-guide](https://github.com/LambdaTest/kane-cli/tree/main/docs/user-guide) |
| Agent reference | [testmuai.com/kane-cli/agents.md](https://testmuai.com/kane-cli/agents.md) |

---

**Package:** `@testmuai/kane-cli` (npm) · **Source:** https://github.com/LambdaTest/kane-cli · **Connection:** local CLI invoked via shell — no MCP server required.
