# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.3] - 2026-07-17

### A rebuilt interactive session panel
- **Keyboard-first navigation** — arrow keys, **Enter**, and digit shortcuts move through the panel; typing immediately opens a free-text editor row seeded with context so you never start from a blank prompt.
- **Cleaner visual hierarchy** — work output indents by two columns, receipts are machine-only, and human-facing commit lines are kept to a single line. No more visual noise from internal IDs or CIDs leaking into readable output.
- **Colored risk and recommended-row highlighting** — the question panel announces its header, marks risk level in color, and highlights the recommended answer so the right choice is obvious at a glance.
- **Phase-aware labels throughout** — loader labels, exit copy, and decision labels all reflect the current phase in plain language; file paths use `~` shorthand instead of absolute paths.
- **Narrative appears after the commit** — the summary message renders once a decision is finalized, not before, so the flow reads in the right order.

### Auth that doesn't silently fail
- **OAuth now doesn't expire mid session** — after an OAuth login, kane-cli doesn't let the subsequent runs hit token-expiry mid-session.
- **Malformed payloads and slow exchanges are rejected cleanly** — the credential exchange now has a timeout and rejects malformed responses, with a visible warning if the exchange falls back to a secondary path.

### Reliability fixes
- **A bad cite no longer crashes a run** — a list-shaped add-operation cite is now treated as a recoverable error rather than a hard crash.
- **No phantom blank lines in output** — trailing-newline prose no longer produces an extra empty row in the scrollback.
- **Selector recorded for wrapped actions** — the resolved selector for `until`-wrapped actions is now saved correctly, so logs reflect what was actually matched.

### Bug Fixes
- https://github.com/LambdaTest/kane-cli/issues/136

## [0.6.2] - 2026-07-16

### Auth that's honest about what it's doing
- **OAuth tokens are now exchanged for long-lived credentials automatically** — when running tests, OAuth credentials are resolved into non-expiring basic credentials behind the scenes, so sessions don't break mid-run.
- **Fallback during credential exchange now warns you** — if the auth exchange falls back to a secondary path, you'll see a clear warning instead of it happening silently.

### Conditions and variables that compute correctly
- **Condition blocks now evaluate logical and boolean expressions** — the condition leg previously missed logical/boolean expressions; those cases are now handled correctly.
- **`SET` variable values are no longer pre-seeded** — variables declared with `SET` now get their value from the store instruction at runtime, rather than being initialized prematurely, which could cause stale or incorrect values.
- **Empty expected values no longer cause false failures for non-`contains` checks** — the fail-loud guard for an empty expected value is now scoped only to `contains` assertions, so other check types aren't incorrectly flagged.
- **Visual checkpoint conditions derive from the right base** — the `textual_visual` leg now correctly inherits from the checkpoint condition type.

### Cleaner output
- **Unrelated references no longer appear in terminal output** — user-facing messages are cleaned up; unrelated identifiers and phrasing that passed into output have been removed or reworded.

## [0.6.1] - 2026-07-16

### Fixed
- **`context`, `design`, and `maintain` now work on a fresh install** — 0.6.0's published packages shipped without a component these commands require, so they failed immediately after `npm install` / `brew install`. 0.6.1 bundles it correctly across all supported platforms.
- **A missing platform binary no longer fails the install itself** — the post-install step now degrades gracefully instead of aborting `npm install` when a binary is absent.

