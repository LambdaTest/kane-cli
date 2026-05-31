---
name: kane-cli
description: Browser automation via kane-cli — run objectives, parse NDJSON output, inspect logs, report bugs. Use for any task requiring a real browser (navigate, click, fill forms, test web UI, take screenshots).
---

# Kane CLI — Browser Automation Skill

Use `kane-cli` for **any task that requires a real browser**: navigating websites, clicking elements, filling forms, searching, testing web UI, taking screenshots, or verifying deployments. Do NOT use Playwright, Puppeteer, or Selenium directly. Always run with `--agent` so output is structured NDJSON you can parse.

---

## 1. Live narration and results presentation — READ THIS FIRST

The user is watching this happen in real time. Silence during a kane-cli run is a bug; a one-line "Test passed" instead of the results table is a bug. Both happen because this section used to be buried at line 353 of an 800-line file. It's first now. Follow it exactly.

### 1.1 Before you invoke kane-cli

**Before** the Bash call that launches `kane-cli`, emit a short message in plain language. Template:

```text
Starting browser task: <one-line restatement of the user's objective>.
```

Then, **create these TodoWrite items** (skip on Gemini CLI where TodoWrite is unavailable — the imperative rules below still apply):

1. `Narrate start of <objective>` — mark `in_progress` immediately
2. `Narrate each step as NDJSON arrives`
3. `Present results table after run_end`

The todos exist so that after Bash blocks, the in-context reminder pulls you back into narration mode instead of into a generic "Bash finished, parse stdout" mode.

### 1.2 During the run

`kane-cli --agent` emits one JSON object per line on stdout, plus a progress UI on stderr. As progress events arrive (lines with `step`/`status`/`remark` fields and no `type`), emit one narration line per event. Template:

```text
Step <n>: <plain-language version of the remark>
```

If `status` is `"failed"`, flag it immediately — don't wait for `run_end`:

```text
Step <n> failed: <remark> — the agent is retrying.
```

Never expose internal field names (`step`, `status`, `remark`, `run_end`, `final_state`, `bifurcation`, `session_dir`, etc.) to the user. Translate to plain language.

### 1.3 After run_end — present the results table

The terminal event has `type: "run_end"` and stable fields: `status`, `summary`, `one_liner`, `duration`, `credits`, `final_state`, `test_url`, `session_dir`, `run_dir`.

**For a passing run, always emit this exact table** (substituting the field values):

```markdown
| | |
|-------|-------|
| 🟢 **Result** | Passed |
| 🎯 **Task** | <one_liner> |
| ⏱️ **Duration** | <duration>s |
| 👣 **Steps taken** | <count of progress events> |
| 📝 **What happened** | <summary> |
| 🔗 **View details** | [Open in KaneAI Dashboard](<test_url>) |
```

**If `final_state` has values** (the user used "store as X" — see §4), append a second table:

```markdown
| 📦 What was found | Value |
|-------------|----------------|
| <key from final_state, humanized> | <value> |
```

**If the objective used assertions** ("assert …", "verify …"), append a pass/fail table per assertion derived from the run summary and step remarks.

### 1.4 On failure

For exit code 1 (or `status: "failed"` in `run_end`), present a plain-language failure report — never raw paths or NDJSON. Template:

```markdown
🔴 **Failed** at step <n> of <total> (after <duration>s)

**What happened:** <plain-language description of the failing step's remark>.

**Likely cause:** <your diagnosis: missing element, slow page, ambiguous objective, auth wall, etc.>

**Suggested fix:** <one concrete next step the user can take>.
```

If a screenshot exists at `<run_dir>/run-test/screenshots/step_<n>.png`, Read it and show it inline before the suggested fix. For deeper diagnosis, see `references/debug.md`.

---

## 2. Decision tree

When the user's request involves a browser:

**Is kane-cli installed and authenticated?**
- Unknown → `kane-cli whoami`
- No / errors → Read `references/setup-and-config.md`
- Yes ↓

