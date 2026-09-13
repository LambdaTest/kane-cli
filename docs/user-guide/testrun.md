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

- *(0.8.4)* **It need not be authored** — a member with no recording classifies as an **author** member: the agent authors it during the run, and afterwards the authored and replayed evidence consolidates into one published execution (best-effort — when consolidation can't complete, the evidence stays split rather than lost). Before 0.8.4, unauthored members failed preflight (`missing_meta` / `not_authored`).
- **All members must belong to one org and one project** — a testrun is one execution in Test Manager, so it can't span projects.

A member can fail preflight for these reasons:

| Reason | Meaning | Fix |
|---|---|---|
| `org_mismatch` | Belongs to a different organisation than the rest | Check with `kane-cli testmd status <path>` |
| `project_mismatch` | Belongs to a different project than the rest | Check with `kane-cli testmd status <path>`; run project-by-project |

If any member fails preflight, the plan is invalid and **nothing runs** (exit `2`). The offenders print to stderr:

```
error: plan invalid — 2 offending test(s):
  tests/other_org_test.md: org_mismatch
  tests/other_project_test.md: project_mismatch
```

## Mobile members

A `_test.md` with a mobile [`target:`](./testmd/overview.md#mobile-target) (`emulator` / `simulator`) is a normal member *(0.8.7)*:

- **Locally**, the suite drives the emulators and simulators on this machine, so the host must be macOS Apple Silicon with the [mobile setup](./mobile/overview.md) done. Pick the device with `--device-name` / `--os-version` as `kane-cli devices list --target emulator|simulator` prints it, or set `device_name:` / `os_version:` in the file.
- **On the cloud grid** (`--remote`), the suite runs on a virtual device on a HyperExecute macOS host, so it works **from any machine** — Linux, Windows, or a Mac with no Xcode or Android Studio. Pick the device from `kane-cli devices list --target emulator|simulator --remote`. One grid job runs one platform (emulator members on one Android version, simulator members on one HyperExecute pool), and a member's local build is uploaded from your machine before dispatch and handed to the grid as an `APP…` id. Everything else is in [Remote runs](./remote-execution.md).

```bash
kane-cli testrun run tests/app/ --device-name "Pixel 7 API 35" --os-version 15            # local emulators
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14           # the grid
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
| `--remote [backend]` | Dispatch the suite to the cloud grid instead of local Chrome / local devices (default backend: `hyper`). Needs `kane-cli plugin install remote-execution`. See [Remote runs](./remote-execution.md) | off |
| `--device-name <name>` | Device for the suite's mobile members: as `kane-cli devices list` prints it locally, or a grid catalog device with `--remote` | member's `device_name:` |
| `--os-version <version>` | OS version for the mobile members (`14`, `17.5`); alone = any device on that version | member's `os_version:` |
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

## Remote runs

Add `--remote` and the same selection runs as one **HyperExecute** job: Chrome on a grid macOS runner for web suites, a grid emulator or simulator for mobile suites. Each member runs as its own headless `testmd run` on the grid, `--parallel N` spreads the members across N grid runners, and the job link, the recordings, and the evidence pack come back to your project. Requires a LambdaTest plan with HyperExecute (macOS runners) and the `remote-execution` plugin — nothing else locally, not even Chrome.

```bash
kane-cli plugin install remote-execution
kane-cli testrun run --tags smoke --remote --dry-run          # resolve everything, dispatch nothing
kane-cli testrun run --tags smoke --remote --parallel 4       # a web suite on 4 grid runners
kane-cli testrun run tests/ios/ --remote --device-name "iPhone 15" --os-version 17.5
```

`--dry-run` runs the remote preflight too, so the selection is validated against the grid before any job exists. A web selection and a device selection cannot share one job — run them as two suites. This is different from `--ws-endpoint`, which attaches a remote browser to a run that still executes on your machine. The full guide — prerequisites, how a job runs, web suites, device catalog, app rules, what one job can hold, and the events — is [Remote runs on the cloud grid](./remote-execution.md).

## Using testrun in CI

```bash
kane-cli testrun run --tags smoke --parallel 4 --headless --on-failure fail-fast
```

The exit code gates the pipeline, and `.testmuai/evidence/*.evidence` is a natural CI artifact — a single file per suite run that anyone can drop into the viewer. With `--remote`, the runner needs no Chrome or mobile tooling at all. Full recipes: [CI/CD](./cicd.md).

## For agents: NDJSON events

In agent / non-TTY mode, `testrun run` emits its own typed NDJSON events on stdout — `testrun_plan`, `testrun_start`, `testrun_member_start`, `testrun_member_end`, `testrun_investigations_wait`, `testrun_evidence_ingest`, `testrun_summary`, and finally the terminal `testrun_done`. Stop parsing at `testrun_done`. A `--remote` run wraps that stream in `remote_*` events (`remote_start`, `remote_device`, `remote_dispatched`, `remote_error`, `remote_done`) — see [Remote runs](./remote-execution.md#for-agents-ndjson-events). The full event schema ships with the [kane-cli agent skill](https://testmuai.com/kane-cli/agents.md).

## Next steps

- [Remote runs on the cloud grid](./remote-execution.md) — `--remote`, mobile suites from any machine.
- [Evidence packs](./evidence.md) — what's in the pack and how to view it.
- [Writing test.md files](./testmd/overview.md) — the file format, including `tags:`.
- [Running test.md files](./testmd/running.md) — single-test runs, replay, and flags.
- [CI/CD recipes](./cicd.md) — pipeline patterns.
