# Kane CLI — `kane-cli run` steering

Load this steering file for every `kane-cli run` invocation. It carries the full "how to actually use Kane CLI" reference: writing good objectives, the complete flag table, NDJSON parsing, results presentation, failure diagnosis, and parallel execution.

The single rule that governs everything below: **wait for the terminal `run_end` event.** `--agent` streams progress events while the run is in flight; the run is only finished when the `run_end` line arrives on stdout or the process exits. Acting on partial information — relaunching, "retrying with a longer timeout", searching the filesystem mid-run — is the most common bug. Don't.

---

# Decision tree (run before every invocation)

When a dependency check fails, run the fix yourself. Only ask the user when the action genuinely needs them (finishing sign-in in the browser, a project or folder they must pick).

**Is `kane-cli` installed, signed in and ready?**
- Unknown → run the ready check and show the ready card (POWER.md → Every session). On a first session, load the **`kane-cli-first-run`** steering file before launching.
- A problem that stops the run → offer the fix from the card. Not installed: run `npm install -g @testmuai/kane-cli` (if npm fails with `EACCES` or similar, see POWER.md Step 1). Not signed in: Kiro runs `kane-cli login --oauth` itself (POWER.md Step 2). Never ask for an access key or password in chat, and never fabricate credentials.
- Ready → continue.

**What does the user want?**
- One browser task → build a single `kane-cli run "<objective>" --agent …` command. **The `run` subcommand is mandatory** — `kane-cli "<objective>"` exits `2` with a "did you mean" hint.
- Test / verify something → same, with assertion phrasing.
- Extract data from a page → same, using the `store … as '<name>'` pattern.
- Save / re-run / commit a test → switch to `kane-cli testmd`. Load the **`kane-cli-testmd`** steering file.
- **Test cases or scenarios written** — because the user asked, or because the task needs them (no browser action) → **don't hand-draft them**; load the **`kane-cli-generate`** steering file and use `kane-cli generate`. Trigger phrases: "write tests for", "test cases for", "test suite for", "what edge cases", "generate tests for".
- Browse / create a Test Manager project or folder, or interpret a `project_folder_auto_defaulted` event → use `kane-cli projects list|create` / `kane-cli folders list|create --project <id>` (NDJSON under `--agent`). The run-startup gate auto-defaults a project/folder when nothing is configured and emits `project_folder_auto_defaulted` before the first progress event.
- The user wants results saved somewhere else ("change project") → follow **Changing where results go** below. The change is global, and the question must say so.
- The user wants to change how runs behave ("kane preferences": watch or quiet, one-off or suite), or asks what Kane CLI can do or for the tour again ("kane tour") → load the **`kane-cli-first-run`** steering file.
- Multiple independent flows → decompose into N self-contained sub-objectives and run them in parallel.
- Debug a failed run → read the run's evidence pack (failure records, per-step logs, screenshots) — see Failure handling below.

After every run: parse NDJSON, present the result card with any extracted values, and on failure show the failing screenshot under the card.

---

# Writing objectives — four patterns

The objective string is the single most important input. It determines what the agent does.

| Pattern | Trigger phrases | Agent behavior |
|---|---|---|
| 🎯 **Action**     | "go to", "click", "type", "search", "fill", "scroll" | Performs browser actions |
| ✅ **Assertion**  | "assert", "verify", "confirm", "check that"          | Validates a condition (pass / fail) |
| 📦 **Extraction** | "store X as 'name'"                                   | Reads a value from the page and persists it in `final_state` |
| 🔌 **API call**   | "call", "POST/GET a URL", a pasted `curl`            | Makes the HTTP request itself; "save the response as X", then asserts on it in plain English: "assert the response status is 200", "store the id from the response body as 'order_id'" |

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
 assert the response status is 200"
