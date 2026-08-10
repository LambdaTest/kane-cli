<!-- kane-cli skill reference: NDJSON wire contract for the assurance conversational commands (context ingest/extract / design tests / maintain reconcile / cover with --mode agent). Internal parsing reference — never show these names to the user. -->

# Assurance NDJSON — Wire Contract

`kane-cli context extract --mode agent`, `kane-cli context ingest … --mode agent`, and `kane-cli design tests --mode agent` speak a versioned NDJSON vocabulary on stdout — one JSON object per line, envelope `{"type": "<name>", "v": 1, "verb": "extract"|"design", ...}`. Prose diagnostics go to stderr. `maintain reconcile --mode agent` (verb `reconcile`) and `cover`/`cover gaps --mode agent` (verbs `cover`/`gaps`) share the envelope with their own event sets (below).

**The vocabulary is open**: new event types and fields may appear in any release — tolerate unknowns, never fail on them.

**One stdout impurity to handle (0.7.1+):** a merged `context ingest … --mode agent` run prints its landing receipts — up to two prose lines per file — BEFORE the NDJSON begins (the receipts belong to the landing, which precedes the extraction). Skip non-JSON prefix lines; start parsing at the first line that begins with `{`.

## Terminal detection — the `done` guarantee

Every `--mode agent` invocation ends its stream with exactly one `{"type":"done","status":…,"exit_code":…}` — including refusals. Build all post-run logic on it, exactly like `run_end` for browser runs:

```text
for each line:
  if obj.type === "done"           → terminal: status ∈ complete|paused|error|refused|interrupted|aborted; stop
  else if obj.type === "session_paused" → capture sid + resume + pending_questions (the pause deliverable)
  else                             → per-type handling below
```

A stream that ends **without** `done` means the process crashed — outcome unknown; inspect `context sessions --json` and `context list` before retrying anything paid.

## Events (extract / design)

| type | payload highlights | handle |
|---|---|---|
| `ingested` *(0.7.1+)* | per source landed by a merged ingest run: `source_id`, `status` (`created`/`unchanged`/`versioned`), `cid`; arrives before the extraction's events | fold into one landing line |
| `run_start` | `mode`, `trace` (per-run log path); design adds `use_case` | note the trace path for debugging |
| `corpus` | extract: `sources[]` this run covers + already-extracted `skipped[]` | fold into one line |
| `source_start` / `source_skipped` | `source_id`, `index`/`total`, `resumed` / `reason` | progress |
| `plan` | the `--plan` transcription payload | present as the preview |
| `assumed_default` | a question auto-answered with its recommended default: `id`, `selected_index`, `risk` | mention that defaults were assumed (they are flagged in the commit) |
| `agent_activity` | `kind` (`tool`/`decision`/`progress`/`thinking_done`) + display `label` | noise — fold; **never script against labels** |
| `usage` | per agent turn: `credits`, running `total_credits` | track; report the final total |
| `validate_failed` | kane-side validation failed: `codes[]`, `repairing` | the agent self-repairs; only surface if the run then errors |
| `degraded` *(0.7.1+)* | duplicate detection running in a reduced mode (`reason`) — new items will be HELD, not committed | tell the user their items will be held for review |
| `held` / `update_held` *(0.7.1+)* | items held for the user's review instead of committed: `source_id` + `count` + `reason` / `count` + `targets[]` | surface the count and that review happens at resume/`context review` |
| `commit` | what landed: counts + `minted[]` (`cid` + `logical_id`); extract adds `proposal_id` | translate ("5 use-cases extracted"); `logical_id` slugs are how you reference nodes later |
| `receipt` | per-phase commit receipt (design; extract also emits one at its commits): `commit_n`, `phase`, `committed[]`, `reused`, `rejected[]`, `warnings[]`, `parity`, `next` | surface non-empty `rejected[]` and `warnings[]` in plain language; meaningful reuse is worth one line |
| `message_sent` | `--message` delivered: `sid`, `chars` | confirmation only |
| `panel_resolved` *(0.7.1+)* | a `--answer` flag landed on a pending question: `id`, `by`, `via` | confirmation only |
| `ask_deferred` *(0.7.1+)* | `--with-source` set the pending batch aside: `source_id`, `cid`, `questions` (count) | tell the user the questions were deferred while the agent reads the new source |
| `session_paused` | `sid`, verbatim `resume` command, `expires_at` (24 h), **`pending_questions[]`** | THE pause deliverable — see below |
| `session_complete` | `sid` | the session finished cleanly |
| `gate_refused` | a design gate refused the run (may be the first event); may carry `next[]` | surface the reason + offer the `next` commands |
| `phase_entry_override` *(0.7.1+)* | a design `--phase` entry applied: `phase`, `missing[]` | note the entry point |
| `error` | `message` + stable `code` when one exists — the 0.6.x set (`NO_STORE`, `PREFLIGHT`, `SOURCE_MISSING`, `BLOB_MISSING`, `HIGH_RISK_CI`, `STALE_BASIS`) plus the 0.7.1+ set (`EXTRACT_LOCKED`, `TRUST_USAGE`, `TRUST_UNDER_CI`, `HOLD_MULTI_SOURCE`, `UC_UNREVIEWED`, `UNKNOWN_PHASE`, `PHASE_ORDER`, `CITE_UNVERIFIED`, `WRONG_VERB`, `INGEST_UNAUTHORIZED_REF`, `PAIR_MISMATCH`, media families `PDF_*`/`DOCX_*`). Many runtime failures are message-only — never require a code | map per `references/assurance.md` §9 |
| `done` | **always last**: `status` + `exit_code`; may carry `next[]` | terminal |

