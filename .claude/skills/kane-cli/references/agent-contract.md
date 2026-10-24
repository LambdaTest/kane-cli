<!-- kane-cli skill reference: the agent contract for a folder linked to a shared project (kane-cli 0.10.0+). Which agent flag each command takes, the NDJSON shapes, every event, `next`, exit codes, and every refusal code with what to do. Internal parsing reference: never show event or field names to the person. -->

# Shared projects: Agent Contract

A folder is **linked** when `.testmuai/assurance.json` names a TestMu AI Test Manager project and the folder has no `.context/`. In a linked folder the commands below work in the **shared project**, so the team sees what each person saves. Link a folder with `kane-cli context ingest <files> --project <id> --mode agent` (or `kane-cli context extract --project <id> --mode agent`, or, where `kane-cli context pull --help` lists `--project`, `kane-cli context pull --project <id> --mode agent`); find the id with `kane-cli projects list --search <name> --agent`. In a folder with neither a link nor `.context/`, `--mode agent` without `--project` goes on locally without asking, as before: `context ingest` makes a local store, and `context extract` refuses `NO_STORE` until one exists.

| Area | Commands |
|---|---|
| Projects | `kane-cli projects list`, `kane-cli projects create` |
| Sources and use-cases | `kane-cli context ingest`, `kane-cli context extract`, `kane-cli context list` |
| Sessions | `kane-cli context sessions`, `kane-cli context sessions save <sid>`, `kane-cli context sessions discard <sid>` |
| Tests | `kane-cli design tests`, `kane-cli maintain evolve`, `kane-cli maintain reconcile`, `kane-cli context pull` (`shared-projects.md` §7) |
| Runs and coverage | `kane-cli testmd run <designed>_test.md`, `kane-cli testrun run`, `kane-cli cover` |

Nothing reaches the project until `kane-cli context sessions save`. Other assurance commands are refused in a linked folder (`REMOTE_UNSUPPORTED`, §6). Local-store parsing stays in `references/assurance-parsing.md`.

## 1. Which flag

| Command | Agent flag | The wrong one does |
|---|---|---|
| `context ingest`, `context extract`, `context list`, `context sessions` (list, save, discard), `design tests`, `maintain evolve`, `maintain reconcile`, `cover` | `--mode agent` | `--agent` is an unknown option: prose on stderr, no NDJSON, non-zero exit |
| `testmd run` | `--agent` (`--mode agent` works too) | — |
| `testrun run` | `--agent`, or stdin not a terminal | `--mode agent` is refused: `error` `USAGE` + `done` (exit 2); nothing runs |
| `projects list`, `projects create` | `--agent` (or stdin/stdout not a terminal) | `--mode agent` is refused the same way |
| `install skill` | none: with stdin not a terminal it prints one JSON line | `--agent` is an unknown option (exit 1); `--mode agent` is `USAGE` (exit 2) |

- **Stderr.** Only a command line holding `--mode agent` keeps stderr free of the "Skill update available" and "Update available" banners. Under `--agent` those lines can appear on stderr, and `testrun run` also writes its coverage lines and `kane-cli evidence serve` hints there. Parse stdout only; a stderr line is not a failure.
- **No flag, no terminal.** Linked `context extract` and `design tests` refuse with a stderr line (exit 2). Linked `context ingest` falls back to land-only: it uploads, prints text lines and leaves the session paused. Always pass the flag.
- **Modes to avoid.** `--mode ci` on linked extract, design or reconcile is refused as a stderr line (exit 2), even with `--json`. `--json` with `--mode agent` is refused as a stderr line (exit 2). `--mode override` answers every question with its recommended option: never use it for the person.
- **Usage errors.** With `--mode agent` anywhere on the command line, a parse error arrives as `error` `USAGE` + `done{refused, 2}`; `--help` and `--version` print only a `done` line.

## 2. Stream shape

**Assurance stream** (`context …`, `design tests`, `maintain …`, `cover`): one JSON object per line, envelope `{"type": "<name>", "v": 1, "verb": "<verb>", …}`. No `stream_start`, and don't rely on a `ts` field here. Verbs: `sync` (`context pull` in a linked folder; refusals of its flags and at its entry carry `pull`), `extract` (ingest and extract; `reconcile` from the upload on when the ingest is a new version of a source the project holds), `design`, `evolve`, `reconcile`, `save`, `discard`, `cover`. Refusals of `context sessions` (list, show, clean) are stamped `save`, and those of `context list` are stamped `list`.

**Run stream** (`testmd run`, `testrun run`): opens with `stream_start {cli_version, surface, pid}`; every line carries `v` and `ts`. Shapes: `references/testmd.md`, `references/testrun.md`; linked-folder additions in §3.7.

| Command (agent flag) | First line | Last line |
|---|---|---|
| `context extract` | `folder_linked` (with `--project`), else `nothing_new`, `warning` or `remote_connect` | `done` |
| `context ingest <refs>` | `folder_linked` (with `--project`), else `remote_fetch` (an address) or `remote_upload` (a file); a refusal is `error` | `done` |
| `design tests` | `remote_connect` (or `warning`, `error`) | `done` |
| `maintain evolve` | `remote_connect` | `done` (may carry `not_updated`) |
| `maintain reconcile` | `remote_upload` or `remote_fetch`, else `remote_connect` | `done` |
| `context sessions save <sid>` | `session_save{phase:"check"}`; `phase:"saving"` for a session saved before; `phase:"saved"` with `saved: 0` when it added nothing (or `error`) | `done` |
| `context sessions discard <sid>` | `session_discard{phase:"check"}` (or `error`) | `done` |
| `context pull` (linked, or `--project`) | `folder_linked` (with `--project`), else `pull_test` or `error`; a project with no tests sends `done` alone | `done` (`shared-projects.md` §7a) |
| `cover` | `coverage` | `done` |
| `testmd run <designed test>`, stopped on its Test Manager case | `stream_start` | `error` (no `test_md_done`) |
| `testrun run`, refused | `stream_start`; then `error` before any plan for `--from-context` in a linked folder; else `testrun_plan` | `PROJECT_MISMATCH`: `error`, the last line outside a linked folder. Another invalid plan, or no tests: no `error`, the stream ends at `testrun_plan` (read the exit code). **In a linked folder only**, from the release that carries the fix, every one of these (`PROJECT_MISMATCH` too) ends `error` then `testrun_done{overall_status:"refused"}` (the `--from-context` refusal still ends on its `error`); handle both shapes. Everywhere else these shapes don't change |

