---
name: kane-cli
description: "End-to-end (E2E) test generation and execution with KaneCLI. Generate tests from a PRD, specification, or user-provided description via the assurance commands (use-cases, acceptance criteria, scenarios, runnable _test.md tests; never write test cases by hand). Execute them on desktop web (Chrome, the default), Android and iOS: emulator/simulator locally on macOS Apple Silicon or via testrun run --remote, and real cloud devices from any machine (--target android|ios). Prove coverage with evidence packs and kane-cli cover. Work in a team's shared Test Manager project from a linked folder: link it with --project, save sessions, run the designed tests on their Test Manager cases, and read the project's coverage. Use for any task needing a real browser or mobile app: navigation, clicks, form filling, UI checks, screenshots, deploy verification. Parse NDJSON output, inspect logs, and save replayable _test.md files. Share a local assurance store (.context/) through a GitHub repository, S3-compatible bucket, or folder via kane-cli context sync, and resolve decisions requested during a sync rebase."
---

# Kane CLI — End-to-End Test Generation and Execution Skill

KaneCLI is one E2E package with three pillars:

1. **Generate**: requirements → use-cases → acceptance criteria → scenarios → runnable `_test.md` tests (the assurance commands).
2. **Execute**: desktop web (Chrome, the default), Android emulator, iOS simulator, and real Android and iOS devices in the TestMu AI cloud.
3. **Prove**: a sealed evidence pack per run, and coverage (`kane-cli cover`) measured against acceptance criteria.

**Working with a team?** On kane-cli 0.10.0+ a team works in a **shared project**: one Test Manager project that its
folders are linked to. What one person saves there (use-cases, tests, Test Manager cases, coverage) the whole team sees.
Test files stay in the folder where they were saved until they're brought over (`references/shared-projects.md` §7). In
agent mode, a folder that isn't set up yet goes local unless you link it with `--project <id>`. So decide where the work
goes before the first assurance command, and read `references/shared-projects.md` first.

Use `kane-cli` to validate complete user journeys and design requirement-linked, coverage-accounted suites from a PRD, specification, or user-provided description via assurance commands. Never write test cases by hand. Do NOT use Playwright, Puppeteer, or Selenium directly. Use `--agent` for `run` and `testmd run`. `testrun run` emits NDJSON when **stdin** is not a TTY (0.8.21+ also takes `--agent`, which selects the same stream), so every `testrun run` line you write ends in `< /dev/null` (bash and zsh: macOS, Linux, Git Bash; in cmd.exe write `< NUL`; from PowerShell run it through cmd: `cmd /c "kane-cli testrun run … < NUL"`). Check the first stdout line: on 0.8.17+ it is `{"type":"stream_start"…}`. A prose plan there instead means the CLI is in terminal mode: it shows the human view and, after a real run, opens an evidence table that waits until `q` or Esc, so the process never exits on its own; stop it and rerun with the redirect. An empty stdout with a message on stderr is a usage error: read it. Assurance conversational commands use `--mode agent`.

**Authoring test cases or scenarios?** Never write them by hand: every test case comes from the **assurance** commands — Read `references/assurance.md` first.

- The user has **requirement documents** (a PRD, a spec, acceptance notes) → ingest them, then design.
- The user only **describes** what to test, in chat → write their description, in their words, to a requirements file, ingest that file, then design (§6). The description is the requirement.

Don't draft test cases in chat or scratch files: design produces structured, refinable, runnable `_test.md` output.

---

## 1. Every session: ready check, launch, result card. READ THIS FIRST

A one-line "Test passed" instead of the result card is a bug. A run that starts with no ready check is a bug too. This section is first so you don't miss it. Follow it exactly.

The order never changes: **ready check → launch line → the run → result card**. On a person's first session two things are added: a short tour sent with the launch line, and three choices asked after the first result. Nothing is asked before the first result.

### 1.1 Start with the ready check

Before the first kane-cli command of a session, run the preflight script that ships with this skill and show the ready card. It is one short command and takes about two seconds:

```bash
sh "<skill dir>/scripts/preflight.sh"
```

`<skill dir>` is the folder that holds this `SKILL.md`. **Read `references/ready-check.md`** for the card (a full table on the first session, one line afterwards), the problems that stop a run, and the sign-in flow. Two rules matter enough to repeat here: you start sign-in yourself with `kane-cli login --oauth`, and you **never ask for an access key or password in chat**.