```

Use the response in plain English (`the response status`, `store the id from the response body as 'order_id'`, later `the stored order_id value`); `{{name}}` is reserved for global variables and secrets. A pasted `curl` works too. API calls and browser actions mix in one objective — use a direct call to set up state (seed a record, hit a backend), and DevTools/Network (below) to **observe** the requests the page itself makes.

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
| `--max-steps <n>` | Cap agent reasoning steps. | `50` |
| `--timeout <s>` | Hard kill after N seconds. | none |
| `--url <url>` | Start URL for the run. Overrides config `default_url`; bare domains get `https://`. | config `default_url` |
| `--allow-missing-url` | Non-TTY only: start from the browser's current page instead of failing when no start URL resolves. | off |
| `--variables '<json>'` | Inline variables JSON. | none |
| `--variables-file <path>` | Load variables from a JSON file. | none |
| `--global-context <file>` | Override global agent context. | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override project agent context. | `.testmuai/context.md` |
| `--ws-endpoint <url>` | Remote browser via WebSocket (e.g. LambdaTest grid). | local Chrome |
| `--cdp-endpoint <url>` | Connect to existing Chrome via CDP. | auto-launch Chrome |
| `--code-export` | Generate a Playwright code export after upload. | config (`true` by default) |
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

Exit `2` means nothing ran and no credits were used: present the `🟡 Didn't start` card, not a failure. Exit `3` gets the stopped early card. Both are under Presenting results.

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

> **Internal reference only.** Never echo these field names (`run_end`, `final_state`, `session_dir`, `run_dir`, `bifurcation`, `stream_start`, `NDJSON`) back to the user. Translate them.

`--agent` writes one JSON object per line on **stdout**. The progress UI goes to **stderr**.

## The stream contract (kane-cli 0.8.17+)

On `run`, `testmd run` and `testrun run`, every stdout line carries two extra fields, and nothing that existed before changed:

| Field | Meaning |
|---|---|
| `v` | Contract version, `1`. It only bumps on a breaking change |
| `ts` | ISO timestamp of when the event was emitted |

The first line on every surface is an opening event:

```json
{"type":"stream_start","cli_version":"0.8.17","surface":"run","pid":16664,"v":1,"ts":"2026-09-21T08:47:26.889Z"}
```

`surface` is `run`, `testmd` or `testrun`. Use `cli_version` to tell whether a newer event or flag is available.

Rules a parser must follow:

- **Ignore unknown fields and unknown event types.** New ones can appear in any release without a `v` bump.
- **Never assume the first line is a progress line**, and skip any line that is not JSON.
- Step lines on `run` stay **typeless** (below). Do not look for `type: "step"`.
- The documented completion event is always the last line: `run_end` for `run`, `test_md_done` for `testmd run`, `testrun_done` for `testrun run` (then `remote_done` on cloud grid runs).

The same stream is also written to disk line by line, as `events.ndjson` in the session folder, and while a run is live kane-cli keeps a small active-run pointer file at `~/.testmuai/kaneai/sessions/active/<pid>.json` that it removes on exit. Kiro normally needs neither: the log holds exactly what stdout printed, so treat it with the same care. The log is also where a suite keeps each test's own events (see the `kane-cli-testrun` steering file).

## Event types

**Progress events** — most of stdout, start and completion per agent step. They have **no `type` field**:

```json
{"step": 1, "status": "running", "remark": "Navigate to amazon.in"}
{"step": 1, "status": "done", "remark": "Navigated to amazon.in"}
{"step": 2, "status": "done", "remark": "Typed 'laptop' in search box"}
{"step": 3, "status": "failed", "remark": "Could not find Add to Cart button"}
```

| Field | Type | Description |
|---|---|---|
| `step`   | number | Step index. It can run one ahead of the step the user would count (a `bifurcation` takes the first slot), so count completed `done`/`failed` lines for "steps taken" rather than reading the last index |
| `status` | string | `"running"` at start; `"done"` or `"failed"` at completion |
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

The `run` stream has no `run_start` event. On kane-cli 0.8.17+ the first line is `stream_start`, and startup metadata or errors (`project_folder_auto_defaulted`, a `bifurcation`, an `error`) can precede the first progress object.

**The evidence hint is not an event.** After a run, Kane CLI prints `` evidence: view locally with `kane-cli evidence serve <path>` `` on **stderr**. Never look for it on stdout.

`ask_user` is auto-disabled when stdin is not a TTY. Since Kiro runs Kane CLI as a subprocess, `ask_user` events will not be emitted — write objectives that don't require interactive input.

## Parsing strategy

