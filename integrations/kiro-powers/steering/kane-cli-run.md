# Kane CLI — `kane-cli run` steering

Load this steering file for every `kane-cli run` invocation. It carries the full "how to actually use Kane CLI" reference: writing good objectives, the complete flag table, NDJSON parsing, results presentation, failure diagnosis, and parallel execution.

The single rule that governs everything below: **wait for the terminal `run_end` event.** `--agent` streams progress events while the run is in flight; the run is only finished when the `run_end` line arrives on stdout or the process exits. Acting on partial information — relaunching, "retrying with a longer timeout", searching the filesystem mid-run — is the most common bug. Don't.

---

# Decision tree (run before every invocation)

When a dependency check fails, run the fix yourself. Only ask the user when the action genuinely needs human input (credentials, project / folder IDs the user must look up).

**Is `kane-cli` installed?**
- Unknown → run `kane-cli --version`.
- No → run `npm install -g @testmuai/kane-cli`. If npm fails with `EACCES` or similar, see POWER.md Step 1.
- Yes → continue.

**Is the user signed in?**
- Unknown → run `kane-cli whoami`.
- No → ask which auth method (basic / OAuth) and run `kane-cli login --username … --access-key …` or `kane-cli login --oauth`. Never fabricate credentials.
- Yes → continue.

**What does the user want?**
- One browser task → build a single `kane-cli run "<objective>" --agent …` command. **The `run` subcommand is mandatory** — `kane-cli "<objective>"` exits `2` with a "did you mean" hint.
- Test / verify something → same, with assertion phrasing.
- Extract data from a page → same, using the `store … as '<name>'` pattern.
- Save / re-run / commit a test → switch to `kane-cli testmd`. Load the **`kane-cli-testmd`** steering file.
- **Test cases or scenarios written** — because the user asked, or because the task needs them (no browser action) → **don't hand-draft them**; load the **`kane-cli-generate`** steering file and use `kane-cli generate`. Trigger phrases: "write tests for", "test cases for", "test suite for", "what edge cases", "generate tests for".
- Browse / create a Test Manager project or folder, or interpret a `project_folder_auto_defaulted` event → use `kane-cli projects list|create` / `kane-cli folders list|create` (NDJSON under `--agent`). The run-startup gate auto-defaults a project/folder when nothing is configured and emits `project_folder_auto_defaulted` before the first progress event.
- Multiple independent flows → decompose into N self-contained sub-objectives and run them in parallel.
- Debug a failed run → read the run's evidence pack (failure records, per-step logs, screenshots) — see Failure handling below.

After every run: parse NDJSON, present a plain-language results card with any extracted values, and on failure render the failing screenshot inline.

---

# Writing objectives — four patterns

The objective string is the single most important input. It determines what the agent does.

| Pattern | Trigger phrases | Agent behavior |
|---|---|---|
| 🎯 **Action**     | "go to", "click", "type", "search", "fill", "scroll" | Performs browser actions |
| ✅ **Assertion**  | "assert", "verify", "confirm", "check that"          | Validates a condition (pass / fail) |
| 📦 **Extraction** | "store X as 'name'"                                   | Reads a value from the page and persists it in `final_state` |
| 🔌 **API call**   | "call", "POST/GET a URL", a pasted `curl`            | Makes the HTTP request itself; "save the response as X", then assert/reference `{{X.status}}` / `{{X.response_body…}}` |

## The "store as" pattern is mandatory for extraction

Vague phrasing does **not** persist values. The agent may "see" them but they will not appear in `final_state`.

**Bad — agent looks but doesn't capture:**

```
"go to example.com and read the page title"
"go to example.com and tell me the price"
"go to example.com and report the headline"
```

**Good — agent extracts and persists:**

```
"go to example.com, store the page title as 'page_title'"
"go to example.com, store the price of the first item as 'price'"
"go to example.com, store the headline as 'headline'"
```