Outputs that are **not** the envelope and have **no `done`** (read the exit code):

| Command | Stdout on success |
|---|---|
| `projects list --agent` | `{"id","name"}` per project, then `{"_meta":"page","limit","offset","returned","has_more"}`. Errors are plain text on stderr, with no code |
| `projects create "<name>" --agent` | one line `{"id","name"}`. Errors on stderr. It does not link the folder |
| `context list --mode agent` | one bare object per row: `{id, label, title, trust, fresh, tests_fresh?, next?}` (`trust: "derived"` = proposed, not approved yet; `"trusted"` = approved: say *proposed* or *approved*, never the value); `--undesigned` adds `designed: false`; nothing at all when nothing matches |
| `context sessions --mode agent` | one line holding a JSON array of `{sid, verb, subject, title, state, added, updated?, last_activity_at, owner}` |
| `install skill` (stdin not a terminal) | one line `{"type":"skill_install_result","status":"installed"\|"already-installed"\|"failed","version","installed_targets","error?"}`; exit 1 only on `failed` |

Refusals of `context list` and `context sessions` do use the envelope: `error` + `done`.

Dispatch on `type`, never on position. **The vocabulary is open:** tolerate unknown event types and unknown fields. A stream that should end in `done` and doesn't means the process died: check `kane-cli context sessions --mode agent` before retrying anything paid.

## 3. Event catalogue

"Tell the person" is plain words. Never show event or field names.

### 3.1 Linking and loading (every assurance verb)

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `folder_linked` | `--project <id>` linked the folder in this run; the first line | `project_id`, `project` | "This folder is now linked to <project>; what you save goes there." If the run then ends `PERMISSION_REQUIRED` or `ASSURANCE_OFF`, or a `context pull --project` is refused at the start or can't read the project, the link was removed again |
| `folder_local` | `--local` gave the folder its own store; `extract` then ends `done` exit 0 (ingest goes on locally) | `gitignore`: `added`, `failed`, null | "This folder keeps its own local store." On `failed`: `.context/` wasn't added to `.gitignore` |
| `nothing_new` | a plain `extract` found every source already read; no session opened; exit 0 | `reason`: `every_source_read`, or `sources_in_a_session` with `open_sessions[{sid, owner, state, added}]`; `next` | "Nothing new to extract" / "every source is already in an open session"; offer `next` |
| `remote_connect` | `step:"connect"`, then `step:"open_session"` once the session exists | `sid`, `project` (on `open_session`) | "Connecting to <project>." Keep `sid` |
| `remote_load` | the project's history loads | `part` (`project`, `project_ready`), `percent` (may be null) | fold into one progress line |
| `remote_fetch` | an address or item is fetched on this machine, before upload | `ref`, `provider` (`web`, `jira`, `confluence`, `linear`, `linear-doc`) | "Reading <ref>" |
| `remote_upload` | a file goes up before the session opens: 0%, per chunk, 100% | `file`, `percent` | one line per file |
| `remote_retry` | waiting on the shared project | `attempt`, `next_in_s`, `give_up_in_s`, `cause` (`unreachable`, `not_ready`, `timeout`) | "The shared project isn't answering; retrying." Let it run |
| `remote_overlap` | a new session opened while others are open on the same subject | `sessions[{sid, owner: you\|someone_else\|null, state, added, next?}]` | name the other sessions; offer the resume `next` on the person's own; this run goes on |
| `run_start` | the run starts | `session` = the shared project's session id (not a support id); no log path | — |
| `warning` | a non-fatal condition | `message`, `code?` | relay it |

### 3.2 Ingest, extract, review, evolve

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `ingested` | each item lands in the session | `source_id`, `status` (`created`, `versioned`, `unchanged`), `behind?`, `unread?`, `media?`, `duplicate_of?`, `origin?`, `warnings?`; no `cid` | "Added <file> to this session" / "a new version" / "already in <project>, unchanged" |
| `commit` | the agent's items land in the **session** | counts, `minted[]` | "N use-cases proposed in this session, not saved yet" |
| `held` | items held back | `reason`: `duplicate_check_reduced`, `review` | "N items are held for review" |
| `usage` | each agent turn | `credits`, `total_credits` | report the final total |
| `review_cards` | a new version's review holds its cards, before a `review_pending` pause | `source`, `cards[{key, kind, use_case?, title, change, diff?, tests?}]` | show each change; ask approve, reject or defer |
| `card_verdict` / `card_refused` | an `--answer <key>=<verdict>` landed / didn't | `key`, `verdict`, `line`, `offer?{kind, key, title}` / `code`, `refusal` | relay `line` or `refusal`. `offer.kind: "evolve"` runs at once (`child_start` … `child_end`); `offer.kind: "design"` does **not** run: after the save, offer to design that use-case's tests (`kane-cli design tests --use-case <uc> --mode agent`, its id from `kane-cli context list --mode agent`) |
| `evolve_paused` | evolve asks once per use-case; exit 3 | `pending_questions[]` (id `evolve:<uc>`), `next` (update all, leave all out) | present the blast radius and ask (`references/assurance.md` §11) |
| `child_start` / `child_end` | a design run inside a review or an evolve | `child`, `subject` / `ok`, `exit_code`, `next?` | "Designing tests for <uc>… done" / "didn't finish" |
| `evolve_skipped` | a use-case evolve leaves alone | `use_case`, `reason` (`no-design`, `source_changed`, `up_to_date`, `archived`, `unreviewed`, `held`, `declined`), `held_by?`, `next?`, `remedy?` | the reason in words; offer `next` |
| `session_complete` | the run finished; **nothing is saved yet** | `sid`, `next` (save, then discard), `no_start_page?[{test}]` | "Done. Save it to <project>?" Name tests with no start page. No `next` = it added nothing and was discarded. On a resume of a finished run whose ending was never recorded, `next` is the save alone |
| `session_ended` | the session was saved or discarded in another terminal; exit 0 | `sid`, `reason`: `saved_elsewhere`, `discarded_elsewhere`, `ended_elsewhere` | say where it went; nothing to do |
| `error` | a refusal or failure | `code?`, `message`, `remedy?`, `next?`, `held_by?`, `not_added?[]`, `final?` | §6 |
| `done` | always last | `status`, `exit_code`, `next?`, `not_updated?` (evolve) | §4, §5 |