```
for each line on stdout:
  if obj.type === "run_end"     → terminal event, stop parsing
  if obj.type === "bifurcation" → flow split, note it for narration
  if obj.type is set            → other typed event (skip the ones you do not know, such as the stream_start opening line)
  if obj.step is set            → progress event (narrate it)
```

For one-shot `run`, build automation on `run_end` and process exit; other commands have their own completion events. Use progress events for live narration only.

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
  "credits_consumed": 11.9,
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
| `credits_consumed` | Credits the run used, a decimal number (when reported). Round it for display. Older releases and docs called this `credits` |
| `final_state`  | Extracted values from "store as" objectives |
| `test_url`     | KaneAI dashboard link (when upload succeeded) |
| `session_dir`  | Path to the session directory (session log + the sealed evidence pack under `evidence/`) |
| `run_dir`      | **Legacy** — this directory is no longer created; run logs and screenshots live inside the evidence pack |
| `result_code`  | Optional string classification. Under `--bug-detection`, a **confirmed product bug** arrives as `result_code: "740"` plus a `verdict` object (`confirmed`, `family`, `category`, `severity`, `one_liner`, `confidence`). Report it as a product bug found — distinct from a test failure. |

---

# Presenting results

A one-line "Test passed" instead of the result card is a bug. The order for every run is fixed: ready check → launch line → the run → result card (POWER.md → Every session).

## Before the run: the launch line

In one message, **before** starting the run, send the ready card and then:

> Starting browser task: <one-line restatement of the user's objective>.

That line tells the user something is in progress. On a first session the tour from the **`kane-cli-first-run`** steering file goes in this same message, right after the launch line, so the user reads it while the run works.

## During the run — narrate, don't sit silent

As progress events stream in, narrate them in plain language:

> Step 1: Opened Amazon homepage
> Step 2: Typed 'laptop' in the search bar
> Step 3: Clicked the search button
> Step 4: Search results loaded — found product listings

If a step fails mid-run, flag it immediately:

> Step 5: Could not find the 'Add to Cart' button — the agent is retrying…

Keep updates terse. Do not paste raw JSON, field names, or `run_dir` paths. When the user's saved watch preference is `results-only`, skip the narration and show the card only.

## After the run — render a results card

Every result is an emoji table. Rules for every card:

- **Same order every time:** verdict, task, duration, steps, credits, what happened, values or checks, links, next.
- **One short sentence per cell**, so the table holds its shape in a narrow panel. Screenshots go under the card, never inside it.
- **Failures first.** Passing tests fold into a count and are never listed one by one.
- **➡️ Next is an offer**, not advice: two things at most, each something Kiro can do right now.
- **Durations read like `1m 54s`** (or `21s` under a minute).
- **💳 Credits** reads `<used> used · about <left> left`. Used is what the run consumed, rounded. Left is the ready check balance minus what was used since: no extra call. Drop the second half when there is no balance.
- **Never show internals:** no event names, no field names, no paths the user does not own. File names they own (`checkout_test.md`, `output-checkout/`) are fine.
- **`🟡 Didn't start` is not `🔴 Failed`.** When nothing ran, say what to fix.
- **Secret-looking values never go in chat.** For a missing value whose name contains `password`, `secret`, `token` or `key`, add an empty entry to the variables file for the user to fill. Ask in chat only for plain values (a URL, a user name).
- If the run's output carried an update notice, add one quiet last line under the card: `kane-cli <version> is available.`

**Successful run:**

| | |
|---|---|
| 🟢 **Result**          | Passed |
| 🎯 **Task**            | Search for 'laptop' on Amazon |
| ⏱️ **Duration**        | 45s |
| 👣 **Steps taken**     | 7 |
| 💳 **Credits**         | 12 used · about 65,571 left |
| 📝 **What happened**   | Opened Amazon, searched for 'laptop', and the results loaded with 48 products |
| 📁 **Evidence**        | Want to open the run evidence in your browser? |
| 🔗 **Test case**       | [Open in Test Manager](<test case link>) |
| ➡️ **Next**            | Add an add-to-cart step · Run it headless in CI |