## Calling APIs directly

The agent can make API calls itself — not just observe the requests a page makes. Phrase an explicit call and name the response:

```
"Call POST https://api.example.com/login with body {...}, save the response as login,
 assert {{login.status}} is 200"
```

Reference the saved response as `{{login.status}}` and `{{login.response_body.<field>}}`; a pasted `curl` works too. API calls and browser actions mix in one objective — use a direct call to set up state (seed a record, hit a backend), and DevTools/Network (below) to **observe** the requests the page itself makes.

## Combining patterns

Chain action → extraction → assertion in a single objective:

```
"go to {{app_url}}/dashboard,
 store the welcome message as 'welcome_text',
 store the user role in the sidebar as 'role',
 assert the role is 'Admin'"
```

## Assertion specificity

| Type | Example |
|---|---|
| Exact match | `"assert the cart total shows '$29.99'"` |
| Flexible    | `"assert a price is displayed for each product"` |
| State       | `"assert the Submit button is disabled until all fields are filled"` |
| Conditional | `"if a cookie banner appears, dismiss it, then assert the homepage loads"` |
| Negative    | `"assert no error message or red banner is visible"` |
| Positional  | `"assert 'Settings' appears in the left sidebar navigation"` |

## Analyze methods — picking the right checkpoint

Assertions, extractions, and if/else checkpoints each work with five **analyze methods** — *where* the agent looks for the data. The method is selected from the phrasing of the objective. Pick the method that matches the data source, not the one that's easiest to type.

| Method | Use it for | Phrasing the agent recognizes |
|---|---|---|
| **Visual** (default) | Visible text, prices, labels, counts, colors by name, visibility | "the price …", "is visible", "displays", "is shown" |
| **Textual (DOM)** | Element states, CSS properties, HTML attributes, exact CSS color values | "is disabled / enabled / checked", "the placeholder of …", "the aria-label of …", "the font-size of …", "rgb(…)" / "#hex" |
| **URL** | Address bar — path, query, fragment, redirects | "URL contains …", "URL path is …", "URL has param …", "redirected to …" |
| **Title** | Browser tab `document.title` | "page title contains …", "title is …" |
| **DevTools** | Things not visible on the page — network, console, performance, cookies, localStorage | see DevTools subdomains below |

### DevTools subdomains

Five domains. Each captures data the user cannot see on screen. The agent picks the subdomain from phrasing.

| Subdomain | Captures | Scope | Common phrasing |
|---|---|---|---|
| **Network** | HTTP requests/responses, incl. API calls you make directly — status codes, headers, response bodies, timing | Resets each step | "no API calls returned 5xx", "the POST /api/login returned 200", "all API responses completed under 2 seconds" |
| **Console** | `console.log/warn/error/info/debug` + uncaught JS exceptions | Resets each step. Top frame only | "no console errors", "no uncaught JS exceptions", "console contains '…'" |
| **Performance** | Core Web Vitals — LCP, CLS, INP, FCP, TTFB | Per-navigation, point-in-time | "page LCP is under 2500ms", "CLS is below 0.1", "TTFB under 800ms" |
| **Cookies** | All cookies including `httpOnly` — name, value, flags | Point-in-time, persists across steps | "a cookie named 'session_id' exists", "the session cookie is httpOnly", "no cookies without the Secure flag" |
| **localStorage** | Browser `localStorage` for the current origin | Point-in-time, persists across steps on same origin | "auth_token exists in localStorage", "the theme preference is 'dark'" |

> Network and Console **reset between steps** — if a later step asserts on traffic or logs from an earlier step, extract and carry the value forward. Cookies and localStorage **persist** across steps on the same origin.

### Operators

Assertions support these comparisons. Phrase naturally — the agent maps to the right one.

