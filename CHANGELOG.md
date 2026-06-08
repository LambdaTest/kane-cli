# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-06-08

### Breaking & behavior changes
   - **Bare-objective shortcut removed.** `kane-cli "<objective>"` no longer routes to `run`. Use `kane-cli run "<objective>"`.
   Unknown first tokens now exit `2` with a "did you mean" suggestion instead of silently running.
   - **Exit code `1 → 2` for TMS credential-exchange failures.** Aligns with the other auth/setup failure codes. CI scripts that
   branch on exit `1` vs `2` should be updated.
   - **`config show` and the new `list` commands emit JSON when stdout is piped or redirected** (`> file`, `| jq`) instead of  the human table. Useful for scripts; anyone scraping the human format will need to update.
   - **Mid-run interactive project/folder picker removed.** When the startup gate finds nothing configured (or a stale/invalid cached value), it auto-defaults headlessly and announces the choice rather than prompting. The explicit `kane-cli config project` / `config folder` pickers still work in a TTY.

### Project & folder selection
   - **Zero-config first run** — every run path (`kane-cli run`, `kane-cli testmd run`, `kane-cli generate`) validates a
   project/folder before launching. If nothing is configured, kane-cli auto-resolves (find-or-create) and announces the choice in the TUI scrollback and as a `project_folder_auto_defaulted` event under `--agent`.
   - **New `projects` and `folders` subcommands** for scripted setup:
     - `kane-cli projects list [--search] [--limit] [--offset]`
     - `kane-cli projects create <name> [--description]`
     - `kane-cli folders list [--search] [--limit] [--offset]`
     - `kane-cli folders create <name> [--description]`

     Human table in a TTY, NDJSON when piped or under `--agent`, with `_meta`-paginated output for agents.
   - **Self-healing for stale, invalid, or typo'd IDs** — a cached project/folder that's been deleted, renamed, revoked, or set to a malformed value is detected at run start and replaced via auto-default, instead of silently breaking the upload at the end of the run.
   - **OAuth users can use the interactive `config project` / `config folder` picker again** — a regression that required basic-auth credentials to reach the picker is fixed.
   - **OAuth tokens refreshed in the projects/folders auth path** — expired tokens no longer cause silent failures when listing or selecting projects.

### More faithful recorded tests
- **Bare variable references are preserved in recorded `test.md`** — variable refs are written as-is, not coerced or mangled during recording.
- **`--author` is honored in non-TTY and agent runs** — passing `--author` in CI or agent mode now takes effect as expected.