Where the rows come from (internal): Task is `one_liner`, Duration is `duration`, Steps taken is the count of completed progress lines (`done` or `failed`, retaining child and execution context), Credits is `credits_consumed` rounded, What happened is `summary`, and the Test case link is `test_url`. On a first session the 📁 row carries the viewer link itself (see the `kane-cli-first-run` steering file).

**If data was extracted** (from "store as" objectives). Leave out `url` unless the user asked for it:

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

For exit code `1` (or a failed status), present the failure card. Explain what went wrong **in the user's terms**, and never paste log paths or raw output.

| | |
|---|---|
| 🔴 **Result**          | Failed at step 5 of 9 |
| 🎯 **Task**            | Check out with a saved card |
| ⏱️ **Duration**        | 1m 12s |
| 💳 **Credits**         | 9 used |
| 📝 **What happened**   | The agent clicked "Proceed to Checkout" but the payment form never appeared |
| 🔍 **Likely cause**    | The checkout page may require sign-in, or the payment service was slow |
| 📁 **Evidence**        | Want to open the run evidence in your browser? |
| ➡️ **Next**            | Re-run with a sign-in step before checkout · Walk through the failing step |

🔍 Likely cause is Kiro's own diagnosis: a missing element, a popup over the button, a slow page, an ambiguous objective, an auth wall. ➡️ Next pairs a retry Kiro can run now with an offer to walk through the failing step.

Then extract the failing-step screenshot from the run's evidence pack (`unzip <pack> "tests/*/steps/*/screenshot.png" -d <tmpdir>`) and show it **under** the card.

## Didn't start (exit `2`)

Nothing ran and no credits were used. Causes include missing variable values, no start URL, sign-in or setup errors, a test file that does not parse, an invalid suite plan, a cloud grid refusal. This is its own card, not a failure:

```markdown
| | |
|---|---|
| 🟡 **Result** | Didn't start. Nothing ran, no credits used |
| ❓ **Missing** | <what is missing, by name> |
| ➡️ **Next** | <the one thing that unblocks it> |
```

Swap `❓ **Missing**` for `🔍 **Why**` when the cause is not a missing value (for example: `Two tests belong to another project, so they can't run together`). Never retry the same command unchanged.

## Stopped early (exit `3`)

Timeout or cancelled:

```markdown
| | |
|---|---|
| 🟡 **Result** | Stopped after <2m 0s>, at step <n> |
| 📝 **What happened** | <what was done before it stopped> |
| ➡️ **Next** | Raise the time limit · Split the objective into two runs |
```

## Possible product bug

When bug detection is on and the run confirms a product bug (`result_code` `740` with a verdict, see the Terminal `run_end` event above), it is its own verdict, apart from a test failure:

```markdown
| | |
|---|---|
| 🐞 **Result** | Possible product bug found |
| 📝 **What happened** | <the verdict's one-line description> |
| 🚦 **Severity** | <severity> · <confidence> confidence |
| 📁 **Evidence** | Want to open the run evidence in your browser? |
| ➡️ **Next** | File it with the evidence attached · Re-run to confirm |
```

## Saved tests and suites

