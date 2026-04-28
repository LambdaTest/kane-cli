---
name: kane-cli
description: Browser automation via kane-cli — run objectives, parse NDJSON output, inspect logs, report bugs. Use for any task requiring a real browser (navigate, click, fill forms, test web UI, take screenshots).
---

# Kane CLI — Browser Automation Skill

Use `kane-cli` for **any task that requires a real browser**: navigating websites, clicking elements, filling forms, searching, testing web UI, taking screenshots, or verifying deployments.

**Do NOT** use Playwright, Puppeteer, or Selenium directly. `kane-cli` manages Chrome, auth, and the AI automation agent.

**Always run with `--agent` flag.** This gives structured NDJSON output that you parse and present to the user with rich formatting.

---

## 1. Decision Tree

When the user's request involves a browser, follow this flow:

**Is kane-cli installed?**
├─ Unknown → Check with `kane-cli --version`
├─ No → `npm install -g @testmuai/kane-cli` then §2
└─ Yes ↓

**Is kane-cli set up?**
├─ Unknown → Run `kane-cli whoami` to check auth status
├─ No → Go to §2 (Pre-flight Setup)
└─ Yes ↓

**What does the user want?**
├─ Single browser task → Build one `kane-cli run --agent` command (§3, §4)
├─ Test/verify something → Same, but use assertion objectives (§4)
├─ Extract data from a page → Same, but use "store as" extraction pattern (§4)
├─ Multiple independent tasks → Decompose into sub-objectives, run in parallel via Agent tool (§8)
├─ Debug a failed run → Inspect logs (§7)
└─ Configure kane-cli → Run config commands (§9)

**After every run:**
1. Parse the NDJSON output (§5)
2. Present rich results with emojis (§6)
3. If failed, inspect logs and diagnose (§7)

---

## 2. Pre-flight Setup

Before first use, verify installation and auth.

### Install

```bash
npm install -g @testmuai/kane-cli
```

### Check Auth Status

```bash
kane-cli whoami
```

If this shows "not configured" or errors, run login:

### Login (Basic Auth)

```bash
kane-cli login --username <user> --access-key <key>
```

This creates the default profile with basic auth, auto-selects the KaneAI project, and marks setup complete. Credentials come from the user's TestmuAI dashboard (Settings → Keys).

Optional flag:
- `--profile <name>` — profile name (default: last selected profile check using `config show`)

### Login (OAuth)

```bash
kane-cli login --oauth
```

This opens the browser for OAuth consent and waits for the callback. Works in both TTY and non-TTY (agent) mode.

### Login (Interactive — TTY only)

In a terminal, run `kane-cli login` with no flags for the interactive wizard (auth method → project picker → folder picker). If the user needs this, ask them to run it directly:

> Please run `! kane-cli login` and complete the sign-in.

### Verify

```bash
kane-cli whoami          # Auth status
kane-cli config show     # Current configuration
```

---

## 3. Building the Command

Every run uses this pattern:

```bash
kane-cli run "<objective>" --agent [options]
```

`--agent` is **mandatory** — it outputs structured NDJSON that you parse and present to the user.

### Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `--headless` | No visible browser window | Off (browser visible) |
| `--max-steps <n>` | Limit agent reasoning steps | 30 |
| `--timeout <s>` | Kill run after N seconds | No limit |
| `--variables <json>` | Inline variables JSON | None |
| `--variables-file <path>` | Load variables from a JSON file | None |
| `--global-context <file>` | Override global agent context markdown | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override local project context markdown | `.testmuai/context.md` |
| `--ws-endpoint <url>` | Remote browser via WebSocket (e.g. LambdaTest grid) | Local Chrome |
| `--cdp-endpoint <url>` | Connect to existing Chrome via CDP | Auto-launch Chrome |
| `--code-export` | Generate code export after upload | Off |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | ✅ Passed |
| 1 | ❌ Failed |
| 2 | ⚠️ Error (auth, setup, infra) |
| 3 | ⏱️ Timeout or cancelled |

