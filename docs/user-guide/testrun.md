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

- **`--match <regex>`** — keep tests whose project-relative path matches the regex. `--match` sees the path as the OS writes it: `tests/app/` on macOS and Linux, `tests\app\` on Windows. Quote the regex with double quotes in cmd.exe; single quotes are literal there.
- **`--tags <list>`** — keep tests whose [`tags:` frontmatter](./testmd/overview.md#frontmatter) matches **any** of the given tags (case-insensitive). Repeat the flag or pass a comma-separated list; `--tags smoke,checkout` and `--tags smoke --tags checkout` are equivalent.

Duplicates are removed and the final list runs in a stable order.

```bash
kane-cli testrun run --match 'tests/e2e/.*' --tags smoke
```

### When nothing is selected

When no `_test.md` file is selected, nothing runs (exit `2`):

```text
error: no *_test.md files selected.
```

Check the paths, or widen a `--match` or `--tags` filter; `--dry-run` shows what a selection picks.

<!-- release: needs the testrun fix -->
<!-- release: needs context pull -->
In a folder linked to a [shared project](./assurance/shared-projects.md) that holds no tests at all, kane-cli says where to get them instead:

```text
error: no tests here yet
next: to bring the project's tests into this folder, run:
  kane-cli context pull
```

## Preflight

Before anything runs, every member is checked:

- *(0.8.4)* **It need not be authored** — a member with no recording classifies as an **author** member: the agent authors it during the run, and afterwards the authored and replayed evidence consolidates into one published execution (best-effort — when consolidation can't complete, the evidence stays split rather than lost). Before 0.8.4, unauthored members failed preflight (`missing_meta` / `not_authored`).
- **All members must belong to one org and one project** — a testrun is one execution in Test Manager, so it can't span projects.

A member can fail preflight for these reasons:

| Reason | Meaning | Fix |
|---|---|---|
| `org_mismatch` | Belongs to a different organisation than the rest | Check with `kane-cli testmd status <path>` |
| `project_mismatch` | Belongs to a different project than the rest | The refusal lists each project's tests and names the command that runs one project's: see [Tests from two projects](#tests-from-two-projects) |

If any member fails preflight, the plan is invalid and **nothing runs** (exit `2`). The offenders print to stderr:

```
error: plan invalid — 2 offending test(s):
  tests/other_org_test.md: org_mismatch
  tests/other_project_test.md: project_mismatch
```

A member whose authored steps reference a `{{name}}` with no value passes preflight. kane-cli prints a warning receipt — every such name across the members, each with the test files and steps that use it — and the run types the name as written unless a step sets it first:

```
warning: 2 variables have no value

  Not in any variables file
    other_key   b_test.md step 1
    shared_url  a_test.md step 1 · b_test.md step 1

    Add them to .testmuai/variables/variables.json

  If {{name}} is literal page text, write \{{name}} to keep it as-is.
  A step that sets a name first binds it; anything else is typed as written. Fill the values to bind them.
