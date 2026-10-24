<!-- kane-cli skill reference: shared projects (a folder linked to a team's Test Manager project). Read before any assurance command when the person works with a team, or when a folder holds .testmuai/assurance.json. Requires kane-cli 0.10.0+. -->

# Shared projects: a team's work in one Test Manager project

A **shared project** is a Test Manager project that a team's folders are **linked** to. In a linked folder the assurance
commands (`context`, `design`, `maintain`, `cover`) work in the project itself, not in a local `.context/` store. What one
person saves, everyone on the team sees: use-cases, criteria, scenarios, tests, Test Manager cases, coverage.

Read this before the first assurance command of a session whenever:
- the person mentions a team, a teammate, a Test Manager project, or "our project";
- the folder holds `.testmuai/assurance.json` (it is linked; the file names its `projectId` and `projectName`);
- a command prints `using project "<name>", shared with your team`, or emits `folder_linked`.

The commands below are the agent forms. Everything in a linked folder runs from **the folder that holds
`.testmuai/assurance.json`**: a subfolder of a linked folder is not linked.

## 1. Where the work goes: decide first

In agent mode, a folder that isn't set up yet goes **local without asking** unless you pass `--project <id>`. So decide
before the first `context ingest`:

| The person… | Do |
|---|---|
| works with a team, or names a Test Manager project | link this folder to that project (§2–3) |
| works alone, or asks to keep it on this machine | work locally: the journey in `assurance.md` §1 |
| isn't clear | ask once: "Should this work go to your team's Test Manager project, or stay in this folder?" |

A folder is one or the other, never both: a folder with its own `.context/` refuses `--project` (`FOLDER_CHOSEN`), and a
folder with both refuses every assurance command (`BOTH_STORES`). To share an existing local store with a team through a
Git repository, a bucket or a folder instead, see `context-sync.md`; that is a different way of sharing and doesn't reach
Test Manager.

## 2. Find or make the project

```bash
kane-cli projects list --search "<part of the name>" --agent
kane-cli projects create "<name>" --description "<one line>" --agent
```

- `projects list` prints one JSON line per project, `{"id":"<project id>","name":"<name>"}`, then a page line
  `{"_meta":"page",…,"has_more":true|false}`. There is no `type` and no `done`. `--limit` (1–200, default 10) and
  `--offset` page through; `--search` matches any part of the name.
- `projects create` prints `{"id":…,"name":…}`. It does **not** link the folder and doesn't change where `kane-cli run`
  saves. Create a project only when the person asks for a new one; otherwise use the team's.
- Errors from `projects` are plain text on stderr (exit 2 for usage or sign-in, 1 for a Test Manager refusal), not events.
- A linked folder's own project id is in `.testmuai/assurance.json` (`projectId`).

### This folder's project id

A teammate's agent needs it to join (`kane-cli context pull --project <id>` where the pull exists, or
`kane-cli context extract --project <id>`), and so does anything that reads the project, such as a dashboard. Give the
person the name and the id together. Ways to get it:

| Where | What |
|---|---|
| a linked folder's `.testmuai/assurance.json` | its `projectId` field (and `projectName`); read only those two fields |
| the skill's preflight | its `## link` section: `project=<name>`, `project_id=<id>` |
| the `folder_linked` event | `project_id` and `project`, when a command links the folder |
| `kane-cli projects list --search "<name>" --agent` | `{"id","name"}` for every project the person can open |

## 3. Link this folder

```bash
kane-cli context ingest <files> --project <id> --mode agent    # link, then add the documents and find their use-cases
kane-cli context extract --project <id> --mode agent           # link and read what the project hasn't read yet
```

- Only `context ingest` and `context extract` take `--project`. The link is made once; later commands in the folder need
  no flag. `--project` with the folder's own project is harmless; a different id refuses `FOLDER_CHOSEN`.
- `{"type":"folder_linked","project_id":…,"project":…}` confirms the link. It can come before a check that still refuses
  the run, so read the events after it. Tell the person: "This folder is now linked to <project> (<project id>); what you
  save goes to the project."
- If the project refuses its first session (`PERMISSION_REQUIRED`: it needs someone allowed to create test cases), the link
  is removed again; ask the person to get someone allowed to create test cases in that project to start the first
  session, or to pick another project. After `PROJECT_NO_ACCESS` the folder **stays linked**, and every
  assurance command refuses the same way until the person gets access or removes `.testmuai/assurance.json` (their call).
- A person at a terminal is asked instead: "where should this folder's work go?", then a project picker (Tab makes a new
  project). Agents never see these questions.