### 3.3 `session_paused` (exit 3)

Every pause has `sid`, `expires_at: null` and `pending_questions[]` (empty unless questions wait); most carry `resume` (the exact command). Branch on `reason`:

| `reason` | Means | `next` | Do |
|---|---|---|---|
| none, questions pending | the agent asks the person | resume; resume with `--answer <qid>=<n>` | the pause loop (`references/assurance.md` §2) |
| none, no questions | a forced stop (second Ctrl+C), or a stop during an evolve | resume | resume when the person wants |
| `held_back` | `--trust hold` held items | — | tell the person; nothing promises they come back on a resume |
| `connection_lost` | the connection dropped, or the ending couldn't be recorded | resume | resume once the network is back |
| `not_accepted` | the shared project refused a step | resume | resume once; then ask for help |
| `computer_slept` | this machine slept over 2 minutes | none | run `resume` when the person wants |
| `resumed_elsewhere` | the session was resumed in another terminal | none | leave it; it goes on there |
| `review_pending` | review cards wait (`pending_cards[]`) | resume with `--answer <key>=approve` … | ask per card: `approve`, `reject` or `defer` |
| `review_decided` | every card was decided, then a stop | resume | resume to finish the review |
| several sources read (`not_named?[]`, no `resume`) | an extract that read 2+ sources paused | discard; start again | it can't be resumed or saved: tell the person, discard on their word, then extract one source at a time |

### 3.4 Save and discard

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `session_save` `check` | first: what the save would land | `sid`, `project`, `adds{use_cases, acceptance_criteria, scenarios, tests, open_questions, sources, style_notes}`, `changes?`/`approves?`/`archives?`/`removes?`, `held_changes?`, `replaces?`, `marks_up_to_date?`, `other_work?`, `not_updated?[]` | "Saving adds N use-cases and M tests to <project>." Without `--yes` the command stops here (`CONFIRM_REQUIRED`): show this preview and get the person's word |
| `session_save` `saving` | the save is sent | `sid` | — |
| `session_save` `saved` | landed | `saved` (records landed; `0` = nothing to save, and the session was discarded), `test_manager`, `test_files`, `next?` (evolve what is still out of date) | "Saved to <project>", then the two blocks below |
| `session_save` `behind` | a later save changed what this session touched; exit 2, no `error` | `conflict?{kind, id, title}` or `{kind:"link", from, to}`, `next` | "Another save changed <title>; nothing was saved." Offer `next` |
| `session_save` `failed` | the project refused the save; exit 1, no `error` | `reason:"not_accepted"`, `code?` (`SCOPE_RECORD_REFUSED`) | "The project refused the save." Don't retry; ask for help |
| `session_discard` | `check` (the same counts), then `discarded` | `sid`, `adds?` | "Discarded; nothing was saved." An already-discarded session gets `discarded` alone (exit 0) |

