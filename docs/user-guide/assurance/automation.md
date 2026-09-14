# Assurance without a terminal: agents and CI

The conversational assurance commands — `context ingest`/`context extract`, `design tests`, and `maintain reconcile` — are interactive by default. This page is the contract for running them **headless**: from CI, from a script, or from an AI agent driving kane-cli. The coverage reads (`cover`, `cover gaps`) speak the same stream since 0.7.1.

## The ask policy: `--mode`

On a terminal, extract and design open a chat. Headless is an explicit opt-in — a bare non-TTY invocation **exits `2`** and mutates nothing:

```
extract: no TTY — pass an explicit --mode agent|ci|override to run headless
```

`--mode` decides both what happens when the agent has a question, and what the command writes to stdout:

| Mode | Questions | stdout |
|---|---|---|
| `interactive` | asked in the chat (TTY default) | the Ink chat UI |
| `agent` | **every** question pauses the session — exit `3`, resumable; the agent that drives the run answers at resume or escalates to its person *(0.8.8)* | **NDJSON events** (one JSON object per line); *(0.7.2)* nothing else on either output — stderr stays silent |
| `ci` | any high-risk question **fails closed** — exit `1`, error code `HIGH_RISK_CI`; low- and medium-risk questions take their recommended default (each reported) | prose transcript |
| `override` | every default is auto-taken, including high-risk (each flagged in the commit record) | prose transcript |

Rule of thumb: `agent` when something can read the pause and answer (an AI agent, a human on the next shift); `ci` when a pipeline must fail rather than guess on anything high-risk; `override` when you accept the recommended defaults wholesale and want one unattended pass.