### Variables

Variables parameterize objectives with reusable values and secrets. Use `{{key}}` syntax in objectives.

**Format:**
```json
{
  "username": { "value": "alice", "secret": false },
  "password": { "value": "s3cret!", "secret": true }
}
```

`secret: true` masks the value in logs and routes it to TestmuAI's secrets store instead of being synced as plain TMS variables.

**Loading order** (later wins):
1. `~/.testmuai/kaneai/variables/*.json` (global, alphabetical)
2. `{cwd}/.testmuai/variables/*.json` (local project overrides)
3. `--variables-file <path>`
4. `--variables '{...}'` (inline JSON)

**Always parameterize:** credentials, API keys, tokens, environment-specific URLs.
**OK to hardcode:** one-off URLs, static UI text, navigation paths.

### Context Files

Context files provide additional instructions to the agent:
- **Global:** `~/.testmuai/kaneai/global-memory.md` — shared across all runs
- **Local:** `.testmuai/context.md` in cwd — project-specific

Override per-run with `--global-context` / `--local-context` flags.

### Examples

```bash
# Simple browser task
kane-cli run "Go to https://www.amazon.in and search for 'laptop'" --agent

# Headless with timeout
kane-cli run "Go to https://app.example.com and verify login page loads" --agent --headless --timeout 60

# With variables
kane-cli run "Go to https://app.example.com and login with {{username}} and {{password}}" --agent \
  --variables '{"username": {"value": "alice"}, "password": {"value": "secret123", "secret": true}}'

# Remote browser (LambdaTest grid)
kane-cli run "Go to https://shop.example.com and add item to cart" --agent \
  --ws-endpoint "wss://cdp.lambdatest.com/playwright?capabilities=..."

# With variables file
kane-cli run "Go to https://staging.myapp.com, login and verify dashboard" --agent \
  --variables-file ./test-creds.json --headless --timeout 120
```

---

## 4. Writing Objectives

The objective string is the most important input. How you phrase it determines what the agent does.

### Three Patterns

| Pattern | Trigger Phrases | Agent Behavior |
|---------|----------------|----------------|
| 🎯 **Action** | "go to", "click", "type", "search", "fill", "scroll" | Performs browser actions |
| ✅ **Assertion** | "assert", "verify", "confirm", "check that" | Validates a condition (pass/fail) |
| 📦 **Extraction** | "store X as 'name'" | Reads a value from the page and persists it in structured output |

### Extraction: The "store as" Pattern

**Critical.** Vague phrasing like "read", "report", or "tell me" does NOT reliably extract data. The agent may observe the value visually but won't persist it in structured output.

❌ **Bad** — agent looks but doesn't capture:
```
"go to example.com and read the page title"
"go to example.com and tell me the price"
```

✅ **Good** — agent extracts and persists in `final_state`:
```
"go to example.com, store the page title as 'page_title'"
"go to example.com, store the price of the first item as 'price'"
```

Stored values appear in the `run_end` event's `final_state` and `context.memory` fields.

### Combining Patterns

Chain action → extraction → assertion in a single objective:

```
"go to {{app_url}}/dashboard,
 store the welcome message as 'welcome_text',
 store the user role in the sidebar as 'role',
 assert the role is 'Admin'"
```

### Assertion Specificity

| Type | Example |
|------|---------|
| **Exact match** | `"assert the cart total shows '$29.99'"` |
| **Flexible match** | `"assert a price is displayed for each product"` |
| **State** | `"assert the Submit button is disabled until all fields are filled"` |
| **Conditional** | `"if a cookie banner appears, dismiss it, then assert the homepage loads"` |
| **Negative** | `"assert no error message or red banner is visible"` |
| **Positional** | `"assert 'Settings' appears in the left sidebar navigation"` |