`test_manager` (when the project's Test Manager takes the cases): `total`, `created`, `updated`, `already_there`, `waiting` with `waiting_on[{scenario, title, reason}]` (`changed_both_sides`, `not_pushable`, `archived`, `busy`, `not_accepted`), `next_run[{scenario, title}]` (written by the next `testmd run`), `not_covered?[]`, `error?`, `support_id?`, `next?`. Tell: "N test cases created and M updated in Test Manager"; name what waits and why.

`test_files` (design, reconcile and evolve sessions): `written[]` (paths in `.testmuai/tests/`), `refused[{test, title, reason, file?}]` (`reason` is prose; a file edited by hand is kept), `replaced?[]` (files of tests this save replaced: they stay in the folder, won't run any more, and a bare `testrun run` still picks them up; tell the person, and offer to move them out of `.testmuai/tests/`), `variables_needed?{file, variables}`, `no_start_page?[]`, `next?`; or `{written: [], refused: [], error: "TEST_FILES_NOT_WRITTEN", next}`. Test files are written **only** by the save, only in the folder where it runs. Tell: "Wrote N test files." Fill `variables_needed` before any run.

### 3.5 Design

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `gate_refused` | design entry refused: unknown, removed or not-a-use-case ref; or the use-case already has tests, or changed since | `message`, `final: true`, `next?[{cmd, why, title}]`; **no `code`** | relay `message`; offer `next` (`Redesign` = `--force`) |
| `error` `UC_UNREVIEWED` / `UC_ARCHIVED` | the use-case is proposed / archived | `message`, `final`, `next?` | §6 |
| `commit`, `usage` | as §3.2 | | "Designed N tests in this session, not saved yet" |
| `variables_declared` | the tests need variables | `file`, `variables[]` | a to-do; the stubs are this folder's only |
| `note`, `panel_resolved` | a resume with `--answer` | `text` / `id` | confirmation only |
| `session_paused`, `session_complete` | as §3.2–3.3 | | |

### 3.6 Cover

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `coverage` | `cover --mode agent` | `source: "project"`, `pct`, `usecases`, `criteria`, `perUc`, `perAc`, `flags`, `recent_run?{may_not_count_yet: true, up_to_minutes: 5}` | "Coverage is N% across <project>'s K use-cases." With `recent_run`: "a run from the last 5 minutes may not count yet" |
| `coverage` (computing) | the project is still working it out; exit 0 | `{source: "project", state: "computing"}` | run `next` (`kane-cli cover --mode agent`) in a moment |
| `done` | last | `next?`: designs to make, `testrun run` while nothing has run; `kane-cli context pull --mode agent` first (and no run) when the project has designs and this folder has no designed test files yet | offer them, adding the agent flag (§4) |

### 3.7 `testmd run` and `testrun run` in a linked folder

A file directly in `.testmuai/tests/` with an `assurance:` header runs on its scenario's Test Manager case. Its first run authors (about 30–85 credits per test, approximate); later runs replay.

| Event | When | Fields that matter | Tell the person |
|---|---|---|---|
| `error` (testmd) | the case lookup or attach stopped the run | `code`, `message`, `remedy`, `support_id?`; no `next`, no `test_md_done` | §6, runs of designed tests |
| `error` `TEST_RUN_NOT_SAVED` (testmd) | before `test_md_done`; the verdict stands | as above | report the verdict; exit 1 even when steps passed |
| `testrun_plan` | the plan | `members[{path, test_id, failure?}]`, `valid` | on 0.10.0 an invalid plan other than `PROJECT_MISMATCH`, or no tests at all (`members: []`), has **no `error`**: read each `failure` |
| `error` `NO_TESTS` | *(linked folder only, from the release that carries it)* no `*_test.md` selected | `message` "no tests here yet", `next` | `next` is `kane-cli context pull --mode agent`. A filter that matches nothing: the old message and no `next`. Outside a linked folder there is no such event: the stream ends at `testrun_plan` with `members: []` and exit 2 |
| `error` `PLAN_INVALID` | *(linked folder only, from the release that carries it)* an invalid plan other than `PROJECT_MISMATCH` | `offenders[{path, failure}]`, no `next` | fix those tests or leave them out. Outside a linked folder: read `testrun_plan.members[].failure` |
| `error` `PROJECT_MISMATCH` | after `testrun_plan` | `projects[{project_id, name, this_folder, tests}]`, `remedy`, `next` | §6 |
| `testrun_member_end` (`testrun_authored_member_end` for a test's first run) | each member | `status`, `failure?{message}`, `log_path` | a member stopped on its case shows only `failure.message`; its `error` (with `code` and `remedy`) is in the member's log at `log_path`, or inside `testrun_member_event` with `--stream-members` |
| `coverage` | after the evidence ingest | `status` (`written`, `none`, `skipped`, `failed`); `written`: `computed_by: "project"`, `pct`; `none`: `reason` (`on_grid`, `project_no_answer`) | "This run reached N use-cases." `none`: the project didn't answer in time; the run is fine |
| `testrun_done` | last (local run) | `overall_status` (`passed`, `failed`, `cancelled`; `refused` after a refusal, in a linked folder only, from the release that carries it), `coverage?` | the verdict |
| `remote_error` (`--remote`) | one per member that stops before dispatch | `code`, `detail` (`<path>: <message>`), `remedy?`, `support_id?`; no `next` | nothing was sent to HyperExecute; `testrun_done{overall_status:"failed"}` and `remote_done{status:"failed", exit:2}` follow |

## 4. `next`

Shape: `next: [{cmd, why}]`, one runnable command per item (design walls add `title`). Tolerate a plain string item.

Where: `error`, `session_complete`, `session_paused`, `nothing_new`, `remote_overlap.sessions[]`, `gate_refused`, `evolve_paused`, `evolve_skipped`, `child_end`, `session_save` (`saved`, `behind`, and inside `test_manager` and `test_files`), a `context list` row whose tests are out of date, and `done` (it repeats a pause's `next`).

- **Agent flag.** Each `cmd` already carries `--mode agent` (`--agent` for `testrun run`, `testmd run`, `projects`); end a `testrun run` line in `< /dev/null`. If a `cmd` has no agent flag, add the one that command takes (§1) before running it.
- **One at a time.** Run each `cmd` as its own command. Never join them with `&&`.
- **Placeholders.** A `cmd` holding `<files>` (from `nothing_new`, a `behind` save) is a template: put in the person's real paths.
- **Read it before running it.** Some spend credits (`context extract`, `context ingest`, `design tests`, `maintain evolve`, `testmd run`, `testrun run`). Some need the person's word: `--allow-unreviewed` (designs from a use-case nobody approved), `--force` (replaces a use-case's tests), `context sessions save --yes` (publishes to the team's project and Test Manager), `context sessions discard --yes` (throws the session's work away). A `next` built from a partial `--answer` set carries the answers already given.
- **No `next`?** Read `remedy`: prose that may name a command. Add the agent flag that command takes (§1) before running it. Refusals at a folder's entry (linking, sign-in, access, `REMOTE_UNSUPPORTED`) carry `remedy` only; §6 gives the command for each. For `projects`, read stderr.

## 5. Exit codes

`done.status` follows the exit (`0` complete, `2` refused, `3` paused, `130` interrupted, any other `error`), with two exceptions: `context ingest` and `maintain reconcile` refusals can end `done{status:"refused", exit_code:1}`, and a failed read of `context list`, `context sessions` or `cover` ends `done{status:"error", exit_code:1}`. Branch on `exit_code`.

| Command | 0 | 1 | 2 | 3 | 130 |
|---|---|---|---|---|---|
| `context extract` | `session_complete`, `nothing_new`, `session_ended` | the run stopped (work kept in the session), `SESSION_OPEN_FAILED`, `SESSION_NOT_ENDED`, agent failures | entry, sign-in, access, resume and `--answer` refusals | paused | stopped before a session opened |
| `context ingest` | as extract | as extract, plus `UPLOAD_STALLED`, `UPLOAD_NOT_TAKEN`, `RESULT_REFUSED`, `FETCH_FAILED`, conversion failures | file, address, conversion and source-id refusals | paused | stopped during a fetch or upload |
| `design tests` | complete | as extract | `UC_*`, `gate_refused`, `USAGE`, `STRUCTURED_*` | paused | as extract |
| `maintain evolve` | complete | some use-cases not updated (`done.not_updated`, `next`) | entry refusals, `USAGE`, `MODE_USAGE` | paused | as extract |
| `maintain reconcile` | complete; nothing to review | `DESIGN_CHILD_FAILED` | `REMOTE_UNSUPPORTED`, `SOURCE_*`, `MODE_USAGE`, `STRUCTURED_TARGET_UNKNOWN` | `review_pending` | as ingest |
| `context sessions save` | saved; nothing to save | `failed` phase, `SAVE_FAILED`, `ASSURANCE_OFF` | `CONFIRM_REQUIRED`, `behind` phase, `SESSION_*`, `CONNECTION_FAILED`, sign-in | — | — |
| `context sessions discard` | discarded; already discarded | `DISCARD_FAILED` | every other refusal | — | — |
| `context sessions`, `context list` | the array / the rows | `LIST_FAILED` | `REMOTE_UNSUPPORTED`, `ASSURANCE_OFF`, sign-in, `USAGE`, `MODE_USAGE` | — | — |
| `cover` | `coverage` (also computing) | `COVERAGE_FAILED` | `ASSURANCE_OFF`, sign-in, `REMOTE_UNSUPPORTED` (`cover gaps`) | — | — |
| `testmd run` (designed test) | passed | failed, `TEST_MANAGER_OUTDATED`, `TEST_CASE_ATTACH_FAILED`, `TEST_RUN_NOT_SAVED` | case and lookup refusals | — | — |
| `testrun run` | all passed | a member failed, including one stopped on its case | `REMOTE_UNSUPPORTED`, `PROJECT_MISMATCH`, invalid plans, every `--remote` stop before dispatch | cancelled | — |

On the assurance verbs, `3` is a **pause** (resumable), not a failure: run the pause loop. `130` is a forced stop: resumable only if a `session_paused` arrived. On `testrun run`, `3` means cancelled.

## 6. Refusal codes

`Do` says what to tell or ask the person and the exact command, so you can go on when the event has no `next`. "Ask the person:" marks a step only they (or an admin) can take. Never rerun a paid command (extract, ingest, design, evolve, testmd, testrun) blindly: an exit 1 after turns ran has spent credits. `<the command>` = the refused command as typed.

| Code | Exit | When | Do |
|---|---|---|---|
| **Linking and the folder** | | | |
| `FOLDER_USAGE` | 2 | `--project` and `--local` together | ask the person: share the work (`<the command>` without `--local`) or keep it here (`<the command>` without `--project`) |
| `FOLDER_USAGE` | 2 | `--project` or `--local` with `--resume` | `<the command>` without the folder flag; a session stays where it started |
| `FOLDER_CHOSEN` | 2 | `--project` in a folder with its own store; `--project Q` in a folder linked to P; `--local` in a linked folder | `<the command>` without `--project` / `--local` (it works in the folder's own store or project). To change that, ask the person: move `.context/` out, or remove `.testmuai/assurance.json` |
| `BOTH_STORES` | 2 | the folder has `.context/` and a link | ask the person: work locally (remove `.testmuai/assurance.json`) or in the project (move `.context/` out of the folder) |
| `PROJECT_FILE_UNREADABLE` | 2 | `.testmuai/assurance.json` can't be read | ask the person: remove `.testmuai/assurance.json`. Then `kane-cli context extract --project <id> --mode agent` |
| `PROJECT_FILE_UNWRITABLE` | 2 | the link couldn't be written | ask the person: make the folder writable, or move a file named `.testmuai` out of it |
| `PROJECT_NO_ACCESS` | 2 | `--project <id>` names no project of theirs | `kane-cli projects list --search <name> --agent`; confirm the id with the person; run `<the command>` with it |
| `PROJECT_NO_ACCESS` | 2 | no access to the folder's project | ask the person: a Test Manager admin grants their account access |
| `PERMISSION_REQUIRED` | 2 | the project's first session needs permission to create test cases | ask the person: an admin grants it, or someone who has it starts the first session. A link made in this run was removed |
| `ASSURANCE_OFF` | 2 (1 from `sessions save`) | assurance isn't available for the project | ask the person; no command |
| `REMOTE_UNSUPPORTED` | 2 | `context review`, `context explain` | `kane-cli context list --mode agent` (the use-cases, their status, scenarios and tests) |
| `REMOTE_UNSUPPORTED` | 2 | `cover gaps` | `kane-cli cover --mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `context sessions show`, `context sessions clean` | `kane-cli context sessions --mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `--mode ci` on extract or design (a stderr line) | `<the command>` with `--mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `context ingest --plan` or `--mode override`; `context list --all`, or a `--type` other than `source`, `usecase`, `scenario`, `test` | `<the command>` without that flag, with `--mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `maintain reconcile --plan`, `--apply`, `--mode ci`, or no `--source-id`; `--from <address>` | `kane-cli maintain reconcile --from <file> --source-id <id> --mode agent`; for an address, `kane-cli context ingest <address> --mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `context sync`, `push`, `clone`, `fsck`, `view`, `retire`, `revert`, `rebuild`, `name`, `design explain` (and `context pull` where its help has no `--project`: `shared-projects.md` §7b) | no command in a linked folder; tell the person these work on a folder's own store. The project's tests come with `kane-cli context pull --mode agent` (`shared-projects.md` §7) |
| `PULL_LOCATION_LINKED` | 2 | `context pull` with a location name, `--rebase`, `--yes` or `--answer` in a linked folder | `kane-cli context pull --mode agent` |
| `REMOTE_UNSUPPORTED` | 2 | `testrun run --from-context` | run `next`, or `kane-cli testrun run <test files> --agent` |
| **Sign-in and access** | | | |
| `CREDENTIALS_MISSING` | 2 | nobody signed in | start sign-in (`kane-cli login --oauth`, `references/ready-check.md`), then `<the command>` |
| `CREDENTIALS_MISSING` | 2 | "couldn't confirm your login for shared projects" (a browser sign-in with no access key) | `<the command>` once more; if it refuses again, ask the person: run `kane-cli login --username <user> --access-key <key>` in their own terminal |
| `CREDENTIALS_REJECTED` | 2 | the shared project rejected the credentials | sign in again (`kane-cli login --oauth`), then `<the command>` |
| `CONNECTION_FAILED` | 2 | couldn't connect (or for 2 minutes); nothing was started | check the network; `<the command>` once more |
| `PREFLIGHT` | 2 | kane-cli's check before a session opens failed: unreachable, sign-in unchecked or rejected, or "assurance sessions aren't available here yet" | unreachable: `<the command>` once more later. Sign-in: `kane-cli login --oauth`. Not available: stop and pass on the support id in `remedy` |
| `VERSION_MISMATCH` | 2 | this kane-cli is too old, or the shared project doesn't support it yet | too old: ask the person to update (`npm install -g @testmuai/kane-cli@latest`). Not supported yet: stop and pass on the support id in `remedy` |
| `PROJECT_BUSY` | 2 | a live session holds the project, use-case or source: `held_by{sid, verb, use_case, mine, status}` | no `next`. When `remedy` names a resume (`kane-cli context extract --resume <sid> --mode agent`, or `kane-cli design tests --resume <sid> --mode agent`; only for the person's own session, `mine: true`), running it takes the session over and stops it in the other terminal, so ask the person first; otherwise wait for that run to finish. When `remedy` only says to wait (a resume refused this way, or a design while the person's own extract holds the project), wait. Someone else's: tell the person a teammate's session holds it; wait; `<the command>` later |
| **Sessions** | | | |
| `SESSION_NOT_FOUND` | 2 | no session with that id is theirs (a colleague's can't be resumed or saved) | `kane-cli context sessions --mode agent`; use a `sid` whose `owner` is `you` |
| `SESSION_FINISHED` | 2 | resume of a finished session | on the person's word: `kane-cli context sessions save <sid> --yes --mode agent` |
| `SESSION_NOT_FINISHED` | 2 | save of an unfinished session | resume first: `kane-cli context extract --resume <sid> --mode agent` (`design-…`, `evolve-…` ids: `kane-cli design tests --resume <sid> --mode agent`); save after `session_complete` |
| `SESSION_NOT_ENDED` | 1 | the run finished but the project didn't take its last step; the work is safe | run `next` (the resume command above): it records the ending; then save |
| `SESSION_FAILED` | 2 | the session ended with an error; it can't be resumed or saved | start again: `kane-cli context extract --mode agent`, or `kane-cli design tests --use-case <uc> --mode agent` |
| `CHECKPOINT_PROTOCOL`, `SESSION_KEPT_NOTHING`, `SESSION_MISSING` | 2 | a resume can't read the session's last step | tell the person it can't be resumed; start a new one: `kane-cli context extract --mode agent` or `kane-cli design tests --use-case <uc> --mode agent` |
| `SESSION_OPEN_FAILED` | 1 | the session couldn't be opened | `<the command>` once more; then ask for help |
| no code: "stopped before it finished" | 1 | the run stopped; the work so far is kept in the session | resume with the `sid` from `remote_connect`: `kane-cli context extract --resume <sid> --mode agent` (design: `kane-cli design tests --resume <sid> --mode agent`). Don't start over |
| `CONFIRM_REQUIRED` | 2 | save or discard without `--yes` | the `check` line before it is the preview: show it; on the person's word, `kane-cli context sessions save <sid> --yes --mode agent` (or `discard`) |
| `SESSION_ELSEWHERE` | 2 | discard while the session runs in another terminal, or is held | wait (up to 3 minutes) or stop the other run; then `kane-cli context sessions discard <sid> --yes --mode agent` |
| `ALREADY_SAVED`, `ALREADY_ENDED` | 2 | discard of a saved or ended session | nothing to discard; tell the person |
| `DISCARD_FAILED` | 1 | the discard failed | stop; ask for help |
| `LIST_FAILED` | 1 | the session list or `context list` couldn't load | `<the command>` once more; then ask for help |
| `STRUCTURED_FLAGS_USAGE` | 2 | `--answer` without `--resume <sid>` or `--mode agent`, or unreadable | `kane-cli context extract --resume <sid> --mode agent --answer <id>=<value>` (design: `kane-cli design tests --resume <sid> …`) |
| `STRUCTURED_TARGET_UNKNOWN` | 2 | `--answer` names no pending question or card, isn't a verdict, or repeats a card | use the ids from `pending_questions` or `review_cards` |
| `USAGE` | 2 | a parse error; save or discard with no `<sid>`; evolve with both or neither of `<ref>` and `--from-stale`; design with no `--use-case` | fix the command (`kane-cli <command> --help`); never resend it unchanged |
| `MODE_USAGE` | 2 | `--mode` isn't one the command takes | `<the command>` with `--mode agent` |
| **Extract and ingest inputs** | | | |
| `NO_PROPOSAL` | 1 | the agent returned no use-cases | retry `kane-cli context extract --mode agent` once (it reads the source again and costs credits again). If it happens twice, stop, and give the person the command and the message |
| `AS_SINGLE_SOURCE` | 2 | `--as` with several refs | run `next`, or `kane-cli context ingest <ref> --as <id> --mode agent` once per source |
| `SAME_SOURCE_ID` | 2 | two refs would share one source id | run `next`; with none, ask the person for distinct ids and run `kane-cli context ingest <ref> --as <id> --mode agent` per ref |
| `NEW_VERSION_ALONE` | 2 | a new version of a held source among other refs; nothing added | `kane-cli context ingest <the other refs> --mode agent`, then `kane-cli context ingest <new version> --mode agent` alone (it opens a review) |
| `SITE_MOVED`, `KIND_MISMATCH`, `WEB_URL_CHANGED`, `UUID_MOVED` | 2 | the fetched item can't become a new version of the source id it would replace | ask the person which they mean; run that `next`, or `kane-cli context ingest <address> --as <new id> --mode agent` for a source of its own |
| `UNSUPPORTED_URL` | 2 | the ref is neither a file nor a web address | ask the person for a file path or a full `https://` address |
| `FILE_NOT_FOUND`, `FILE_UNREADABLE`, `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA`, `MEDIA_SNIFF_MISMATCH`, `BAD_SOURCE_ID` | 2 | checked before anything was sent | fix the path or file (relay the message); `BAD_SOURCE_ID`: pass a valid `--as <id>` |
| `PDF_ENCRYPTED`, `PDF_NO_TEXT_LAYER`, `PDF_UNREADABLE`, `DOCX_UNREADABLE`, `DOCX_NOT_WORDPROCESSING`, `DOCX_NO_TEXT`, `DOCX_ENCRYPTED_OR_LEGACY`, `DOCX_PART_TOO_LARGE`, `DOCX_TOO_MANY_PARTS`, `DOCX_BOMB`, `PROJECTION_TOO_LARGE` | 2 | the file can't be converted on this machine | relay the message; ask the person for an unlocked, text-bearing or smaller copy |
| `SOURCE_ID_OWNED` | 2 | that source id is taken | ask the person for another id; `kane-cli context ingest <ref> --as <id> --mode agent` |
| `INGEST_FAILED`, other conversion failures | 1 | the conversion failed | report it; ask for help |
| `INVALID_URL`, `ADDRESS_NOT_ALLOWED`, `NOT_A_PAGE`, `PAGE_NOT_FOUND`, `PAGE_BLOCKED`, `PAGE_PAYWALLED`, `PAGE_TOO_LARGE`, `PAGE_TIMEOUT`, `PAGES_UNAVAILABLE`, `PAGES_NOT_AVAILABLE`, `ITEM_UNAVAILABLE`, `LINEAR_PAGE`, `LINEAR_LINK_MALFORMED`, `ATTACHMENT_TOO_LARGE` | 2 | the address or item can't be read | relay the message; ask the person for another address or a saved file |
| `NO_CONNECTION`, `NO_ACCESS`, `NO_ISSUE_ACCESS`, `NO_DOCUMENT_ACCESS`, `NO_CONFLUENCE_ACCESS`, `NO_COMMENTS_ACCESS`, `PROJECT_NOT_SELECTED`, `INTEGRATION_SETUP`, `INTEGRATION_UNAVAILABLE` | 2 | the Jira, Confluence or Linear connection is missing or can't see the item | ask the person: connect the integration or grant access (relay the message) |
| `INTEGRATION_BUSY` | 2 | the integration is busy | wait; `<the command>` once more |
| `OUT_OF_CREDITS` | 2 | no credits left for the fetch | tell the person (`kane-cli balance`); stop |
| `FETCH_FAILED` | 1 | the fetch failed | `<the command>` once more; then ask for help |
| `PLUGIN_NOT_CLAIMED`, `PLUGIN_SOURCE_ID_INVALID`, `PLUGIN_MISSING` | 2 | no source plugin takes the ref, or its id is invalid | ask the person: check the ref's form and that the plugin is installed |
| `PLUGIN_HOOK_FAILED`, `PLUGIN_HOOK_TIMEOUT` | 1 | the source plugin failed | report it; ask for help |
| `UPLOAD_STALLED`, `UPLOAD_EXPIRED` | 1 / 2 | the upload stopped, or its window ended | `<the command>` once more |
| `UPLOAD_NOT_TAKEN`, `RESULT_REFUSED` | 1 | the shared project didn't take the upload or its result | stop; ask for help |
| `LINKS_NOT_TAKEN` | 2 | the shared project can't take addresses | ask the person for a saved file of the page; `kane-cli context ingest <file> --mode agent` |
| `SOURCE_UNKNOWN`, `SOURCE_REMOVED` | 2 | reconcile: the project doesn't hold that `--source-id`, or removed it | `kane-cli context list --type source --mode agent`; a new source: `kane-cli context ingest <file> --mode agent` |
| `SOURCE_ORIGIN_UNKNOWN`, `SOURCE_REF_UNROUTED`, `SOURCE_ID_MISMATCH` | 2 | reconcile of a plugin source that doesn't line up | relay the message; check the `--source-id` with the person (`kane-cli context list --type source --mode agent`) |
| on `card_refused`: `CONCURRENT_APPEND`, `TARGET_RETIRED`, `SOURCE_MOVED`, `SOURCE_UNRESOLVED`, `ARCHIVE_UNRESOLVED`, `ALREADY_VERDICTED`, `CARD_GONE`, `HOLD_GONE` | — | a review verdict didn't land | relay `refusal`; `kane-cli context extract --resume <sid> --mode agent` shows the cards still open |
| `DESIGN_CHILD_FAILED` | 1 | an approved change's design run failed | later: `kane-cli design tests --use-case <uc> --mode agent` |
| `AGENT_FAILED`, `AGENT_CRASHED`, `REPAIR_FAILED`, `PROPOSAL_INVALID`, `COMMIT_FAILED` | 1 | the agent's run failed | report it; credits were spent; check `kane-cli context sessions --mode agent` before any retry |
| `TRUST_USAGE` | 2 | `--trust hold` in a terminal run | `<the command>` without `--trust`, with `--mode agent` |
| **Design** | | | |
| `UC_UNREVIEWED` | 2 | the use-case is still proposed; nobody approved it | show it (`kane-cli context list --type usecase --mode agent`); on the person's word, `kane-cli design tests --use-case <uc> --allow-unreviewed --mode agent` (one that already has tests also needs `--force`: the `gate_refused` row below). A person approves at the end of a terminal session |
| `UC_ARCHIVED` | 2 | the use-case is archived | tell the person; pick another use-case |
| `gate_refused` (no code) | 2 | unknown, removed or not-a-use-case ref | pick from the ids the message lists (`kane-cli context list --type usecase --mode agent`) |
| `gate_refused` (no code) | 2 | the use-case already has tests, or changed since they were designed | ask the person: redesign (`kane-cli design tests --use-case <uc> --force --mode agent`, replaces its tests) or update (`kane-cli maintain evolve <uc> --mode agent`, only what changed). A use-case that is also still **proposed** needs both flags on a redesign: `kane-cli design tests --use-case <uc> --force --allow-unreviewed --mode agent` (each alone refuses with the other wall); evolve refuses it (`UC_UNREVIEWED`), so use the redesign |
| `NOTHING_CHANGED` | 2 | evolve of a use-case unchanged since its tests were designed | ask the person why: `kane-cli maintain evolve <uc> --because "<reason>" --mode agent`; or run `next` |
| `NO_TESTS_YET` (`evolve_skipped` `no-design`) | 2 | evolve of a use-case with no tests | `kane-cli design tests --use-case <uc> --mode agent` |
| `evolve_skipped` `source_changed` | 2 | only its source changed | run `next`; a file source has none: `kane-cli maintain reconcile --from <file> --source-id <id> --mode agent` |
| **Save** | | | |
| `session_save` `phase: "behind"` (no `error` event; a terminal shows `PROJECT_CHANGED`) | 2 | another save changed what this session touched | tell the person what (`conflict`); on their word run one `next` (start again from the latest) |
| `session_save` `phase: "failed"` (`reason`, maybe `code: "SCOPE_RECORD_REFUSED"`; a terminal shows `SAVE_FAILED` with a support id) | 1 | the project refused the save | saving again won't help: stop, and give the person the `reason` and the session id |
| `CONNECTION_FAILED` | 2 | the save's answer was lost after sending | `<the command>` once more: nothing is saved twice |
| `TEST_MANAGER_TIMED_OUT`, `TEST_MANAGER_UNREACHABLE`, `TEST_MANAGER_FAILED` (`test_manager.error`) | 0 | the save landed; Test Manager wasn't fully updated | run `test_manager.next`, or `kane-cli context sessions save <sid> --mode agent` (saving again finishes it) |
| `PROJECT_NO_ACCESS`, `ASSURANCE_OFF` (`test_manager.error`) | 0 | the save landed; Test Manager refused the cases | ask the person: their Test Manager access, or assurance for the project |
| `TEST_FILES_NOT_WRITTEN` (`test_files.error`) | 0 | the save landed; no test files were written here | run `test_files.next`, or `kane-cli context sessions save <sid> --mode agent` |
| `test_files.refused[]` | 0 | a test file wasn't written; `reason` says why: edited by hand and kept, a duplicate, an unreadable or unresolved record, an unwritable folder, a missing import (some have no `file`) | tell the person the reason; follow `test_files.next` when it is there. Only for a file edited by hand: when `test_files.next` offers `kane-cli testmd run <file> --agent`, it sends their edit to its case; otherwise (or instead) they move the file out and save again |
| **Runs of designed tests** | | | |
| `TEST_CASE_MISSING` | 2 | the session that designed the test isn't saved | on the person's word: `kane-cli context sessions save <sid> --yes --mode agent` (`kane-cli context sessions --mode agent` lists the sids) |
| `TEST_CASE_GONE` | 2 | its Test Manager case was deleted or moved | show the person; on their word, `kane-cli context sessions save <sid> --yes --mode agent` with the sid `remedy` names (it makes a new case). A `remedy` with no sid: `kane-cli context sessions --mode agent` to find it |
| `TEST_CASE_ARCHIVED` | 2 | its case is archived in Test Manager | ask the person: restore the case, or leave the test out of the run |
| `TEST_NOT_IN_PROJECT` | 2 | the test isn't in the folder's project, its file is out of date, or the project has no work yet | run it in the folder linked to its project; or, on the person's word, design it again: `kane-cli design tests --use-case <uc> --mode agent` (a proposed use-case also needs `--allow-unreviewed`, one with tests `--force`: the Design rows), then save; a project with no work: `kane-cli context ingest <files> --mode agent` |
| `TEST_MANAGER_OUTDATED` | 1 (2 on `--remote`) | Test Manager can't add this run to the test's case: on a device target (it attaches desktop-browser runs only), or because Test Manager itself needs an update (or made a case of its own) | stop and tell the person. On a device target, offer the desktop browser; otherwise the run can only go again once Test Manager is updated. Pass on the support id |
| `TEST_CASE_ATTACH_FAILED` | 1 | attaching to the case failed | `<the command>` once more later; then pass on the support id |
| `TEST_RUN_NOT_SAVED` | 1 | the run ran but its version wasn't saved on the case | report the verdict as it stands; tell the person Test Manager has no record of this run; pass on the support id |
| `CREDENTIALS_MISSING`, `CREDENTIALS_REJECTED`, `PROJECT_NO_ACCESS`, `ASSURANCE_OFF`, `CONNECTION_FAILED` | 2 | a first run couldn't look up its case | as the sign-in and access rows above; a later run goes on without the lookup |
| `REMOTE_KANE_NOT_PUBLISHED` | 2 | `testrun run --remote` with designed tests from a kane-cli that isn't a published release | ask the person to install a published kane-cli; `remedy` names the flags that pick one |
| **testrun plans** | | | |
| `PROJECT_MISMATCH` | 2 | the selected tests belong to more than one Test Manager project | show `projects[]` (`this_folder: true` marks the folder's project); run `next`, or `kane-cli testrun run <that project's test paths> --agent`. Keep `kane-cli run` experiments in another folder |
| invalid plan (no `error`: outside a linked folder, or on 0.10.0) | 2 | `testrun_plan.valid` is false | read each `members[].failure`; fix those tests or leave them out |
| `PLAN_INVALID` | 2 | *(linked folder only, from the release that carries it)* the same, as an `error` with `offenders[{path, failure}]`, then `testrun_done{refused}` | fix the named tests or leave them out |
| no tests (`members: []`) | 2 | nothing selected (everywhere on 0.10.0; outside a linked folder on every release) | in a linked folder: get the project's tests (`shared-projects.md` §7); elsewhere design them (`kane-cli context list --mode agent`, then `kane-cli design tests --use-case <id> --mode agent`) |
| `NO_TESTS` | 2 | *(linked folder only, from the release that carries it)* "no tests here yet", then `testrun_done{refused}` | run its `next`: `kane-cli context pull --mode agent`. A filter matching nothing has no `next`: change the filter |
| **Coverage** | | | |
| `COVERAGE_FAILED` | 1 | the project's coverage couldn't be read | `kane-cli cover --mode agent` once more in a moment; then ask for help |
| `coverage` computing | 0 | still being worked out | `kane-cli cover --mode agent` in a moment |

## 7. Support ids

A support id looks like `as-YYYYMMDDTHHMM-xxxxxxxx`. It names one command's attempt for TestMu AI support.

| Where | What shows |
|---|---|
| Terminal | under a refusal: `if this keeps failing, share this id with support: <id>` |
| Assurance stream | **not** on `error` events. Only inside `remedy` for `VERSION_MISMATCH` (not supported yet), `PREFLIGHT` (not available here) and `SAVE_FAILED`, and in `session_save.test_manager.support_id` (a test that couldn't be read) |
| Run stream | `testmd run`: `error.support_id`; `testrun run --remote`: `remote_error.support_id`; a member's `error` inside `testrun_member_event` (`--stream-members`) |

When you ask the person to get help, give them the support id, the command, the code and the message. With no id on the stream, give the rest; never rerun a paid command just to get an id. With `KANE_TELEMETRY=0` the id still shows, but nothing is recorded under it: say so.
