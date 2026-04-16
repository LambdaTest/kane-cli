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

If this shows "not configured" or errors, run setup:

### First-Time Setup (Agents)

```bash
kane-cli setup --auth-method basic --username <user> --access-key <key>
```

This creates the default profile with basic auth. Credentials come from the user's LambdaTest dashboard (Settings → Keys).

### OAuth Login (Human-Only)

OAuth requires the interactive Ink UI — **agents cannot run this directly**. If OAuth is needed, ask the user to run it themselves:

> You need to log in to kane-cli first. Please run `! kane-cli login` and complete the browser sign-in.

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
| `--url <url>` | Starting URL | Last used or configured URL |
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

`secret: true` masks the value in logs and pushes it to HyperExecute Secrets API.

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
kane-cli run "Search for 'laptop' on Amazon" --agent --url https://www.amazon.in

# Headless with timeout
kane-cli run "Verify login page loads" --agent --url https://app.example.com --headless --timeout 60

# With variables
kane-cli run "Login with {{username}} and {{password}}" --agent --url https://app.example.com \
  --variables '{"username": {"value": "alice"}, "password": {"value": "secret123", "secret": true}}'

# Remote browser (LambdaTest grid)
kane-cli run "Add item to cart" --agent --url https://shop.example.com \
  --ws-endpoint "wss://cdp.lambdatest.com/playwright?capabilities=..."

# With variables file
kane-cli run "Login and verify dashboard" --agent --url https://staging.myapp.com \
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
| Include starting URL via `--url` | Assume the agent knows where to start |
| Split mega-objectives (>15 steps) into multiple runs | Cram everything into one massive objective |

---

## 5. Parsing NDJSON Output (--agent mode)

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

These are **untyped** — they have no `type` field. Do **not** key on `event.type === 'step_start'` or `'step_end'`; those event types are not emitted in v0.1.x.

**Flow events:**

| Event (`type` field) | Key Fields | Purpose |
|-------|-----------|---------|
| `bifurcation` | `flows[]`, `count` | Agent split objective into sub-flows |
| `child_agent_start` | `child_id`, `objective`, `parent_step` | Child agent spawned |
| `child_agent_end` | `child_id`, `success`, `steps_taken`, `summary` | Child agent finished |
| `ask_user` | `question`, `step_index`, `options?` | Agent needs user input |
| `error` | `message` | Error occurred |

**Note:** There is no `run_start` event in v0.1.x — the first line is either a `bifurcation` or a progress object.

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
  "final_state": {
    "price": "$29.99",
    "product_name": "Wireless Headphones"
  },
  "context": {
    "memory": {},
    "variables": {},
    "pointer": "(passed) Searched for laptop and added first result to cart"
  },
  "token_usage": {
    "reasoning_input": 12000,
    "reasoning_output": 800,
    "vision_input": 5000,
    "vision_output": 200
  },
  "session_dir": "~/.testmuai/kaneai/sessions/2026-04-05_14-30-45_a1b2c3",
  "run_dir": "~/.testmuai/kaneai/sessions/2026-04-05_14-30-45_a1b2c3/runs/0",
  "test_url": "https://test-manager.lambdatest.com/projects/123/test-cases/456"
}
```

Key `run_end` fields:
- `status` — `"passed"` or `"failed"`
- `summary` — what the agent did
- `one_liner` — short summary for display
- `reason` — why it stopped
- `final_state` — extracted values from "store as" objectives
- `test_url` — link to KaneAI dashboard (if upload succeeded)
- `session_dir` / `run_dir` — paths to log files
- `token_usage` — token consumption breakdown

### Responding to `ask_user` (if stdin is a TTY)

```json
{"type": "user_response", "answer": "Medium size"}
```

To cancel a run:

```json
{"type": "cancel"}
```

---

## 6. Post-Run Presentation

**After every run, present rich structured output.** Never just say "it passed" — always show the full picture.

### 🎯 Action Runs

| Field | Value |
|-------|-------|
| 🟢 Status | passed |
| 🎯 Objective | Search for 'laptop' on Amazon |
| ⏱️ Duration | 45.2s |
| 👣 Steps | 7 |
| 🌐 Final URL | https://www.amazon.in/s?k=laptop |
| 📝 Summary | Navigated to Amazon, typed 'laptop' in search, clicked search button, results loaded |
| 🔗 Test URL | [View in KaneAI Dashboard](https://test-manager.lambdatest.com/...) |

### 📦 Extraction Runs (objectives with "store as")

Same table as above, plus a separate extraction table:

| 📦 Variable | Extracted Value |
|-------------|----------------|
| `top_repo` | freeCodeCamp/freeCodeCamp |
| `top_stars` | 413k |
| `price` | $29.99 |

### ✅ Assertion Runs

Same table as above, plus assertion results:

| ✅ Assertion | Result |
|-------------|--------|
| Dashboard shows welcome message | 🟢 Passed |
| User role is Admin | 🔴 Failed |

### 🏆 Rating

Rate every run on a **1–10 scale**:

| Score | Criteria |
|-------|----------|
| **9–10** | 🌟 Objective fully met. All extractions captured. No wasted steps. |
| **7–8** | 👍 Objective met with minor issues: extra steps, retries, slow navigation. |
| **5–6** | 🤔 Partially met. Some extractions missing or assertions skipped. |
| **3–4** | 👎 Mostly failed. Agent got stuck, looped, or wrong actions. |
| **1–2** | 💥 Total failure. Crashed, never started, or completely wrong. |

Always present as:

> **🏆 Agent Rating: X/10** — One-line reason.

### ❌ Failed Runs

For failed runs, additionally show:
- 🔍 **Failure step** — which step failed and why
- 📸 **Screenshot** — path to the failing step's screenshot
- 💡 **Diagnosis** — your analysis of what went wrong

### 🐛 Bug Report Suggestion (Rating ≤ 6)

If the failure looks like an **agent bug** (not auth, timeout, or vague objective), suggest filing a bug:

> 🐛 This looks like an agent bug. Want me to file a report?

File at: **https://github.com/LambdaTest/kane-cli/issues** using the bug report template.

Required fields:
- **kane-cli version** — run `kane-cli --version`
- **OS** — macOS (Apple Silicon), macOS (Intel), Linux (x64), Linux (ARM64), Windows (x64)
- **Install method** — npm, Homebrew, curl installer, direct binary
- **What happened** — describe the bug
- **Steps to reproduce** — the `kane-cli run` command and objective used
- **Expected behavior** — what should have happened
- **Error output / logs** — `run_summary.json`, failing `step_NNN.json`, screenshot

**Do NOT suggest bug reports for:** auth issues, low timeouts, vague objectives, site-side errors (500s, CAPTCHAs).

---

## 7. Failure Handling & Log Inspection

When a run fails, diagnose before suggesting fixes.

### Log Locations

The `run_end` event provides `session_dir` and `run_dir` paths. Use those directly.

```
{run_dir}/
├── run.log                    # Text log for this run
└── run-test/
    ├── run_summary.json       # Overall result, step list, errors
    ├── step_001.json          # Per-step detail
    ├── step_002.json
    ├── screenshots/
    │   ├── step_001.png
    │   └── step_002.png
    ├── dag_diagram.md         # Cycle detection diagram
    └── child-{id}/            # Child agent logs (same structure)