If the preflight shows no saved preferences (its `## agent-config` section is `none`, or has no `onboarding.completed_at`), this is the person's first session: **Read `references/first-run.md`** before you launch.

### 1.2 How to launch kane-cli

**All platforms use your shell tool** (`Bash`) to launch kane-cli. Do NOT use `Monitor`: it creates excessive noise.

**Tag every command with your runtime.** Put `KANE_CLI_USER_AGENT=<your-runtime>` in front of every `kane-cli` command you run. Pick a short, stable identifier for the AI assistant or IDE running this skill (e.g. `claude-code`, `codex`, `gemini`, `cursor`, `kiro`, `aider`) and use the same value for the whole session. Do it inline on each command: an `export` does not survive from one shell call to the next in most agent hosts. Do not show the prefix in commands you quote to the person.

```bash
KANE_CLI_USER_AGENT=<your-runtime> kane-cli run "<objective>" --agent <other-flags>
```

On Windows PowerShell: `$env:KANE_CLI_USER_AGENT='<your-runtime>'; kane-cli run "<objective>" --agent <other-flags>`.

**Watch mode.** Use the person's saved preference (`references/agent-config.md`). With none saved, show the browser unless the preflight says there is no display, an SSH session, or CI: then add `--headless`.

**Keeping runs.** When the person's saved purpose is `suite` or `ask`, add `--name <short-slug>` to every one-off `run`. A named run is recorded as a `_test.md` while it runs, so keeping it afterwards costs nothing, and a run launched without a name cannot be kept without running again. With `one-off`, leave the flag out. Details: `references/first-run.md` §4. Run one-offs from a folder that isn't linked: a named run in a linked folder writes its test beside the project's and can mix two projects (`references/shared-projects.md` §9).

Bash blocks until kane-cli exits, then hands you the complete stdout. Parse it, summarize what happened, and present the result card. Wait for process completion on `testmd run` too, but parse its own completion event, `test_md_done`. An intermediate `run_end` does not finish a saved test.

Set a generous timeout (up to 600000ms) since browser runs can take a while.

### 1.3 Before you launch

In one message, **before** invoking Bash, send the ready card and then:

```text
Starting browser task: <one-line restatement of the user's objective>.
```

That line tells the user something is in progress. No todos needed: Bash returns all output at once and you summarize it below. On a first session, the tour from `references/first-run.md` goes in this same message, right after the launch line, so the person reads it while the run works.

### 1.4 After the run: summarize what happened