The same matrix drives `maintain reconcile`, with two reconcile-specific rules: no headless mode ever archives anything — ARCHIVE decisions wait for an interactive session — and a `ci`-mode run that hits a decision needing a human **stores the plan and exits `2`** (the work isn't lost; walk the stored plan interactively or apply it in `agent` mode).

`context ingest` follows the matrix with one extra rule *(0.7.1)*: it lands the files and then runs the extraction under the given mode — except `--mode ci`, or piped stdin without any `--mode`, which **lands only** (exit `0`, with a stderr guidance line naming the next command). Two extraction dials also matter headless: `--trust hold` holds everything new for review instead of committing it (headless-only; `ci` refuses the flag entirely with exit `2`), and `--trust auto` is the default everywhere.

## Exit codes

Consistent across extract, design, and the maintain commands that embed them:

| Code | Meaning |
|---|---|
| `0` | Complete. |
| `1` | Runtime failure. For extract and design, a `ci`-mode fail-close on a high-risk question also exits `1`; reconcile's `ci` fail-close stores the plan and exits `2` instead. |
| `2` | Usage / auth / refusal — bad flags, failed input validation, no store, bare non-TTY without `--mode`, missing `--yes` on a destructive command. Nothing was mutated — with two durable exceptions: a merged ingest whose *extraction* refused keeps its landed sources (the run says they're safe), and reconcile's `ci` fail-close keeps its stored plan. |
| `3` | **Paused and resumable** — the only meaning of 3. A session is saved; resume it within 24 hours. Since 0.7.1 sessions are durable from the first turn, so a crash that left a checkpoint also exits `3` and names the exact resume command (a crash before anything durable — or a failed pause save — still exits `1`). |

The sync verbs *(0.8.14)* keep the same three meanings with one addition: exit `3` is also **a person has to decide something** — a `kane-cli context push` or `kane-cli context pull` refused because you are behind or diverged (the remedy names the command), and a rebase that stopped on open decisions (answer them with `--answer`, or on a terminal). Exit `2` is a precondition (a location that cannot be reached, a rebase still open, missing keys); exit `1` a record that cannot be used. A refusal says what stopped, not that nothing happened. See [the sync verbs on the stream](#the-sync-verbs-on-the-stream).

## The NDJSON stream (`--mode agent`)

With `--mode agent`, stdout speaks a versioned NDJSON vocabulary — envelope `{"type": "<name>", "v": 1, "verb": "extract"|"design", ...}`, one object per line. The vocabulary is open: new event types may appear, so **tolerate unknown types**.

*(0.7.2)* The stream is **strict**: stdout carries only NDJSON — the first line is an event, `done` is the last — and stderr stays silent (crash traces excepted). No version banner, no receipts, no progress lines; everything user-relevant arrives as a typed event. On 0.7.1, prose diagnostics could ride stderr and a merged ingest printed receipt lines before the stream — a consumer that skips non-JSON prefix lines works on both releases.

| type | payload highlights |
|---|---|
| `ingested` *(0.7.1)* | one per source landed by a merged `context ingest … --mode agent` run — `source_id`, `status` (`created`/`unchanged`/`versioned`), `cid`; arrives **before** the extraction's own events |
| `run_start` | `mode`, `trace` (the per-run log path); design adds `use_case`; *(0.7.2)* `session` — a support id, present when telemetry is on |
| `corpus` | extract: the `sources[]` this run covers + already-extracted `skipped[]` |
| `source_start` / `source_skipped` | `source_id`, `index`/`total`, `resumed` / `reason` |
| `plan` | the `--plan` transcription payload |
| `assumed_default` | a question auto-answered with its recommended default: `id`, `selected_index`, `risk` — `ci` and `override` runs only; since 0.8.8 an `agent` run pauses instead |
| `agent_activity` | progress: `kind` (`tool` / `decision` / `progress` / `thinking_done`) + a display `label` |
| `agent_message` *(0.7.2)* | the agent's narrative `text` — the conversational lead-in before a question batch and the closing statement at the end of a run |
| `warning` *(0.7.2)* | an actionable non-fatal condition: `message`, plus `code` when there is one (`ZERO_USE_CASES`, `SAVE_FAILED`); a `.gitignore` that could not be written or a lifecycle note carries `message` alone — surface it either way |
| `lock_steal` *(0.7.2)* | a stale run lock was taken over: `key`, `stale_owner`, `by`, `ts` — observability only, no action needed |
| `usage` | per agent turn: `credits` + running `total_credits` (*(0.7.2)* rounded to two decimals) |
| `validate_failed` | a proposal failed kane-side validation: `codes[]`, `repairing` (the agent self-repairs) |
| `degraded` *(0.7.1)* | duplicate detection fell back to a reduced mode this run (`reason`) — new items are held for review instead of auto-committed |
| `held` / `update_held` *(0.7.1)* | items were **held** for your review instead of committed (`source_id`, `count`, `reason` / `count`, `targets[]`) — the `--trust hold` and degraded-detection paths |
| `commit` | what landed: counts + `minted[]` (`cid` + `logical_id`); extract adds `proposal_id` |
| `receipt` | per-phase commit receipt (design; extract emits one at its commits too) — `commit_n`, `phase`, `committed[]`, `warnings[]`, a human-readable `next` hint, and (design only) `parity` |
| `variables_declared` *(0.8.12)* | design: the stubs a phase commit wrote — `file` (the pool file) + `variables[]` (`name`, `description`, `secret`). Only names that existed in no variable file; fires after the `commit` that minted the tests |
| `variables_summary` *(0.8.12)* | design, at the end of the run: every name still needing a value — same shape as `variables_declared` |
| `message_sent` | your `--message` was delivered: `sid`, `chars` |
| `panel_resolved` *(0.7.1)* | a pending question was answered by a `--answer` flag: `id`, `by`, `via` |
| `ask_deferred` *(0.7.1)* | a pending question batch was set aside because `--with-source` landed a new source first: `source_id`, `cid`, `questions` (count) |
| `session_paused` | `sid`, the verbatim `resume` command, `expires_at`, and **`pending_questions[]`** in full. Two additional shapes *(0.7.1)*, distinguished by their fields: a crash-paused session carries `crashed: true` and **no** `pending_questions` (resume re-enters the conversation); a held-for-review pause carries only `sid`, `resume`, and `held` (a count) — no `expires_at` |
| `session_complete` | `sid` |
| `gate_refused` | a design gate refused the run (may be the first event) |
| `phase_entry_override` *(0.7.1)* | a design `--phase` entry point was applied: `phase`, `missing[]` |
| `error` | `message` + a stable `code` where one exists — e.g. `NO_STORE`, `PREFLIGHT`, `SOURCE_MISSING`, `BLOB_MISSING`, `HIGH_RISK_CI`, `STALE_BASIS`, `EXTRACT_LOCKED`, `TRUST_USAGE`, `TRUST_UNDER_CI`, `HOLD_MULTI_SOURCE`, `UC_UNREVIEWED`, `UNKNOWN_PHASE`, `PHASE_ORDER`, `CITE_UNVERIFIED`, `WRONG_VERB`, `INGEST_UNAUTHORIZED_REF`, `STRUCTURED_FLAGS_USAGE` / `STRUCTURED_TARGET_UNKNOWN` (a misused `--answer`/structured verdict; the unknown-target refusal lists the addressable ids), `PAIR_MISMATCH` / `BINDING_MISMATCH` (see below). *(0.7.2)* Three reconcile refusals carry a bracketed marker at the END of the message instead of a `code` — `[SOURCE_HELD]` (a head-move refused while a live review holds the source — finish the named session first), `[SESSIONS_UNREADABLE]` (the hold check could not run — unreadable session files fail closed; list/clean the sessions), and `[HELD_REVIEW]` (a headless `--apply` met a held review that needs a human); match the marker, not a `code` field. Many runtime failures are message-only |
| `done` | **always the last event**: `status` (`complete`/`paused`/`error`/`refused`/`interrupted`/`aborted`) + `exit_code`; may carry `next[]` |

**The `done` guarantee:** every `--mode agent` invocation that starts the stream ends it with exactly one `done` event — including refusals and graceful interrupts. *(0.7.2)* The stream starts at the first line: a merged ingest's landing failures (a bad path, an unsupported or oversized file, a refused URL, a misused `--mode` or `--as`) also arrive as `error` + `done` — codes `MODE_USAGE`, `AS_SINGLE_SOURCE`, `UNSUPPORTED_URL`, `INGEST_FAILED` — and sources already landed stay safe, with the run saying so. (On 0.7.1 these landing failures ended with a prose error line and exit `1`/`2` *before any NDJSON began* — no stream, no `done`.) The one exception on both releases is operator force: a second Ctrl+C can hard-kill the process (exit `130`) without a `done`. One command is shaped differently by design: `kane-cli context review --mode agent` keeps its `--json` output, so its verdict and drift listings are one JSON object per line with no `done` at the end (an empty listing prints nothing and exits `0`); its missing-store and open-rebase refusals are typed events followed by `done`; its other refusals exit without `done`. Read its exit code. Any other stream that ends without `done` should be treated as a crash. One more parsing note: the agent may also repair a draft mid-turn on its own — that surfaces only as `agent_activity` lines (labels like `validation failed`, `refining the draft`); treat activity labels as display text, never script against them.

Two more parsing rules:

- **Receipts and prefixes.** *(0.7.2)* Nothing precedes the stream — the landing receipts **are** the `ingested` events, and every stdout line parses as JSON. On 0.7.1, a merged ingest printed a few prose receipt lines per file before the NDJSON began, so strict per-line `JSON.parse` consumers had to skip non-JSON prefix lines. That skip is harmless on 0.7.2 — a version-tolerant consumer can keep it.
- **`next[]` carries follow-up commands** *(0.7.1)*. Pauses, gate refusals, and `done` can carry a `next` list of ready-to-run follow-ups. The common shape is objects (`{cmd, why, title}`); a few refusal sites emit plain strings — handle both, and treat every entry as a command to offer, not to auto-run.

### Reconcile's stream

`maintain reconcile --mode agent` speaks the same envelope with `verb: "reconcile"` and its own event set. *(0.7.2)* The stream opens with a minimal `run_start` (it carries `session` only — no `trace`), and the re-extract child rides the **same stream**: its extract-vocabulary events (`source_start`, `agent_activity`, `plan`, `commit`, …) interleave between the `reconcile_*` events, all stamped `verb: "reconcile"` — one command, one stream. The engine itself is unchanged: ADD/MODIFY auto-apply, ARCHIVE pauses, `--apply` resumes.

| type | payload highlights |
|---|---|
| `reconcile_plan` | the triage ahead: `source_id`, `plan_path`, `rows[]` (`kind`, `ref`, `why`), `archive[]` (proposed archivals with their evidence-decay reasons) |
| `reconcile_row_start` | per row: `kind`, `ref`, plus the impact counts where they apply (`stale`, `direct`) |
| `reconcile_row_end` | the row's `outcome` (`applied` \| `failed` \| `skipped` \| `plan-only` \| `paused`) + `exit_code`, and an additive `detail` carrying a failure's reason and hint (e.g. a `HELD_CITES_STALE` refusal with its re-stage hint). A row's embedded design run is folded in here, so the stream stays single-writer with exactly one `done` |
| `reconcile_paused` | `plan_path` + `pending[]` (`ref`, `why`) — resume with the same reconcile command (or `--apply`) |
| `reconcile_summary` | the honest totals, always the same field set: `applied`, `skipped`, `deferred`, `plan_only`, `failed`, `paused`, `stale_created` |
| `done` | always last — same guarantee as above |

Validation failures (bad inputs, unknown source, the fork guard) ride the stream as `error` + `done` with exit `2` — never stderr alone.

## The pause → answer → resume loop

This is the heart of driving assurance from an agent. A real exchange (events abridged, payloads shortened):

```bash
$ kane-cli context extract --mode agent
{"type":"run_start","v":1,"verb":"extract","mode":"agent","trace":"~/.testmuai/kaneai/assurance/…/logs/extract-….log"}
{"type":"corpus","v":1,"verb":"extract","sources":[{"source_id":"prd-online-store","cid":"sha256:0661…"}],"skipped":[]}
{"type":"agent_activity","v":1,"verb":"extract","kind":"decision","label":"asking to resolve an ambiguity"}
{"type":"session_paused","v":1,"verb":"extract","sid":"ext-20260716T140742-prd-online-store",
  "resume":"kane-cli context extract --resume ext-20260716T140742-prd-online-store --mode agent",
  "expires_at":"2026-07-17T14:07:53Z",
  "pending_questions":[{"id":"q1",
    "text":"The PRD conflicts on guest checkout; should I treat checkout as account-required or guest-allowed?",
    "risk":"high",
    "rationale":"Lines L20-L21 say all customers must create an account, but L35 says guest checkout is allowed.",
    "options":[{"label":"Account required","detail":"…"},{"label":"Guest allowed","detail":"…"}],
    "recommended_index":0,"allow_free_text":true}]}
{"type":"done","v":1,"verb":"extract","status":"paused","exit_code":3}
```

The pause event carries everything needed to decide: the question, why it matters, the options, and the recommendation. Answer **in plain words** — no question ids, no option indexes. After the resumed run's usual `run_start`, `corpus`, and `source_start` (with `"resumed": true`) events, the stream continues:

```bash
$ kane-cli context extract --resume ext-20260716T140742-prd-online-store --mode agent \
    --message "Account required — treat the update section as superseding: no guest checkout"
{"type":"message_sent","v":1,"verb":"extract","sid":"ext-…","chars":115}
{"type":"usage","v":1,"verb":"extract","credits":2.45,"total_credits":2.45}
{"type":"commit","v":1,"verb":"extract","derived":5,"minted":[{"cid":"sha256:6d68…","logical_id":"uc-create-an-account-to-order"}, …]}
{"type":"session_complete","v":1,"verb":"extract","sid":"ext-…"}
{"type":"done","v":1,"verb":"extract","status":"complete","exit_code":0}
```

The agent maps your statement to its own pending questions. A statement that answers nothing pending is treated as steering ("also cover the coupon path"); if questions remain unanswered, the run pauses again with refreshed questions.

Two structured alternatives to `--message` *(0.7.1)*:

- **Answer by id** — `--answer <question-id>=<option number | free text>` (repeatable, `--resume --mode agent` only). Each landed answer echoes as a `panel_resolved` event before the run continues:

  ```bash
  kane-cli context extract --resume <sid> --mode agent --answer q1=1 --answer q2="use the staging URL"
  ```

- **Land a source instead of answering** — `--resume <sid> --with-source <path|url>` lands the file or URL first and sets the pending batch aside (`ask_deferred` on the stream); the agent reads the new source and re-asks only what it didn't settle. Only refs **you** provide can land — anything else refuses with `INGEST_UNAUTHORIZED_REF`.

Between the pause and the resume, everything is inspectable without contending the session:

```bash
kane-cli context sessions --json                 # one row per resumable session, with its resume command
kane-cli context sessions show <sid> --json      # the pending questions in wire shape + any assumed defaults
```

Abandoned sessions expire after 24 hours; `kane-cli context sessions clean` garbage-collects them.

## Headless review

Trust promotion deliberately has **no auto-approve** — but it does have a non-interactive path. Prepare verdicts as JSON and land them atomically:

```bash
cat > verdicts.json <<'EOF'
[
  {"ref": "uc-create-an-account-to-order", "resolution": "approved"},
  {"ref": "uc-manage-the-cart",            "resolution": "approved"}
]
EOF
kane-cli context review --verdicts verdicts.json --json
```

`resolution` is one of `approved | edited | rejected | skipped | supersede` (optional `reason`, `edit`, `supersede_target`). One unresolvable ref fails the whole file (exit `2`, nothing committed). With `--json`, each landed verdict echoes as one NDJSON row.

Two 0.7.1 additions:

- **Structured verdict flags** — for scripted single decisions without a file: `--approve <refs...>` lands approvals; `--skip <refs...>` and `--defer <refs...>` record nothing and leave the items queued. Mutually exclusive with `--verdicts`.
- **Archives require explicit consent.** A headless rejection no longer destroys anything: rejected entries are held as non-destructive `pending_archive` facts (exit `0`, loudly summarized). Destroying them takes `--allow-archive` **plus** `--because "<reason>"` — and under `--mode ci`, archives are refused under any flag (exit `2`).

The rule stands: there is no auto-approve. These paths land **your** decisions faster; they never make them.

## Coverage on the stream *(0.7.1)*

`cover --mode agent` and `cover gaps --mode agent` speak the same envelope (`verb: "cover"` / `"gaps"`): the full `--json` payload arrives as **one** `coverage` (or `gaps`) event — *(0.8.2)* `cover gaps <uc-id>` emits the document closed over that use-case — and `done` closes the stream carrying the worklist's ready-to-paste commands in `next[]`. `--mode ci` speaks the identical stream. Any refusal is an `error` event + `done` with exit `2`.

<a name="the-sync-verbs-on-the-stream"></a>
## The sync verbs on the stream *(0.8.14)*

`kane-cli context sync`, `kane-cli context push`, `kane-cli context pull`, `kane-cli context clone` and the subcommands `kane-cli context sync add`, `kane-cli context sync list`, `kane-cli context sync remove`, `kane-cli context sync status` and `kane-cli context sync doctor` all take `--mode agent` and speak the same strict envelope with `verb: "sync"` — stdout is NDJSON only, stderr stays empty, `done` is last. None of them calls the agent or spends credits. `kane-cli context sync setup` is the one command that needs a terminal: under `--mode agent` it answers `error{code: TTY_REQUIRED}` naming `kane-cli context sync add` and `kane-cli context clone` as the alternatives. The full picture of what these commands do is in [Sharing the context graph with your team](./sharing.md).

| type | payload highlights |
|---|---|
| `sync_probe_started` / `sync_probe` | `kane-cli context sync add` and `kane-cli context clone`, around the location check (the slow part on a first GitHub fetch): `name`, `kind`; then `tier` (`1` = the location can publish; `2` or `3` = download only) and `detail` |
| `sync_status` | `kane-cli context sync status`: `name`, `relation` — `kind` (`up-to-date`, `behind`, `ahead`, `diverged`, `empty-storage`, `empty-local`, `foreign-lineage`), `local` and `storage` (each `{seq, hash}` of that side's last record, or null when that side is empty) and, on `diverged`, `at` (the first record number where the two sides differ; the last shared record is `at - 1`) — then `rebase_id` (the open rebase, or null) and `decisions[]` (each in the `sync_rebase_decision` shape). The event needs the location: when it cannot be reached the command refuses instead, and the decisions are not listed |
| `sync_status` with `--show <n>` | `kane-cli context sync status --show <n>` needs no location: `record[]` (the saved record in full, one line each), `decision`, `rebase_id`, `decisions[]`; `name` and `relation` are null |
| `sync_locations` / `sync_removed` | `kane-cli context sync list` / `kane-cli context sync remove` |
| `sync_pull_done` | `kane-cli context pull`, `kane-cli context sync`, `kane-cli context clone`: `name`, `imported`, `from`, `to`, `blobs`, `proposals`; `clone` adds `dir` |
| `sync_push_done` | `kane-cli context push`, `kane-cli context sync`: `name`, `from`, `to`, `pushed`, `blobs`, `proposals`, `already_there` |
| `sync_rebase_started` | `kane-cli context pull --rebase --yes`: `rebase_id`, `from`, `backup_path`, `moved[]`, `quarantined_tests[]` |
| `sync_rebase_item` | one per saved record: `seq`, `intent` (`extract`, `review`, `names`, `retire`, …), `outcome` (`reapplied`, `already-present`, `not-reapplied`, `decision`), `reason?` |
| `sync_rebase_decision` | one per open decision, in dependency order: `decision_id`, `kind`, `intent`, `seq`, `label`, `location`, `mine` and `theirs` (one line per side — the local change and the location's), `answers[]` (only the legal ones, each `{answer, consequence}`) |
| `sync_rebase_done` | once per walk, and once when `kane-cli context sync doctor --abort` closes a readable rebase: the four counts, `decisions_open`, `status` (`complete`, `paused`, `aborted`) |
| `sync_rebase_open` | `kane-cli context push` or `kane-cli context sync` while a rebase is still open — followed by `sync_error{SYNC_REBASE_PENDING}` |
| `sync_doctor` / `sync_rebase_exported` | `kane-cli context sync doctor` / `kane-cli context sync doctor --export` |
| `sync_behind` | the advisory from `kane-cli context extract`, `kane-cli design tests` and `kane-cli maintain reconcile` when a teammate has pushed since you pulled: `name`, `local_seq`, `storage_seq`, `text`; nothing is refused |
| `gitignore_updated` | `kane-cli context clone` and `kane-cli context sync doctor --export` (and `kane-cli context ingest` on its `extract` stream) when the new store's folder is inside a git repository and `.context/` was added to its `.gitignore`: `path` (`.gitignore`). When the line could not be written the store is still created and a `warning{message}` says why |
| `sync_error` | a sync refusal: always `code` (`SYNC_BEHIND`, `SYNC_DIVERGED`, `SYNC_REBASE_PENDING`, `SYNC_LOCATION_UNREACHABLE`, `SYNC_LOCATION_DENIED`, `SYNC_LOCATION_EMPTY`, `SYNC_READ_ONLY`, `SYNC_POSITION_TAKEN`, `SYNC_FOREIGN_LINEAGE`, `SYNC_GIT_REQUIRED`, `SYNC_PUBLICATION_UNKNOWN`, …), `detail`, `remedy` — the exact next command in plain words |
| `error` | a command-level refusal — a bad flag or an unknown decision id (`USAGE`), `MODE_USAGE`, `CREDENTIALS_MISSING`, `TTY_REQUIRED` — or a runtime failure: `message`, with optional `code` and `remedy`. A message-only event can be either (a missing store is a refusal with `message` alone), so read `message`, relay `remedy` when present, and tell the two apart by `done.exit_code` (`2` refused, `1` failed) |
| `done` | always last: `status` — `complete` (0), `refused` (2, or 3 when a person has to decide), `paused` (3), `error` (1), `interrupted` (130) — and `exit_code`. `paused` means decisions are waiting: after a rebase walk the rebase stays open; after `kane-cli context sync doctor --abort` the rebase is closed and the unanswered decisions stayed in the backup — the `sync_rebase_done` before it (`status` `paused` or `aborted`) tells the two apart. One more case: a rebase whose saved state cannot be read is set aside by `kane-cli context sync doctor --abort` with `sync_doctor` alone (`aborted: true`, a `detail` saying the backup is reapplied by the next `kane-cli context sync`) and no `sync_rebase_done` — read `sync_doctor.detail` |

The `done` guarantee holds: every one of these commands ends its stream with exactly one `done`, refusals included. Tolerate unknown types. A refusal says what stopped, not that nothing happened: `kane-cli context sync` finishes its pull before its push can be refused, and a push can land on the server before its confirmation is lost (`SYNC_PUBLICATION_UNKNOWN`) — the events before the `sync_error` say what completed.

**Decisions from an agent.** A rebase that meets a disagreement emits every open `sync_rebase_decision` before it stops with `done{paused, 3}`. Answer one by id — `--answer <decision_id>=<answer>` on `kane-cli context sync` or `kane-cli context pull`, repeatable — using only an `answer` the event listed; each run answers what it was given and stops again while cards remain. The last answer lets the rebase finish: `kane-cli context sync` then pulls and pushes in the same run, `kane-cli context pull` only pulls. The two sides are always `local` and the location's name; `mine` describes the local change and `theirs` the location's. Never guess an answer. `keep-theirs` writes nothing and is always offered, but it is a choice: the local change stays in the backup, and a later saved record built on it is looked at again. An unknown id, or an answer the card does not offer, is `error{USAGE}` and nothing is written; an answer that was checked against decisions that have since moved refuses with `SYNC_REBASE_PENDING` — read the decisions again before answering. Between runs, `kane-cli context sync status --json` re-lists the open decisions when the location can be reached, and `--show <n>` prints one saved record in full without touching the location. A real exchange with one decision (the backup path shortened):

```bash
$ kane-cli context pull origin --rebase --yes --mode agent
{"type":"sync_rebase_started","v":1,"verb":"sync","name":"origin","rebase_id":"2026-09-14T10-47-54-074Z-reset","from":3,"backup_path":"…/.context/sync/backups/2026-09-14T10-47-54-074Z-reset","moved":["000003-3551914b01f9.json"],"quarantined_tests":[]}
{"type":"sync_pull_done","v":1,"verb":"sync","name":"origin","imported":1,"from":2,"to":3,"blobs":0,"proposals":0}
{"type":"sync_rebase_item","v":1,"verb":"sync","rebase_id":"2026-09-14T10-47-54-074Z-reset","seq":3,"intent":"names","outcome":"decision","reason":"slug: \"spec\" names brief on origin (by bob at 2026-09-14T10:47:47.857Z)"}
{"type":"sync_rebase_decision","v":1,"verb":"sync","rebase_id":"2026-09-14T10-47-54-074Z-reset","decision_id":"h3","kind":"slug","intent":"names","seq":3,"label":"names spec","location":"origin","mine":"named prd \"spec\" at 2026-09-14T10:47:50.866Z","theirs":"\"spec\" names brief on origin (by bob at 2026-09-14T10:47:47.857Z)","answers":[{"answer":"keep-theirs","consequence":"the local change stays in the backup"},{"answer":"apply-mine","consequence":"the name moves to the local node; the node that holds it on origin is reached by its id again"}]}
{"type":"sync_rebase_done","v":1,"verb":"sync","rebase_id":"2026-09-14T10-47-54-074Z-reset","reapplied":0,"already_present":0,"not_reapplied":0,"decisions_open":1,"status":"paused"}
{"type":"done","v":1,"verb":"sync","status":"paused","exit_code":3}

$ kane-cli context sync origin --answer h3=keep-theirs --mode agent
{"type":"sync_rebase_item","v":1,"verb":"sync","rebase_id":"2026-09-14T10-47-54-074Z-reset","seq":3,"intent":"names","outcome":"not-reapplied","reason":"you kept origin's version"}
{"type":"sync_rebase_done","v":1,"verb":"sync","rebase_id":"2026-09-14T10-47-54-074Z-reset","reapplied":0,"already_present":0,"not_reapplied":1,"decisions_open":0,"status":"complete"}
{"type":"sync_pull_done","v":1,"verb":"sync","name":"origin","imported":0,"from":3,"to":3,"blobs":0,"proposals":0}
{"type":"sync_push_done","v":1,"verb":"sync","name":"origin","from":3,"to":3,"pushed":0,"blobs":0,"proposals":0,"already_there":0}
{"type":"done","v":1,"verb":"sync","status":"complete","exit_code":0}
```

**The fence.** While a rebase is open every write verb — `kane-cli context extract`, `kane-cli design tests`, `kane-cli maintain reconcile`, `kane-cli context ingest`, `kane-cli context review`, `kane-cli context name`, `kane-cli context retire`, `kane-cli context revert` and `kane-cli context push` — refuses with `sync_error{code: SYNC_REBASE_PENDING}` on its own stream and exit `2`. A test run is the exception: it does not refuse; the results it would record wait to the side and land on the first run after the rebase closes, and the run logs a warning. Finish the rebase (`kane-cli context sync` or `kane-cli context pull`, with answers) or close it (`kane-cli context sync doctor --abort`); never delete files under `.context/`. `kane-cli context name`, `kane-cli context retire` and `kane-cli context revert` take `--mode agent` too *(0.8.14)*: on success the stream ends with `done`, preceded by a `warning{message}` event for each note the command has (`kane-cli context revert` emits one per note); every refusal is typed.

**In CI** — clone once, pull before the run, push after, stop the job on exit `3` — the one maintained recipe is in [CI/CD recipes → A shared context store in CI](../cicd.md#a-shared-context-store-in-ci).

## When releases don't match

Sessions bind to the kane-cli release that created them, and the refusals are loud with the remedy in the message: `PAIR_MISMATCH` at startup (exit `2` — reinstall so the installed pieces match), `BINDING_MISMATCH` on resume (exit `2` — the session belongs to another release: start fresh, committed work is kept, or resume on the release that created it), and a mid-run "this version of kane-cli is no longer supported — update kane-cli and retry" (a message-only runtime failure, exit `1`). Hitting `BINDING_MISMATCH` on a paused session right after upgrading is expected, not corruption.

## Machine-readable reads

These read commands have structured forms: `context list --json` and `context sessions --json` (one JSON object per line), `context explain --json`, `context view --json` (the full computed graph payload), `context view --no-open --out graph.html` (render without a browser), `cover --json`, `cover gaps --json` (the nested coverage document — see [Coverage](./coverage.md)), and *(0.8.14)* `kane-cli context sync status --json` (the relation, the open rebase id and its decisions), `kane-cli context sync list --json` and `kane-cli context sync doctor --json`.

## Headless maintain

- `maintain reconcile --from <file> --source-id <id> --plan` — safe preview: records the source change, stages every proposed row into a stored plan, touches nothing else. Exit `0`; when the source actually changed, the plan path is the last stdout line (an unchanged source is a no-op that stores nothing).
- `maintain reconcile … --mode override` (or `--mode ci`) — unattended application: ADD and MODIFY rows apply, archiving never happens headless, and `ci` fail-closes the moment human judgement is needed (the plan is stored; exit `2`).
- Re-running the same reconcile command is idempotent — it resumes a pending plan, reports an applied one, and recomputes a superseded one ([details](./maintain.md#running-again)).
- Bare headless runs without an explicit `--mode` refuse with exit `2` — by design.

## A CI shape that works

```bash
# fail the pipeline on a high-risk question; low- and medium-risk ones take their recommended default:
kane-cli context extract --mode ci

# or: let it pause, surface the questions as a build artifact, resume in a follow-up job:
kane-cli context extract --mode agent > extract.ndjson; code=$?
if [ "$code" -eq 3 ]; then
  kane-cli context sessions --json > pending-sessions.ndjson   # hand to a human or an agent
fi

# design a specific use-case unattended, bounded:
kane-cli design tests --use-case uc-checkout --max 8 --mode ci

# keep the suite honest on requirement changes:
kane-cli maintain reconcile --from ./docs/prd.md --source-id prd --plan
```

Author and batch the resulting tests with the same CI patterns as any other test — see [testrun](../testrun.md) and [CI/CD recipes](../cicd.md).

## Next steps

- [The assurance overview](./overview.md) — where each command sits.
- [Building the context graph](./context.md) · [Designing tests](./design.md) · [Maintaining the suite](./maintain.md).