```

Session-level log:
```
{session_dir}/
├── session.json               # Session metadata, run list, upload status
└── tui.log                    # Timeline: session start, run start/end, errors
```

### Debugging Flow

1. **Read `run_summary.json`** → check `final_status`, `reason`, `errors[]`
2. **Find the failing step** → scan `steps[]` for `"success": false`
3. **Read that `step_NNN.json`** → check:
   - `reasoning.response` — what the agent intended
   - `dom_action` / `action` — what actually happened
   - `vision` — what the agent saw
   - `assertion` — checkpoint verdict (if assertion step)
4. **View `screenshots/step_NNN.png`** — see what the page looked like
5. **Check `tui.log`** — for session-level issues (Chrome launch, auth, upload)

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
   kane-cli run "<sub-objective>" --agent --headless --timeout 120
   ```
3. Each agent parses the NDJSON output, waits for `run_end`, returns: status, steps, duration, summary, session path
4. After ALL agents complete, format the batch summary

### Agent Prompt Template

```
Run this kane-cli browser test and report results:

    kane-cli run "<objective>" --agent --headless --timeout 120

After the command completes:
1. Capture the exit code
2. Parse the run_end NDJSON event from stdout
3. If failed, read the failing step's screenshot from run_dir
4. Return: {status, steps, duration, summary, session_dir, failure_step, screenshot_path}
```

### Batch Summary Format

```markdown
## 🧪 Test Suite: <suite name>
**📅 Run at:** 2026-04-14 14:30 UTC

| # | Test | Status | Steps | Time | Summary |
|---|------|--------|-------|------|---------|
| 1 | Login + dashboard | ✅ | 5 | 12s | Welcome banner visible |
| 2 | Product search | ✅ | 7 | 18s | 3 results for 'shoes' |
| 3 | Checkout flow | ❌ | 9 | 25s | Payment form did not load |
| 4 | Admin CSV export | ✅ | 6 | 15s | CSV downloaded (42 rows) |

### 📊 Aggregates
- **Pass rate:** 3/4 (75%)
- **Total steps:** 27 · **Total time:** 1m10s
- **Avg steps/test:** 6.75 · **Avg time/test:** 17.5s

### ❌ Failures
**#3 Checkout flow** — Payment form did not load after clicking "Credit Card".
📸 Screenshot: `~/.testmuai/kaneai/sessions/<id>/runs/0/run-test/screenshots/step_008.png`
```

Status icons: ✅ passed · ❌ failed · ⚠️ stuck/timeout

---

## 9. Configuration & Reference

### Config Commands

**Agent-usable (non-interactive):**
```bash
kane-cli config show                    # Show all current settings
kane-cli config set-url <url>           # Default target URL
kane-cli config set-window <W>x<H>     # Browser window size (e.g. 1920x1080)
```

**Human-only (interactive Ink UI):**
```bash
kane-cli config set-chrome-profile      # Interactive Chrome profile picker
kane-cli config set-project             # Interactive TMS project picker
kane-cli config set-folder              # Interactive TMS folder picker
```

For interactive config commands, ask the user to run them directly:
> Please run `! kane-cli config set-project` to select your TMS project.

### Feedback

Submit feedback on a completed test run:
```bash
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."
```

### Directory Structure

```
~/.testmuai/kaneai/
├── tui-config.json              # Persistent settings
├── config.json                  # Shared auth configuration
├── global-memory.md             # Global agent context
├── chrome-profile/              # Default Chrome user profile
├── profiles/                    # Stored credentials
│   └── {profile}/{env}/
│       └── credentials
├── sessions/                    # Session history
│   └── {session-id}/
│       ├── session.json
│       ├── tui.log
│       └── runs/{n}/
│           └── run-test/        # Step logs + screenshots
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
