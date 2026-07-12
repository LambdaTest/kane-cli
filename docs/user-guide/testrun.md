# Batch runs with testrun

`kane-cli testrun run` executes many authored `_test.md` files as **one execution** — one summary, one exit code, and one sealed [evidence pack](./evidence.md) for the whole suite.

```bash
kane-cli testrun run                                              # every *_test.md under the cwd
kane-cli testrun run tests/checkout_test.md tests/login_test.md   # explicit paths
kane-cli testrun run --tags smoke --parallel 4                    # select by tags, 4 workers
```

Use `testrun` when you have a suite of committed tests to run together — nightly regression, pre-merge smoke, release gates. For a single test, `kane-cli testmd run` is all you need.

## Selecting tests

Members come either from explicit paths (each must end in `_test.md`) or, when no paths are given, from a recursive walk of the current directory. Two filters then apply, in order:

- **`--match <regex>`** — keep tests whose project-relative path matches the regex.
- **`--tags <list>`** — keep tests whose [`tags:` frontmatter](./testmd/overview.md#frontmatter) matches **any** of the given tags (case-insensitive). Repeat the flag or pass a comma-separated list; `--tags smoke,checkout` and `--tags smoke --tags checkout` are equivalent.

Duplicates are removed and the final list runs in a stable order.

```bash
kane-cli testrun run --match 'tests/e2e/.*' --tags smoke
```

## Preflight

Before anything runs, every member is checked:

- **It must be authored** — run at least once and committed, so it has recordings and a test id.
- **All members must belong to one org and one project** — a testrun is one execution in Test Manager, so it can't span projects.

A member can fail preflight for four reasons:

| Reason | Meaning | Fix |
|---|---|---|
| `missing_meta` | No recorded output next to the test | Run it once with `kane-cli testmd run` |
| `not_authored` | Recorded but never committed | Run it to completion so it commits |
| `org_mismatch` | Belongs to a different organisation than the rest | Check with `kane-cli testmd status <path>` |
| `project_mismatch` | Belongs to a different project than the rest | Check with `kane-cli testmd status <path>`; run project-by-project |

If any member fails preflight, the plan is invalid and **nothing runs** (exit `2`). The offenders print to stderr:

```
error: plan invalid — 2 offending test(s):
  tests/new_flow_test.md: not_authored
  tests/other_project_test.md: project_mismatch
```

## Running

| Flag | Description | Default |
|---|---|---|
| `--match <regex>` | Filter candidates by project-relative path regex | — |
| `--tags <list>` | ANY-match on frontmatter tags (repeatable or comma-separated) | — |
| `--parallel <n>` | Worker count | `1` |
| `--on-failure <mode>` | `continue` \| `fail-fast` | `continue` |
| `--name <label>` | Run title | derived from the selection |
| `--dry-run` | Plan + validate only, execute nothing | off |
| `--retry` | On replay failure, restart with a shrinking replay window | off |
| `--retry-count <n>` | Max replay restart attempts before a full re-author | `3` |
| `--bug-detection <mode>` | `off` \| `stop` \| `continue` — see [Configuration](./configuration.md#bug-detection) | config value |
| `--headless` | Run Chrome without a visible window | off |
| `--env <name>` | Environment (`prod` or `stage`) | active env |
| `--username <user>` / `--access-key <key>` | Basic auth (skips OAuth) | — |

Each worker gets its **own isolated Chrome** with a fresh temporary profile, so parallel members never share cookies, logins, or tabs — and never fight over your real browser profile.

`--on-failure` controls what a failed member does to the rest of the suite:

- **`continue`** (default) — every member runs; failures are collected in the summary.
- **`fail-fast`** — a failure stops *new* members from starting; members already in flight finish normally.

**Ctrl-C is graceful**: no new members start, in-flight members finish, the evidence pack still seals, and the run exits `3`. Members that never started are reported as skipped — the pack accounts for every planned member, including skipped and broken ones.

## Dry runs

`--dry-run` prints exactly the plan the real run would execute — the selected members, any preflight failures, and the parallelism — then exits without launching anything:

```bash
kane-cli testrun run --tags smoke --parallel 4 --dry-run
```

Exit `0` means the plan is valid and a real run would proceed; exit `2` means it wouldn't, and the offender list shows why. The dry run and the real run share the same planner, so they can never disagree.

## Reading results

At the end of a run you get a suite summary — totals for passed / failed / broken / skipped members and the overall duration — plus one sealed evidence pack covering every member, created directly in `.testmuai/evidence/`.

In a terminal, kane-cli offers to open the pack in the [evidence viewer](./evidence.md#viewing-evidence); in CI it prints the `evidence serve` hint instead. The pack is also published to your project's execution history in Test Manager.

`--name` sets the run's title — useful for telling nightly runs apart in the dashboard.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All members passed. |
| `1` | At least one member failed or broke. |
| `2` | Usage error, invalid plan (preflight failures), or auth error. Nothing ran. |
| `3` | Cancelled (Ctrl-C). |

## Using testrun in CI

```bash
kane-cli testrun run --tags smoke --parallel 4 --headless --on-failure fail-fast
```

The exit code gates the pipeline, and `.testmuai/evidence/*.evidence` is a natural CI artifact — a single file per suite run that anyone can drop into the viewer. Full recipes: [CI/CD](./cicd.md).

## For agents: NDJSON events

In agent / non-TTY mode, `testrun run` emits its own typed NDJSON events on stdout — `testrun_plan`, `testrun_start`, `testrun_member_start`, `testrun_member_end`, `testrun_investigations_wait`, `testrun_evidence_ingest`, `testrun_summary`, and finally the terminal `testrun_done`. Stop parsing at `testrun_done`. The full event schema ships with the [kane-cli agent skill](https://testmuai.com/kane-cli/agents.md).

## Next steps

- [Evidence packs](./evidence.md) — what's in the pack and how to view it.
- [Writing test.md files](./testmd/overview.md) — the file format, including `tags:`.
- [Running test.md files](./testmd/running.md) — single-test runs, replay, and flags.
- [CI/CD recipes](./cicd.md) — pipeline patterns.
