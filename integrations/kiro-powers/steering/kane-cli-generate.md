# Kane CLI — `kane-cli generate` steering

Load this steering file whenever the user wants **test cases or test scenarios written** — because they asked, or because the task needs them — rather than a browser action. `kane-cli generate` turns a plain-language description of *what to test* into structured Test Scenarios (logical groupings), each containing typed Test Cases (Positive / Negative / Edge). It does **not** drive a browser. The result is a tree of scenarios + cases you present to the user, refine conversationally, and optionally save as runnable `_test.md` files.

The single rule governing this framework: **every invocation is one turn, then exit.** There is no interactive session — continuity across turns is carried by a request id that the previous turn hands back. Treat each `kane-cli generate` call as one round-trip with the AI Test Case Generator.

`kane-cli run` is for browser actions. `kane-cli testmd` is for running saved tests. `kane-cli generate` is for **authoring** test cases — when a task says "write tests for X" or "I need a regression suite for the checkout flow", reach for this, not for hand-drafting cases in chat or a scratch file.

---

# When to recommend `generate`

The decision is about the **deliverable**: does the user want browser action, a saved test to run, or a *suite of test cases to write*?

## User-phrase triggers

| User says | Use |
|---|---|
| "write test cases for the login flow" | ✅ `generate` |
| "give me a test suite for checkout" | ✅ `generate` |
| "what edge cases should we cover for the password reset?" | ✅ `generate` |
| "generate tests for the new feature spec" | ✅ `generate` |
| "more negative cases for this scenario" | ✅ `generate` with `--refine` |
| "save these as runnable tests" | ✅ `generate` with `--save`, then `kane-cli testmd run` |
| "run a smoke test on the checkout page" | ❌ `kane-cli run` |
| "verify the dashboard loads after login" | ❌ `kane-cli run` |
| "save THIS browser session as a regression test" | ❌ `kane-cli run --name`, then `kane-cli testmd` |

## When the intent is unclear

Ask, don't guess:

> "Do you want me to write test cases for this (no browser), or run a browser check?"

Default to `kane-cli generate` when the task needs cases authored. **Don't hand-draft test cases in chat or a scratch file** — generate them so they come out structured, refinable, and runnable as `_test.md`.

---

# The three modes — one turn per invocation, then exit

There is **no interactive session**. Each invocation runs exactly one generation turn and exits. Continuity across turns is carried by a **request id** (`--req <id>`) that the previous turn's terminal line hands back.

| Mode | Command | Notes |
|---|---|---|
| **New** | `kane-cli generate "<what to test>" --agent` | Starts a fresh request. Capture the request id from the terminal line. |
| **Refine** | `kane-cli generate "<change>" --refine --req <id> --agent` | Adjusts an existing request. `--refine` **and** `--req` required; needs a change description. |
| **Save** | `kane-cli generate --save --req <id> [--out <dir>] --agent` | Writes the request's Functional cases to `_test.md`. No new turn, takes no objective. |

`--refine` and `--save` always run headless (even from a terminal).

## Flag reference

| Flag | Purpose |
|---|---|
| `--agent` | **Required for Kiro.** Typed NDJSON on stdout. Auto-on when stdin is not a TTY, but pass it explicitly. |
| `--req <id>` | The request id to `--refine` or `--save`. |
| `--out <dir>` | Save target — **only** with `--save`; default `<cwd>/.testmuai/tests`. |
| `--name <name>` | Names the run and the saved suite folder. |
| `--scenario-limit <n>` / `--per-scenario-limit <n>` | Cap scenarios / cases-per-scenario. |
| `--memory` | Use the memory layer — reuse relevant existing cases, reduce duplicates. |
| `--project <id>` / `--folder <id>` | Test Manager project / folder. |
| `--env prod\|stage` · `--username` / `--access-key` | Environment / auth (same as `run`). |

If neither `--project`/`--folder` nor a saved project/folder is set when generation starts, Kane CLI auto-resolves one headlessly and emits a `project_folder_auto_defaulted` event before `generate_start` — surface as a one-line note and continue parsing.

---

# The refine → save → run loop

```bash
# 1. New request
kane-cli generate "checkout flow on a shopping site" --agent
#    → terminal line carries request id (e.g. 23271) + Refine/Save hints

# 2. Refine (repeat as needed)
kane-cli generate "also cover an expired card and an out-of-stock item" --refine --req 23271 --agent

# 3. Save the Functional cases as runnable _test.md
kane-cli generate --save --req 23271 --agent
#    → <cwd>/.testmuai/tests/<suite>/<scenario>/<case>_test.md

# 4. Run / replay them — switches to the `kane-cli-testmd` steering file
kane-cli testmd run .testmuai/tests/<suite>/<scenario>/<case>_test.md --agent
```