```

`testrun run` has no `--variables` flag: fill the pool file or the member's own `variables:` frontmatter. In agent mode (stdin not a TTY, or `--agent` on 0.8.21+) the same content arrives as one `warning` event with `code: "unresolved_variables"` right after `testrun_plan`, whose members carry their rows — see [Running tests](./running-tests.md#unresolved-variables) for the shape.

## Mobile members

A `_test.md` with a mobile [`target:`](./testmd/overview.md#mobile-target) (`emulator` / `simulator`, or `android` / `ios` for real devices) is a normal member *(0.8.7)*:

- **Locally**, the suite drives the emulators and simulators on this machine, so the host must be macOS Apple Silicon with the [mobile setup](./mobile/overview.md) done. Pick the device with `--device-name` / `--os-version` as `kane-cli devices list --target emulator|simulator` prints it, or set `device_name:` / `os_version:` in the file.
- **On the cloud grid** (`--remote`), the suite runs on a virtual device on a HyperExecute macOS host, so it works **from any machine** — Linux, Windows, or a Mac with no Xcode or Android Studio. Pick the device from `kane-cli devices list --target emulator|simulator --remote`. One grid job runs one platform (emulator members on one Android version, simulator members on one HyperExecute pool), and a member's local build is uploaded from your machine before dispatch and handed to the grid as an `APP…` id. Everything else is in [Remote runs](./remote-execution.md).
- **Real devices** (`target: android` / `target: ios`) run from **any machine**, locally or with `--remote`. Each member opens its own device session in the TestMu AI cloud, so `--parallel` works, up to the real devices your plan allows (extra sessions queue for up to 15 minutes). Each member needs an `app:` in its file (`testrun` has no `--app`). With `--remote`, the suite runs as a HyperExecute job on Linux runners. See [Real devices](./mobile/real-device.md).

```bash
kane-cli testrun run --match '^tests/app/' --device-name "Pixel 7 API 35" --os-version 15            # local emulators
kane-cli testrun run --match '^tests/app/' --remote --device-name "Pixel 7" --os-version 14           # the grid
kane-cli testrun run --match '^tests/devices/' --parallel 2                                            # real devices
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
| `--agent` | *(0.8.21)* NDJSON on stdout even in a terminal: the same stream a non-TTY stdin selects | off |
| `--no-adaptive-heal` | Disable default adaptive healing after replay failure | healing enabled |
| `--bug-detection <mode>` | `off` \| `stop` \| `continue` — see [Configuration](./configuration.md#bug-detection) | config value |
| `--headless` | Run Chrome without a visible window | off |
| `--remote [backend]` | Dispatch the suite to the cloud grid instead of local Chrome / local devices (default backend: `hyper`). Needs `kane-cli plugin install remote-execution`. See [Remote runs](./remote-execution.md) | off |
| `--device-name <name>` | Device for the suite's mobile members: as `kane-cli devices list` prints it locally, or a grid catalog device with `--remote` | member's `device_name:` |
| `--os-version <version>` | OS version for the mobile members (`14`, `17.5`); alone = any device on that version | member's `os_version:` |
| `--username <user>` / `--access-key <key>` | Basic auth (skips OAuth) | — |

Each desktop worker gets its **own isolated Chrome** with a fresh temporary profile, so parallel members never share cookies, logins, or tabs — and never fight over your real browser profile.

`--on-failure` controls what a failed member does to the rest of the suite:

- **`continue`** (default) — every member runs; failures are collected in the summary.
- **`fail-fast`** — a failure stops *new* members from starting; members already in flight finish normally.

**Ctrl-C is graceful**: no new members start, in-flight members finish, the evidence pack still seals, and the run exits `3`. Members that never started are reported as skipped — the pack accounts for every planned member, including skipped and broken ones.

## Dry runs

`--dry-run` prints exactly the plan the real run would execute — the selected members, any preflight failures, and the parallelism — then exits without launching anything:

```bash
kane-cli testrun run --tags smoke --parallel 4 --dry-run
```

Exit `0` means the plan is valid; exit `2` reports planning refusals. This does not prove runtime readiness: local dry-run returns before runtime authentication and browser/device startup. Remote dry-run also validates the grid catalog but does not upload apps or dispatch a job. A real run can still fail after a valid plan. A dry run prints the variable warning too, so you can fill values before the real run.

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

## Designed tests in a shared project

In a folder linked to a [shared project](./assurance/shared-projects.md), each designed test runs on its scenario's **test case** in Test Manager, so every run is recorded on that case and counts toward the project's coverage.

A test runs on its case when its file sits directly in `.testmuai/tests/` and starts with the `assurance:` header the save writes. A designed file moved into a subfolder (`.testmuai/tests/smoke/`) or anywhere else runs as an ordinary test, under your profile's project, and doesn't count.

### First run, replay and heal

| Run | When | What it does | Cost |
|---|---|---|---|
| **First run** | The test has no `output-<name>/` beside it in this folder: it was just saved, pulled or copied here | Adds a KaneAI test to the scenario's test case, then writes each step in a real browser | More credits, and a few minutes |
| **Replay** | `output-<name>/` holds its recorded steps | Replays them | Far fewer credits |
| **Heal** | A replayed step no longer matches the page | Writes that step and the ones after it again, then goes on | Like a first run, for the steps it writes |

A test's recorded steps stay in the folder that ran it. So a teammate's copy of the same test makes its own first run in their folder, on the same test case.

A designed test's first run is on desktop web: Test Manager adds runs to a test case from web runs only, so a first run on a device (the file's `target:`, or `--target` on `kane-cli testmd run`) stops with `Test Manager can't add this test's runs to its test case yet, so the run didn't start`.