| Operator | Meaning | Example |
|---|---|---|
| `equals` | Exact match | "price equals $29.99", "title is 'Home'" |
| `contains` | Substring match | "URL contains /checkout" |
| `not_contains` | Does not contain | "title not contains 'Error'" |
| `gt` / `gte` | Greater than / or equal | "items greater than 5" |
| `lt` / `lte` | Less than / or equal | "LCP less than 2500" |
| `not_equals` | Not equal | "status not equals 'failed'" |

### Picking the right method when in doubt

- "Is the price $29.99?" → **Visual** (on screen).
- "Is the submit button disabled?" → **Textual/DOM** (state, not visible text).
- "Does this red background match exactly `rgb(220,38,38)`?" → **Textual/DOM** (exact CSS).
- "Are we on the checkout page?" → **URL**.
- "Did the page send failed API calls?" → **DevTools/Network**.
- "Are there console errors?" → **DevTools/Console**.
- "Is the page fast?" → **DevTools/Performance** (LCP/FCP/TTFB).
- "Did login set a session cookie?" → **DevTools/Cookies**.
- "Did the app store the auth token?" → **DevTools/localStorage**.

Default when uncertain: **Visual** — that's what the agent does too.

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Imperative verbs: "go to", "click", "store as" | Vague verbs: "check out", "look at", "explore" |
| Be specific: "click the 'Add to Cart' button"   | Be vague: "add the item" |
| Name extractions: "store X as 'price'"          | Hope for values: "tell me the price" |
| Use the right analyze method for the data       | Default to a generic "check this" when DevTools fits |
| Use `{{variables}}` for credentials and URLs    | Hardcode secrets in the objective string |
| Include the starting URL in the objective       | Assume the agent knows where to start |
| Split mega-objectives (>15 steps) into runs     | Cram everything into one giant objective |

---

# Full flag reference

```bash
kane-cli run "<objective>" --agent [flags]
```

| Flag | Purpose | Default |
|---|---|---|
| `--agent` | **Required for Kiro.** Emit one JSON object per line on stdout. Without it, Kane CLI renders a TUI. | off |
| `--headless` | Run Chrome without a window. | off |
| `--max-steps <n>` | Cap agent reasoning steps. | `30` |
| `--timeout <s>` | Hard kill after N seconds. | none |
| `--url <url>` | Start URL for the run. Overrides config `default_url`; bare domains get `https://`. | config `default_url` |
| `--allow-missing-url` | Non-TTY only: start from the browser's current page instead of failing when no start URL resolves. | off |
| `--variables '<json>'` | Inline variables JSON. | none |
| `--variables-file <path>` | Load variables from a JSON file. | none |
| `--global-context <file>` | Override global agent context. | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override project agent context. | `.testmuai/context.md` |
| `--ws-endpoint <url>` | Remote browser via WebSocket (e.g. LambdaTest grid). | local Chrome |
| `--cdp-endpoint <url>` | Connect to existing Chrome via CDP. | auto-launch Chrome |
| `--code-export` | Generate a Playwright code export after upload. | off |
| `--bug-detection <mode>` | Flag suspected product bugs while authoring: `off`/`stop`/`continue` (`stop` halts on a confirmed bug; `continue` records and keeps going). Overrides `config set-bug-detection`. | config value (`off`) |
| `--name <slug>` | Persist this run as `<cwd>/.testmuai/tests/<slug>_test.md` on exit. Slug: `[a-zA-Z0-9_-]+`. | none — the run is ephemeral |

## Start URL (required)

Every run needs a start URL for the first navigation, resolved as `--url` flag → config `default_url` (`kane-cli config set-url <url>`) → a site named in the objective. There is **no** silent default site. Because Kiro runs Kane CLI non-TTY, a run that resolves **no** start URL **fails** (exit `2`) rather than prompting — so always either start the objective with the site ("Go to https://… and …") or pass `--url <url>`. To deliberately start from the browser's current page, add `--allow-missing-url`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | ✅ Passed |
| `1` | ❌ Failed |
| `2` | ⚠️ Error (auth, setup, infra) |
| `3` | ⏱️ Timeout or cancelled |