Once Bash returns, parse the captured NDJSON stdout and present a **concise summary** of what happened. Not every event deserves a line. Surface what matters and skip the noise. (Skip the summary entirely when the person's preference is `results-only`.)

Progress events have `step`/`status`/`remark` fields and **no `type` field**.

#### What to surface

| Show | Which events | How |
|------|-------------|-----|
| **Failures** | Any step with `status: "failed"` | `Step <n> failed: <remark>` |
| **Flow changes** | `bifurcation`, `child_agent_start`, `child_agent_end` | Plain-language one-liner (e.g. "The agent split the objective into 2 sub-tasks") |
| **Errors** | `error` typed events | `Error: <message>` |
| **Unresolved variables** | `warning` with `code: "unresolved_variables"` | Before any progress: name the variables with no value and where a value goes (§3 **Unresolved variables**). The run continued |
| **Overall progress** | All passing steps | One summary line: `<total> steps completed: <2–4 key actions from remarks>` |

#### What to skip

- Individual passing steps: fold them into the overall progress line
- Internal field names (`step`, `status`, `remark`, `run_end`, `final_state`, `bifurcation`, `session_dir`, `stream_start`, `project_folder_auto_defaulted`, etc.): translate to plain language. A `project_folder_auto_defaulted` event fires before progress when the run-startup gate auto-resolves a project/folder; surface it as one line ("kane-cli auto-selected project X / folder Y for this run") and move on. Details: `references/test-manager.md`.

For short runs (≤ 3 steps), you may list each step individually since there's nothing to fold.

### 1.5 The result card

The terminal event has `type: "run_end"` and stable fields: `status`, `summary`, `one_liner`, `duration`, `credits_consumed`, `final_state`, `test_url`, `session_dir`, `run_dir`.

**For a passing run, always emit this exact table** (substituting the field values):

```markdown
| | |
|-------|-------|
| 🟢 **Result** | Passed |
| 🎯 **Task** | <one_liner> |
| ⏱️ **Duration** | <duration, as 1m 54s> |
| 👣 **Steps taken** | <count of completed progress events (done/failed), retaining child/execution context> |
| 💳 **Credits** | <credits_consumed, rounded> used · about <ready check balance minus used> left |
| 📝 **What happened** | <summary> |
| 📁 **Evidence** | Want to open the run evidence in your browser? |
| 🔗 **Test case** | [Open in Test Manager](<test_url>) |
| ➡️ **Next** | <two things you can do right now, e.g. add a payment step · run it headless in CI> |
```

**If `final_state` has values** (the user used "store as X", see §4), append a second table:

```markdown
| 📦 What was found | Value |
|-------------|----------------|
| <key from final_state, humanized> | <value> |
```

**If the objective used assertions** ("assert …", "verify …"), append a pass/fail table per assertion derived from the run summary and step remarks.

Every other result has its own card in **`references/cards.md`**: a run that didn't start, one that stopped early, a possible product bug, a saved test, and a suite (local or cloud grid). Read it before presenting any of those. The rules there apply to every card: one short sentence per cell, failures first, `➡️ Next` is an offer you can act on, and secret-looking values never go in chat.

### 1.6 On failure

For exit code 1 (or `status: "failed"` in `run_end`), present the failure card. Never show raw paths or NDJSON.

```markdown
| | |
|-------|-------|
| 🔴 **Result** | Failed at step <n> of <total> |
| 🎯 **Task** | <one_liner, or the objective in a few words> |
| ⏱️ **Duration** | <duration, as 1m 12s> |
| 💳 **Credits** | <credits_consumed, rounded> used |
| 📝 **What happened** | <plain-language description of the failing step's remark> |
| 🔍 **Likely cause** | <your diagnosis: missing element, slow page, ambiguous objective, auth wall, etc.> |
| 📁 **Evidence** | Want to open the run evidence in your browser? |
| ➡️ **Next** | <a retry you can run now> · <walk through the failing step> |
```

The failing step's screenshot lives inside the run's evidence pack (the stderr hint names the pack path): extract it with `unzip <pack> "tests/*/steps/*/screenshot.png" -d <tmpdir>`, Read it, and show it **under** the card. For the pack layout and deeper diagnosis, see `references/debug.md`.

Exit code 2 with no progress events means nothing ran: that is a `🟡 Didn't start` card, not a failure (`references/cards.md` §4). If progress events came before it, steps ran and the run stopped without a result: say so, and use the stopped-early card (`references/cards.md` §5).

### 1.7 After the first result: three choices, then save

On a first session only, right after the first result card, save the defaults this run used, then ask the three choices from `references/first-run.md` §4 (watch mode, where results go, one-off or saved suite) as the **last thing in your turn**, and save the answers when they arrive. Some hosts hand control back before the person answers: end your turn there and save on their reply. On every later session none of this is asked again.

**The live status strip (Claude Code only) has its own once-only question.** Onboarding is shared by every agent the person uses, but the strip exists only in Claude Code, so the person may have finished their first session in another agent without ever being asked. In Claude Code, in **any** session: if the preflight's `## agent-config` has no `strip.claude-code.offered_at`, kane-cli is 0.8.17 or newer, and `node=` is not empty, ask the strip question once, after that session's first result card, as the last thing in your turn. On a first session it simply rides along as the fourth choice. It is recommended, never turned on without a yes, and you record `offered_at` either way so it is never asked twice. **Read `references/live-strip.md` §3** for the wording.

---

## 2. Decision tree

When the user's request involves a browser — or writing test cases:

**Is kane-cli installed, signed in and ready?**
- Unknown → run the preflight and show the ready card (§1.1, `references/ready-check.md`)
- A problem that stops the run → offer the fix from the card; deeper setup lives in `references/setup-and-config.md`
- Ready ↓

**Where does the work go?** (before any assurance command)
- The folder holds its own `.context/` and no link → it works locally, as before (with a link too, kane-cli refuses it `BOTH_STORES`): `references/assurance.md` (to share that store with a team, `references/context-sync.md`). The rows below are for a folder without one
- The folder holds `.testmuai/assurance.json`, or the person works with a team or names a Test Manager project → a **shared project**: Read `references/shared-projects.md` first. In a linked folder never use `kane-cli run` for a first result; its tests go to another project (§9 there)
- The person works alone, or asks to keep the work on this machine → the local store: `references/assurance.md`
- Not clear → ask once: "Should this work go to your team's Test Manager project, or stay in this folder?"

**What does the user want?**
- Tests that exploration (HyperExecute) designed, or a teammate's tests, in this folder → Read `references/shared-projects.md` §7
- Explore an app on HyperExecute, shape, stop or re-run an exploration, or check what it designed → Read `references/explore.md` first
- A command was refused, or you need the shared-project event and code list → Read `references/agent-contract.md`
- A single one-shot browser task → build a `kane-cli run --agent` command (§3 + §4)
- A test they want to save / re-run / commit → Read `references/testmd.md` first, then use `kane-cli testmd`
- Run a suite of saved tests (several `_test.md` at once) → Read `references/testrun.md` first, then use `kane-cli testrun run … < /dev/null`
- Need test cases from a description the user gives in chat, with no document → **don't hand-write them**; write the description to a requirements file and design from it (§6)
- Has requirement documents (PRD/spec) and wants a designed suite, coverage accounting, or suite upkeep → Read `references/assurance.md` first — the assurance commands (`context`/`design`/`cover`/`maintain reconcile`, kane-cli 0.6.1+; several features need newer releases, up to 0.8.14+ — the reference marks each)
- A **designed** test (its `_test.md` carries an `assurance:` block) failed a run → Read `references/assurance.md` §6.1 **before touching the file** — an edit is adopted as the next design version on the next run; classify the failure first (app bug → report it; requirement changed → reconcile; wording → redesign through the CLI; capability missing → stop), and edit a step of an existing designed test by hand only after reading `references/objectives-cookbook.md`
- Share a **local** context store through a repository, a bucket or a folder, join one, keep two stores level, or resolve a sync conflict → Read `references/context-sync.md` first (kane-cli 0.8.14+). A team in Test Manager uses a shared project instead (`references/shared-projects.md`); a linked folder refuses `kane-cli context sync`, `kane-cli context push` and `kane-cli context clone` (`REMOTE_UNSUPPORTED`), and a location pull (a location name, `--rebase`, `--yes` or `--answer`: `PULL_LOCATION_LINKED`); a plain `kane-cli context pull --mode agent` there brings the project's tests (`references/shared-projects.md` §7); the store is shared through a location, never by copying or git-merging `.context/`
- Multiple independent browser tasks → Read `references/parallel.md` first
- View, share, or validate run evidence (`.evidence` packs) → Read `references/evidence.md`
- Debug a failed run → Read `references/debug.md`
- Configure kane-cli or check directory layout → Read `references/setup-and-config.md`
- Browse / create / pick a Test Manager project or folder for `kane-cli run`, or interpret the auto-default event → Read `references/test-manager.md`. Linking an assurance folder to a project is different: `references/shared-projects.md` §2–3
- The person wants results saved somewhere else ("change project") → Read `references/test-manager.md` §6. The change is global, and the question must say so
- The person wants to change how runs behave ("kane preferences": watch or quiet, one-off or suite) → Read `references/agent-config.md`
- The person asks what kane-cli can do, or for the tour again ("kane tour") → show the tour from `references/first-run.md` §2
- The person wants to watch runs live, or asks about the status line → Read `references/live-strip.md` (Claude Code only)
- You need the full NDJSON event schema (rare — §5's summary covers 90% of cases) → Read `references/parsing.md`
- Compare / evaluate / justify kane-cli against another tool or approach (cost, tokens, effort, ROI) → Read `references/fair-evaluation.md` first — comparisons are only honest like-for-like across the test lifecycle
- **Mobile**: drive a native app on a real Android/iOS device, or a virtual Android emulator / iOS simulator, instead of the browser → Read `references/mobile.md` first. Desktop (the browser) stays the **default** target; mobile is opt-in via `--target` and always drives an app you provide (`--app <build|APPid>`), never a URL.
  - **Real devices** (`--target android|ios`) run from **any machine** — `run`, `testmd run`, `testrun run`, and `--remote` — with only `kane-cli login` (`--remote` also needs the remote-execution plugin and a HyperExecute plan). They need **KaneAI Max** (one real device) or **KaneAI credits + Real Device Plus Automation Cloud**; read `references/mobile.md` §Real devices for the plan rules before running one.
  - **Emulator/simulator** (`--target emulator|simulator`): local runs need macOS Apple Silicon. From any other machine, run saved `_test.md` files on the cloud grid with `kane-cli testrun run <paths> --remote --device-name "<grid device>" --os-version <v> < /dev/null` (HyperExecute macOS runners).
  - Never tell a non-Mac user mobile is impossible: offer a real device, or `--remote`.

**Every run, always:** follow §1 above.

---

## 3. Building a `run` command

```bash
kane-cli run "<objective>" --agent [options]
```

> The `run` subcommand is **mandatory**. `kane-cli "<objective>"` (no `run`) does **not** work — unknown first tokens exit `2` with a "did you mean" suggestion. Same rule applies to `kane-cli testmd run …`.

`--agent` is mandatory — it switches stdout to NDJSON. Most-used flags:

| Flag | Purpose | Default |
|------|---------|---------|
| `--headless` | No visible browser window | Off |
| `--max-steps <n>` | Cap agent reasoning steps | 50 |
| `--timeout <s>` | Hard kill after N seconds | No limit |
| `--url <url>` | Start URL for the run (overrides config `default_url`; bare domains get `https://`) | Config `default_url` |
| `--variables <json>` | Inline variables JSON (for `{{key}}` in objective) | None |
| `--variables-file <path>` | Load variables from a JSON file | None |
| `--ws-endpoint <url>` | Remote browser (LambdaTest grid) | Local Chrome |
| `--code-export` | Generate code export after upload | config (`true` by default) |
| `--bug-detection <mode>` | Flag suspected product bugs while authoring: `off`/`stop`/`continue` (`stop` halts on a confirmed bug; `continue` records and keeps going) | config value (`off`) |

Other flags (`--global-context`, `--local-context`, `--cdp-endpoint`, `--allow-missing-url`) and the full variables precedence chain live in `references/setup-and-config.md`.

**Start URL:** every run needs a start URL for the first navigation. Provide it the simplest way — start the objective with the site ("Go to https://… and …") — or pass `--url <url>`; a configured `default_url` is the fallback (`kane-cli config set-url`). There is no silent default site: if none of these supply one, a non-TTY run **fails** rather than guessing (pass `--allow-missing-url` to start from the current page instead).

**Exit codes:** `0` passed · `1` failed · `2` auth/infra error · `3` timeout/cancelled.

**Unresolved variables (0.8.15+):** kane-cli checks every `{{name}}` in the objective before the run starts. A name with no value is a warning: the run goes ahead and types the name as written, unless a step sets it first. With `--agent` the warning is one `{"type":"warning","code":"unresolved_variables", ...}` event before the first progress frame. It carries `suggested_file` and `variables[]`: `name`; `reason` (`value_missing` = the key exists in `file` with no value · `not_declared` = the key is in no file, add it to `suggested_file`); `used_by[]`. Never checked: an explicit `{{global.*}}` (it resolves from Test Manager at run time), `{{smart.*}}`, `{{environment.*}}`, `{{secrets.*}}`, `{{totp.*}}`, and names an earlier step stores (`store … as 'x'`). Numbers in a variable file count as values (loaded as strings); booleans do not.

**Fill the variables before any run.** Do this before `run`, `testmd run` and `testrun run`, and always before `--remote`, which books a grid job. A missing value is asked for before the run; the first-run rule that nothing is asked before the first result does not cover it.

1. Collect the names with no value: the `warning`, a dry-run plan's `unresolved[]` rows, or a design run's `variables_declared` and `variables_summary` rows. Design rows list what design declared, not every missing value, and a dry run's `valid: true` says nothing about values: the dry run's `warning` is the check.
2. A value you already have, because the user said it or the requirement document states it, you write into that key in the file the event names (for `run`, `--variables '{"name":{"value":"…"}}'` also works), and you tell the user what you filled and where.
3. The rest you ask for once, in one message, using each variable's `description` when design gave one. Plain values (a URL, an email, a user name) the user gives you here or adds to the file, their choice. Secrets, which are any row with `secret: true`, any description that names a credential, and any name containing `password`, `secret`, `token` or `key`, the user fills in the file and tells you when done; you never ask for the value in chat, never echo it, and report names and file paths only.
4. Then the check: for saved tests, a fresh `kane-cli testrun run <files> --dry-run --agent < /dev/null` of the exact selection (`run` and `testmd run` have no dry run; for them the `warning` arrives before the first step): a valid plan with no `warning` is the check. A member whose rows are all filled may run while the others wait. Never fill a placeholder just to silence the check; a throwaway value is right only when the description asks for one, such as a deliberately wrong password. A frontmatter declaration with an empty value also silences the check, so look at the values a step relies on, not only at the warning. A name still empty is typed into the page as written; if a run then failed at that step, say so.

### Examples

```bash
# One-shot
kane-cli run "Go to https://www.amazon.in and search for 'laptop'" --agent

# Headless with timeout
kane-cli run "Go to https://app.example.com and verify login page loads" --agent --headless --timeout 60

# With inline credentials
kane-cli run "Go to https://app.example.com and login with {{username}} and {{password}}" --agent \
  --variables '{"username":{"value":"alice"},"password":{"value":"s3cret","secret":true}}'
```

---

## 4. Writing objectives

How you phrase the objective string determines what the agent does. Four patterns:

> For the full catalog — every action verb, every assertion analyze method (Visual / Textual-DOM / URL / Title / DevTools→Network/Console/Performance/Cookies/localStorage/Clipboard), direct API calls, operators, chaining, conditional/negative patterns, and worked examples — Read `references/objectives-cookbook.md`. Same grammar applies to one-shot `kane-cli run` objectives and `_test.md` step bodies.

| Pattern | Trigger words | Behavior |
|---|---|---|
| 🎯 **Action** | "go to", "click", "type", "search", "fill" | Performs browser actions |
| ✅ **Assertion** | "assert", "verify", "confirm", "check that" | Pass/fail check on a condition |
| 📦 **Extraction** | "store X as 'name'" | Persists a value into `run_end.final_state` |
| 🔌 **API call** | "call", "POST/GET a URL", a pasted `curl` | The agent makes the HTTP request itself; "save the response as X", then assert on it in plain English: "assert the response status is 200", "store the id from the response body as 'order_id'" |

### Two rules that make an objective replayable

1. **End every flow in a terminal assertion.** Close with a check of the resulting page state (`verify the cart shows 1 item`), not a bare `submit` or `confirm the dialog`. A run only earns a replayable pass/fail from a verify/assert — a pure-action objective (`add a laptop to the cart`) gets none. If the objective has several phases, each ends in its own check. Phrase the closing check as what is on screen once the last action completes, so it verifies with no further click or navigation; if the evidence is elsewhere, make getting there an explicit action (`place the order, open Order History, then verify the newest order shows "Processing"`), never `verify the order succeeded by checking Order History`. Two traps: `confirm the dialog` is an action, not a check; and `verify the Submit button is visible` fails exactly when the action worked (the control disappears on success) — assert the outcome, not the trigger.
2. **Intent for the actions, literal for the data.** Phrase actions as goals (`Log in with {{user}}`) so the run absorbs layout drift; keep exact values literal or in `{{variables}}`. Data that must be fresh on every run (a sign-up email, a unique name, today's date) is a smart variable — `{{smart.random_email}}`, `{{smart.random_string_8}}`, `{{smart.current_date}}` — never a fixed value the second replay collides with (`references/objectives-cookbook.md` §6). An expected-optional branch (a sometimes-there cookie banner) goes in an `if/else`, not assumed away.

**Shape:** an intent action carrying literal data, then a verify of an observable end state — `Search for "{{query}}" and open the first result, then verify the title contains "{{query}}"`. Full grammar in `references/objectives-cookbook.md §1`.

### The "store as" rule (critical for extraction)

Vague phrasing like "read", "tell me", "report" does NOT reliably extract data — the agent may see the value but won't capture it. Use "store as".

❌ `"go to example.com and read the page title"`
✅ `"go to example.com, store the page title as 'page_title'"`

Stored values appear in `run_end.final_state` and become the second results table per §1.4. Refer back to a stored value in plain English (`the stored price value`), never as `{{price}}`; `{{name}}` is for your own variables, secrets, and the runtime namespaces (`{{global.*}}`, `{{environment.*}}`, `{{smart.*}}`) only.

### Calling APIs directly

The agent can make API calls itself — not just observe the page's traffic. Phrase an explicit call and name the response:

```text
"Call POST https://api.example.com/login with body {...}, save the response as login,
 assert the response status is 200"
```

Use the response in plain English: `the response status`, `store the id from the response body as 'order_id'`, and later `the stored order_id value`. Never `{{login.status}}`: `{{name}}` is for your own variables, secrets, and the runtime namespaces (`{{global.*}}`, `{{environment.*}}`, `{{smart.*}}`) only. A pasted `curl` works too. Full grammar in `references/objectives-cookbook.md` §3.5.

### Chaining

Action → extraction → assertion in one objective:

```text
"go to {{app_url}}/dashboard,
 store the welcome message as 'welcome_text',
 assert the user role in the sidebar is 'Admin'"
```

### Dos and don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Imperative verbs: "go to", "click", "store as" | Vague verbs: "check out", "look at", "explore" |
| Specific: "click the 'Add to Cart' button" | Vague: "add the item" |
| Name extractions: "store X as 'price'" | Hope for values: "tell me the price" |
| `{{variables}}` for credentials/URLs | Hardcode secrets in the objective |
| Plain English for values the run produces: "the stored price value", "the response status" | `{{price}}` / `{{login.status}}` for a stored value or an API response |
| Always include starting URL | Assume the agent knows where to start |
| Split mega-objectives (>15 steps) into multiple runs | Cram everything into one |

---

## 5. Parsing one-shot `run --agent` output — essentials

> Internal reference only. Never expose these field names to the user — translate them per §1.

Stdout is NDJSON, one event per line. On kane-cli 0.8.17+ every line also carries `v` (contract version, `1`) and `ts` (when it was emitted), and the first line is `{"type":"stream_start","cli_version":…,"surface":"run"|"testmd"|"testrun"}`. Ignore fields and event types you do not know: new ones can appear in any release. There are two shapes:

- **Progress events** (most events) have `step` (1-based), `status` (`running` at start, `done`/`failed` at completion), `remark` — and **no `type` field**.
- **Typed events** have a `type` field: `project_folder_auto_defaulted` (run-startup gate, fires before any progress when no project/folder is configured), `bifurcation`, `child_agent_start`, `child_agent_end`, `ask_user`, `error`, `warning` (pre-run `code: "unresolved_variables"` — the run continues; handle per §3), and finally `run_end`.

Parsing strategy:

```text
for each line:
  if obj.type === "run_end"  → terminal, stop parsing
  else if obj.type exists    → typed flow event (rare)
  else if obj.step exists    → progress event → summarize per §1.3
```

For one-shot `run`, build post-run logic on `run_end` and process exit. Saved tests and suites use their own completion events (see Command-specific completion below).

For full event schemas (`bifurcation` flow fields, `child_agent_*`, `ask_user` semantics, `cancel`/`user_response` outbound events, complete `run_end` field list), Read `references/parsing.md`.

**Which agent flag.** `--agent`: `run`, `testmd run`, `testrun run` (or stdin not a TTY), `projects`, `folders`, `explore`, `config show`, `generate`, `devices`, `apps`. `--mode agent`: `context …`, `design …`, `maintain …`, `cover`. `run` and `testmd run` also accept `--mode agent`; `testrun`, `projects`, `folders` and `explore` refuse it, and the assurance commands refuse `--agent`. With `--agent`, an update notice can still print on stderr; it is not part of the stream. In a linked folder the streams, events and refusal codes are in `references/agent-contract.md`.

The assurance conversational commands (`context ingest`/`context extract`, `design tests`, `maintain reconcile`, `maintain evolve` on 0.8.21+, `cover`) do NOT take `--agent` — they take **`--mode agent`** and speak their own typed stream ending in `done` (open vocabulary — tolerate unknown event types; on 0.7.2+ the stream is strict — every stdout line parses, stderr silent — while on 0.7.1 a merged `context ingest` prints a few prose receipt lines BEFORE the stream — skip to the first `{` line, harmless on 0.7.2+ — and a landing-phase ingest failure ends with prose + exit 1/2 and no stream at all: a refusal, not a crash; on 0.7.2+ those failures ride the stream as `error` + `done`); **for those commands only, exit `3` means paused-and-resumable, not timeout** — schema in `references/assurance-parsing.md`, behavior in `references/assurance.md`. The context sync verbs (`kane-cli context sync`, `kane-cli context push`, `kane-cli context pull`, `kane-cli context clone`; kane-cli 0.8.14+) take `--mode agent` the same way and speak a `sync_*` family ending in `done`; there too exit `3` means a decision or a pull is needed, not a failure — `references/context-sync.md`. `kane-cli context sync setup` refuses without a terminal (`TTY_REQUIRED`): agents use `kane-cli context sync add` and `kane-cli context clone`.

`kane-cli testrun run` also emits its own typed stream (`testrun_plan` … terminal `testrun_done`) — schema in `references/testrun.md`. `kane-cli testmd run` may additionally emit `test_md_evidence_ingest` (replay evidence published) and `test_md_bundle_sync` (test bundle synced) — informational; describe in plain language, never surface raw names. The post-run evidence hint (`` evidence: view locally with `kane-cli evidence serve <path>` ``) is a **stderr** text line, not a stdout event — don't try to parse it from the NDJSON stream; see `references/evidence.md` for how to act on it.

---

## 6. Test cases from a description (no requirement document)

When the user describes what to test in chat and has no document, use the description as the requirement.

1. Write the user's words to `requirements/<feature>.md` in the project, as given, one heading per feature, nothing invented. Tell the user the file exists and that the tests will cite it.
2. `kane-cli context ingest requirements/<feature>.md --mode agent`, review the extracted use-cases at the checkpoint, then `kane-cli design tests …`, exactly as `references/assurance.md` describes. In a shared project add `--project <id>` the first time, and follow the journey in `references/shared-projects.md` §4 (save each session; the one-question checkpoint).
3. Present the designed tests, gaps, warnings and the variables that need values (§3 **Fill the variables before any run**). The designed tests get their own review checkpoint before any run (`references/assurance.md`). Then hand the set to `kane-cli testrun run … < /dev/null` (`references/assurance.md`, the authoring bridge).

A draft in chat cannot be run, and a hand-written `_test.md` carries no requirement link and no coverage accounting; the deliverable is the designed test.

---

## 7. When to read which reference

| Situation | Read |
|---|---|
| User wants to save/persist/re-run a test | `references/testmd.md` |
| Run a suite of saved `_test.md` tests as one batch | `references/testrun.md` |
| Run a suite on the cloud grid (`--remote`), incl. mobile suites from any machine | `references/testrun.md` §Remote + `references/mobile.md` §Remote |
| Run on a real Android/iOS device (`--target android\|ios`), its plan requirements, or a hub session error | `references/mobile.md` §Real devices |
| A team, a Test Manager project, a linked folder (`.testmuai/assurance.json`), a teammate's or exploration's tests | `references/shared-projects.md` |
| This folder's shared project and its id (for a teammate, or a dashboard) | `references/shared-projects.md` §2, "This folder's project id" |
| A shared-project refusal code, event or exit code | `references/agent-contract.md` |
| Explore an app on HyperExecute | `references/explore.md` |
| User has requirement docs (PRD/spec) → designed suite, coverage, or suite upkeep | `references/assurance.md` |
| Need the assurance NDJSON event schema (`--mode agent`) | `references/assurance-parsing.md` |
| Share the context store with a team, join one, keep stores level, or resolve a sync conflict (kane-cli 0.8.14+) | `references/context-sync.md` |
| Run failed, need to diagnose | `references/debug.md` |
| View, share, validate, or merge evidence packs | `references/evidence.md` |
| Multiple independent browser tasks | `references/parallel.md` |
| Need full NDJSON event schema (`run`) | `references/parsing.md` |
| Browse / create projects or folders, or parse the auto-default event | `references/test-manager.md` |
| Start of every session: preflight, the ready card, sign-in | `references/ready-check.md` |
| A person's first session: run first, the tour, three choices | `references/first-run.md` |
| Any result other than a plain passed or failed run (didn't start, stopped early, product bug, saved test, suite) | `references/cards.md` |
| Read, save or change the person's preferences | `references/agent-config.md` |
| Watch runs live in the Claude Code status bar | `references/live-strip.md` |
| First-time install, auth, or full config | `references/setup-and-config.md` |
| Compare / evaluate / benchmark kane-cli vs another tool or approach (cost, tokens, effort, ROI) | `references/fair-evaluation.md` |

## Command-specific completion

The `run_end` parsing strategy applies to one-shot `run` only. For `testmd run`, collect `test_md_done.overall_status`, `duration_s`, `session_id`, and optional `share_url`; embedded `run_end` events can finish individual steps. Local suites emit `testrun_done`; dispatched remote suites then emit `remote_done` (retain `status`, `exit`, `sessions_path`). Assurance conversational agent streams end in `done`; review/read verbs have their own contracts. Always check process exit too: early refusal, invalid plan or dry-run can exit without the normal completion event.

Progress is for live display: count only `done`/`failed` completions, retaining child and execution context when step indices repeat.


For assertion mode, optional final validation, current-page `--analyzer-only` checks, streaming-network capture, and code-export defaults, read [Execution controls](references/execution-controls.md).
