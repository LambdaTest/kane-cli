<!-- kane-cli skill reference: NDJSON wire contract for the assurance conversational commands (context extract / design tests with --mode agent). Internal parsing reference — never show these names to the user. -->

# Assurance NDJSON — Wire Contract

`kane-cli context extract --mode agent` and `kane-cli design tests --mode agent` speak a versioned NDJSON vocabulary on stdout — one JSON object per line, envelope `{"type": "<name>", "v": 1, "verb": "extract"|"design", ...}`. Prose diagnostics go to stderr; stdout stays pure events.

**The vocabulary is open**: new event types and fields may appear in any release — tolerate unknowns, never fail on them.

## Terminal detection — the `done` guarantee

Every `--mode agent` invocation ends its stream with exactly one `{"type":"done","status":…,"exit_code":…}` — including refusals. Build all post-run logic on it, exactly like `run_end` for browser runs:

```text
for each line:
  if obj.type === "done"           → terminal: status ∈ complete|paused|error|refused|interrupted|aborted; stop
  else if obj.type === "session_paused" → capture sid + resume + pending_questions (the pause deliverable)
  else                             → per-type handling below
```

A stream that ends **without** `done` means the process crashed — outcome unknown; inspect `context sessions --json` and `context list` before retrying anything paid.

## Events

| type | payload highlights | handle |
|---|---|---|
| `run_start` | `mode`, `trace` (per-run log path); design adds `use_case` | note the trace path for debugging |
| `corpus` | extract: `sources[]` this run covers + already-extracted `skipped[]` | fold into one line |
| `source_start` / `source_skipped` | `source_id`, `index`/`total`, `resumed` / `reason` | progress |
| `plan` | the `--plan` transcription payload | present as the preview |
| `assumed_default` | a question auto-answered with its recommended default: `id`, `selected_index`, `risk` | mention that defaults were assumed (they are flagged in the commit) |
| `agent_activity` | `kind` (`tool`/`decision`/`progress`/`thinking_done`) + display `label` | noise — fold; **never script against labels** |
| `usage` | per agent turn: `credits`, running `total_credits` | track; report the final total |
| `validate_failed` | kane-side validation failed: `codes[]`, `repairing` | the agent self-repairs; only surface if the run then errors |
| `commit` | what landed: counts + `minted[]` (`cid` + `logical_id`); extract adds `proposal_id` | translate ("5 use-cases extracted"); `logical_id` slugs are how you reference nodes later |
| `receipt` | design, per phase commit: `commit_n`, `phase`, `committed[]`, `reused`, `rejected[]`, `warnings[]`, `parity`, `next` | surface non-empty `rejected[]` and `warnings[]` in plain language; meaningful reuse is worth one line |
| `message_sent` | `--message` delivered: `sid`, `chars` | confirmation only |
| `session_paused` | `sid`, verbatim `resume` command, `expires_at` (24 h), **`pending_questions[]`** | THE pause deliverable — see below |
| `session_complete` | `sid` | the session finished cleanly |
| `gate_refused` | a design gate refused the run (may be the first event) | surface the reason |
| `error` | `message` + stable `code` when one exists (`NO_STORE`, `PREFLIGHT`, `SOURCE_MISSING`, `BLOB_MISSING`, `HIGH_RISK_CI`, `STALE_BASIS`) | map per `references/assurance.md` §9 |
| `done` | **always last**: `status` + `exit_code` | terminal |

## `session_paused` — the shape the pause loop parses

```json
{"type":"session_paused","v":1,"verb":"extract","sid":"ext-…",
 "resume":"kane-cli context extract --resume ext-… --mode agent",
 "expires_at":"…",
 "pending_questions":[{
   "id":"q1","text":"…the question…","risk":"high",
   "rationale":"…why it matters, with the conflicting evidence…",
   "options":[{"label":"…","detail":"…"},{"label":"…","detail":"…"}],
   "recommended_index":0,"allow_free_text":true}]}
```

Use `text` + `options[].label` + `recommended_index` + `rationale` to decide or to present the question to your user. The `resume` field is the exact command to run — append `--message "<plain words>"` with the answer. Never build structured answers; plain words only.

## Exit codes (these commands only)

| Code | Meaning |
|---|---|
| `0` | complete |
| `1` | runtime failure — report, don't blindly retry (turns already consumed credits) |
| `2` | usage/auth/refusal — bad flags, no store, bare non-TTY without `--mode`; nothing mutated |
| `3` | **paused and resumable** — not a failure; run the pause loop |
| `130` | force-interrupted — resumable only if a `session_paused` event arrived |

Reminder: this exit-3 meaning is **specific to these assurance commands**. `run` / `testmd` / `testrun` / `generate` keep their own meanings (3 = timeout/cancelled).