### Dos and Don'ts

| ✅ Do | ❌ Don't |
|-------|---------|
| Use imperative verbs: "go to", "click", "store as" | Use vague verbs: "check out", "look at", "explore" |
| Be specific: "click the 'Add to Cart' button" | Be vague: "add the item" |
| Name extractions: "store X as 'price'" | Hope for values: "tell me the price" |
| Use `{{variables}}` for credentials/URLs | Hardcode secrets in the objective |
| Include starting URL in the objective: "Go to https://..." | Assume the agent knows where to start |
| Split mega-objectives (>15 steps) into multiple runs | Cram everything into one massive objective |

---

## 5. Parsing Output (--agent mode)

> **Internal reference only.** Everything in this section (field names, event types, JSON structure) is for you to parse programmatically. **Never expose these internal terms to the user.** The user should see plain-language summaries, not `run_end`, `final_state`, `bifurcation`, `NDJSON`, `session_dir`, or any raw JSON fields.

With `--agent`, kane-cli outputs one JSON object per line to **stdout**. Progress UI renders to **stderr**.

### Event Types

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
| `bifurcation` | `flows[]`, `count` | Agent split objective into sub-flows |
| `child_agent_start` | `child_id`, `objective`, `parent_step` | Child agent spawned |
| `child_agent_end` | `child_id`, `success`, `steps_taken`, `summary` | Child agent finished |
| `ask_user` | `question`, `step_index`, `options?` | Agent needs user input |
| `error` | `message` | Error occurred |

**Note:** There is no `run_start` event — the first line is either a `bifurcation` or a progress object.

**Note:** `ask_user` is auto-disabled when stdin is not a TTY. Since agents typically run kane-cli as a subprocess, ask_user events will not be emitted. Write objectives that don't require interactive input.

### Parsing Strategy

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
- `session_dir` / `run_dir` — paths to log files

### Responding to `ask_user` (if stdin is a TTY)

```json
{"type": "user_response", "answer": "Medium size"}
```

To cancel a run:

```json
{"type": "cancel"}
```

---

## 6. Presenting Results to the User

> **Golden rule:** The user should feel like they're watching a browser task happen, not reading a log file. Use plain language, never expose internal field names, JSON keys, file paths, or technical jargon. Translate everything into what the user cares about.

### 📢 Live Progress (During the Run)

**Do not stay silent while kane-cli runs.** As the command executes, keep the user informed:

1. **Before starting** — Tell the user what you're about to do:
   > Starting browser task: searching for 'laptop' on Amazon...

2. **As steps complete** — Relay each step's outcome in plain language as it happens. Parse the progress events from stdout and narrate them:
   > Step 1: Opened Amazon homepage
   > Step 2: Typed 'laptop' in the search bar
   > Step 3: Clicked the search button
   > Step 4: Search results loaded — found product listings

3. **If something goes wrong mid-run** — Flag it immediately, don't wait for the final result:
   > Step 5: Could not find the 'Add to Cart' button — the agent is retrying...

This keeps the user engaged and lets them intervene early if the task is going in the wrong direction.

### 📋 Results Summary (After the Run)

**After every run, present a clear summary.** Never just say "it passed" — show the full picture in a user-friendly format.

**Successful run:**

