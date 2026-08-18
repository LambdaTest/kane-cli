# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.4] - 2026-08-18

### Remote execution on the grid
- **Run tests on LambdaTest HyperExecute with `--remote`** — kane-cli dispatches your test run through the backend, spawns a HyperExecute job, and streams progress back to your terminal with the job ID and a sessions path.
- **Automatic HyperExecute setup** — `kane-cli plugin install` sets up remote execution and places it where kane-cli expects it. `kane-cli doctor` tells you whether the setup, auth, and gitignore gate are all ready before you dispatch.
- **Grid login now uses the right environment** — remote runs pass `--env` correctly, preventing stage credentials from being rejected against production endpoints. Chrome discovery is also handled automatically on the grid.

### Plugin system
- **New `kane-cli plugin` command** — install, list, and remove plugins with `kane-cli plugin install`, `kane-cli plugin list`, and `kane-cli plugin remove`. An allowlist controls which plugins kane-cli will load.
- **Plugins install into a versioned local layout** — installed plugins materialize bundled assets into a `cwd`-local directory, so plugin versions are tied to your project rather than a global state.
- **`kane-cli doctor` covers plugin readiness** — the readiness report flags a missing HyperExecute binary as an error (the plugin owns it), so you know exactly what to fix before running.

### Smarter local run consolidation
- **Authored and replayed evidence merge into one published execution** — after a run that includes both authored and replay members, kane-cli reconciles them into a single pack with kane merge rules applied, coverage recomputed, and facts synced into the local graph.
- **Author members no longer cause a preflight failure** — members are now classified as `replay` or `author`; author-class members run standalone with their own pack and are folded into the consolidated result at reconcile.
- **`--from-context` selects members by assurance test IDs** — and automatically follows edit supersessions, so only tombstoned tests are excluded.
- **Gate auto-defaults now match local behavior** — `project_folder_auto_defaulted` surfaces in local runs the same way it does on the grid.

### A clearer terminal view
- **Evidence table now works in TTY and non-TTY modes** — TTY sessions get an interactive multi-pack evidence table with progress and a result box; non-TTY sessions get `serve` commands for each evidence row.
- **Remote runs render again in the TTY view** — a missing event-surface hook (`willMountTTYView`) was preventing the themed progress and result box from appearing during `--remote` runs.
- **Evidence display errors never flip the verdict** — a throw in the evidence presentation layer is now isolated, so a display bug cannot change the exit code of a passing run.
- **Exit codes derive from reconcile verdicts** — the terminal status and exit code are now grounded in what reconcile actually decided, not an earlier assumption.

### `testmd` improvements
- **`testmd run` accepts `--target`, `--device`, and `--app`** — device meta fields are carried through the evidence environment, so runs targeting specific devices report the right context.

## [0.8.3] - 2026-08-14

### Feed any web URL directly into context
- **Any web URL is now a valid content source** — paste a remote URL as input and kane-cli fetches and ingests it automatically, no manual download step required.

### More reliable evidence and log files
- **Log and evidence files now write correctly on all systems** — UTF-8 encoding is pinned on every file write, so non-ASCII characters in logs and evidence no longer corrupt or fail silently.

### Smarter click and scroll targets
- **Clicks and scrolls hit the right element more often** — target resolution now looks at parent element context when identifying text nodes, removing a fallback that could silently miss on the first attempt.

### All package manager bundles its own runtime
- **Kane-CLI no longer requires a separate Node install** — the Node 24 runtime and assurance-agent are bundled directly into Kane-CLI; Node 20 is now the minimum supported version.

## [0.8.2] - 2026-08-13

### Mobile workflows simplified
- **App upload, list, and download go direct** — these commands now call the API directly instead of going through the extra service hop.
- **`doctor --target` is now mandatory and singular** — the flag requires exactly one target; dependency status matches on bundle identity for accurate results.
- **Mobile test creation uses the correct route** — `mobile test create` now shows the correct Mobile category on test manager.