**Save is Functional-only.** `--save` writes only test cases whose category is **Functional** — those are the ones runnable as `_test.md`. Non-functional cases (Security, Performance, etc.) are generated and shown in the result but are **not** written; saving a request with no Functional cases writes nothing and says so. Saved files are ordinary `_test.md` tests — see the **`kane-cli-testmd`** steering file for running, editing, and replay. This is the **generate → testmd** pipeline: author cases here, run them there.

---

# Clarifications — act on them, never drop them

If a turn ends with a **clarification question**, that is **success (exit 0)**, not an error — the generator needs an answer before it can continue. You must act on it:

1. Read the question.
2. **Decide** — answer it yourself from context, **or** surface it to your user and get an answer.
3. **Re-invoke** with the answer as a refine:

   ```bash
   kane-cli generate "<your answer>" --refine --req <id> --agent
   ```

Never drop a clarification. A turn that ended awaiting one is not "done" — it's blocked on a single round-trip.

---

# Parsing the NDJSON output

> **Internal reference only.** Never echo these field names (`generate_snapshot`, `request_id`, `generate_done`, `generate_clarification`, `_meta`) back to the user. Translate them into plain language.

Unlike `run` (which has untyped `step`/`status` progress lines), **every `generate` line is typed** — it always has a `type` field. That makes parsing simpler:

```
for each line on stdout:
  parse JSON, switch on obj.type
  if obj.type === "generate_done"          → terminal event, stop parsing
  if obj.type === "generate_snapshot"      → the deliverable (full scenarios + cases)
  if obj.type === "generate_clarification" → turn ended awaiting an answer (still exit 0)
  else                                     → progress / informational
```

Build post-turn logic on **`generate_done`** (terminal, stable schema) and read the result from **`generate_snapshot`** (emitted once, at turn end).

## Event types

Generate-specific (typed `generate_*`):

| `type` | Key fields | Meaning → what to do |
|---|---|---|
| `generate_start` | `request_id`, `objective_chars`, `scenario_limit`, `per_scenario_limit`, `is_refine` | Turn began. **Capture `request_id`** — it's the handle for every later `--refine` / `--save`. `is_refine` distinguishes a new request from a continuation. |
| `generate_thinking` | `took_ms` | Liveness only. Narrate "thinking…" or ignore. |
| `generate_progress` | `pct` | Milestone (25 / 50 / 75 / 100). Optional progress display — not a completion signal. |
| `generate_snapshot` | `scenario_count`, `case_count`, `scenarios[]` | **The deliverable** — full scenarios, each with its cases. Each case carries `title`, `polarity` (`"p"`/`"n"`/`"e"` = Positive / Negative / Edge), `category` (`"Functional"`, `"Security"`, …), `priority`. Emitted exactly once. Present per "Presenting results" below. |
| `generate_clarification` | `text` | The generator needs an answer; the turn ended (exit 0) awaiting it. **Not an error** — answer via `--refine --req`. |
| `generate_chat` | `text` | The model's prose reply (e.g. what a refine changed). Show as info. |
| `generate_save_result` | `suite_dir`, `saved`, `fell_back`, `warning?` | `--save` wrote files. `saved` = files written; `fell_back` = cases written as prose because they couldn't be expanded; `warning` e.g. `"no functional test cases"`. |
| `generate_done` | `request_id`, `status`, `scenario_count`, `case_count`, `refine_hint`, `save_hint`, `suite_dir?` | **Terminal line.** Branch on `status`; use `refine_hint` / `save_hint` **verbatim** as the next command. `suite_dir` present only after a `--save`. |

Shared with `run` (not generate-specific):

| `type` | Fields | Meaning |
|---|---|---|
| `project_folder_auto_defaulted` | resolved project + folder (id, name) | Run-startup gate auto-resolved a project/folder when none was configured. Fires **before** `generate_start`. Translate to a one-line note ("Kane CLI auto-selected project X / folder Y for this turn"). |
| `error` | `message` | A failure occurred; pair with the exit code to decide retry vs abort. |
| `update_available` | `current`, `latest`, `severity` | A newer Kane CLI exists. Informational; emitted before `generate_start`. |

## Terminal `generate_done`

Example after a **`--save`** run (note `suite_dir` — a new/refine turn omits it):

```json
{
  "type": "generate_done",
  "request_id": "23271",
  "status": "completed",
  "scenario_count": 3,
  "case_count": 11,
  "refine_hint": "kane-cli generate \"<refinement>\" --refine --req 23271",
  "save_hint": "kane-cli generate --save --req 23271",
  "suite_dir": ".testmuai/tests/checkout-23271"
}
```

`status` values:

| Value | Exit | Meaning |
|---|---|---|
| `completed` | `0` | Turn finished cleanly (includes turns that ended with a clarification). |
| `failed` / `ended` | `1` | Generation failed or stopped without producing the deliverable. |
| `stopped` | `3` | Stopped / cancelled. |