## Variables and secrets

Use `{{key}}` in the objective and provide the values inline or from a file:

```json
{
  "username": { "value": "alice@example.com", "secret": false },
  "password": { "value": "s3cret!",            "secret": true  }
}
```

`secret: true` masks the value in logs and routes it through TestMu AI's secrets store instead of being uploaded as a plain variable.

Loading order (later wins):

1. `~/.testmuai/kaneai/variables/*.json` — global, alphabetical
2. `{cwd}/.testmuai/variables/*.json` — project overrides
3. `--variables-file <path>`
4. `--variables '{...}'` — inline

**Always parameterize:** credentials, API keys, tokens, environment-specific URLs. **OK to hardcode:** one-off URLs, static UI text, navigation paths.

## Context files

The agent picks up two Markdown context files automatically:

- **Global** — `~/.testmuai/kaneai/global-memory.md`, shared across all runs.
- **Local**  — `.testmuai/context.md` in the current working directory, project-specific.

Override either per-run with `--global-context` / `--local-context`.

---

# Parsing the NDJSON output

> **Internal reference only.** Never echo these field names (`run_end`, `final_state`, `session_dir`, `run_dir`, `bifurcation`, `NDJSON`) back to the user. Translate them.

`--agent` writes one JSON object per line on **stdout**. The progress UI goes to **stderr**.

## Event types

**Progress events** — most of stdout, one per agent step. They have **no `type` field**:

```json
{"step": 1, "status": "passed", "remark": "Navigated to amazon.in"}
{"step": 2, "status": "passed", "remark": "Typed 'laptop' in search box"}
{"step": 3, "status": "failed", "remark": "Could not find Add to Cart button"}
```

| Field | Type | Description |
|---|---|---|
| `step`   | number | Step index, 1-based |
| `status` | string | `"passed"` or `"failed"` |
| `remark` | string | What the agent did or why it failed |

**Typed events** — `type` field present:

| `type` | Key fields | Purpose |
|---|---|---|
| `project_folder_auto_defaulted` | resolved project + folder (id, name) | Run-startup gate auto-resolved a project/folder when none was configured (or the cached one was stale/invalid). Fires **before** any progress event. Translate to a one-line note ("kane-cli auto-selected project X / folder Y for this run") and continue parsing. |
| `bifurcation`       | `flows[]`, `count`                          | Agent split the objective into sub-flows |
| `child_agent_start` | `child_id`, `objective`, `parent_step`      | Child agent spawned |
| `child_agent_end`   | `child_id`, `success`, `steps_taken`, `summary` | Child agent finished |
| `ask_user`          | `question`, `step_index`, `options?`        | Agent needs input (auto-disabled when stdin is non-TTY) |
| `error`             | `message`                                   | Error |
| `test_md_evidence_ingest` | `status: "ok"\|"failed"`, `evidence_id`, `stage?` | `testmd run` only: a replay's evidence pack published to the dashboard. Informational. |
| `test_md_bundle_sync` | `status: "ok"\|"failed"`, `commit_id`, `bytes?`/`stage?` | `testmd run`/`testmd sync`: test bundle pushed to cloud after an authored commit. Informational. |
| `testrun_*` family  | see the **`kane-cli-testrun`** steering file | Only from `kane-cli testrun run`; its terminal event is `testrun_done`, not `run_end`. |

There is no `run_start` event — the first line is either `project_folder_auto_defaulted`, a `bifurcation`, or a progress object.

**The evidence hint is not an event.** After a run, Kane CLI prints `` evidence: view locally with `kane-cli evidence serve <path>` `` on **stderr**. Never look for it on stdout.

`ask_user` is auto-disabled when stdin is not a TTY. Since Kiro runs Kane CLI as a subprocess, `ask_user` events will not be emitted — write objectives that don't require interactive input.