### Session and replay reliability
- **Device persistence and prepared-device reuse** — sessions now lock to their target, persist device selection across reconnects, and reuse prepared devices when available.
- **Scroll recording is replay-safe** — scroll-into-view actions are recorded as `SCROLL_UNTIL_ELEMENT` and written to the replay/export record so they survive round-trips.
- **JSON path in sub-check results is preserved** — `json_path` is now stored, so replay and export honor the original check structure.
- **Evidence steps show human-readable captions** — step labels in evidence output use descriptive text instead of raw locators or bare "Step N" strings.
- **Pause, crash, and held summaries include credits used** — these session-end states previously omitted credit counts; they are now reported correctly.

### Sharper assurance views
- **Coverage table is high-level again** — the main table lists only use cases and progress; detailed census data and commands have moved into the dossier, so the default output is scannable at a glance.
- **`--rollup` replaces `--aspect`** — the flag was renamed to match existing JSON vocabulary (`proven.aspect`) is unchanged.
- **Gaps view is now the coverage ribbon** — use-case bands show full-word progress bars on a shared grid; detail lives in the dossier.
- **New ContextBar** — a compact, status-first three-line bar sits behind a full-width divider and shows aggregated per-turn state; the transcript keeps one line per turn instead of accumulating duplicates.

### Review results you can trust
- **All-clear never claims proven without execution facts** — the review round no longer declares a use case proven on percentage alone; it requires an actual execution count.
- **Single-UC JSON closes over its own use case** — other entries are emptied so agent next-step suggestions can't leak commands from unrelated project use cases.
- **Dossier acceptance criteria sort numerically** — AC-2 now appears before AC-10 instead of sorting lexicographically.
- **ID columns cap at 16 characters** — long slugs no longer push column widths negative or break the layout.
- **Action commands in the dossier wrap at the label column** — long commands hang-wrap cleanly and never break mid-word at the terminal edge.
- **Review fold IDs never clip** — the id column is now dynamic; class columns fit every word; degraded classes keep their commands; `--stage` no longer reorders bands.

## [0.8.1] - 2026-08-12

### Mobile is now a first-class platform
- **Test against emulators and simulators** — device setup, persistent runner sessions, and evidence capture (screenshots, logs) all work end-to-end for mobile targets, mirroring what web automation already offers.
- **The AI understands mobile screens** — perception, accessibility tree inspection, vision coordinates, and code generation are all platform-aware; the model reasons about mobile UI the same way it reasons about web pages.
- **Replay works on mobile too** — recorded `.testmd` flows can be replayed against an emulator or simulator; the frontmatter now carries target vocabulary so the file knows what platform it belongs to.
- **Gestures re-read the screen mid-turn** — after a gesture tool acts during a run, the agent immediately re-reads the screen before continuing, so it works from a fresh view rather than a stale one.

### Discover devices and apps before you run
- **`devices list` and `apps list` commands** — see available devices and uploaded apps from the terminal before starting a session, so you can confirm your target exists without leaving the CLI.

### Faster, more reliable dependency downloads
- **Dependencies download in parallel with live progress** — instead of sequential fetches, all deps are grabbed at once; a progress indicator shows what's happening, and failures retry automatically.
- **Download errors surface immediately** — previously, non-404 errors from the download endpoint could be swallowed silently; they now appear in the terminal so you know exactly what went wrong.

## [0.7.2] - 2026-08-11

### Jira and Confluence ingestion
- **Ingest a Confluence page directly by URL** — `ingest <confluence-url>` pulls page content and images into kane-cli. Images are gated on your account's capabilities, and the canonical envelope is byte-deterministic so re-ingesting the same page never creates phantom versions. Space renames do not silently trigger a new version.
- **Jira ingests now carry comments** — comments are fetched with full cursor pagination and appended to the canonical envelope. If Jira setup has not been completed, ingest prints the Integrations URL so the fix is one click away.
- **Better error surfaces on the shared transport** — when the transport hits a 429, it retries with a bounded backoff. Wire errors map to clean codes and include the Integrations setup URL when relevant. Malformed attachments (raw bytes or base64 JSON) are handled tolerantly rather than failing the whole request.

