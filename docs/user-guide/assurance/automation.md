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
| `agent` | low/medium-risk defaults are auto-taken (each reported); a **high-risk** question pauses the session — exit `3`, resumable | **NDJSON events** (one JSON object per line); prose diagnostics go to stderr |
| `ci` | any high-risk question **fails closed** — exit `1`, error code `HIGH_RISK_CI` | prose transcript |
| `override` | every default is auto-taken, including high-risk (each flagged in the commit record) | prose transcript |

Rule of thumb: `agent` when something can read the pause and answer (an AI agent, a human on the next shift); `ci` when a pipeline must never guess; `override` when you accept the recommended defaults wholesale and want one unattended pass.

The same matrix drives `maintain reconcile`, with two reconcile-specific rules: no headless mode ever archives anything — ARCHIVE decisions wait for an interactive session — and a `ci`-mode run that hits a decision needing a human **stores the plan and exits `2`** (the work isn't lost; walk the stored plan interactively or apply it in `agent` mode).

`context ingest` follows the matrix with one extra rule *(0.7.1)*: it lands the files and then runs the extraction under the given mode — except `--mode ci`, or piped stdin without any `--mode`, which **lands only** (exit `0`, with a stderr guidance line naming the next command). Two extraction dials also matter headless: `--trust hold` holds everything new for review instead of committing it (headless-only; `ci` refuses the flag entirely with exit `2`), and `--trust auto` is the default everywhere.

## Exit codes

Consistent across extract, design, and the maintain commands that embed them:

| Code | Meaning |
|---|---|
| `0` | Complete. |
| `1` | Runtime failure. For extract and design, a `ci`-mode fail-close on a high-risk question also exits `1`; reconcile's `ci` fail-close stores the plan and exits `2` instead. |
| `2` | Usage / auth / refusal — bad flags, failed input validation, no store, bare non-TTY without `--mode`, missing `--yes` on a destructive command. Nothing was mutated. |
| `3` | **Paused and resumable** — the only meaning of 3. A session is saved; resume it within 24 hours. Since 0.7.1 this includes crashes: sessions are durable from the first turn, so even an agent crash exits `3` and names the exact resume command. |

## The NDJSON stream (`--mode agent`)

With `--mode agent`, stdout speaks a versioned NDJSON vocabulary — envelope `{"type": "<name>", "v": 1, "verb": "extract"|"design", ...}`, one object per line. The vocabulary is open: new event types may appear, so **tolerate unknown types**.

| type | payload highlights |
|---|---|
| `ingested` *(0.7.1)* | one per source landed by a merged `context ingest … --mode agent` run — `source_id`, `status` (`created`/`unchanged`/`versioned`), `cid`; arrives **before** the extraction's own events |
| `run_start` | `mode`, `trace` (the per-run log path); design adds `use_case` |
| `corpus` | extract: the `sources[]` this run covers + already-extracted `skipped[]` |
| `source_start` / `source_skipped` | `source_id`, `index`/`total`, `resumed` / `reason` |
| `plan` | the `--plan` transcription payload |
| `assumed_default` | a question auto-answered with its recommended default: `id`, `selected_index`, `risk` |
| `agent_activity` | progress: `kind` (`tool` / `decision` / `progress` / `thinking_done`) + a display `label` |
| `usage` | per agent turn: `credits` + running `total_credits` |
| `validate_failed` | a proposal failed kane-side validation: `codes[]`, `repairing` (the agent self-repairs) |
| `degraded` *(0.7.1)* | duplicate detection fell back to a reduced mode this run (`reason`) — new items are held for review instead of auto-committed |
| `held` / `update_held` *(0.7.1)* | items were **held** for your review instead of committed (`source_id`, `count`, `reason` / `count`, `targets[]`) — the `--trust hold` and degraded-detection paths |
| `commit` | what landed: counts + `minted[]` (`cid` + `logical_id`); extract adds `proposal_id` |
| `receipt` | per-phase commit receipt (design; extract emits one at its commits too) — `commit_n`, `phase`, `committed[]`, `warnings[]`, `parity`, and a human-readable `next` hint |
| `message_sent` | your `--message` was delivered: `sid`, `chars` |
| `panel_resolved` *(0.7.1)* | a pending question was answered by a `--answer` flag: `id`, `by`, `via` |
| `ask_deferred` *(0.7.1)* | a pending question batch was set aside because `--with-source` landed a new source first: `source_id`, `cid`, `questions` (count) |
| `session_paused` | `sid`, the verbatim `resume` command, `expires_at`, and **`pending_questions[]`** in full. Two additional shapes *(0.7.1)*, distinguished by their fields: a crash-paused session carries `crashed: true` and **no** `pending_questions` (resume re-enters the conversation); a held-for-review pause carries `held` (a count) instead |
| `session_complete` | `sid` |
| `gate_refused` | a design gate refused the run (may be the first event) |
| `phase_entry_override` *(0.7.1)* | a design `--phase` entry point was applied: `phase`, `missing[]` |
| `error` | `message` + a stable `code` where one exists — e.g. `NO_STORE`, `PREFLIGHT`, `SOURCE_MISSING`, `BLOB_MISSING`, `HIGH_RISK_CI`, `STALE_BASIS`, `EXTRACT_LOCKED`, `TRUST_USAGE`, `TRUST_UNDER_CI`, `HOLD_MULTI_SOURCE`, `UC_UNREVIEWED`, `UNKNOWN_PHASE`, `PHASE_ORDER`, `CITE_UNVERIFIED`, `WRONG_VERB`, `INGEST_UNAUTHORIZED_REF`, `PAIR_MISMATCH` (see below). Many runtime failures are message-only |
| `done` | **always the last event**: `status` (`complete`/`paused`/`error`/`refused`/`interrupted`/`aborted`) + `exit_code`; may carry `next[]` |

**The `done` guarantee:** every `--mode agent` invocation ends its stream with exactly one `done` event — including refusals and graceful interrupts. The one exception is operator force: a second Ctrl+C can hard-kill the process (exit `130`) without a `done`. Any other stream that ends without `done` should be treated as a crash. One more parsing note: the agent may also repair a draft mid-turn on its own — that surfaces only as `agent_activity` lines (labels like `validation failed`, `refining the draft`); treat activity labels as display text, never script against them.

Two more parsing rules *(0.7.1)*:

- **A merged ingest prints receipts before the stream.** `kane-cli context ingest … --mode agent` prints its landing receipts — up to two prose lines per file — *before* the NDJSON begins. This is deliberate (the receipts belong to the landing, which precedes the extraction). A strict per-line `JSON.parse` consumer must skip non-JSON prefix lines, or start consuming at the first line that begins with `{`.
- **`next[]` carries follow-up commands.** Pauses, gate refusals, and `done` can carry a `next` list of ready-to-run follow-ups. The common shape is objects (`{cmd, why, title}`); a few refusal sites emit plain strings — handle both, and treat every entry as a command to offer, not to auto-run.

### Reconcile's stream

`maintain reconcile --mode agent` speaks the same envelope with `verb: "reconcile"` and its own event set:

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
{"type":"run_start","v":1,"verb":"extract","mode":"agent","trace":".context/logs/extract-….log"}
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

The agent maps your statement to its own pending questions. A statement that answers nothing pending is treated as steering ("also cover the coupon path"); if it leaves a high-risk ambiguity standing, the run pauses again with refreshed questions.

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

`cover --mode agent` and `cover gaps --mode agent` speak the same envelope (`verb: "cover"` / `"gaps"`): the full `--json` payload arrives as **one** `coverage` (or `gaps`) event, and `done` closes the stream carrying the worklist's ready-to-paste commands in `next[]`. `--mode ci` is the same with prose output. Any refusal is an `error` event + `done` with exit `2`.

## When the release pair doesn't match

The assurance commands ship as a matched pair of components inside one kane-cli release, and sessions bind to the pair that created them. Three refusals exist so a mismatch is loud instead of subtle, each naming its remedy:

- `PAIR_MISMATCH` (exit `2`, at startup) — the installed halves are from different releases; rebuild or reinstall so both halves match.
- `binding_mismatch` (exit `2`, on resume) — the session was created under a different release pair than the one resuming it; resume with the original pair, or abandon the session and start fresh.
- `client_unsupported` (exit `2`) — the service now requires a newer kane-cli release; upgrade and retry.

A paused session can hit `binding_mismatch` after upgrading kane-cli — that is the expected shape of "this session belongs to the old release", not a corruption.

## Machine-readable reads

These read commands have structured forms: `context list --json` and `context sessions --json` (one JSON object per line), `context explain --json`, `context view --json` (the full computed graph payload), `context view --no-open --out graph.html` (render without a browser), `cover --json`, and `cover gaps --json` (the nested dual-axis document — see [Coverage](./coverage.md)).

## Headless maintain

- `maintain reconcile --from <file> --source-id <id> --plan` — safe preview: records the source change, stages every proposed row into a stored plan, touches nothing else. Exit `0`; when the source actually changed, the plan path is the last stdout line (an unchanged source is a no-op that stores nothing).
- `maintain reconcile … --mode override` (or `--mode ci`) — unattended application: ADD and MODIFY rows apply, archiving never happens headless, and `ci` fail-closes the moment human judgement is needed (the plan is stored; exit `2`).
- Re-running the same reconcile command is idempotent — it resumes a pending plan, reports an applied one, and recomputes a superseded one ([details](./maintain.md#running-again)).
- Bare headless runs without an explicit `--mode` refuse with exit `2` — by design.

## A CI shape that works

```bash
# fail the pipeline on unresolved high-risk ambiguity, never guess:
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
