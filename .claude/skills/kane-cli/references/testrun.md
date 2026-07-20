<!-- kane-cli skill reference: testrun (batch execution of _test.md files) -->

# Batch Runs with testrun

`kane-cli testrun run` executes many **authored** `_test.md` files as one execution: one summary, one exit code, one sealed evidence pack for the whole suite.

## When to use testrun (vs. anything else)

- The user has **two or more saved `_test.md` tests** to run → `kane-cli testrun run`. Do NOT hand-roll a bash loop or spawn parallel `testmd run` processes — testrun does isolation, pooling, and a single rollup for you.
- One test → `kane-cli testmd run` (`references/testmd.md`).
- Multiple ad-hoc `run` objectives (not saved tests) → `references/parallel.md` still applies.

## Command

```bash
kane-cli testrun run [paths...] [flags]     # NDJSON is automatic when stdout is piped — there is NO --agent flag on testrun
```

`[paths...]` is optional — omit it to auto-discover every `*_test.md` under the cwd. Explicit paths must end in `_test.md`.

| Flag | Purpose | Default |
|---|---|---|
| `--match <regex>` | Filter candidates by project-relative path regex | — |
| `--tags <list>` | ANY-match on frontmatter `tags:` (repeatable or comma-separated, case-insensitive) | — |
| `--parallel <n>` | Worker count; each worker gets an isolated Chrome with a fresh temp profile | `1` |
| `--on-failure <mode>` | `continue` (run everything) \| `fail-fast` (stop dispatching new members after a failure) | `continue` |
| `--name <label>` | Run title in the dashboard | derived |
| `--dry-run` | Print the plan (members + preflight failures) and exit; runs nothing | off |
| `--retry` / `--retry-count <n>` | Replay-failure restart with shrinking replay window / max attempts | off / `3` |
| `--bug-detection <mode>` | `off`\|`stop`\|`continue`, passed through to authoring members | config (`off`) |
| `--headless` | Headless Chrome — use in CI | off |
| `--env <name>` / `--username` / `--access-key` | Environment / basic auth | active profile |

## Preflight (why members get rejected)

Every member must be **authored** (run once to completion, committed) and all members must share one org + project. Failure reasons on the plan:

| Reason | Plain-language meaning | What to tell the user |
|---|---|---|
| `missing_meta` | No recorded output next to the test | "Run it once with `kane-cli testmd run` first" |
| `not_authored` | Recorded but never committed | "Run it to completion so it commits, then retry" |
| `org_mismatch` | Different organisation than the other tests | "Check `kane-cli testmd status <path>` — it belongs to another org" |
| `project_mismatch` | Different project than the other tests | "Run it separately or per-project" |

If **any** member fails preflight, the plan is invalid: nothing runs, exit `2`. Suggest `--dry-run` to preview the plan cheaply before a big run.

## NDJSON events (agent mode)

All typed; stdout; one JSON object per line. **Terminal event: `testrun_done` — stop parsing there.**

| `type` | Payload | Notes |
|---|---|---|
| `testrun_plan` | `members: [{path, test_id?, tags, failure?}]`, `valid`, `parallel`, `parallel_clamped?` | If `valid: false`, treat as immediate failure — report each member's `failure` reason and stop expecting more events. |
| `testrun_start` | `execution_id`, `members` (paths), `parallel` | |
| `testrun_member_start` | `path`, `test_id?` | |
| `testrun_member_end` | `path`, `test_id?`, `status`, `duration_s` | `status` ∈ `passed \| failed \| broken \| interrupted` |
| `testrun_investigations_wait` | `count` | Failed replays left investigations running; the coordinator waits before sealing. Narrate as "investigating N failures". |
| `testrun_evidence_ingest` | `status: "ok"\|"failed"`, `evidence_id`, `stage?` | Pack published to the dashboard. Absent when publish is skipped. |
| `testrun_summary` | `totals: {tests, passed, failed, broken, skipped}`, `duration_s`, `upload`, `cancelled` | Build the rollup table from this. |
| `testrun_done` | `execution_id`, `overall_status: "passed"\|"failed"\|"cancelled"` | Terminal. |

Parsing strategy:

```text
for each line:
  if type === "testrun_done"          → terminal, stop
  if type === "testrun_plan" && !valid → report offenders, expect exit 2
  if type === "testrun_member_end"    → note per-member outcome
  if type === "testrun_summary"       → capture totals for the rollup
  else                                → informational; narrate sparingly
```

## Presenting results (same discipline as SKILL.md §1)

Never expose event/field names. After `testrun_done`, always render a suite rollup:

```markdown
| | |
|-------|-------|
| 🟢 **Suite** | Passed (12/12) |
| ⏱️ **Duration** | 284s |
| 👣 **Tests** | 12 passed, 0 failed, 0 broken, 0 skipped |
| 📦 **Evidence** | one sealed pack for the whole suite |
```

For failures, add one line per failed member only (path + duration + status) — don't list passing members individually. If the pack published, mention the run is visible in the dashboard.

## Exit codes

`0` all members passed · `1` at least one failed/broken · `2` usage / invalid plan / auth (nothing ran) · `3` cancelled (Ctrl-C — in-flight members finish, the pack still seals).

## Evidence & debugging

The suite produces **one** sealed pack, created directly in `<cwd>/.testmuai/evidence/`. Offer it to the user per `references/evidence.md`. Members run silently by design; to see per-member output while debugging, set `KANE_TESTRUN_MEMBER_DEBUG=1` (routes member events to stderr, prefixed `[member]`).