**What does the user want?**
- A single one-shot browser task → build a `kane-cli run --agent` command (§3 + §4)
- A test they want to save / re-run / commit → Read `references/testmd.md` first, then use `kane-cli testmd`
- Multiple independent browser tasks → Read `references/parallel.md` first
- Debug a failed run → Read `references/debug.md`
- Configure kane-cli or check directory layout → Read `references/setup-and-config.md`
- You need the full NDJSON event schema (rare — §5's summary covers 90% of cases) → Read `references/parsing.md`

**Every run, always:** follow §1 above.

---

## 3. Building a `run` command

```bash
kane-cli run "<objective>" --agent [options]
```

`--agent` is mandatory — it switches stdout to NDJSON. Most-used flags:

| Flag | Purpose | Default |
|------|---------|---------|
| `--headless` | No visible browser window | Off |
| `--max-steps <n>` | Cap agent reasoning steps | 30 |
| `--timeout <s>` | Hard kill after N seconds | No limit |
| `--variables <json>` | Inline variables JSON (for `{{key}}` in objective) | None |
| `--variables-file <path>` | Load variables from a JSON file | None |
| `--ws-endpoint <url>` | Remote browser (LambdaTest grid) | Local Chrome |
| `--code-export` | Generate code export after upload | Off |

Other flags (`--global-context`, `--local-context`, `--cdp-endpoint`) and the full variables precedence chain live in `references/setup-and-config.md`.

**Exit codes:** `0` passed · `1` failed · `2` auth/infra error · `3` timeout/cancelled.

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

How you phrase the objective string determines what the agent does. Three patterns:

| Pattern | Trigger words | Behavior |
|---|---|---|
| 🎯 **Action** | "go to", "click", "type", "search", "fill" | Performs browser actions |
| ✅ **Assertion** | "assert", "verify", "confirm", "check that" | Pass/fail check on a condition |
| 📦 **Extraction** | "store X as 'name'" | Persists a value into `run_end.final_state` |

### The "store as" rule (critical for extraction)

Vague phrasing like "read", "tell me", "report" does NOT reliably extract data — the agent may see the value but won't capture it. Use "store as".

❌ `"go to example.com and read the page title"`
✅ `"go to example.com, store the page title as 'page_title'"`

Stored values appear in `run_end.final_state` and become the second results table per §1.3.

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
| Always include starting URL | Assume the agent knows where to start |
| Split mega-objectives (>15 steps) into multiple runs | Cram everything into one |

---

## 5. Parsing `--agent` output — essentials

> Internal reference only. Never expose these field names to the user — translate them per §1.

Stdout is NDJSON, one event per line. There are two shapes:

- **Progress events** (most events) have `step` (1-based), `status` (`passed`/`failed`), `remark` — and **no `type` field**.
- **Typed events** have a `type` field: `bifurcation`, `child_agent_start`, `child_agent_end`, `ask_user`, `error`, and finally `run_end`.

Parsing strategy:

```text
for each line:
  if obj.type === "run_end"  → terminal, stop parsing
  else if obj.type exists    → typed flow event (rare)
  else if obj.step exists    → progress event → narrate per §1.2
```

`run_end` is the only event with a stable cross-version schema — build all post-run logic on it.

For full event schemas (`bifurcation` flow fields, `child_agent_*`, `ask_user` semantics, `cancel`/`user_response` outbound events, complete `run_end` field list), Read `references/parsing.md`.

---

## 6. When to read which reference

| Situation | Read |
|---|---|
| User wants to save/persist/re-run a test | `references/testmd.md` |
| Run failed, need to diagnose | `references/debug.md` |
| Multiple independent browser tasks | `references/parallel.md` |
| Need full NDJSON event schema | `references/parsing.md` |
| First-time install, auth, or full config | `references/setup-and-config.md` |