- There is no unlink command. Linking a folder to another project means removing `.testmuai/assurance.json` first; that
  is the person's call, never yours.

## 4. The journey in a shared project

| Step | Command | What to watch |
|---|---|---|
| 1. Add the documents and find their use-cases | `kane-cli context ingest <file> --project <id> --mode agent` (the first time), later `kane-cli context ingest <file> --mode agent` | one document per run; it ends `session_complete` with two `next` commands, save and discard (none when it added nothing) |
| 2. Save the session | `kane-cli context sessions save <sid> --yes --mode agent` | **nothing is in the project until this runs.** `session_save` `phase: "saved"` confirms it |
| 3. The use-case checkpoint | `kane-cli context list --mode agent` to show them; then ask once (below) | use-cases an agent run saves are `proposed`, not approved |
| 4. Design the tests | `kane-cli design tests --use-case <uc> --mode agent --allow-unreviewed` | only after the person's yes; ends `session_complete`. To cap the scenarios (and the cost), offer `--max <n>`; add it only on the person's word |
| 5. Save the design | `kane-cli context sessions save <sid> --yes --mode agent` | writes the test files here and makes one Test Manager case per scenario; `test_files.written[]` lists the files. Before going on, read `test_files.refused[]` and `test_files.error`, and `test_manager.error` and `waiting`: a save can succeed while a file or a case is still missing. Files listed in `test_files.replaced[]` stay but won't run any more: name only the `written[]` files on `testrun run`, and offer to move the replaced ones out |
| 6. Fill the variables, and the start pages | the file in `test_files.variables_needed.file` (usually `.testmuai/variables/assurance.json`); `test_files.no_start_page[]` names tests with no start page | SKILL.md §3, before any run. Use only values the person gives you, never invented ones; write them into the file (a script is fine) without printing them to the terminal or a log. Ask the person for the site address of a test with no start page |
| 7. Run the tests | `kane-cli testrun run <the files from step 5> --agent < /dev/null` | the first run of each test writes its steps: minutes, and about 30–85 credits per test; replays are cheap (`testrun.md` §Designed tests in a shared project) |
| 8. Coverage | `kane-cli cover --mode agent` | the project's figure; a new run can take up to 5 minutes to count |


**The use-case checkpoint.** A linked folder has no command that approves use-cases:
`context review` is refused there, and use-cases an agent run saves stay `proposed`. So `design tests` refuses
`UC_UNREVIEWED` until it gets `--allow-unreviewed`. Show the person the use-cases you found (titles and what they cover,
from `context list --mode agent`), then ask **once for the batch**: "I found these N use-cases in <document>. Shall I design tests for them? Nobody has
approved them yet, so tell me any to leave out or change first." Pass `--allow-unreviewed` only after a yes, and only for the use-cases they keep. A person at a terminal approves them by finishing the
session there.

**What things cost.** These are approximate figures from real runs of small documents; the person's billing page is
the authority. The stream's `usage.total_credits` and the run's summary give the real figure for each step:

| Step | Credits (approximate) |
|---|---|
| `projects list`, `projects create`, `context list`, `context sessions`, `cover`, a save, `explore list`, `explore context status` | 0 |
| linking (`context extract --project` when every document is already read) and `context pull` | 0 |
| reading one document (`context ingest`, or `context extract` with something unread) | about 5 |
| designing one use-case's tests (`design tests`) | about 10–15 |
| a designed test's first run in a folder (it writes its steps; each input it checks is its own browser run) | about 30–85 per test |
| a replay | a few |

Tell the person the likely cost before a step that costs credits, let them choose, and give the total after. Never add
a flag that changes cost or behaviour (for example `--no-adaptive-heal`, `--max`, `--force`) on your own: offer it, and
use it only when the person asks.

**One session at a time.** A live session holds its source or its use-case; another person's start on the same one is
refused `PROJECT_BUSY`, saying whether the session in the way is the person's own (`held_by.mine`) or a teammate's. Save or discard each session before the next one, and tell the person when a
teammate's session is in the way. `kane-cli context sessions --mode agent` lists the project's open sessions (one JSON
array; `owner` says whose).

## 5. Where everything lives