For the full feature set 0.6.1 brings to life, see the [0.6.0 release notes](https://github.com/LambdaTest/kane-cli/releases/tag/0.6.0).

---

## [0.6.0] - 2026-07-15

### From requirements to a designed suite
Point kane-cli at what your product must do, and it designs a suite that proves it — every test tied to the criteria it verifies.
- **Each test records the acceptance criteria it covers** — the link between a test and its requirements is captured at authoring time and stays permanent and auditable.
- **Results are reported per criterion, not just per test** — a test that satisfies 3 of 5 tagged criteria shows exactly that, instead of a blanket pass.
- **You're warned when a test claims more than it checks** — tagged criteria that no automated check covers are surfaced up front.
- **Every test file links cleanly to its design entry**, so coverage lookups are exact.

### See exactly what's covered
Coverage stops being a guess — every run reports what it reached and what it missed.
- **Coverage reflects the current run** — sealed evidence and reports cover only what this run touched; project-wide coverage stays separate and unaffected.
- **`kane-cli cover` shows coverage and gaps side by side**, each gap anchored to its use-case so nothing is quietly dropped.
- **Evidence is self-contained** — referenced sources travel inside the pack with a content fingerprint, verifiable offline.
- **`usecases.yaml` is a coverage snapshot you can diff** — requirements, verdicts, run history, risk, and gaps in one file.

### Keep the suite current
Products change; tests shouldn't rot. The `kane-cli maintain` family keeps them aligned.
- **Reconcile and evolve your suite as your product changes** — kane-cli surfaces what's drifted and helps bring tests back in step with new behavior, with updates reviewed before they're applied.
- **`kane-cli maintain learn`** — a read-only view of the signals your maintenance decisions leave behind, which inform future runs.

### Author richer checks
Assertions and conditions gained real depth this release.
- **DOM is the default assertion mode**, with final validation now a configurable setting.
- **Boolean and arithmetic assertions** — combine checks with boolean logic and assert on computed values like totals and quantities.
- **Containment checks** — a "shows X" assertion verifies X is present, rather than requiring an exact match.
- **Replay-safe conditional steps** — conditions re-run deterministically, so conditional flows behave the same on every replay.
- **Variables inside a condition** now export a test that genuinely asserts, instead of one that could never fail.

### Solid underneath
- **Changes are visible immediately** — later steps work against the current state, not a stale snapshot.
- **A hung run is diagnosable** — `kill -USR1 <pid>` writes a full stack trace to the session log, captured live rather than only on clean exit.
- **A test with no starting URL fails fast** instead of hanging for input.
- Plus fixes: per-criterion status display, contained failures during generation and clean identifier truncation.
- Windows: Tier 1 agent resolution is fixed — a path-resolution bug that prevented the agent from starting on Windows is resolved.

---

## [0.5.0] - 2026-07-12

### Automatic bug detection on every failure
- **Failures are investigated, not just reported** — when a run fails, kane-cli automatically investigates whether it hit a product bug or a test issue and records a structured verdict in the pack's `failure.yaml`, alongside the page state and pointers into the console/network logs.
- **Result code 740 means a confirmed product bug** — a confirmed bug is recorded as result code `740` in the run's result records and final event, so CI pipelines can distinguish genuine regressions from flaky tests.
- **Proactive detection is configurable** — `--bug-detection off|stop|continue` on `run`, `testmd run`, and `testrun run` (default `off`): `stop` halts the run on a confirmed bug, `continue` records it and keeps going. Persist it with `config set-bug-detection` or the TUI settings panel.
- **Investigation never stalls a run** — investigations run asynchronously, so other members in a multi-test run are never blocked waiting for a verdict.

### Evidence packs: structured proof for every run
- **Every run now produces an evidence pack** — screenshots, a HAR network log, console output, and a `result.yaml` summary are bundled and sealed into a single zip after each run. Saved runs land in `.testmuai/evidence/` in your project.
- **Visual steps get an annotated screenshot** — each visual action produces an `annotated.png` with a crosshair and bounding box so you can see exactly what was targeted.
- **Console and network traffic are captured per step** — each run's network log is saved as a real HAR file (readable in any HAR viewer) and console output as NDJSON, both attributed to the step that produced them.
- **Packs publish automatically and can be merged** — replayed tests and testrun executions publish their sealed pack to your project's execution history; `kane-cli evidence merge` combines several packs into one. `kane-cli testmd sync <path>` pushes a test's replay bundle (test + imports + outputs) to the cloud.

### Browse your evidence right after a run
- **A browser viewer opens after every run** — on interactive runs, kane-cli prompts to open the sealed pack in a browser-based viewer; non-interactive runs print a hint line instead.
- **`kane-cli evidence serve`** — serve any sealed pack to the viewer from a localhost-only server (nothing is uploaded — the viewer reads the pack from your machine); holds until **Ctrl-C**.
- **`kane-cli evidence validate`** — check a pack's structure and completeness without running a test; exit codes make it easy to gate in CI.

### Run multiple tests at once with `kane-cli testrun run`
- **`kane-cli testrun run`** executes a set of `_test.md` files as one run — select members by path, tag (`tags:` frontmatter key, ANY-match), or auto-discovery, with a bounded worker pool (`--parallel`) and optional fail-fast (`--on-failure fail-fast`).
- **Each parallel worker gets an isolated Chrome** — a fresh temporary profile per worker, so members never share cookies, logins, or tabs.
- **`--dry-run` previews what would execute** — the exact members, per-member preflight results, and any org/project mismatches, before a single browser opens.
- **One sealed pack for the whole suite** — every member's results, logs, and screenshots land in a single evidence pack; skipped and broken members are recorded with full detail, not silently dropped.
- **Ctrl-C is graceful** — no new members start, in-flight members finish, the evidence pack still seals, and the run exits 3.

### Replay is more accurate and complete
- **Step geometry reflects the actual page at replay time** — element coordinates and bounding boxes in `step.json` come from the live page during the run, not from the original recording.
- **Pure replay packs carry the original `execution.json`** — the authored execution tree is preserved exactly; unexecuted actions are recorded as skipped in `result.yaml`, and failed steps are kept in the tree.
- **Variables resolve correctly on cloud runs** — cloud-provisioned variable bindings substitute correctly during replay.
- **WebSocket and SSE assertions arm capture automatically** — exported and replayed tests that assert on WebSocket or SSE traffic enable the right capture without manual configuration.

### Result records are richer and more trustworthy
- **`result.yaml` now includes who ran the test** — executed-by carries the user name and email from the authenticated identity.
- **Tags from `_test.md` frontmatter appear in `result.yaml`** — tags flow through the full pipeline, including skipped and broken entries.
- **`action_id` links steps to the execution tree** — step events and `result.yaml` entries share a join key, so external tools can correlate them precisely.
- **OS version and browser viewport are recorded automatically** — the result's environment block includes the host OS version and the actual browser resolution, for replays too.

### Also in this release
- **npm installs work on Linux ARM64** — the matching platform binary is selected automatically.

---

## [0.4.10] - 2026-07-03

### Smarter visual checks
- **"Element not found" is no longer a silent failure** — when a presence check is uncertain, kane-cli now escalates to a visual scan instead of confidently returning false, reducing missed detections.
- **Hover actions work on vision coordinates** — previously, hovering over a vision-identified coordinate would fail; it now maps correctly to a click-compatible action.

### More reliable text input
- **Special characters in typed text are handled correctly** — literal tokens inside `type` and `fill` actions are now properly re-escaped, preventing misinterpretation of characters that would otherwise be treated as control sequences.

### Clearer error feedback
- **Validation errors now show what was sent** — on a 422 response, the full request body is logged so you can see exactly what the server rejected without extra debugging steps.
- **Status codes pass through accurately** — 422 errors are only raised for request-body validation problems; other upstream errors now forward their original status codes instead of being masked.

## [0.4.9] - 2026-07-01

### Live SSE streaming in the TUI
- **Network SSE is now a toggleable mode** — a new `network_sse` flag (and matching TUI toggle) lets you stream server-sent events through the run pipeline rather than waiting for full responses.
- **SSE activity is visible in the run view** — connection summaries and an analyzer log surface what SSE connections are active, so you can see streaming traffic at a glance without leaving the terminal.
- **Replay arms and runs automatically with SSE** — when SSE mode is on, replay start and stop are handled for you; no manual setup required.

### Faster, more reliable navigation
- **`back` and `forward` navigations no longer hang for 30 seconds** — navigation completes as soon as the browser commits, not after a full load timeout.

### Local assertions
- **Assertion evaluations are now local** — the evaluations for assertions are now local, previously they were managed at server even though they were deterministic.

### Fixes and edge cases
- **System-only API nodes no longer error on empty input** — a guard prevents sending a blank request to the LLM when there is no user message.
- **Multi-line `@` branch events are matched correctly** — if/else branch events spanning multiple lines are now captured and routed as expected.
- **SSE response bodies are skipped during network capture** — `text/event-stream` responses no longer attempt a full body read, which avoids stalling the capture pipeline.

## [0.4.8] - 2026-06-25

### WebSocket capture, now surfaced end-to-end
- **Toggle WebSocket capture from the TUI** — a new switch in Config > Run lets you turn WS frame capture on or off without editing config files.
- **WS frames appear alongside network activity** — WebSocket traffic is folded into the devtools network view, so HTTP and WS events show up in one place during both test runs and authoring sessions.

### Smarter AI-generated test steps
- **No more invented response field names** — when extracting values from API responses, kane-cli now insists on named extractions tied to real fields rather than making up key names.
- **Conditionals inside multi-step flows wrap correctly** — flows that mix conditional logic with multiple actions no longer produce malformed step sequences.
- **Driver and block payloads are treated as literal data** — previously, the runner could misinterpret structured payloads; they are now passed through as-is.

### Version check that actually works
- **`check-version` reliably detects when a newer release is published** — the gate was previously missing live published versions; it now correctly compares against the registry.

## [0.4.7] - 2026-06-22

### A live run view that shows what's happening
- **Step labels appear as the AI reasons** — instead of waiting until a step completes, the label streams in with a typewriter effect and a blinking cursor, so you can follow along in real time.
- **A dedicated describe panel in the run view** — a bordered box below the activity line shows a plain-English description of what the browser just did, updating live as each step finishes.
- **The objective header is now a proper bordered box** — replaces the flat grey bar, making it easier to visually separate your goal from the step activity below.
- **Long objectives no longer overflow the terminal** — the run box wraps long objective text and pins itself to your terminal width. The step timer no longer flickers on updates.

### More accurate assertions and text extraction
- **A new text-based assertion path checks page content via code, not just screenshots** — for assertions, kane-cli can now extract structured DOM content and run a code extractor against it, giving more stable and replay-safe results.
- **Boolean checks now steer toward presence vs. state** — rather than brittle exact-match comparisons, the AI now uses a dedicated mode that asks whether something is present or in a given state, reducing false failures.
- **Assertion intent carries through to code export** — the query, expected value, and unit-conversion flag from a heal/assertion step now travel all the way into exported automation code.

### Cleaner, more accurate step labels
- **Step labels are generated in parallel with execution** — the humanizer runs alongside the action node so labels appear faster, without blocking the step.
- **Labels are cleaner by default** — auto-generated step labels strip autopilot grounding descriptors and redundant "wait" language, and whitespace-only names are normalized at ingestion.
- **The initial navigate step now always gets a label and rationale** — the first `navigate` step no longer silently skips humanization.

### Reliability and display fixes
- **Loopback URLs get the right scheme** — hosts like `localhost` now correctly get `http://` instead of being flagged as unresolvable.
- **Screenshots are labeled correctly** — images were being sent as `image/png` even when they were JPEG; the content type is now correct.

---

## [0.4.6] - 2026-06-18

### API steps inside test flows
- **Call external APIs as first-class test steps** — flows can now include `execute_api` steps that dispatch a named API call, store the response, and pass it forward to later steps in the same run.
- **Child flows inherit API context** — when a flow spawns a child, the child has access to the parent's API registry and writes its response back so the parent can read it; this chains correctly across multiple nesting levels.
- **API variables resolve by dot-path** — output values from an API step can be referenced with dot-path syntax in subsequent conditions and actions, including inside `if_else` branches that follow an API step.

### Capture and observability
- **API request captures are no longer silently dropped** — every upload attempt (prompt, tools, output, usage) now logs success or error explicitly, so missing data is always visible in the run log.
- **Bifurcation decisions are written to disk** — phase-segmentation bifurcation logs are persisted to `runs/<n>/bifurcation.log` in both normal and testing mode, so the branching decision is always inspectable after a run.

### Reliability and failure surfacing
- **Fixed: child flows ran without their tools** — a flow spawned from another flow wasn't receiving its tools (tab switching, the ask-user prompt, file upload, etc.), so nested flows silently couldn't perform actions a top-level flow could. Spawned flows now inherit the parent's full tool set and behave the same as top-level flows.
- **No orphan run directories on early exit** — the run directory is allocated lazily, so runs that return early (e.g. due to a pre-flight error) no longer leave empty directories behind

---

## [0.4.5] - 2026-06-15

### Smarter retries and timeouts
- **Chrome no longer hangs on startup** — the CDP launch now has a bounded retry loop and a configurable timeout, so a stuck browser process fails fast instead of blocking your run indefinitely.
- **Retry logic handles edge cases correctly** — previously, certain hung or degenerate branching states could cause retries to stall or misbehave; these are now resolved cleanly.

### More reliable variable and URL handling
- **`{{var}}` placeholders in start URLs are passed through as-is** — the CLI no longer tries to resolve or rewrite template variables in start URLs before the run begins, so your parameterized URLs reach the browser exactly as written.
- **Value comparisons and cross-page checks are more robust** — boundary values, if/else branching logic, and comparisons that span multiple pages are handled more consistently during test execution.

### Cleaner run lifecycle
- **Cancelling a run releases its playground lock** — if a run was cancelled or never committed, the TMS playground lock could be left held, blocking future runs. That lock is now released automatically.

## [0.4.4] - 2026-06-14

### One place to set your start URL
- **Default URL in config** — set a default start URL with `config set-url` and the CLI will use it for every run automatically. The `/config` menu in interactive mode now includes a "Default URL" item, and `show` displays whatever value you've stored.
- **Per-run `--url` flag** — pass `--url <address>` on any `kane run` or `testmd run` call to override the default for that run without touching your config.
- **URL in `.testmd` frontmatter** — add a `url:` key to a test file's frontmatter and it becomes that file's built-in start URL. Resolution order: `--url` flag → frontmatter → stored default.

### Clearer errors when a URL is missing
- **Missing URL is now a hard stop, not a silent fallback** — previously the CLI could fall back to a hardcoded placeholder (google.com). Now, if no URL can be resolved, an overlay in the TUI or an error in the CLI tells you immediately and asks you to supply one.
- **Skip the requirement when you need to** — pass `--allow-missing-url` on non-TTY runs to opt out of the URL requirement entirely, useful for headless pipelines where the URL comes from another source.

### Fewer surprises in long sessions
- **URL is only sent for the first run, not replayed** — after the first completed run in a session, the start URL is no longer re-injected into subsequent sub-flows, which prevents stale navigation on `/new` or follow-up runs.
- **Session reset clears URL state cleanly** — `/new` and `/reset` now properly reset the internal "has completed run" flag, so a fresh session behaves exactly like the first one.
- **Non-TTY testmd runs no longer prompt** — when running in a non-interactive environment, the CLI no longer blocks waiting for user input if a URL is missing.

## [0.4.3] - 2026-06-12

### New browser-automation tools
- **Clipboard, cookie, and localStorage are now first-class tools** — test flows can read and write the virtual clipboard, and can perform full create/read/update/delete operations on cookies and localStorage, matching what a real browser session can do.

### Contextual hints in the footer
- **A live hints bar at the bottom of the TUI** — a new footer row shows tips relevant to your current mode, cycling through a remote catalog that updates automatically (cached for 1 hour).
- **Hints can be turned off** — run `/config` inside the TUI to toggle hints on or off; the setting is saved locally and defaults to on.

## [0.4.2] - 2026-06-10

### Attach files to generate sessions
- **Local files in generate mode** — pass `--files` on the command line or type `@filename` inline to attach files to a generation request; kane-cli validates, uploads, and maps them automatically before submitting.
- **`@`-mention selector with grouped categories** — typing `@` opens a unified palette that organizes matches into Files, Scenarios, and Test Cases, with a bounded 7-row scroll window so it never takes over the screen.
- **Mistyped `@` paths are surfaced, not silently dropped** — if a referenced file can't be found, kane-cli warns you instead of ignoring it.
- **Input locks during upload** — the prompt becomes inert while attachments are processing, and a "Processing files" label replaces any ambiguous spinner text.
- **Uploads are cancellable** — pressing **Ctrl+C** during a file upload aborts cleanly and leaves a scrollback marker so you can see where the session stopped.

### Smarter generate-mode interaction
- **Per-session input history** — generate mode keeps its own history separate from run mode; press the up arrow to recall previous prompts.
- **Duplicate submits are blocked** — hitting submit twice in quick succession no longer fires a second request; the guard resets correctly after upload completes rather than after the full session ends.
- **Frozen refine input is fixed** — if a chat POST was rejected, the refine input could get stuck; it now resets correctly so you can type again.
- **Generation failures visible in scrollback** — errors from failed generation requests appear inline in the terminal and are also written to a local `errors.log`, with the same event sent to telemetry.

### Install subcommand
- **`kane install` checks for updates** — a new `/public/skills/kane-cli` endpoint backs a version-map check so `kane install` knows when a newer agent version is available.
- **`kane install <version>`** — pass a version as a positional argument to pin the install; already-installed targets are back-filled on re-runs so missing agent directories are never left behind.
- **Network calls time out** — install-phase requests are now bounded with abort timeouts so a slow or unreachable endpoint doesn't hang the terminal indefinitely.

### Project and folder gate in generate mode
- **Generate mode enforces project/folder selection** — entering `/generate` now applies the same project and folder gate as `/run`, so sessions can't start without a valid context set.

### Startup noise reduced
- **Node 18 `buffer.File` warning suppressed** — the `ExperimentalWarning` that appeared on Node 18 at startup is now filtered out; other warnings are unaffected.

---

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