## Parsing strategy

```
for each line on stdout:
  if obj.type === "run_end"     → terminal event, stop parsing
  if obj.type === "bifurcation" → flow split, note it for narration
  if obj.type is set            → other typed event
  if obj.step is set            → progress event (narrate it)
```

Build automation on `run_end` — it is the only event with a stable schema across versions. Use progress events for live narration only.

## The wait-for-`run_end` rule

The most common failure mode for this power is the agent deciding partway through a run that it should "check what we've captured so far and re-run with a longer timeout." That is wrong.

- Progress events stream while the run is in flight. Narrate them. **Take no other action.**
- The single terminal `run_end` line arrives when the run is **actually finished** — regardless of pass / fail / error / timeout.
- The process exit code is the secondary source of truth (`0` / `1` / `2` / `3`).

Only after the `run_end` line or the process exit do you act — render the results card, propose a fix, etc.

If progress events stop arriving for >60 seconds and the process is still alive, **wait.** Kane CLI applies its own `--timeout` and will emit a `run_end` with `status: "failed"` (or exit with code `3`). Until then, the run is not done.

The only reasons to interrupt:

1. The user explicitly typed "stop" / "cancel".
2. The Kane CLI process exited.
3. The terminal `run_end` event arrived.

## Terminal `run_end` event

Always the last line on stdout:

```json
{
  "type": "run_end",
  "status": "passed",
  "summary": "Searched for laptop and added first result to cart",
  "one_liner": "Searched for laptop on Amazon and added to cart",
  "reason": "Objective completed",
  "duration": 45.2,
  "credits": 12,
  "final_state": { "price": "$29.99", "product_name": "Wireless Headphones" },
  "context": { "memory": {}, "variables": {}, "pointer": "(passed) ..." },
  "session_dir": "~/.testmuai/kaneai/sessions/<uuid>",
  "run_dir":     "~/.testmuai/kaneai/sessions/<uuid>/runs/0",
  "test_url":    "https://test-manager.lambdatest.com/projects/123/test-cases/456"
}
```

Read these fields:

| Field | Meaning |
|---|---|
| `status`       | `"passed"` / `"failed"` |
| `summary`      | What the agent did |
| `one_liner`    | Short summary for display |
| `reason`       | Why the run stopped |
| `duration`     | Seconds |
| `credits`      | Credits consumed (when reported) |
| `final_state`  | Extracted values from "store as" objectives |
| `test_url`     | KaneAI dashboard link (when upload succeeded) |
| `session_dir`  | Path to the session directory (session log + the sealed evidence pack under `evidence/`) |
| `run_dir`      | **Legacy** — this directory is no longer created; run logs and screenshots live inside the evidence pack |
| `result_code`  | Optional string classification. Under `--bug-detection`, a **confirmed product bug** arrives as `result_code: "740"` plus a `verdict` object (`confirmed`, `family`, `category`, `severity`, `one_liner`, `confidence`). Report it as a product bug found — distinct from a test failure. |

---

# Presenting results

## During the run — narrate, don't sit silent

As progress events stream in, narrate them in plain language:

> Step 1: Opened Amazon homepage
> Step 2: Typed 'laptop' in the search bar
> Step 3: Clicked the search button
> Step 4: Search results loaded — found product listings

If a step fails mid-run, flag it immediately:

> Step 5: Could not find the 'Add to Cart' button — the agent is retrying…

Keep updates terse. Do not paste raw JSON, field names, or `run_dir` paths.

## After the run — render a results card

**Successful run:**

| | |
|---|---|
| 🟢 **Result**          | Passed |
| 🎯 **Task**            | Search for 'laptop' on Amazon |
| ⏱️ **Duration**        | 45.2s |
| 👣 **Steps taken**     | 7 |
| 📝 **What happened**   | Opened Amazon, typed 'laptop' in search, clicked search, results loaded with 48 products |
| 🔗 **View details**    | [Open in KaneAI Dashboard](<test_url>) |

