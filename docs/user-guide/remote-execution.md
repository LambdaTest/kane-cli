# Remote runs on the cloud grid (`--remote`)

`kane-cli testrun run --remote` dispatches a suite of `_test.md` files to **LambdaTest HyperExecute** instead of running it on your machine. The grid provisions the runtime, runs every member, and streams the job back to your terminal: one job, one exit code, one sealed [evidence pack](./evidence.md), and the same recordings and evidence you get from a local run.

Remote runs cover both kinds of test:

- **Web suites** run on a grid browser, so a CI runner needs no Chrome.
- **Mobile suites** (`target: emulator` / `target: simulator`) run on a **virtual Android emulator or iOS simulator on a HyperExecute macOS host** — so you can author and run mobile tests **from any machine**: Linux, Windows, Intel Macs, or a Mac without Xcode or Android Studio. The [macOS Apple Silicon requirement](./mobile/overview.md) applies only to *local* mobile runs.

```bash
kane-cli testrun run --tags smoke --remote                                       # a web suite
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14  # an Android suite
kane-cli testrun run tests/ios/ --remote --device-name "iPhone 15" --os-version 17.5
```

## Prerequisites

| You need | Why | How to check |
|---|---|---|
| A LambdaTest plan that includes **HyperExecute** — with **macOS runner concurrency** if you run mobile members | Every remote run is a HyperExecute job; mobile members are allocated on the grid's macOS pools | Ask your LambdaTest account owner, or open the HyperExecute dashboard for your org |
| The `remote-execution` plugin | It owns the HyperExecute binary kane-cli dispatches with | `kane-cli plugin install remote-execution`, then `kane-cli plugin doctor remote-execution` |
| A LambdaTest **username + access key** | HyperExecute authenticates with basic auth. An OAuth profile is exchanged for them automatically; otherwise pass `--username` / `--access-key` | `kane-cli whoami` |
| A project directory that **contains the tests** | The current directory is zipped and shipped as the job payload | Run from the repo root (or any parent of the tests) |
| Recordings and builds **not gitignored** | The payload respects `.gitignore`; an ignored `output-<stem>/` or `.apk` never reaches the grid | `--dry-run` reports `gitignored_inputs`; un-ignore with e.g. `!output-*/` |

`--env` picks the environment (`prod` or `stage`) for both the login on the grid and the Test Manager upload.

## Dispatching a run