| What | Where | How to see it |
|---|---|---|
| sources, use-cases, criteria, scenarios, tests | in the shared project | `kane-cli context list --mode agent` lists sources, use-cases, scenarios and tests (one plain JSON row each: `id`, `label`, `title`, `trust`, `fresh`; no `done`); criteria aren't listed there. `trust: "derived"` is a proposal nobody has approved yet, `"trusted"` is approved: say *proposed* or *approved* to the person, never the field's value |
| test files (`*_test.md`) | `.testmuai/tests/` of **the folder where the session was saved**, and nowhere else | `session_save.test_files.written[]` |
| Test Manager cases | one per scenario, in the shared project, made or updated when a design is saved | `session_save.test_manager`: counts `created`, `updated`, `already_there`, `waiting`, and `next_run[]` (the scenarios whose case updates on their next run) |
| a test's runs | on its scenario's Test Manager case | Test Manager; the run's `testrun_summary` |
| coverage | worked out by the shared project from the counted runs | `kane-cli cover --mode agent` |
| variables | names: in the saved tests; empty stubs: this folder's `.testmuai/variables/assurance.json`; values: whatever the person writes there | `test_files.variables_needed` |
| a run's recording | `.testmuai/tests/output-<test>/` beside the test file, after a first run that finished | the next run replays it cheaply; a first run that stopped early leaves it incomplete, and the next run writes the steps again |

Two rules follow:
- **Keep designed test files directly in `.testmuai/tests/`.** A designed test moved into a subfolder runs as an ordinary
  test, not on its Test Manager case, and doesn't count for coverage.
- **Variable values reach the whole organisation.** Every run sends the non-secret values it loads to Test Manager: the
  global and folder variable files, `--variables` and `--variables-file`, and the test's own `variables:`. Test Manager
  keeps one value per name for the organisation, so a teammate's run with a different value replaces it. Never fill a
  value just to silence a warning. Any `*.json` in `.testmuai/variables/` counts; prefer the file `variables_needed` names.

## 6. A teammate joins

From the teammate's own empty folder:

```bash
kane-cli context extract --project <id> --mode agent
```

It links the folder, then:
- every document already read: `nothing_new` (`reason: "every_source_read"`), exit 0, no credits;
- a document nobody has read yet: it reads it (credits, see §4) and ends `session_complete`. Save that session (§4 step 2),
  or discard it on the person's word; while it is open it holds that document, and teammates get `PROJECT_BUSY`;
- another person's session already holds the unread document: `nothing_new` (`reason: "sources_in_a_session"`) with
  `open_sessions[]`; nothing to do here.

After it, `context list` and `cover` show the project. **No test files arrive with the link**, so `testrun run` has
nothing to run yet: see §7.

## 7. Get the team's tests into this folder

Test files are written only in the folder where a design was saved. Exploration saves its tests into the project, but its
files never reach anyone's folder.

**First check whether this kane-cli can pull them:**

```bash
kane-cli context pull --help
```

If its options include `--project` and `--use-case`, use §7a. If not (kane-cli 0.10.0), it can't: `context pull` in a
linked folder is refused (`REMOTE_UNSUPPORTED`), and `--project` is an unknown option. Use §7b.

### 7a. Pull them (when `context pull --help` lists `--project`)

After exploration finishes, or after a teammate saves a design:

```bash
kane-cli context pull --mode agent                       # in a linked folder: write the project's tests here
kane-cli context pull --project <id> --mode agent        # in a folder that isn't set up yet: join (reads no documents), then pull
kane-cli context pull --use-case <uc> --mode agent       # only that use-case's tests, with the tests they use
kane-cli context pull --overwrite --mode agent           # replace test files changed here with the project's
```

- The pull's own events and refusals carry `verb: "sync"`; a refusal at the folder's entry (sign-in, access, the link) carries `verb: "pull"`. Dispatch on `type`, as always.
- One `pull_test` event per test: `{test, title, file, outcome, first_run?, imported?, reason?}`, where `outcome` is
  `new`, `updated`, `unchanged`, `kept` (changed here, left alone), `replaced` (with `--overwrite`) or `not_written`.
- `first_run: true` means the test hasn't run in this folder: its first run writes its steps in a real browser, which
  takes a few minutes and costs credits (§4); later runs replay. Tell the person the count and the cost first.
- `variables_needed {file, variables[], no_start_page[]}` names the variables to fill; the pull writes no stubs. If the
  file it names doesn't exist yet, it is a JSON object with one entry per name:
  `{"<name>": {"value": "<value>", "secret": true|false}}`.