**`next[]`** on pauses, refusals, and `done` lists ready-to-run follow-up commands. Usual shape: objects `{cmd, why, title}`; a few refusal sites emit plain strings — handle both. Offer them to the user; never auto-run a mutating `next` command.

## `session_paused` — the shapes the pause loop parses

The full pause (questions pending):

```json
{"type":"session_paused","v":1,"verb":"extract","sid":"ext-…",
 "resume":"kane-cli context extract --resume ext-… --mode agent",
 "expires_at":"…",
 "pending_questions":[{
   "id":"q1","text":"…the question…","risk":"high",
   "rationale":"…why it matters, with the conflicting evidence…",
   "options":[{"label":"…","detail":"…"},{"label":"…","detail":"…","input":true}],
   "recommended_index":0,"allow_free_text":true}]}
```

Two sibling shapes *(0.7.1+)*, distinguished by their fields — branch on presence:

- `crashed: true` and **no** `pending_questions` — a crash-paused session; the `resume` command re-enters the conversation, nothing to answer up front.
- `held` (a count) — the session holds items awaiting the user's review; resume presents them.

Use `text` + `options[].label` + `recommended_index` + `rationale` to decide or to present the question. An option carrying `input: true` *(0.7.1+)* needs a typed value with the pick — answer it via `--answer <id>="<value>"` or plain-words `--message`. The `resume` field is the exact command to run — append `--message "<plain words>"`, `--answer <id>=<v>` pairs, or `--with-source <ref>`.

## Reconcile events (verb `reconcile`)

`reconcile_plan` `{source_id, plan_path, rows[], archive[]}` → per row `reconcile_row_start` `{kind, ref, stale?, direct?}` + `reconcile_row_end` `{kind, ref, outcome: applied|failed|skipped|plan-only|paused, exit_code?, detail?}` → `reconcile_paused` `{plan_path, pending[]}` when ARCHIVE rows remain (exit 3; a human resumes with `--apply <plan_path>` in a terminal) → `reconcile_summary` `{applied, skipped, deferred, plan_only, failed, paused, stale_created}` on every path → `done` always last. Validation refusals ride the stream as `error` + `done` (exit 2), never stderr alone.

## Coverage events (verbs `cover` / `gaps`) *(0.7.1+)*

One payload event carrying the full `--json` document — `coverage` for `cover`, `gaps` for `cover gaps` — then `done` (with the worklist's ready-commands in `next[]`). Refusal = `error` + `done{refused, 2}`.

## Exit codes (these commands only)

| Code | Meaning |
|---|---|
| `0` | complete |
| `1` | runtime failure — incl. an extract sweep where some sources failed (each got one line; they retry next run). Report, don't blindly retry (turns already consumed credits) |
| `2` | usage/auth/refusal — bad flags, no store, bare non-TTY without `--mode`, gates (unreviewed target, phase order, trust misuse, lock held, release-pair mismatch); nothing mutated |
| `3` | **paused and resumable** — not a failure; run the pause loop. Includes crash-pauses (0.7.1+) |
| `130` | force-interrupted — resumable only if a `session_paused` event arrived |

Reminder: this exit-3 meaning is **specific to these assurance commands**. `run` / `testmd` / `testrun` / `generate` keep their own meanings (3 = timeout/cancelled).