### Variable handling in recorded tests
- **`--variables-file` and auto-store values resolve as expected** ([LambdaTest/kane-cli#69](https://github.com/LambdaTest/kane-cli/issues/69), [#75](https://github.com/LambdaTest/kane-cli/issues/75)) — the runtime `{{VAR}}` resolver now tries the local resolver first and falls back to the ATMS lookup, instead of silently dropping values the file had set.
- **Recorded `*_test.md` no longer double-prefixes variable namespaces** [#76](https://github.com/LambdaTest/kane-cli/issues/76) — replays previously produced `{{secrets.user.secrets.user.X}}` which never resolved; recorded objectives + frontmatter now persist bare `{{name}}` refs.

### Non-TTY & agent runs
- **`--author` is honored in non-TTY and `--agent` runs** ([LambdaTest/kane-cli#72](https://github.com/LambdaTest/kane-cli/issues/72)) — forcing re-authoring no longer falls back to the stale cached plan in headless mode.
- **Typo'd subcommands fail loudly** instead of silently running your input as an objective (see Breaking).

### Auth
- **`login` / `whoami` verify credentials server-side** ([LambdaTest/kane-cli#58](https://github.com/LambdaTest/kane-cli/issues/58)) — previously both could report success while the backend rejected every API call; invalid tokens now fail immediately instead of after the first real command.

### Cleaner output and display
- **Project-list count shown as a lower bound while streaming** — the projects denominator is now marked as approximate during streaming, so the display is not misleading.

---

## [0.4.0] - 2026-06-04

### AI test generation (`kane-cli generate`)
- **New `kane-cli generate "<objective>"` command** — starts an AI-driven generation session in an interactive TUI; refine the objective through a chat-like interface, then `/save` to materialize `.testmd` test files.
- **Headless / scripted generation** — run `kane generate` with `--refine` or `--save` flags for non-interactive pipelines; `--out` controls where the resulting files land.
- **Scenarios drill-in with `/view`** — while generating, `/view` opens a full-screen browser showing scenarios and individual test cases as they are produced; cases can be excluded before saving.
- **Bifurcation into per-case `.testmd` files** — each scenario is split into independent test cases eagerly; `/save` writes only functional cases and reports exactly how many were written.
- **Clarification round-trips** — if the AI needs more detail mid-generation, it prompts inline and resumes once answered; cancel any in-flight turn with **Ctrl+C** without losing the session.
- **Mode-switch guard** — switching from Generate to Run (or vice versa) while work is in progress asks for confirmation; an active inline run blocks the switch entirely.

### Browse and run saved tests inline
- **`/list` opens a saved-tests overlay** — from inside a run session, `/list` shows all saved `.testmd` tests; select one to inspect it, then launch it as a full inline run without leaving the TUI.
- **Inline `.testmd` runs have full fidelity** — the in-session run gets its own scoped lifecycle, keybindings, and log; it can't accidentally kill the outer session's Chrome when it exits.
- **Run summary and share link appended on completion** — when an inline `.testmd` run finishes, the summary and share URL are written into the scrollback.

### Share URLs in agent output
- **`share_url` now appears in agent NDJSON** — `test_md_summary` and `test_md_done` events both carry the share URL, so CI pipelines and downstream tooling can link directly to the completed run.

### Chrome profile support
- **`--chrome-profile` flag on `kane-cli run`** — pass a Chrome profile name at the command line; it is also picked up automatically from `.testmd` frontmatter when running saved tests.

### Cleaner Generate TUI
- **Teal accent and wider progress bar** — Generate mode uses a distinct teal color scheme; the progress bar grows from 10 to 24 cells so progress is easier to read at a glance.
- **Bottom bar condensed to 3 rows** — the model name is gone; Mode, Session ID, and key hints fit on three lines.
- **Thinking box capped at 5 rows** — the expanded thinking panel no longer pushes the live region off-screen.
- **Agent replies wrap correctly** — each reply block renders as a single unit so Ink wraps at word boundaries; bullets and indented blocks no longer dedent mid-line.
- **Markdown formatting in agent replies** — bold, italic (boundary-safe, so `snake_case` is never mangled), and `@`-mention mappings render correctly in the scrollback.
- **Mode-scoped commands** — slash commands are locked to the mode they belong to; foreign commands are rejected with a clear message rather than silently ignored.

---

## [0.3.7] - 2026-06-04

### Deterministic navigation at run start
- **Runs now navigate to the target URL as a defined first step** — navigation happens in its own phase before any test actions begin, so timing is predictable and logged accurately with real wall-clock duration.
- **Navigation and session setup happen in parallel** — the browser moves to the start URL at the same time the session initializer spins up, reducing dead time at the start of a run.

### More reliable dropdown and combobox interaction
- **Custom ARIA comboboxes are now clicked instead of selected** — elements that look like dropdowns but use custom ARIA roles get the interaction they actually respond to, reducing failed selections.
- **All combobox, listbox, and select elements expose their options again** — option extraction was missing for some element types and is now restored across the board.

### Fewer silent failures
- **Non-text request bodies no longer crash the session** — a `UnicodeDecodeError` reading binary or malformed request content is now swallowed gracefully instead of surfacing as an error.
- **Viewport size is read correctly** — a subtle API mismatch when querying the viewport has been fixed, so layout-sensitive steps get accurate dimensions.

### Cleaner run objective display
- **The run's objective now shows the full picture** — the display combines the start URL and the cleaned task description into a single stitched objective, so what you see at the top of a run reflects exactly what was requested.

## [0.3.6] - 2026-06-02

### DevTools assertions and extraction
- **Assert on network requests directly in your tests** — KaneAI can now inspect live network traffic during a run, letting you assert on request/response bodies, status codes, and headers using operators like `gte`, `lte`, and `not_equals`.
- **Read and assert on browser console output** — console logs (errors, warnings, app-level messages) are captured per run and can be used as assertion targets or extraction sources, with level normalization handled automatically.
- **Cookies and localStorage are now inspectable** — Kane-cli can read, assert on, and extract values from cookies and `localStorage` during a test run.
- **Performance traces are captured and assertable** — browser performance data is collected inline during a run and exposed as an assertion and extraction target.

### Code export for DevTools actions
- **DevTools actions now export to Code** — network queries, console reads, cookie access, and performance snapshots all produce correct automation code when code export is enabled, including replay support.

### Replay handles DevTools actions
- **Replaying DevTools steps works end-to-end** — network capture starts and stops correctly around `devtool_network` replay steps; console, cookie, storage, and performance actions are all wired into the replay execution.

---

## [0.3.5] - 2026-05-29

### Features Added

- **Opt out of auto-generated checks in action mode** ([kane-cli#43](https://github.com/LambdaTest/kane-cli/issues/43)) — when authoring tests via `kane-cli` in action mode, the CLI no longer appends its own final-verification check. Authors keep full control over which assertions land in the generated test file. (Behavior unchanged outside action mode.)
- **Confidence-scored element matching** — every element-match call now reports a confidence score and the visual cues that influenced it. Low-confidence matches are rejected up front instead of letting a wrong element silently get clicked.
- **Richer target descriptions** — element targeting now distinguishes load-bearing descriptors (PRIMARY) from supporting visual cues (HINTS), producing fewer ambiguous matches on visually similar elements.

### Bugs Resolved

- **`--retry` now works with OAuth credentials** ([kane-cli#52](https://github.com/LambdaTest/kane-cli/issues/52)) — OAuth users no longer have to fall back to `--username` / `--access-key`. Credentials are resolved up front before the run lock is acquired.
- **Screenshots upload reliably across the full session lifecycle** ([kane-cli#42](https://github.com/LambdaTest/kane-cli/issues/42)) — image network calls now fire consistently in kane-cli reports across boot, login, profile switch, and `/new` session resets.

### Reliability improvements

- **Automatic retry on transient network failures** — idempotent reads retry with backoff instead of failing the run immediately.
- **Stale credential cache falls back correctly** — if the in-memory snapshot is out of date, the CLI falls back to the last known good cached credentials.
- **Session transitions handled consistently** — boot, login, profile switch, and logout now go through a single dispatcher, closing gaps where auth state could get out of sync.
- **Remote logger and screenshot queue init hardened** — the logger won't re-initialize if already running, and a screenshot setup failure no longer takes down the surrounding operation.

## [0.3.4] - 2026-05-26

### Faster, smarter project picker
- **Project search now filters on the server** — typing in the project picker sends a `filter[name]` query instead of filtering a local list, so results are accurate and instant even across hundreds of projects.
- **Results are paginated at 10 per page with a searching indicator** — a visible loading state appears while results load, so the picker never feels frozen.

### Fuller artifact uploads
- **The entire session directory is zipped and uploaded** — artifact uploads now capture everything in the session folder, not just individual files, so post-run inspection has the full context.
- **Screenshot file extensions are tracked per operation** — the correct extension (`.png`, `.jpg`, etc.) is recorded per operation ID, so artifact references point to real files.

### Variable templates that actually resolve
- **`{{var}}` placeholders in query descriptions now expand correctly** — analyze, vision, and textual query descriptions that reference variables were being sent as raw template strings; they now resolve before the query runs.

### Triage and reporting
- **Triage payload and reporting are now supported** — runs can emit structured triage data, giving you a reportable summary of what passed, failed, or needs attention.

### Smoother installation
- **`sharp` is now an optional dependency** — a missing `sharp` native module no longer blocks `npm install`, and the post-install check no longer silently fails on global installs.

### Resolved Issues 
- https://github.com/LambdaTest/kane-cli/issues/51
- https://github.com/LambdaTest/kane-cli/issues/48
- https://github.com/LambdaTest/kane-cli/issues/47
- https://github.com/LambdaTest/kane-cli/issues/46
- https://github.com/LambdaTest/kane-cli/issues/44
- https://github.com/LambdaTest/kane-cli/issues/38
- https://github.com/LambdaTest/kane-cli/issues/27

---

## [0.3.3] - 2026-05-22

### Replay runs are more accurate
- **Variables now carry through in replay mode** — values set earlier in a test are correctly passed to the runner when replaying a recorded flow, so replay results match the original run.
- **AI-driven steps behave more consistently** — when Kane-CLI interprets a step, it now uses the AI's own understanding of the intent rather than the human-written description, producing more reliable browser actions.

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