**If data was extracted** (from "store as" objectives):

| 📦 What was found | Value |
|---|---|
| Top repository | freeCodeCamp/freeCodeCamp |
| Star count     | 413k |
| Price          | $29.99 |

**If assertions were checked:**

| ✅ Check                              | Result |
|---|---|
| Dashboard shows welcome message       | 🟢 Passed |
| User role is Admin                    | 🔴 Failed |

## On failure

Explain what went wrong **in the user's terms** — don't paste log paths.

> 🔴 **Failed** at step 5 of 9 (after 25s)
>
> **What happened:** The agent clicked "Proceed to Checkout" but the payment form never appeared. The page showed a loading spinner for 15 seconds before the agent timed out.
>
> **Likely cause:** The checkout page may require authentication, or the site's payment service was slow / down.
>
> **Suggested fix:** Add an explicit login step before checkout, or raise the timeout to 120s.

Then extract the failing-step screenshot from the run's evidence pack (`unzip <pack> "tests/*/steps/*/screenshot.png" -d <tmpdir>`) and render it inline.

## Bug-report heuristic

Offer to file a bug **only** when the failure looks like Kane CLI itself, not the website or a vague objective. File at **https://github.com/LambdaTest/kane-cli/issues** with: the objective, the full command, the exit code, the last few progress events, and the `<n>-actions.ndjson` log from the run's evidence pack.

Do **not** offer a bug report for: auth issues, low timeouts, vague objectives, website 5xx, or CAPTCHAs.

---

# Failure handling & log inspection

## The evidence pack is the log source

Every run seals an **evidence pack**; all run artifacts — actions, console, network, screenshots, failure records — live inside it. **`run_end.run_dir` is legacy: that directory is not created anymore.** Do not try to read `{run_dir}/run-test/...`.

Find the pack: `{session_dir}/evidence/<execution_id>.evidence`; named/saved runs also land in `<cwd>/.testmuai/evidence/`. The post-run stderr hint names the exact path.

A `.evidence` file is a plain zip:

```bash
unzip -l <pack>                                            # list entries
unzip -p <pack> "tests/*/result.yaml"                      # verdict + per-step outcomes
unzip -p <pack> "tests/*/steps/*/failure.yaml"             # failure records (failed steps only)
unzip -p <pack> "tests/*/logs/0-console.ndjson"            # browser console, run 0
unzip <pack> "tests/*/steps/*/screenshot.png" -d /tmp/ev   # extract screenshots to view
```

Pack layout (per test):

```
tests/<test-id>/
├── test.md                    # the definition
├── result.yaml                # verdict, steps[] (ordinal, status, kind, duration, action_id)
├── logs/                      # meta.yaml, tui.log, and per run index n:
│                              #   <n>-run.log, <n>-actions.ndjson,
│                              #   <n>-console.ndjson, <n>-network.har
├── steps/<ordinal>-<step-id>/ # screenshot.png, annotated.png, step.json
│                              #   (+ failure.yaml on failed steps)
├── auteur/execution.json      # full execution trajectory
└── v16-trajectory/            # per-run planning summaries
```

## Debugging flow