### How runs count

At the end of a run, kane-cli shows what it proved against the project:

```text
coverage: 40% across "Checkout revamp"'s 5 use-cases, from this run's tests
  this run reached 2 use-cases: 6 criteria passed, 1 failed
```

`kane-cli cover` then shows the project's figure from everyone's runs. A new run can take up to 5 minutes to count there.

A test that stops before it starts (its session was never saved, or its test case was deleted) shows only as **failed** in the run's live view. Run it on its own with `kane-cli testmd run <file>` to see why, and see [Troubleshooting: shared projects](./troubleshooting.md#running-designed-tests).

### Tests from two projects

One `testrun run` is one execution in one Test Manager project. A linked folder can still end up holding tests from two projects. The usual way: `kane-cli run` uploads to your profile's project, not the folder's, and saves its test in `.testmuai/tests/` beside the designed ones. A whole-folder run then stops before anything runs:

```text
error: these tests are in different Test Manager projects, and a run counts for one project only
  this folder's project, "Checkout revamp":
    .testmuai/tests/add_one_item_to_the_cart_test.md
    .testmuai/tests/remove_the_last_item_test.md
  "KaneAI Generated":
    .testmuai/tests/search_for_headphones_test.md
next: to run the tests of "Checkout revamp", this folder's project, run:
  kane-cli testrun run .testmuai/tests/add_one_item_to_the_cart_test.md .testmuai/tests/remove_the_last_item_test.md
```

Run the command it names. It lists the tests' paths. Past five, it gives a `--match` instead when one selects exactly those tests. To keep the folder clean, run `kane-cli run` experiments in a different folder.

The same refusal comes in any folder whose tests are in two projects.

In agent mode the refusal is an `error` event with `code: "PROJECT_MISMATCH"`, a `projects` list (each with `project_id`, `name`, `this_folder` and `tests`), and a `next` that runs the folder's project's tests.

## Remote runs

Add `--remote` and the same selection runs as one **HyperExecute** job: Chrome on a grid macOS runner for web suites, a grid emulator or simulator for mobile suites. Each member runs as its own headless `testmd run` on the grid, `--parallel N` spreads the members across N grid runners, and the job link, the recordings, and the evidence pack come back to your project. Requires a LambdaTest plan with HyperExecute (macOS runners) and the `remote-execution` plugin — nothing else locally, not even Chrome.

```bash
kane-cli plugin install remote-execution
kane-cli testrun run --tags smoke --remote --dry-run          # resolve everything, dispatch nothing
kane-cli testrun run --tags smoke --remote --parallel 4       # a web suite on 4 grid runners
kane-cli testrun run --match '^tests/ios/' --remote --device-name "iPhone 15" --os-version 17.5
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

## Execution constraints

Local suites containing any mobile member require `--parallel 1`; larger values are refused. Isolated Chrome workers apply to desktop members only. Remote suites support grid concurrency via `--parallel N`.

Healing is enabled by default (three shrinking replay windows, then re-authoring of authorable steps). `--no-adaptive-heal` disables it. Retired `--retry`/`--retry-count` only print a notice and have no effect. Replay-only recorded steps retain their recordings even during healing.

NDJSON selection uses stdin, not stdout: run `kane-cli testrun run <paths> < /dev/null` for automation launched from a terminal. Dry-run validates a plan, not runtime authentication or browser/device readiness. Always observe process exit, including paths without a normal completion event.