### Reconcile gets remote sources and in-chat review
- **`reconcile --from` now accepts remote URLs** — remote sources are resolved through the provider table and use intrinsic identity, so conflicts are caught before anything lands rather than after.
- **Reviews happen inside the chat shell** — instead of a separate flow, reconcile review sessions appear as cards directly in the terminal: inline diff vs. summary, a diff panel with window markers, and offer/steer actions. Verdicts are written to a durable ledger alongside the proposal so the session survives interruptions.
- **Ctrl+C defers past an in-flight verdict** — pressing Ctrl+C during a reconcile review now waits for the current verdict to complete before exiting, avoiding corrupted state.
- **`--apply <path>` can no longer be hijacked** — a path passed explicitly always resolves to that path; it is never overridden by a mounted session.

### Diagnostics and observability
- **Automatic ingest triage with `fsck`** — a new triage telemetry layer (`ASR_FSCK_REPORT`) tracks identity and error-floor data, making it easier to diagnose silent failures in ingest and reconcile pipelines.
- **Windows logging is now UTF-8-safe** — log output on Windows no longer garbles non-ASCII characters (fixes kane-cli#149).

### Reliability fixes
- **Off-viewport assertions now anchor correctly** — full-page snapshots are taken so value and state assertions on elements scrolled out of view still pass.
- **Retry attempts are nested, not flattened** — `--retry` now tracks each attempt as its own entry rather than merging all retries into a single flat list, making run history readable.
- **Literal value templates recorded correctly** — the tape records the actual value template, not the checkpoint sentence that described it, so replays produce the right inputs.

## [0.7.1] - 2026-08-08

### Multi-source extraction and queued drain
- **Extract from multiple sources in one run** — each tracked with its own `source_id` and completeness record. Op-union (`keep`/`set`/`remove`) lets the same criterion be built from contributions across sources.
- **Queued drain: `extract --queued`** — pre-drawn work items are claimed from a durable queue and processed in budget-aware batches (`--budget n`; default 10 per composite root). Mirrored items complete without spending budget; a budget stop names the remaining queue and prints the exact command to continue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
- **Agent failures inside a queued batch no longer abort the whole batch** — a failed claim is recorded as `AGENT_ERROR` and the batch continues. Early exits (including pause) release claims cleanly.
- **`--queued` is incompatible with `--source`, `--resume`, and `--plan`** — kane-cli exits 2 immediately if these are combined, rather than producing a silent bad run.

### Trust gate and review surface
- **Unreviewed design targets now block extraction** — attempting to extract onto an unreviewed-derived design causes an explicit disclosure prompt (interactive: yes/no confirm; agent: exit 2 with a runnable review command in `next`; CI: exit 2). Pass `--allow-unreviewed` to bypass.
- **Duplicate hits go to a review queue instead of silently promoting** — an explicit match onto an unreviewed-derived target mints a new derived entry and records a durable `PAIR` card for review, rather than laundering a promotion.
- **One review walk covers REVIEW, PAIR, MODIFY\_HELD, and QFAIL cards** — all verdict types surface through the same interactive walk grammar. A feeder fault never blocks the reconcile walk.
- **Held archives require explicit consent** — `--verdicts` default holds rejected entries as non-destructive `pending_archive` facts (exit 0, loud summary). Destruction requires `--allow-archive --because <reason>`; CI refuses archives under any flag (exit 2, atomic). Structured flags `--approve`/`--skip`/`--defer` are the agent-mode surface.

### Durable sessions: pause, crash, and resume
- **Paused runs are fully resumable** — the session is written to disk from turn 0, before the agent spawns. A pause persists the checkpoint and releases locks cleanly; the printed resume command is always runnable.
- **Crashed runs exit 3 and name the resume command** — a crash no longer exits silently or leaves the session in an ambiguous state. Persist failures exit 1 and name the `sid` and sequence number.
- **Resume now reconciles store truth against checkpoint truth** — on `--resume`, committed work is read from the durable record (not recomputed), externally-verdicted rows are pruned and never re-presented, and foreign watermark conflicts are surfaced loudly with a typed error.
- **Wrong-verb resume is refused honestly** — `extract` no longer silently picks up a design session, and vice versa. Unknown-verb sessions (written by a newer kane-cli) get an honest no-command line rather than a fabricated hint.
- **`sessions list` and `sessions show` are verb-honest** — sessions written by a newer kane-cli version are shown with an honest unknown label rather than a guaranteed-refusal extract resume hint.

### Design phases and cite verification
- **Design now tracks phases durably** — each finalized design record carries `{phase, generation, completeness}`. `--phase <name>` on design tests lets a run enter at any phase; missing predecessors prompt interactively or exit 2 with a parseable `next` in agent mode.
- **Already-designed and stale-design gates convert to actionable asks** — interactive mode offers view/redesign/pick-another with impact pairs shown; agent mode exits 2 with structured `next` including `--force` and `evolve` rows; CI stays fail-closed. `--because` is required for redesign.
- **Cite verification runs before every design commit** — `validateCite` checks the pinned source version's citable text before appending a `DERIVES` edge. Failure routes through the existing repair channel as `CITE_UNVERIFIED`; sessions on older templates are byte-identical.

### New `coverage` / `gaps` surface
- **`--mode agent|ci` on coverage tests** — both modes ride the same NDJSON envelope as a decorator over one implementation. `--json` output is captured as a single `coverage/gaps` event; refusals emit an error event and exit 2. `next` contains the gap engine's ready commands, grammar-filtered, deduped, and capped.

### Headless and `--source` / `--resume` parity
- **`--resume --with-source` now works in headless mode** — headless runs have full parity with interactive runs for source-attached resume.
- **The `@` affordance in free-text options** — an option carries its associated text through the agent, so prefill and coverage work correctly end to end.
- **`--trust auto|hold` registered** — `auto` is today's derived auto-commit behavior (pinned); `hold` forces all new BUs into the review queue. Under CI, `--trust hold` exits 2 with nothing executed.

### Fixes
- **Dedup probe now uses the run's live auth** — a stale bearer token was causing commit-moment 401s off-CI, holding every new BU across sessions. The probe now resolves credentials the same way the driver does.
- **`prefill` holds by question identity and never auto-submits** — a question that was already answered is not re-asked; a prefilled answer is not submitted without user confirmation.
- **No-proposal terminal under `--queued` no longer re-queues forever** — a clean done with no proposal now records `NO_PROPOSAL` and continues the batch rather than re-queuing the item with attempts unchanged.
- **Answered-question filter covers both the annex and session ledgers on resume** — a crash at an ask no longer re-asks the same question after resume.
- **`MODIFY_HELD` approve no longer fabricates provenance** — cites are verified against the pinned source before any held-update verdict is applied.
- **Verb/template mismatch is now detected at bind time** — a design conversation that echoes a valid `extract@5` binding no longer renders the extract prompt and tools under clean digests. Kane-cli exits 2 with `CONTRACT_DIGEST` mismatch.
- **`--resume` never re-fires the design-entry trust gate** — a session that passed the gate at entry is not re-prompted mid-journey.
- **`sessions list` review walk no longer crashes on review cards** — `WalkCard.impact` is now a legal union; all three readers guard by shape and render the review preview correctly.

---

## [0.7.0] - 2026-08-05

### A rebuilt Autopilot — faster, and on by default
The engine that drives the browser toward your objective has been rebuilt from the ground up, and it's now the default for every run.
- **Runs are faster and more efficient, at the same success rate** — Autopilot now works over a single ongoing conversation and pulls only the page details it needs at each step, instead of re-uploading the full page and a fresh screenshot every time. Runs finish quicker and typically consume fewer credits.
- **Whole forms fill in one planning pass** — when several fields sit on the same page, Autopilot plans the entire fill from a single look and executes the steps without stopping to reason between each field. A long checkout or signup that used to spend a full reasoning cycle per field now completes in a handful.
- **Clicks land more accurately** — click actions are now aimed at the element's real on-screen position, reducing misclicks on overlapping or offset targets.
- **Native date, time, color, and range inputs just work** — Autopilot understands how browser-native input controls behave, so it sets them directly instead of thrashing segment-by-segment and burning steps.
- **Exported tests self-heal when the UI drifts** — tests authored in this mode carry stronger auto-healing: when a saved selector no longer matches on replay, Autopilot re-locates the element the same way it originally found it, so replays survive layout and markup changes more often.

### Assertions and value checks that read the real page
The step that verifies an expectation or extracts a value — "cart total is under $50", "save the order id" — no longer commits to a strategy before the page loads.
- **Checks are decided on the live page, not planned blind** — kane-cli inspects the actual page at verification time to work out how to confirm your expectation, so fewer checks fail for the wrong reason.
- **Every check self-verifies before it's recorded** — the analyzer runs its own extraction, sees the real value and a pass/fail preview, and revises — a different element, a JavaScript probe, or a visual fallback — if the result looks off. A check only commits when the value is actually plausible, which cuts down on confident-but-wrong verdicts.
- **You describe the expectation in plain language; kane-cli works out the rest** — thresholds, "under/over," presence vs. state, and unit conversions are derived from your wording against the real value, instead of brittle exact-match comparisons or mis-picked units.
- **Multiple checks on one page run in a single pass** — assertions that can be answered from the same page state are batched together, making multi-assertion steps faster and more consistent.
- **Value checks heal on replay** — when a recorded extraction drifts, it's re-anchored from the last known-good version against the fresh page instead of regenerated from scratch, so checks keep working after UI changes.
- **`if`/`else` branches follow the check result correctly** — a conditional step now takes the branch the check actually resolves to, fixing a case where the wrong path could be taken.

### One warm browser for your whole run
The execution engine now runs on a single persistent runner process and one long-lived browser per session, instead of relaunching and reconnecting for every objective.
- **Multi-run and multi-step sessions start faster** — the runner and browser are launched and connected once per session, not once per run, so cold-start and reconnect overhead between runs is gone.
- **Multi-tab and popup flows stay intact between steps** — because the browser is never disconnected mid-run, tab order, newly opened tabs, and popups created in one step are still there in the next. Flows that open a tab, switch, and come back now behave reliably instead of acting on the wrong tab.
- **Session state carries across steps** — cookies, localStorage, clipboard, and captured variables set earlier in a run persist into later steps, matching how the test behaved when it was authored, so replays are more faithful.
- **Each run still gets its own scoped context** — inputs, config variables, and secrets are applied per run, so runs sharing the process never bleed into each other.
- **Evidence is unchanged** — each run still writes its own screenshots, console, and network logs into the same sealed evidence pack you already rely on.

### Fixes that ride along
- **Per-run config variables merge correctly** — each run's own captured variables take precedence as expected; a stale field that could drop merges has been removed.
- **Secrets reach the runner every run** — secret-typed values are exported into the runner's environment per run, so secret fields fill in correctly instead of coming through empty.
- **`ask_user` prompts are isolated per run** — the prompt response queue is drained per run and reads are bounded, so a prompt from one run can no longer block or corrupt a later one.
- **Cleaner shutdown** — the runner exits gracefully before the browser is closed, preventing crashes or orphaned processes at the end of a session.

## [0.6.11] - 2026-08-04

### Ingest from Jira
- **Paste a Jira URL to pull in an issue** — `kane-cli ingest <jira-url>` fetches the issue and its attachments (including images) directly from Jira as a remote source, no local file download required.
- **Project access is enforced before fetching** — only issues in projects your account is permitted to use are accepted; unauthorized requests are rejected up front with a clear message.

### More Reliable Tab Switching
- **Click-then-switch-tab sequences no longer race** — when a click opens a new tab, replay now waits for the tab-open popup to resolve before executing the `switch_tab` step, preventing the tab from being missed in multi-tab flows.

### Code Export and Codegen Fixes
- **Frame context uploads correctly under the v4 code-export contract** — frame info is now sent as a bare list, matching what the export service expects.
- **`frame_info` is correctly scoped to `wait_until` click and scroll steps** — codegen no longer applies frame context where it doesn't belong.

---

## [0.6.10] - 2026-07-31

### Automated plan execution
- **Sub-flows now run back-to-back automatically** — every recorded sub-flow executes in a single spawn, so a multi-step plan runs end-to-end without manual re-triggering.
- **Negative-verdict verification** — failing checkpoints are now verified against stored memory before surfacing, reducing false failures.

### .docx files are now supported
- **Upload and analyze Word documents end-to-end** — .docx files are unpacked, their text projected deterministically, and images inventoried and delivered alongside PDFs and other formats.
- **Image references inside .docx work in prompts** — images extracted from Word documents carry their citation references into the model, so `probe` and visual checks work the same as with other file types.

### Run UI polish
- **Question panel shows one question at a time** — the question panel (WP5) now uses ruled lines, keyboard-navigable chips, and free nav, so the prompt is never buried in noise.
- **Panels have cleaner visual structure** — bordered boxes are removed everywhere; column-0 rules and a single content edge replace the previous multi-border layout (WP5b).
- **Blank-line rhythm is consistent** — stanza openers, panels, and tool-burst labels all follow a defined spacing contract; the context bar now has one blank line of breathing room above it.
- **Table content is always readable** — table headers are bold in the foreground; row content is foreground color and never dimmed.

### Observability and telemetry
- **Run events are traced end-to-end** — session IDs, turn captures, tool calls, and timings are correlated across the run
- **Crashes leave a dead-letter record** — unhandled exits spool a dead-letter entry so failures don't disappear silently.
- **Telemetry is zero-cost when disabled** — context binding for store-creating verbs is deferred until needed, and no disk writes happen when telemetry is turned off.

---

## [0.6.9] - 2026-07-29

### More ways to feed context into test generation
- **Markdown files work as attachments in `generate`** — pass `.md` files (docs, specs, notes) directly when generating tests, instead of converting them to another format first.

## [0.6.8] - 2026-07-28

### A new options-first design surface for assurance
- **Composer and slash palette are gone** — the new options-first surface replaces them with a shared panel family; answers, recommendations, and multi-select actions are all reachable from one place without typing slash commands.
- **Question panel shows your picks and lets you act on them in bulk** — visible selections, real multi-select, and a `» Go with recommendations` batch action (reachable via **Tab**) make answering faster on long option lists.
- **Design check-in is phase-aware** — the headline updates per phase, labels switch between "Design view" and "✎ Edit", and a "Continue to next" prompt appears at the right moment instead of leaving you to guess what comes next.
- **Typed answer API with go-with-recommendations** — answers are now strongly typed end-to-end; accepting the recommended set is a single action rather than manual selection.

### Chained design runs that actually work
- **A chained design can ask questions and be steered mid-run** — the nested run channel carries the conversation forward; the child run no longer parks silently on IDLE.
- **Re-design is now an explicit act** — a chained child narrates its progress and asks as expected; re-entering design mode requires a deliberate step, not an accidental state.
- **Extract-design chaining has a full picker and ask-again loop** — the picker, bridge, and ask-again flow are wired together so you can keep refining without restarting.
- **Bar returns to the session after a chained run** — the status bar correctly resumes on the parent session once the child finishes; the ask-again path can also open the view.

### Gaps becomes a dual-axis tree
- **Gaps now shows designed vs. proven as separate axes** — the nested tree splits coverage into what's been designed and what's been execution-proven, so gaps are visible on both dimensions at once.
- **`--json` and `--from` flags now reach the subcommand** — a parent-level flag-stealing bug is fixed; both flags work correctly when passed to `gaps`.
- **Risk-first ordering throughout** — tables and item lists sort by risk weight, so the most consequential gaps surface first.

### Stable IDs and richer test identification
- **Every node gets a sequential ID, visible everywhere** — sequential per-kind logical IDs are minted at all four creation points, so rows, items, and test files all carry consistent, human-readable identifiers instead of fabricated labels.
- **Failing rows name the sealed test by ID and basename** — when a row fails, the display shows the real test ID and file stem; names are never fabricated.
- **Descriptive test-file stems** — generated test files are named from the test's logical identity, making them easier to find in your file system.
- **Sticky display names with reserved namespace and case tolerance** — display names persist correctly across state transitions and handle mixed-case input without collision.

### Dossier and graph views
- **Full dossier view across the graph seam** — an all-info dossier surfaces every relevant fact for a node, including chain-union evidence and live-successor status.
- **Scoped explorer opens on the state's minted items** — when you open the explorer from a given state, it starts on that state's items rather than the full list.
- **Dossier actually loads under ESM** — a `require` call under an ESM module was silently breaking the dossier; fixed.

### Accuracy and display fixes
- **Unchecked checkboxes no longer render as `[checked]`** — CDP tri-state normalization now correctly distinguishes unchecked from checked.
- **Receipts stay in the chat gutter** — wrapped receipt lines no longer snap to column 0; they hang correctly in the gutter margin.
- **Agent prose-stop mid-design is not treated as completion** — if the agent stops writing mid-design, the reply-first panel appears instead of the run being silently marked done.
- **OR checkpoints wait for every required store key** — previously only the first key in an OR checkpoint was awaited; all keys are now required before the checkpoint clears.
- **Formula pipeline is consistent** — window cuts apply before failure attribution; nameless nodes never render a cell ID; the latest-only cut is honored in strict-mode failure checks.

---

## [0.6.7] - 2026-07-27

### PDFs as test sources
- **PDFs can now drive test runs** — a PDF supplied as `run_config.source` is ingested, converted to a structured projection, and delivered with a complete content inventory so the AI knows exactly what it received.
- **Embedded images inside PDFs are fingerprint-verified** — each image extracted from a PDF is hashed at ingest, its fingerprint is checked through staging and delivery, and its origin page is tracked; the AI can cite specific images by reference (e.g. `img#1`).
- **Payload size is enforced at the gate** — if a PDF's serialized payload exceeds the size contract, it is blocked before reaching the runner rather than failing mid-run.
- **PDF dependency moved out of core** — the PDF converter is now a separate module; projects that don't use PDFs are unaffected.

### Accurate cross-frame browser capture
- **The agent now sees content inside iframes correctly** — each frame is captured independently with its own tree and the content is no longer misattributed across frames.
- **Frame identity uses DOM ownership, not position** — frames are matched by their actual DOM owner relationship rather than by positional index.
- **API steps work inside frames** — `execute_api` actions are now routed correctly through frame-qualified grounding, enabling API-type test steps.

### More reliable chat edits and session handling
- **A chat edit that fails to commit now reaches the agent as a held receipt** — previously a failed commit could be silently dropped; the agent now sees it and can respond.
- **Edit-op payloads are validated against the topology descriptor** — malformed chat edit operations are caught early, before they can corrupt session state.
- **Edit hints now cover all field labels** — guidance is only shown for genuinely unknown fields, and non-dict payloads are repaired rather than rejected outright.
- **Session-end distill now applies its own record** — the distill step that runs at session close correctly writes its own record; the file-system check no longer flags the brief lag between write and check as an error.

### Cleaner migration output
- **Migrated runs emit `UPLOAD_FILE` in the correct format** — the migrator now correctly outputs the `UPLOAD_FILE` step instead of a misnamed variant.

---

## [0.6.6] - 2026-07-24

### Local files travel with your test
- **Upload local media, replay anywhere** — local files are uploaded to the cloud media store so that replays work on any machine without manual file provisioning.
- **Media config flows through the full run** — media configuration is now passed into the runner and threaded through the session manifest, so replay picks up the right assets automatically.

### Bundled Node runtime
- **kane-cli now ships its own Node runtime** — the runtime is bundled per platform (`kane-cli-node-<platform>`) so kane-cli works without requiring a separately installed Node version.
- **Automatic runtime resolution** — kane-cli resolves the bundled runtime first; if the platform package isn't present it falls back to the system Node, with a clear warning.
- **Windows extraction fixed** — Node tarballs and zip files are now correctly extracted on Windows (Git Bash / GNU tar edge cases resolved).

### Replays more reliable
- **Scroll actions recorded and replayed correctly** — scroll-into-view is now a first-class recorded step with generated code, tracer output, and correct replay behavior.
- **Failed DOM locator attempts skipped on replay** — previously recorded failed locator attempts are now skipped rather than re-attempted, avoiding spurious replay failures.

### Evidence trace back
- **Pure-replay result carries the original commit ID** — replays no longer generate a fresh session ID, so results trace back to the authored commit correctly.

---

## [0.6.4] - 2026-07-20

### A reconcile workflow that actually converges
- **`--plan` previews without editing** — running with `--plan` records the change and stages the work; nothing in the suite is touched until you explicitly apply it.
- **Resuming a pending plan works** — the same `reconcile` command picks up where it left off, supersedes plans that have since moved, and never silently does nothing.
- **Pass in your own file** — `reconcile --from <file> --source-id <id>` accepts an explicit source instead of guessing slugs, with fail-fast validation before any work begins.
- **One vocabulary everywhere** — ADD / MODIFY / ARCHIVE mean the same thing across rows, changesets, wire output, and artifacts, so there's no ambiguity about what reconcile intends to do.

### Honest change detection and impact preview
- **Change detection runs against live edit pairs** — the evaluation covers 12 real edit-pair cases so staleness decisions are grounded in observed diffs, not heuristics.
- **Impact walk surfaces the real cost upfront** — before committing anything, the preview shows which tests are affected and what debt would be introduced.
- **Evolve explains itself** — when a test is marked stale, the reason is recorded; `evolve` now returns control to the CLI after finishing so the loop is scriptable.

### Agent and CI modes
- **`reconcile --mode agent` streams NDJSON** — the W3 stream lets CI and tooling consume reconcile output line by line; pause state is stored in the plan artifact across restarts.
- **CI mode fail-closes on high-risk rows** — when running non-interactively, rows flagged as high-risk cause an immediate failure rather than a silent skip.
- **`ingest --as lineage` guards multi-file input** — passing multiple files shows a TTY-friendly suggestion to prevent accidental bulk ingestion.

### Fixes that matter in the field
- **Held citations are re-verified before commit** — `commitHeldRows` checks cited locations against the current head, not the snapshot from when the plan was created.
- **`--apply --from` persists the recomputed plan** — the plan is saved and marked back after recompute so a subsequent run sees the correct state.
- **URL extraction keeps the full URL** — a bug that was truncating URLs during extraction is fixed; slicing now happens only in `code_js`.
- **`--skip-code-validation` is honored on the CLI run path** — the flag was previously ignored when running via the CLI; it now suppresses validation as documented.
- **Step-produced variables cross `testmd` step boundaries** — variables set in one step are available to later steps in the same run.
- **Citation relocation handles benign line shifts** — shifting a source file by a few lines no longer incorrectly flags citations as stale.

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