1. Parse `run_end` from stdout — `status`, `reason`, `summary`, `session_dir`.
2. Open the pack: the failed step's `failure.yaml` (error + page state), then that step's slice of `<n>-console.ndjson` / `<n>-network.har` — a 4xx/5xx or JS error usually explains the failure; cite it in plain language.
3. Look at the failing step's `annotated.png` — it highlights the element the agent acted on. Render it inline.
4. Check `tui.log` (in the pack's `logs/`, or `{session_dir}/tui.log`) for session-level issues (Chrome launch, auth, upload).

Offer the visual route: `kane-cli evidence serve <pack>` starts a local-only server and prints a hosted-viewer link. After agent-mode runs, Kane CLI prints a stderr hint line (`` evidence: view locally with `kane-cli evidence serve <path>` ``) — it is plain text on stderr, never a stdout event. If a pack won't open, `kane-cli evidence validate <pack>` reports whether it's truncated/unsealed. Full evidence + testrun surface: load **`kane-cli-testrun`** steering.

## Common failure patterns

| Symptom | Likely cause | Fix |
|---|---|---|
| 🔄 Agent repeats the same action | Stuck in a loop / page didn't change | Rephrase the objective, add an explicit wait or assertion |
| 🎯 Agent clicks the wrong element | Ambiguous UI, multiple similar elements | Be more specific ("click the **blue** Submit button in the **checkout form**") |
| 👁️ Agent says "done" but nothing happened | Objective too vague | Add a concrete assertion ("assert the confirmation page shows an order number") |
| 💀 Exit `2`, no steps | Auth, TMS credential exchange, or Chrome failure | Check `kane-cli whoami`; ensure Chrome is installed |
| ❓ Exit `2` with "did you mean …" | Missing `run` subcommand — agent invoked `kane-cli "<objective>"` instead of `kane-cli run "<objective>"` | Re-invoke with `run` (same rule for `testmd run` / `generate`) |
| 📤 Upload silently fails after setting a project/folder by hand | Saved ID is invalid (typo, deleted, no access) | No action needed — the next run detects the 4xx and auto-defaults a working project/folder. To rebind: `kane-cli config project` or `kane-cli projects list` → `kane-cli config project <id>` |
| ⏱️ Exit `3` | Timeout or cancelled | Raise `--timeout`, raise `--max-steps`, or split the objective |
| 🚫 `CDP endpoint not reachable` | Chrome not running | Drop `--cdp-endpoint` and let Kane CLI auto-launch Chrome |

---

# Parallel execution

For multiple independent browser tasks, decompose and run in parallel.

> **Saved tests? Use testrun instead.** If the tasks are committed `_test.md` files, don't hand-roll parallelism — `kane-cli testrun run --parallel N` gives isolated Chromes, a pooled scheduler, one rollup, and one evidence pack. Load the **`kane-cli-testrun`** steering file. This section is for **ad-hoc `run` objectives** only.

## When to split

- **>15 steps** — long runs drift and get stuck.
- **Independent flows** — login test and checkout test don't depend on each other.
- **Different pages / features** — settings vs checkout vs admin.
- **Different roles** — admin flow vs regular-user flow.

## How to split

Each sub-objective must be **self-contained**: it navigates to its own URL, authenticates independently, asserts its own outcomes. No sub-objective depends on another having run first.

## Pattern

1. Decompose the user's request into N independent sub-objectives.
2. Spawn N invocations in parallel, each:
   ```bash
   kane-cli run "Go to <url> and <sub-objective>" --agent --headless --timeout 120
   ```
3. Each parser captures the exit code, parses `run_end`, and on failure reads the failing-step screenshot.
4. After all complete, format a single batch summary.

## Batch summary format

```markdown
## 🧪 Test Suite: <suite name>

| # | Test               | Status | Steps | Time | What happened |
|---|--------------------|--------|-------|------|---------------|
| 1 | Login + dashboard  | ✅ | 5 | 12s | Welcome banner visible |
| 2 | Product search     | ✅ | 7 | 18s | 3 results for 'shoes' |
| 3 | Checkout flow      | ❌ | 9 | 25s | Payment form did not load |
| 4 | Admin CSV export   | ✅ | 6 | 15s | CSV downloaded (42 rows) |

### 📊 Overall
- **Pass rate:** 3/4 (75%)
- **Total steps:** 27 · **Total time:** 1m10s

### ❌ Failures
**#3 Checkout flow** — Payment form did not load after clicking "Credit Card".
📸 [screenshot rendered inline]
```

Status icons: ✅ passed · ❌ failed · ⚠️ stuck / timeout. **Never** show raw paths to session / run directories — read the screenshot and show it inline, or offer to inspect logs only if the user asks.

---

# Validation-layer pattern (verifying Kiro's own output)

When Kiro has just generated or modified UI code, use Kane CLI as the verification step before merge / ship:

1. Identify the user-visible behavior the change is supposed to deliver.
2. Translate it into one targeted objective (action + assertion).
3. Run headless with a tight timeout.
4. If passed, summarize and continue. If failed, read the screenshot, diagnose, and propose a concrete code fix — don't just say "it failed".

Example:

```bash
kane-cli run "Go to http://localhost:5173/settings/profile, click 'Save', assert a green 'Saved' toast appears within 3 seconds and the page does not reload" \
  --agent --headless --timeout 60
```

---

# Configuration surface (reference)

```bash
kane-cli whoami
kane-cli config show
kane-cli config set-window 1920x1080
kane-cli config set-url <url>             # default start URL (used when --url is absent)
kane-cli config set-bug-detection <mode>  # off | stop | continue (default off); per-run --bug-detection overrides
kane-cli config chrome-profile <path>     # or the interactive picker in TTY
kane-cli config project <project-id>      # or the interactive picker in TTY (OAuth + basic both work)
kane-cli config folder  <folder-id>       # or the interactive picker in TTY
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."
```

## Chrome launch overrides (environment variables)

These are **launch/CI overrides**, not Kane CLI configuration — they tune how Chrome is located and started, and are read from the process environment:

| Variable | Effect |
|---|---|
| `KANE_CLI_CHROME_PATH` | Absolute path to the Chrome binary (non-standard installs). |
| `KANE_CLI_SKIP_BROWSER_DOWNLOAD` | Truthy (`1`/`true`/`yes`) skips the Chrome-availability startup check; uses whatever `chrome` is on PATH. |
| `KANE_CLI_CDP_TIMEOUT_MS` | Per-attempt CDP readiness timeout in ms (default `30000`). Raise on slow/cold runners. |
| `KANE_CLI_CDP_RETRIES` | Extra launch attempts after the first on CDP-readiness failure (default `2`; `0` = single attempt). |

If a run fails with a Chrome-launch error on a slow runner, raise the timeout/retries before retrying. A missing/invalid binary fails immediately and is not retried.

## Browsing / creating projects and folders (non-TTY)

When Kiro's shell is non-TTY, the picker is not appropriate. Use the agent surface:

```bash
kane-cli projects list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli projects create "<name>" [--description "<text>"] --agent
kane-cli folders  list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  create "<name>" [--description "<text>"] --agent
```

NDJSON wire shape — each result row is `{id, name}`, terminated by `{_meta: "page", limit, offset, returned, has_more}` (no `total` — paginate while `has_more === true`). `folders` operate inside the currently configured project.

## The run-startup auto-default gate

Every `run`, `testmd run`, and `generate` validates the cached project/folder before launching. Three outcomes:

1. Cached project/folder still valid → run proceeds, no event.
2. Nothing configured **or** cached IDs are gone / invalid / inaccessible → Kane CLI auto-resolves (find-or-create) and emits `project_folder_auto_defaulted` on stdout before any progress event. Surface as a one-liner ("Kane CLI auto-selected project X / folder Y for this run").
3. No usable credentials in a non-TTY context → exit `2` (auth/setup).

Self-healing: stale, deleted, revoked, or typo'd project IDs trigger 4xx from TMS and the gate re-resolves automatically — no need to clear them by hand.

Project-local overrides live in `./.testmuai/` (`context.md`, `variables/*.json`). Global config and history live in `~/.testmuai/kaneai/`. Pass everything through flags — do **not** rely on environment variables for Kane CLI configuration.