`--remote` takes the normal `testrun` selection (paths, `--match`, `--tags`) and the usual preflight applies first — one org, one project. Then a **remote preflight** checks that the selection can be one grid job (see [What one job can hold](#what-one-job-can-hold)). If anything fails, nothing is dispatched: the reasons print, and the command exits `2`.

```bash
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14 --dry-run
```

`--dry-run` runs both preflights and resolves the device against the grid catalog **without creating a job** — use it before every new selection; it costs nothing.

A real run prints the resolved device, the job id and dashboard link, then tracks the job until it completes:

```
device: Pixel 7 (Android 14)
job 9b220ade-… dispatched → https://hyperexecute.lambdatest.com/hyperexecute/task?jobId=9b220ade-…
```

Allow several minutes: the grid installs kane-cli, boots the device (mobile), installs the app, and runs the members. A wall-clock timeout of 10 minutes is a safe starting point in CI.

## Choosing a grid device (mobile)

Remote devices come from the **grid catalog**, not from the AVDs or simulators on your machine. List what the grid can provision:

```bash
kane-cli devices list --target emulator --remote                    # Android emulators
kane-cli devices list --target simulator --remote                   # iOS simulators
kane-cli devices list --target simulator --remote --os-version 17.5 # only that OS version
```

Each row is a device **name** plus the **OS versions** it ships with. Address one with both:

| Flag / key | Purpose |
|---|---|
| `--device-name "<name>"` | The name exactly as the catalog prints it (`"Pixel 7"`, `"iPhone 15"`). Validated before dispatch. |
| `--os-version <v>` | The OS version (`14`, `17.5`). Alone, it means *any* catalog device on that version. |
| `device_name:` / `os_version:` in a `_test.md` | Per-test defaults, used when the flags are absent. See [Mobile target](./testmd/overview.md#mobile-target). |

If you pass neither, kane-cli picks a catalog default for the platform and prints it on the device line — read it before relying on it. A local AVD name in a member is ignored on the grid (you get a `device_name_ignored` note), because a remote job's device is named by the catalog.

## The app under test on the grid

The grid machine has to *obtain* the app, which changes the rules slightly from a local run:

| Target | `app:` in the test | What happens |
|---|---|---|
| `emulator` | A local `.apk` inside the project (path relative to the test file) | Shipped in the payload and installed on the emulator |
| `emulator` | An uploaded `APP…` id | Downloaded by the grid |
| `simulator` | An uploaded `APP…` id | Downloaded by the grid — **required**. A local `.zip` is refused up front (`mobile_app_not_cloud`) because the grid cannot fetch it |

`kane-cli apps list --target emulator|simulator` shows the uploaded builds your account can use; the **APP ID** column is what `app:` takes. There is no upload subcommand: running a test **locally once** with a local build (`kane-cli testmd run <path>` or `kane-cli run … --app ./MyApp.zip`) uploads the build to your account and prints the `APP…` id — set `app:` to that id afterwards. Uploads are **per environment and organisation**: an id uploaded on `prod` is not visible to a `stage` run, and `apps list` for the current profile is the authority.

## What one job can hold

One remote run is one HyperExecute job, which allocates **one runtime**. The remote preflight refuses a selection that needs more than one, and tells you how to split it (`--match` / `--tags`):

| Reason | Meaning | Fix |
|---|---|---|
| `mobile_remote_mixed` | Web and device tests in one selection | Two runs: one for the device tests, one for the rest |
| `mobile_remote_mixed_platform` | Emulator and simulator tests in one selection | Two runs, one per platform |
| `mobile_os_version_split` | Device tests asking for different Android versions | One run per version, or `--os-version` to force one |
| `mobile_remote_unsupported` | A device target the grid cannot provide | Run it locally, or deselect it |
| `mobile_app_not_cloud` | A simulator test references a local `.zip` | Upload the build and set `app:` to the `APP…` id |
| `mobile_app_not_shippable` | An emulator test names an `.apk` outside the project | Move the build inside the project, or use an `APP…` id |
| `member_outside_payload` | A test lives outside the dispatched directory | Run from a directory that contains it |
| `gitignored_inputs` | Required recordings or builds are gitignored | Un-ignore them (e.g. `!output-*/`) or commit them |
| `on_grid` | Already running on a HyperExecute grid | `--remote` cannot re-dispatch from inside a job |

Every reason arrives with the offending paths, both in the terminal and as a `remote_error` event for agents.

## What comes back

- **Recordings** — authored members' `output-<stem>/` directories land in your project exactly as a local run would leave them, so the next run (local or remote) replays from cache.
- **Evidence** — one sealed pack for the suite in `.testmuai/evidence/`, published to your project's execution history in Test Manager.
- **Job logs** — the per-member session logs under `~/.testmuai/kaneai/sessions/remote/<job-id>/`, and the full stage logs on the HyperExecute dashboard at the printed job link.
- **Exit code** — the same as a local `testrun`: `0` all passed, `1` a member failed or broke, `2` preflight / auth / usage (nothing dispatched), `3` cancelled.

`--author`, `--no-adaptive-heal`, `--bug-detection`, and `--name` are forwarded to the members on the grid.

## In CI

A remote run needs no Chrome, Xcode, or Android Studio on the runner — only Node and the plugin:

```bash
npm install -g @testmuai/kane-cli
kane-cli plugin install remote-execution
kane-cli testrun run tests/app/ \
  --remote --env prod \
  --device-name "Pixel 7" --os-version 14 \
  --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY" \
  --on-failure fail-fast
```

Archive `.testmuai/evidence/*.evidence` as the build artifact. More pipeline shapes: [CI/CD recipes](./cicd.md).

## For agents: NDJSON events

In agent / non-TTY mode a remote run adds typed events around the normal `testrun_*` stream (see [Batch runs](./testrun.md#for-agents-ndjson-events)):

| `type` | Payload | Notes |
|---|---|---|
| `remote_start` | `backend`, `env` | Dispatch begins |
| `remote_device` | `platform`, `slug`, `name`, `os_version`, `avd_id?`, `pool?` | The resolved grid device (mobile only) |
| `remote_device_hint` | `reason`, `detail` | `device_name_ignored` (a local AVD name was dropped) or `catalog_stale` |
| `remote_dispatched` | `job_id`, `job_url` | The HyperExecute job exists; the link opens the dashboard |
| `remote_error` | `code`, `detail` | Remote preflight refused the selection (codes above); followed by `testrun_done` and exit `2` |
| `remote_exec_sync`, `remote_coverage` | `status`, `reason`, `detail?` | Informational — assurance graph sync and coverage, skipped when the project has no `.context` store |
| `remote_done` | `status`, `exit`, `job_id`, `sessions_path` | Terminal for the remote wrapper; follows `testrun_done` |

`testrun_summary` also carries a `remote` object (`backend`, `jobId`, `jobUrl`, `sessionsPath`).

## Next steps

- [Batch runs with testrun](./testrun.md) — selection, preflight, flags, exit codes.
- [Mobile testing](./mobile/overview.md) — local setup on macOS Apple Silicon, or skip it with `--remote`.
- [Writing test.md files](./testmd/overview.md#mobile-target) — `target:`, `app:`, `device_name:`, `os_version:`.
- [Evidence packs](./evidence.md) — what comes back and how to view it.
