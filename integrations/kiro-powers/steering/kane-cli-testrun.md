# Kane CLI — `kane-cli testrun` + evidence steering

Load this file when the user wants to run **several** saved `_test.md` tests as one batch ("run the suite", "run all the smoke tests", "nightly regression"), or asks about **evidence packs** (viewing, sharing, validating a run's `.evidence` file).

`kane-cli testrun run` executes many **authored** `_test.md` files as one execution: one summary, one exit code, one sealed evidence pack for the whole suite.

# When to use testrun

- The user has **two or more saved `_test.md` tests** to run → `kane-cli testrun run`. Do NOT hand-roll a bash loop or spawn parallel `testmd run` processes — testrun does isolation, pooling, and a single rollup for you.
- One test → `kane-cli testmd run` (load `kane-cli-testmd.md`).
- Multiple ad-hoc `run` objectives (not saved tests) → the parallel-execution section of `kane-cli-run.md` still applies.

# Command

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

# Preflight (why members get rejected)

Every member must be **authored** (run once to completion, committed) and all members must share one org + project. Failure reasons on the plan:

| Reason | Plain-language meaning | What to tell the user |
|---|---|---|
| `missing_meta` | No recorded output next to the test | "Run it once with `kane-cli testmd run` first" |
| `not_authored` | Recorded but never committed | "Run it to completion so it commits, then retry" |
| `org_mismatch` | Different organisation than the other tests | "Check `kane-cli testmd status <path>` — it belongs to another org" |
| `project_mismatch` | Different project than the other tests | "Run it separately or per-project" |

If **any** member fails preflight, the plan is invalid: nothing runs, exit `2`. Suggest `--dry-run` to preview the plan cheaply before a big run.

# NDJSON events

All typed; stdout; one JSON object per line. **Terminal event: `testrun_done` — stop parsing there** (there is no `run_end` at the testrun level).

| `type` | Payload | Notes |
|---|---|---|
| `testrun_plan` | `members: [{path, test_id?, tags, failure?}]`, `valid`, `parallel`, `parallel_clamped?` | If `valid: false`, treat as immediate failure — report each member's `failure` reason and expect exit `2`. |
| `testrun_start` | `execution_id`, `members` (paths), `parallel` | |
| `testrun_member_start` | `path`, `test_id?` | |
| `testrun_member_end` | `path`, `test_id?`, `status`, `duration_s` | `status` ∈ `passed \| failed \| broken \| interrupted` |
| `testrun_investigations_wait` | `count` | Failed replays left investigations running; the coordinator waits before sealing. Narrate as "investigating N failures". |
| `testrun_evidence_ingest` | `status: "ok"\|"failed"`, `evidence_id`, `stage?` | Pack published to the dashboard. Absent when publish is skipped. |
| `testrun_summary` | `totals: {tests, passed, failed, broken, skipped}`, `duration_s`, `upload`, `cancelled` | Build the rollup from this. |
| `testrun_done` | `execution_id`, `overall_status: "passed"\|"failed"\|"cancelled"` | Terminal. |

The wait-for-terminal rule from `kane-cli-run.md` applies unchanged — narrate while events stream, act only after `testrun_done` or process exit.

# Presenting results

Never expose event/field names. After `testrun_done`, render a suite rollup:

| | |
|-------|-------|
| 🟢 **Suite** | Passed (12/12) |
| ⏱️ **Duration** | 284s |
| 👣 **Tests** | 12 passed, 0 failed, 0 broken, 0 skipped |
| 📦 **Evidence** | one sealed pack for the whole suite |

For failures, add one line per failed member only (path + duration + status) — don't list passing members individually. If the pack published, mention the run is visible in the dashboard.

# Exit codes

| Code | Meaning |
|---|---|
| `0` | All members passed |
| `1` | At least one member failed or broke |
| `2` | Usage error / invalid plan / auth error — nothing ran |
| `3` | Cancelled (Ctrl-C — in-flight members finish, the pack still seals) |

# Evidence packs

Every Kane CLI run seals an **evidence pack**: one `.evidence` file (a zip) holding the test definition, results, per-step screenshots + annotated screenshots, per-step console/network logs, run logs, and failure records. It is the **only** home of run artifacts — the legacy `runs/<n>/` session subdirectory is no longer created.

**Inside a pack** (a standard zip — `unzip -l` lists it, `unzip -p <pack> <entry>` prints one entry):

```
<execution_id>.evidence
├── run.yaml                          # run manifest: title, status, started/ended, totals
├── failure.yaml                      # run-level failure rollup
└── tests/<test-id>/                  # one per test (testrun packs have many)
    ├── test.md                       # the definition
    ├── result.yaml                   # verdict + steps[] (ordinal, status, kind, duration_ms, action_id)
    ├── logs/                         # meta.yaml, tui.log, and per run index n:
    │                                 #   <n>-run.log, <n>-actions.ndjson,
    │                                 #   <n>-console.ndjson, <n>-network.har
    ├── steps/<ordinal>-<step-id>/    # screenshot.png, annotated.png, step.json
    │                                 #   (+ failure.yaml on failed steps)
    ├── auteur/execution.json         # full execution trajectory
    └── v16-trajectory/               # per-run planning summaries
```

**Where packs land:**

| Surface | Sealed pack location |
|---|---|
| `kane-cli run` | `{session_dir}/evidence/<execution_id>.evidence`; also copied to `<cwd>/.testmuai/evidence/` when the run is named (`--name`) |
| `kane-cli testmd run` | always copied to `<cwd>/.testmuai/evidence/` |
| `kane-cli testrun run` | created directly in `<cwd>/.testmuai/evidence/` (one pack for the whole suite) |

**The stderr hint.** After a successful run, Kane CLI prints one hint line to **stderr** (plain text — never an NDJSON event; don't look for it on stdout):

```
evidence: view locally with `kane-cli evidence serve <packPath>`
```

**Serving a pack.** When the user wants to see run evidence, run `kane-cli evidence serve <pack>` (keep it running in the background) and give the user the `viewer` URL from its stdout:

```
serving 1 pack on http://127.0.0.1:<port>
<name>.evidence
  pack    http://127.0.0.1:<port>/<token>/<name>.evidence
  viewer  https://evidence.lambdatest.com/?pack=<encoded pack url>
press Ctrl-C to stop
```

Present only the `viewer` line as a clickable link. Tell the user the server is local-only — nothing uploads; their browser reads the pack from their machine. Stop the process when they're done.

**Validate** — when a pack won't open (truncated / unsealed / killed run) or as a CI gate:

```bash
kane-cli evidence validate <execution-id-or-path> --json    # exit 0 valid / 1 invalid / 2 not found
```

**Merge** — combine several packs into one (targets are execution ids or paths, order-significant; `--run-id` required):

```bash
kane-cli evidence merge <targets...> --run-id <id>          # exit 0 merged / 1 policy abort / 2 usage
```

**Debugging with a pack:** the failed step's failure record (error + page state), its console/network slice (4xx/5xx or JS errors usually explain the failure), and the annotated screenshot (what the agent actually acted on). Same flow as "Failure handling" in `kane-cli-run.md`.

**Debug escape hatch:** `KANE_TESTRUN_MEMBER_DEBUG=1` surfaces per-member output (stderr, `[member]` prefix).