The hints carry no `--agent` flag, but it is auto-on for non-TTY callers (agents/pipes), so re-invoking a hint verbatim still yields NDJSON.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Turn completed (including a turn that ended with a clarification). |
| `1` | Generation failed or stopped without producing the deliverable. |
| `2` | Error (auth / setup / transport, or an invalid flag combination). |
| `3` | Stopped / cancelled. |
| `130` | Interrupted (Ctrl-C). |

Invalid flag combinations exit `2` with a message on stderr. The full set:

- `--refine` and `--save` together
- `--refine` without `--req`
- `--refine` without a change description
- `--refine` combined with `--out` (`--out` is save-only)
- `--save` without `--req`
- `--save` with a description (it takes none)
- `--out` without `--save`
- `--req` without `--refine` or `--save`
- a new generation with no description

---

# Presenting results

Present the result **adaptively** based on size, and always offer the next-step commands the terminal line hands back.

## ≤ ~30 cases → a nested tree

Scenario, then each case with its type tag:

```
✓ Generated 3 scenarios · 11 cases  (request 23271)

▸ Login
   - Valid credentials [Positive]
   - Wrong password [Negative]
   - Empty fields [Edge]
▸ Checkout
   - Guest checkout [Positive]
   - Expired card [Negative]
   - Cart total mismatch [Edge]
▸ Cart management
   ...
```

## More than ~30 cases → summary + scenario list

Cases on request:

```
✓ Generated 6 scenarios · 84 cases  (request 23271)

  • Login (12 cases)
  • Checkout (20 cases)
  • Cart management (14 cases)
  • ...
```

Expand a scenario's cases only when the user asks.

## Always end with next-step hints

The terminal `generate_done` event carries `refine_hint` and `save_hint` — present them **verbatim** (they already carry the request id). Don't hand-build them.

> Want to refine? `kane-cli generate "<refinement>" --refine --req 23271`
> Ready to save the Functional cases? `kane-cli generate --save --req 23271`

## Field names are internal

Never expose `generate_snapshot`, `request_id`, `generate_done`, `polarity`, `category`, `_meta` to the user. Translate `"p"` → "Positive", `"n"` → "Negative", `"e"` → "Edge". Translate scenarios as "scenarios" and cases as "test cases" — that's the user-facing vocabulary.

---

# Failure handling

| Symptom | Likely cause | Fix |
|---|---|---|
| Exit `2` with "invalid flag combination" | Mixed `--refine` + `--save`, or missing `--req` | Re-invoke with the correct mode (see "The three modes" above). |
| Exit `2` with "auth/setup" | Credentials missing or environment unset | `kane-cli whoami`; re-run `kane-cli login` if needed. |
| Turn ended with `generate_clarification` | Generator needs an answer — **this is exit 0, not a failure** | Read the question, decide on an answer (yourself or via the user), re-invoke `kane-cli generate "<answer>" --refine --req <id> --agent`. |
| `generate_save_result` with `warning: "no functional test cases"` | The request has no Functional cases to save | Either refine to add Functional cases, or accept that the suite is non-functional (Security / Performance / etc.) and won't produce `_test.md` files. |
| Bare-objective shortcut: `kane-cli "<description>"` exits `2` with "did you mean" | The `generate` subcommand is mandatory | Re-invoke as `kane-cli generate "<description>" --agent`. Same rule for `run` / `testmd run`. |

---

# Configuration surface (reference)

Generate uses the same auth and project/folder configuration as `run` and `testmd`:

```bash
kane-cli whoami
kane-cli config show
kane-cli config project <project-id>      # or the interactive picker in TTY (OAuth + basic both work)
kane-cli config folder  <folder-id>       # or the interactive picker in TTY
kane-cli projects list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli projects create "<name>" [--description "<text>"] --agent
kane-cli folders  list   [--search <q>] [--limit <n>] [--offset <n>] --agent
kane-cli folders  create "<name>" [--description "<text>"] --agent
```

If nothing is configured, the run-startup gate auto-defaults a project/folder before `generate_start` and emits `project_folder_auto_defaulted`. Pre-configure only when the user wants generated cases filed in a specific place. See the **`kane-cli-run`** steering file for full project/folder mechanics.

---

# Handoff to `kane-cli-testmd`

Once `--save` has written `_test.md` files, every later interaction with those files is a `kane-cli testmd` workflow:

- Run them: `kane-cli testmd run <path> --agent`
- List them: `kane-cli testmd list`
- Inspect: `kane-cli testmd status <path>`
- Re-export code: `kane-cli testmd export <path> --code-language python|javascript`

**Switch to the `kane-cli-testmd` steering file** once the user moves from authoring to running. Generate's job ends at `--save`; testmd's job picks up from there.