| | |
|-------|-------|
| 🟢 **Result** | Passed |
| 🎯 **Task** | Search for 'laptop' on Amazon |
| ⏱️ **Duration** | 45.2s |
| 👣 **Steps taken** | 7 |
| 📝 **What happened** | Opened Amazon, typed 'laptop' in search, clicked search, results loaded with 48 products |
| 🔗 **View details** | [Open in KaneAI Dashboard](https://test-manager.lambdatest.com/...) |

**If data was extracted** (from "store as" objectives), show it as a clean results table:

| 📦 What was found | Value |
|-------------|----------------|
| Top repository | freeCodeCamp/freeCodeCamp |
| Star count | 413k |
| Price | $29.99 |

**If assertions were checked**, show pass/fail for each:

| ✅ Check | Result |
|-------------|--------|
| Dashboard shows welcome message | 🟢 Passed |
| User role is Admin | 🔴 Failed |

### ❌ When Things Go Wrong

For failed runs, explain **what went wrong in plain language**:

- 🔍 **What failed** — describe the step that failed and why, in the user's terms (not "step_003.json shows dom_action error")
- 📸 **Screenshot** — if a screenshot exists, read and show it so the user can see what the browser looked like at the point of failure
- 💡 **Why it likely failed** — your diagnosis: was the element missing? Did the page not load? Was the objective ambiguous?
- 🔧 **Suggested fix** — a concrete next step: rephrase the objective, increase timeout, check auth, etc.

**Example of a good failure report:**

> 🔴 **Failed** at step 5 of 9 (after 25s)
>
> **What happened:** The agent clicked "Proceed to Checkout" but the payment form never appeared. The page showed a loading spinner for 15 seconds before the agent timed out.
>
> **Likely cause:** The checkout page may require authentication, or the site's payment service was slow/down.
>
> **Suggested fix:** Try adding an explicit login step before checkout, or increase the timeout to 120s.

### 🐛 Suggesting a Bug Report

If the failure looks like a **kane-cli bug** (not auth, timeout, or a vague objective), offer to file a report:

> This looks like it might be a bug in kane-cli. Want me to file a report?

File at: **https://github.com/LambdaTest/kane-cli/issues**. Gather the details automatically — don't ask the user to dig through log files.

**Do NOT suggest bug reports for:** auth issues, low timeouts, vague objectives, or website errors (500s, CAPTCHAs).

---

## 7. Failure Handling & Log Inspection

When a run fails, diagnose before suggesting fixes.

### Log Locations

The `run_end` event provides `session_dir` and `run_dir` paths. Use those directly.

```
{session_dir}/
├── session.json               # Session metadata, run list, upload status
├── tui.log                    # Timeline: session start, run start/end, errors
└── runs/{n}/
    └── run-test/
        └── actions.ndjson     # Step-by-step record of agent actions
```

### Debugging Flow

1. **Parse the `run_end` event** from stdout — it has `status`, `reason`, and `summary` plus the `session_dir` / `run_dir` paths.
2. **Read `actions.ndjson`** in `{run_dir}/run-test/` — each line is one agent action with its intent and outcome.
3. **Check `tui.log`** in `{session_dir}/` — for session-level issues (Chrome launch, auth, upload).

### Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 🔄 Agent repeats same action | Stuck in a loop / page didn't change | Rephrase objective, add explicit wait or assertion |
| 🎯 Agent clicks wrong element | Ambiguous UI, multiple similar elements | Be more specific: "click the **blue** 'Submit' button in the **checkout form**" |
| 👁️ Agent says done but didn't finish | Objective too vague | Add explicit assertions: "assert the confirmation page shows order number" |
| 💀 Exit code 2, no steps | Auth or Chrome failure | Check `kane-cli whoami`, verify Chrome is available |
| ⏱️ Exit code 3 | Timeout or cancelled | Increase `--timeout` or `--max-steps`, or split into smaller objectives |
| 🚫 "CDP endpoint not reachable" | Chrome not running | Let kane-cli manage Chrome (remove `--cdp-endpoint`) |

---

## 8. Parallel Execution

For multiple independent browser tasks, decompose and run in parallel using the Agent tool.

### When to Split

- **>15 steps** — long runs drift and get stuck
- **Independent flows** — login test and search test don't depend on each other
- **Different pages/features** — settings vs checkout vs admin
- **Different user roles** — admin flow vs regular user flow

### How to Split

Each sub-objective must be **self-contained**: navigates to its own URL, authenticates independently, asserts its own outcomes. No sub-objective depends on another having run first.

### Execution Pattern

1. Decompose the user's request into N independent sub-objectives
2. Spawn N Agent tool calls in a **single message** — each runs:
   ```bash
   kane-cli run "Go to <url> and <sub-objective>" --agent --headless --timeout 120
   ```
3. Each agent parses the NDJSON output, waits for `run_end`, returns: status, steps, duration, summary, session path
4. After ALL agents complete, format the batch summary

### Agent Prompt Template

```
Run this kane-cli browser test and report results:

    kane-cli run "Go to <url> and <objective>" --agent --headless --timeout 120

After the command completes:
1. Capture the exit code
2. Parse the run_end NDJSON event from stdout
3. If failed, read the failing step's screenshot from run_dir
4. Return: {status, steps, duration, summary, session_dir, failure_step, screenshot_path}
```

### Batch Summary Format

```markdown
## 🧪 Test Suite: <suite name>

| # | Test | Status | Steps | Time | What happened |
|---|------|--------|-------|------|---------|
| 1 | Login + dashboard | ✅ | 5 | 12s | Welcome banner visible |
| 2 | Product search | ✅ | 7 | 18s | 3 results for 'shoes' |
| 3 | Checkout flow | ❌ | 9 | 25s | Payment form did not load |
| 4 | Admin CSV export | ✅ | 6 | 15s | CSV downloaded (42 rows) |

### 📊 Overall
- **Pass rate:** 3/4 (75%)
- **Total steps:** 27 · **Total time:** 1m10s

### ❌ Failures
**#3 Checkout flow** — Payment form did not load after clicking "Credit Card".
📸 [screenshot of the failure shown inline]
```

Status icons: ✅ passed · ❌ failed · ⚠️ stuck/timeout

**Do not** show raw file paths (like `~/.testmuai/kaneai/sessions/...`) in the summary. Instead, read the screenshot and show it inline, or offer to inspect logs only if the user asks.

---

## 9. Configuration & Reference

### Config Commands

```bash
kane-cli config show                          # Show all current settings
kane-cli config set-window <W>x<H>           # Browser window size (e.g. 1920x1080)
kane-cli config chrome-profile <path>         # Chrome profile path (or interactive picker in TTY)
kane-cli config project <project-id>          # TMS project ID (or interactive picker in TTY)
kane-cli config folder <folder-id>            # TMS folder ID (or interactive picker in TTY)
```

### Feedback

Submit feedback on a completed test run:
```bash
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."
```

### Directory Structure

```
~/.testmuai/kaneai/
├── tui-config.json              # Persistent CLI settings
├── config.json                  # Shared auth configuration
├── global-memory.md             # Global agent context
├── chrome-profile/              # Default Chrome user profile
├── profiles/                    # Stored credentials
│   └── {profile}/{env}/
│       └── credentials
├── sessions/                    # Session history
│   └── {session-id}/
│       ├── session.json         # Metadata, run list, upload status
│       ├── tui.log              # Session event log
│       ├── runs/{n}/
│       │   └── run-test/
│       │       └── actions.ndjson   # Step-by-step record of agent actions
│       └── code-export/         # (when --code-export) generated code files
└── variables/                   # Global variable files
    └── *.json

# Project-local overrides (in cwd):
.testmuai/
├── context.md                   # Project-specific agent context
└── variables/
    └── *.json                   # Project-specific variables
```

### Chrome Management

kane-cli auto-launches Chrome with CDP (DevTools Protocol) on ports 9222–9230. Chrome runs as a detached process and outlives the CLI.

- `--headless` — runs Chrome in headless mode (no visible window)
- `--cdp-endpoint <url>` — connect to an already-running Chrome instance
- `--ws-endpoint <url>` — connect to a remote browser (LambdaTest grid)

If Chrome fails to launch, ensure Google Chrome is installed and no other process is using CDP ports 9222–9230.
