<!-- kane-cli skill reference: testrun (batch execution of _test.md files, locally or on the cloud grid with --remote; mobile members included) -->

# Batch Runs with testrun

`kane-cli testrun run` executes many **authored** `_test.md` files as one execution: one summary, one exit code, one sealed evidence pack for the whole suite.

## When to use testrun (vs. anything else)

- The user has **two or more saved `_test.md` tests** to run → `kane-cli testrun run`. Do NOT hand-roll a bash loop or spawn parallel `testmd run` processes — testrun does isolation, pooling, and a single rollup for you.
- One test → `kane-cli testmd run` (`references/testmd.md`).
- Multiple ad-hoc `run` objectives (not saved tests) → `references/parallel.md` still applies.
- A **mobile** `_test.md` (Android emulator / iOS simulator) is a normal member (0.8.7+): locally it needs a mac-arm64 host with the mobile setup and `--device-name`/`--os-version` (or the file's `device_name:`/`os_version:`); with `--remote` it runs on a grid emulator/simulator **from any machine**. Read `references/mobile.md` (§Remote) for the device catalog and app rules.
- The user wants the suite on the **cloud grid** (no local Chrome, or a mobile suite from a non-Mac / a Mac without Xcode or Android Studio) → `kane-cli testrun run … --remote` (§Remote below).

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
| `--remote [backend]` | Dispatch the suite to the HyperExecute grid instead of local Chrome / local devices (default backend `hyper`); needs `kane-cli plugin install remote-execution` — §Remote | off |
| `--device-name <name>` | Device for the mobile members: as `kane-cli devices list --target <kind>` prints it locally, or a grid catalog device (`devices list … --remote`) with `--remote`; validated before dispatch | members' `device_name:` |
| `--os-version <version>` | OS version for the mobile members (`14`, `17.5`); alone = any device on that version | members' `os_version:` |
| `--username` / `--access-key` | Basic auth | active profile |

## Preflight (why members get rejected)

All members must share one org + project. *(0.8.4+)* Members need **not** be authored — an unauthored member classifies as `author`: the run authors it in the author pass, and the evidence consolidates afterwards (best-effort). On pre-0.8.4 CLIs the same members refuse (`missing_meta` / `not_authored` — remedy: author once with `kane-cli testmd run`). Failure reasons on the plan:

| Reason | Plain-language meaning | What to tell the user |
|---|---|---|
| `org_mismatch` | Different organisation than the other tests | "Check `kane-cli testmd status <path>` — it belongs to another org" |
| `project_mismatch` | Different project than the other tests | "Run it separately or per-project" |

If **any** member fails preflight, the plan is invalid: nothing runs, exit `2`. Suggest `--dry-run` to preview the plan cheaply before a big run.

## Remote: the suite as one HyperExecute job (`--remote`)

`kane-cli testrun run <selection> --remote` ships the cwd as the job payload, provisions a grid runtime on a **HyperExecute macOS runner** — Chrome for web members, a **virtual Android emulator or iOS simulator** for mobile members — runs every member there as its own headless `testmd run`, and brings the recordings (`output-<stem>/`) and the sealed evidence pack back into the project. It works **from any machine** with nothing local but Node and the plugin (no Chrome needed); the account needs a HyperExecute plan with macOS runners and the plugin (`kane-cli plugin install remote-execution`; check with `kane-cli plugin doctor remote-execution`). Auth is a LambdaTest username + access key — an OAuth profile is exchanged automatically. Not the same as `--ws-endpoint`, which attaches a remote browser to a run that still executes locally.

```bash
kane-cli testrun run --tags smoke --remote --dry-run                                        # web suite: validate, dispatch nothing
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14            # Android suite on the grid
kane-cli testrun run tests/ios/ --remote --device-name "iPhone 15" --os-version 17.5        # iOS suite on the grid
```

- **Always `--dry-run` first.** It runs the normal preflight plus the **remote preflight** and resolves the device against the grid catalog (`kane-cli devices list --target emulator|simulator --remote --agent`) without creating a job.
- **`--parallel N`** becomes the job's concurrency for web and device suites alike (members auto-split across N grid tasks; a device task gets its own VM and device). **Web suites**: `--headless` is unnecessary (always headless on the grid); there is no `remote_device` event. Overhead is ~15 s of setup plus the tests' own time; a mobile job adds a minute or more for device boot.
- **One job = one runtime.** A selection that mixes web and device members, emulator and simulator members, or emulator members on several Android versions is refused with a split suggestion (`--match`/`--tags`). Simulator members may differ in iOS version as long as they land on one HyperExecute pool (`mobile_pool_split` otherwise).
- **Mobile app on the grid**: a member's local build (`.apk` for emulator, `.zip` for simulator, anywhere on disk) is uploaded from the laptop at preflight and handed to the grid as `--app <id>` (one `remote_app` event per distinct build); an `APP…` id is used as-is. Nothing has to be inside the project or un-gitignored; `--dry-run` uploads nothing. Details and the preflight codes: `references/mobile.md` §Remote.
- `--author`, `--no-adaptive-heal`, `--bug-detection`, `--name`, `--on-failure` are forwarded to the grid. Use a long Bash timeout (up to 600000 ms).
- The dispatch writes `.hyperexecute/`, `hyperexecute-cli.log`, and `.updatedhyperexecute.yaml` into the cwd — suggest gitignoring them; they are not inputs.

Remote preflight refusals arrive as one `remote_error` per reason (then `testrun_done` failed, exit 2):

| `code` | Meaning | Fix to suggest |
|---|---|---|
| `mobile_remote_mixed` | web + device members in one selection | two runs |
| `mobile_remote_mixed_platform` | emulator + simulator members | one run per platform |
| `mobile_os_version_split` | emulator members on different Android versions | one run per version, or `--os-version` |
| `mobile_pool_split` | simulator members whose iOS versions need different HyperExecute pools | one run per pool, or `--os-version` |
| `mobile_remote_unsupported` | a device target the grid can't provide | run locally or deselect |
| `mobile_app_missing` | a member's local build is not on this machine | fix the path, or use an `APP…` id |
| `mobile_app_not_uploadable` | the build is not one the cloud takes (`.ipa`, or the wrong extension for the platform) | `.apk` for emulator, `.zip` of the `.app` for simulator, or an `APP…` id |
| `mobile_app_upload_failed` | the laptop-side upload failed | fix the upload (network/auth), or use an `APP…` id |
| `member_outside_payload` | a member outside the dispatched cwd | run from a directory that contains it |
| `gitignored_inputs` | recordings gitignored | un-ignore (`!output-*/`) or commit |
| `on_grid` | already on a HyperExecute grid | drop `--remote` |
| `invalid_plan` / `project_authority_conflict` | normal preflight failed / project mismatch with the configured one | fix the plan / `kane-cli config project` |

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

With `--remote`, the stream is wrapped in typed `remote_*` events (all on stdout):

| `type` | Payload | Notes |
|---|---|---|
| `remote_start` | `backend`, `env` | Dispatch begins |
| `remote_device` | `platform`, `slug`, `name`, `os_version`, `avd_id?`, `pool?` | The resolved grid device (mobile). Present it as the device line. |
| `remote_device_hint` | `reason: device_name_ignored\|catalog_stale`, `detail` | Informational; `device_name_ignored` is emulator-only |
| `remote_app` | `path`, `app_id`, `source: uploaded\|cache\|dry-run` | One per distinct local build uploaded from the laptop (mobile); `app_id` is empty on a dry run |
| `remote_dispatched` | `job_id`, `job_url` | The HyperExecute job exists — give the user `job_url` |
| `remote_error` | `code`, `detail` | Remote preflight refused (table above); expect `testrun_done` failed + exit 2 |
| `remote_import_tape`, `remote_exec_sync`, `remote_coverage` | `status`, `reason`, `detail?` | Informational; sync/coverage are `skipped` when the project has no `.context` store |
| `remote_done` | `status`, `exit`, `job_id`, `sessions_path` | Follows `testrun_done`; `sessions_path` holds the members' grid session logs |

`testrun_summary` additionally carries `remote: {backend, jobId, jobUrl, sessionsPath}`. A member `status: "broken"` with `execution: null` and `upload: "skipped"` means the grid-side kane-cli refused before launching — send the user to `job_url` for the scenario log and check the app id's environment.

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
