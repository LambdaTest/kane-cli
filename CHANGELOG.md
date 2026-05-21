# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-05-21

### Smarter replay with live branch evaluation
- **`if/else` branches re-evaluate during replay** — instead of blindly replaying recorded steps, the replay engine now re-gates each `if/else` branch against live conditions, so playback follows the correct path even when runtime state differs from the recording.
- **`--retry` no longer gets stuck on terminal-step failures** — previously, retrying a run that failed at a terminal step would silently do nothing; it now behaves correctly.
- **Run log lands in the right place** — `run.log` is now written to `runs/<n>/run.log` instead of `runs/<n>/run-test/run.log`, so it's where you'd expect to find it.

### Tab-count assertions now work end-to-end
- **Assert on the number of open browser tabs** — `tab_count` is now a fully supported assertion type: it's recognized during test initialization, wired through the analyzer, and evaluated correctly during replay.

### More reliable test execution
- **Click actions use vision-based drift detection as a fallback** — coordinate-based clicks now pass, so if a target has shifted since recording, the engine detects the drift rather than silently clicking the wrong spot.
- **Assertion outcomes are recorded, not re-executed** — the codegen path now captures the assert result directly instead of re-running the assertion through code generation, which could produce incorrect behavior.
- **Variable names reach TMS unmodified** — external runtime variable names are now pushed as-is, without an internal prefix that was being incorrectly applied.
- **Code export failures are caught immediately** — if the trigger or poll step for code export returns a non-200 response, the run now fails fast instead of hanging or silently continuing.

### A smoother CLI experience
- **Paste multi-line text into the objective prompt** — multi-line clipboard content pasted into the objective input field is now handled cleanly instead of being misprocessed.
- **`--help` looks the same everywhere** — help output is now consistent whether you reach it via `--help` or by typing an invalid command, and invalid input now shows a hint.
- **HTTPS connections trust your OS certificate store** — the CLI now uses your system's trusted certificate authorities instead of a bundled set, which means corporate or custom CA setups work without extra configuration. A crash on malformed cert entries is also fixed.

## [0.3.1] - 2026-05-14

### More reliable HTTPS connections
- **SSL errors on certain machines are gone** — the binary now bundles its own certificate authority store, so connections work even when the host system's CA certificates are missing, outdated, or misconfigured.

## [0.3.0] - 2026-05-14

### A new `testmd` command for local test files
- **Manage `.testmd` files without leaving the terminal** — the new `testmd` subcommand supports `run`, `list`, `status`, `export`, and `delete` operations on locally-stored test files.
- **`testmd export` pulls generated code from TMS** — exports Playwright code into a `playwright-<lang>-code/` directory alongside your test file, reusing a cached copy if one already exists.
- **`testmd delete` asks before it removes anything** — deletion is gated on an explicit `--yes` confirmation so nothing is wiped by accident.
- **`testmd list` works in both TTY and non-TTY modes** — in a terminal it opens an interactive picker; piped or in CI it streams NDJSON.

### Replay and retry that actually runs
- **Tests can now replay recorded actions and retry on failure** — the new `--retry` / `--retry-count` flags drive a retry loop that replays prior decisions step by step, then falls back to live authoring when no recorded action exists.
- **`--author` controls re-authoring behaviour** — choose between `force-author` (always re-author) and `complete-reauthor` (re-author every step from scratch) when replaying a session.
- **Variables and secrets are delivered just in time** — per-step variable values and secret overrides are pushed to the runner at the moment each step spawns, so overrides set mid-run take effect immediately.
- **Retry boundaries are visible in the run view** — when a retry triggers, the TTY output shows a rollup of the prior attempt before the next one begins.
- **Lock conflicts are handled automatically** — `--on-lock-conflict` (or the `on_lock_conflict` frontmatter key) accepts `readonly`, `fail`, or `wait`, and the lock is acquired mid-run when needed rather than only at startup.

### Safer, more reliable Ctrl+C
- **Ctrl+C now has a confirmation window** — pressing Ctrl+C arms a 5-second cancel window; a second press within that window cancels the run. Steps completing normally disarm the window automatically, so accidental keypresses don't abort a healthy run.

### A cleaner run view
- **Run configuration is shown upfront** — global config (Block A) is rendered at launch so you can confirm settings before the first step executes.
- **Per-step mode, reason, and overrides are visible inline** — each step shows its dispatch mode and any active overrides, making it easier to see why a step ran the way it did.
- **Info panels are consistent across all run paths** — recording status, upload progress, and result links all use a shared layout whether you're running an objective, a test file, or replaying a session.
- **The save prompt behaves predictably** — pressing **Enter** or **Esc** saves with a generated name; **N** is the only way to discard. The run banner no longer says "ephemeral" when a file will actually be saved.

### Output files you can rely on
- **Persisted runs write `Result.md` and `meta.json` next to the test file** — both are populated in direct-run mode, not just after a cloud session.
- **Generated code is copied into `output-<stem>/generated-code/`** — after a run that produces a code export, the Playwright code lands in a predictable sibling directory.
- **`md5sum` fields have been removed from `meta.json` and list/status output** — existing files are migrated automatically on first read; nothing breaks if you have older files.

### CI and non-TTY improvements
- **Retry and lock state are streamed as NDJSON events** — in non-TTY mode, `RETRY_TRIGGERED`, `FORCE_AUTHOR_RUN`, and recording state changes are emitted as structured events so CI pipelines can react to them.
- **`--push`, `--retry`, and `--author` refuse to run without basic auth** — rather than failing mid-run, the CLI stops immediately with a clear message if the credentials needed for those flags aren't present.
- **`TESTMUAI_SESSION_ID` is exported to the test runner environment** — the current session ID is available to steps as an environment variable.