A saved test (`testmd run`) has its own card in the **`kane-cli-testmd`** steering file, and a suite (`testrun run`, local or cloud grid) has its own in **`kane-cli-testrun`**. The rules for every card above apply to both.

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
kane-cli folders  list   --project <id> [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  create "<name>" --project <id> [--description "<text>"] --agent
```

NDJSON wire shape: each result row is `{id, name}`, terminated by `{_meta: "page", limit, offset, returned, has_more}` (there is no `total`, so paginate while `has_more === true`). `folders list` and `folders create` need the project passed in: `--project <id>` is **required** on both, and `folders create` files the folder inside that project. Take the id from `projects list`, or from `project_id` in `kane-cli config show`.

## The run-startup auto-default gate

Every `run`, `testmd run`, and `generate` validates the cached project/folder before launching. Three outcomes:

1. Cached project/folder still valid → run proceeds, no event.
2. Nothing configured **or** cached IDs are gone / invalid / inaccessible → Kane CLI auto-resolves (find-or-create) and emits `project_folder_auto_defaulted` on stdout before any progress event. Surface as a one-liner ("Kane CLI auto-selected project X / folder Y for this run").
3. No usable credentials in a non-TTY context → exit `2` (auth/setup).

Self-healing: stale, deleted, revoked, or typo'd project IDs trigger 4xx from TMS and the gate re-resolves automatically — no need to clear them by hand.

If the user wants their runs in a different project after seeing the auto-selected one, walk them through the next section.

## Changing where results go (a global setting)

The results project and folder belong to kane-cli, not to the saved preferences file. A change applies to **every later kane-cli session for the current sign-in**: every project folder, every agent, and the terminal. Say so in the question itself, so the user's pick is their consent and no second confirmation is needed.

**When to raise it.** The ready card always states the location with a standing offer that never stops the run. Ask outright only once, after the first result (the `kane-cli-first-run` steering file), or whenever the user says "change project".

**The flow.** Listing projects takes a few seconds, so do it only now, never in the ready check.

1. `kane-cli projects list --limit 10 --agent`. Show the names with the current one marked. If the page says more exist, offer a search by name (`--search <text>`) instead of paging. Never promise a count: the CLI only says whether more exist.
2. Let the user pick one, search, create a new one, or keep the current one. For a new project suggest the repo's name: `kane-cli projects create "<name>" --agent`.
3. `kane-cli folders list --project <id> --agent`. Exactly one folder: take it without asking. Otherwise let them pick, or create one with `kane-cli folders create "<name>" --project <id> --agent`.
4. Save the project first, then the folder, always as a pair, so the two never mismatch:

   ```bash
   kane-cli config project <project-id>
   kane-cli config folder <folder-id>
   ```

5. Confirm in one line: `Results now go to <project> / <folder>, for every kane-cli session from here on.`
6. In the saved preferences file record only that the question was asked (`"results"` in `onboarding.asked`). The value stays with kane-cli.

**Before switching, warn when it matters.** If this workspace already holds saved tests (`kane-cli testmd list` shows them), say first: cloud grid suites compare each test's project with the configured one and refuse on a mismatch, so switching can make an existing grid suite refuse until it is switched back. Tests that already ran keep their original project.

**Always visible.** The one-line ready card shows the location at the start of every session, so a global setting never surprises anyone.

Project-local overrides live in `./.testmuai/` (`context.md`, `variables/*.json`). Global config and history live in `~/.testmuai/kaneai/`. Pass everything through flags — do **not** rely on environment variables for Kane CLI configuration.

## Command-specific completion

The `run_end` parsing strategy applies to one-shot `run` only. For `testmd run`, collect `test_md_done.overall_status`, `duration_s`, `session_id`, and optional `share_url`; embedded `run_end` events can finish individual steps. Local suites emit `testrun_done`; dispatched remote suites then emit `remote_done` (retain `status`, `exit`, `sessions_path`). `generate` emits `generate_done`. Assurance conversational agent streams end in `done`; review/read verbs have their own contracts. Always check process exit too: early refusal, invalid plan or dry-run can exit without the normal completion event.

Progress is for live display: count only `done`/`failed` completions, retaining child and execution context when step indices repeat.

## Assertion controls and current-page analysis

`run` and `testmd run` support `--assertion-mode dom|visual` (default `dom` with vision fallback) and `--final-validation on|off` (default off). Persist with `config set-assertion-mode` and `config set-final-validation`. Final validation controls the synthesized `cp_final` checkpoint independently of action/testing mode; keep explicit terminal assertions in objectives.

`run --analyzer-only --condition "<condition>"` checks the current desktop browser page without an objective, action steps or saved test. Repeat `--condition` for multiple checks. Use `--agent` or non-TTY input. Results contain `condition_results: boolean[]`; exit `0` means all conditions were judged, **not** that all are true. Exit `1` means a result was missing, and `3` means cancelled. This mode rejects mobile target/app/device options and code-export/name options.

Experimental `run --network-ws` and `run --network-sse` enable WebSocket and SSE capture; both default off. Persist with `config set-network-ws on|off` and `config set-network-sse on|off`. SSE capture is Chromium-only. Do not copy these run-only flags onto `testmd` or `testrun` commands.

Code export defaults to enabled, subject to saved configuration, and supports `python` (default) or `javascript`. `run`/`testmd run` use `--code-language`; `testmd export` uses `--language`. Upload eligibility is independent of action/testing mode.