- A variable the pull can't classify is marked `secret: true` to be safe. Ask the person whether it really is a secret
  (a message to type usually isn't). A secret's value is never asked for or shown in chat: the person writes it into the
  file. A value the person has already given you in their own words isn't a secret to them: write it there yourself,
  without printing it, and go on (§4 step 6).
- `done.next` names `kane-cli testrun run`. A project with no tests yet ends exit 0 with "has no tests yet" and `next` =
  `kane-cli cover --mode agent`. Exit 1 when any test wasn't written or the project couldn't be read (`PULL_FAILED`);
  2 for refusals.

| Code | When | Do |
|---|---|---|
| — | `context pull` with no flags in a folder that isn't linked: it is the location pull, as before. In a new folder its message is "no context store here" | to join the team's project and bring its tests, run `kane-cli context pull --project <id> --mode agent` (`kane-cli projects list --agent` for the id) |
| `PULL_LOCATION_LINKED` | a location flag (a location name, `--rebase`, `--yes`, `--answer`) in a linked folder | `kane-cli context pull --mode agent` |
| `PULL_FLAGS_MIXED` | project flags mixed with location flags | use one set |
| `PULL_FLAGS_LINKED_ONLY` | `--use-case` or `--overwrite` without `--project` in a folder that isn't linked (a new one, or one with its own local store) | link it first with `--project <id>`, or drop those flags |
| `USE_CASE_UNKNOWN` | the project has no such use-case | `kane-cli context list --mode agent` for the ids |
| `PULL_FAILED` (exit 1) | the project's tests couldn't be read; nothing was written | try once more; then give the person the support id |

### 7b. Until then: copy only what the tests need

Ask the person to get, from the teammate who saved the design, **only**:
- `.testmuai/assurance.json` (the link), when this folder isn't linked yet;
- the test files `.testmuai/tests/*_test.md`;
- for each test, its `output-<test>/` folder beside it, if the teammate ran it (so the first run here is a replay).

**Never** `.testmuai/variables/` (it can hold secret values) or `.testmuai/evidence/`, and never unzip over this folder's
own `.testmuai/`: it would replace this folder's variables and its link. The receiving folder must have no `.context/`
and no link to another project. Then fill this folder's own variables (§4 step 6) and run the files by path.
Exploration's tests have no folder to copy from: they can be seen (`context list`; Test Manager) but not run until the
pull is available.

## 8. What changes in a linked folder

Non-assurance commands (`run`, `testmd`, `testrun`, `projects`, `config`, `evidence` …) always run. These assurance
commands are refused with `REMOTE_UNSUPPORTED` (exit 2):

| Refused | Use instead |
|---|---|
| `context review`, `context explain` | `kane-cli context list --mode agent`; the checkpoint in §4 |
| `cover gaps` | `kane-cli cover --mode agent` |
| `context sessions show`, `context sessions clean` | `kane-cli context sessions --mode agent`; `… sessions discard <sid> --yes --mode agent` |
| `context sync`, `push`, `pull` (until §7 ships), `clone` | the shared project is the team's copy |
| `context view`, `fsck`, `rebuild`, `retire`, `revert`, `name`, `design explain` | none in a linked folder |
| `--mode ci` on `extract`, `design tests` and `maintain reconcile` | `--mode agent` |
| `context ingest --plan`, `--mode override` | `kane-cli context ingest <file> --mode agent` |
| `context list --type` other than `source`, `usecase`, `scenario`, `test` | one of those four |
| `context list --all` | `kane-cli context list --mode agent` |
| `maintain reconcile --plan`, `--apply`, a URL in `--from` | `kane-cli maintain reconcile --from <file> --source-id <id> --mode agent`; for an address, `kane-cli context ingest <address> --mode agent` |
| `testrun run --from-context <ids>` | name the files: the refusal's `next` does |

In a linked folder `extract --plan` and `--with-source` are ignored, and an extract that read two or more documents and
then paused can't be resumed (its `next` adds them again or discards). Give each `context ingest` one document.

## 9. `kane-cli run` in a linked folder, and "two projects"

`kane-cli run` saves its test to the **profile's** Test Manager project (`config project`), not the folder's, unless the
profile's project is this folder's project. With `--name` it also writes the test into this folder's `.testmuai/tests/`.
A `testrun run` that selects tests from two projects then refuses `PROJECT_MISMATCH`.

- In a linked folder, never use `kane-cli run` for a first result: the first result is the journey in §4.
- Quick `run` experiments go in a separate folder that isn't linked.
- On `PROJECT_MISMATCH`: read `projects[]` (`project_id`, `name`, `this_folder`, `tests`). Its `next` runs one project's
  tests, by path or with a `--match`: this folder's project's when it has any, else another's. Run it, and tell the person
  which tests were left out and why.
- **The lasting fix**, with the person's word: move the tests listed under the project where `this_folder` is `false`,
  each with its `output-<test>/` folder, out of `.testmuai/tests/` into a folder that isn't linked. Until then, name the
  files on every `testrun run`.
- Recovery for every shared-project refusal: `agent-contract.md`.
