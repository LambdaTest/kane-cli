<!-- kane-cli skill reference: assurance (requirements → designed suite → coverage). Read when the user has a requirements document and wants tests designed from it, coverage accounting, or suite upkeep. Requires kane-cli 0.6.1+. -->

# Assurance — Agent Surface

When the user has **requirements** — a PRD, a spec, acceptance notes — and wants tests designed from them, wants to know what's covered, or wants the suite kept current, use the **assurance commands** (`kane-cli context`, `design`, `cover`). Do not hand-write the tests, and do not reach for `generate`:

- `kane-cli generate` = quick scenarios/cases from a one-line description. No requirement linkage.
- **Assurance** = tests derived from the actual documents, every claim cited, every test permanently tagged with the acceptance criteria it verifies, coverage measured against requirements. Use it whenever the user cares about "what exactly is covered, and how do we know?"

Everything here works over a local store (`.context/` in the project directory) that the commands create and manage themselves.

**Version gate — check before improvising.** The assurance commands exist on kane-cli **0.6.1 and later**. On an older CLI, `kane-cli context …` fails as an *unknown command* (exit 2 with a "did you mean" suggestion) — that error means the CLI is too old, not that you typed it wrong. Confirm with `kane-cli --version`, tell the user to update (`npm install -g @testmuai/kane-cli`, or `brew upgrade kane-cli`), and stop — do not try to reproduce the workflow with other commands.

## 1. The journey — follow in order, stop at the checkpoints

```bash
kane-cli context ingest ./prd.md                             # 1. snapshot the requirements
kane-cli context extract --mode agent                        # 2. propose use-cases (may pause — §2)
kane-cli context review --verdicts <file> --json             # 3. CHECKPOINT: user approves use-cases
kane-cli design tests --use-case <uc-ref> --mode agent --max 8   # 4. design ACs, scenarios, tests
kane-cli context review --verdicts <file> --json             # 5. CHECKPOINT: user approves the design
kane-cli testmd run .testmuai/tests/<t>_test.md --agent      # 6. author each kept test once (real browser)
kane-cli testrun run --match 't-'                            # 7. batch replays from then on
kane-cli cover                                               # 8. what's proven vs what's owed
```

Two hard rules:

1. **The two checkpoints are the user's, not yours.** Everything the extract and design agents emit is *derived* (unreviewed) until a human decision promotes it — see §4. Do not start authoring (step 6) until the user has approved the design output or explicitly told you to proceed.
2. **One step at a time, one store-writer at a time.** Never run two store-mutating commands concurrently (`ingest`, `extract`, `review` with verdicts, `design`) — the store is single-writer (§8).

Steps 2, 4 call the KaneAI service and consume credits; everything else is local and free.

## 2. The pause loop — exit 3 is a pause, NOT a failure

**Scope: this rule applies to `context extract` and `design tests` only.** (For `run`/`testmd`/`testrun`/`generate`, exit 3 still means timeout/cancelled.)

These commands take **`--mode agent`** — not `--agent`; they reject that flag, and a bare non-TTY invocation exits `2` asking for an explicit mode. In `--mode agent`, low/medium-risk questions are auto-answered with their recommended defaults (each reported on the stream); a **high-risk** question pauses the run:

- The run exits `3`, emits `session_paused` with the session id, the questions in full (text, options, the recommended one, risk, rationale), and the verbatim resume command.
- **Never drop a pause** (same rule as generate clarifications). Answer it: if your own context clearly resolves the question, answer it yourself; otherwise surface the question — with its options and recommendation — to your user and get their answer.
- Resume with the answer **in plain words** — no question ids, no option indexes, no structured format. The agent maps your statement itself:

```bash
kane-cli context extract --resume <sid> --mode agent --message "Account required — the update section supersedes the older text"
```

- If the answer leaves a high-risk ambiguity standing, the run pauses again with refreshed questions — repeat.
- Sessions live 24 hours. Inspect without contending a live run: `kane-cli context sessions --json` (all resumable sessions + their resume commands) and `kane-cli context sessions show <sid> --json` (the pending questions in wire shape). If you abandon a session deliberately, remove it with `kane-cli context sessions clean <sid>` — bare `clean` only collects *expired* sessions, and `--all` is a purge that needs explicit user authorization.

Full event schema: `references/assurance-parsing.md`.

## 3. Extract — propose use-cases

```bash
kane-cli context ingest <files...>            # .md/.txt (≤2MB) and png/jpeg/webp (≤5MB); re-ingesting changed bytes versions the source
kane-cli context extract --mode agent         # covers every not-yet-extracted source; --source <id> for one; --force to redo
```

The agent reads the sources, proposes use-cases with **cited evidence** (exact quotes — fabrication is rejected before anything is written), asks when the source contradicts itself, and commits proposals as `derived`. Watch the `commit` event for what was minted and say it in plain language ("5 use-cases extracted from the PRD").

## 4. Review — trust is the user's decision

Promotion from `derived` to `trusted` **always requires explicit user confirmation** — even when the user asked for an "end-to-end" run. End-to-end authorizes completing the workflow, not making product-requirement judgements. Present the proposals, collect decisions, then land them atomically:

```bash
kane-cli context review --verdicts verdicts.json --json
```

`verdicts.json` is an array of `{"ref": "<slug-or-cid>", "resolution": "..."}` where resolution is exactly `approved | edited | rejected | skipped | supersede` (optional `reason`, `edit`, `supersede_target`). One unresolvable ref fails the whole file (exit `2`, nothing lands) — the error names the valid vocabulary. With `--json`, each landed verdict echoes as one NDJSON row.

Auto-approving is allowed **only** when the user explicitly says so ("approve the recommended items without asking me") — and even then, enumerate everything you promoted in your summary and still surface warnings and conflicts.

## 5. Design — from a trusted use-case to runnable tests

```bash
kane-cli design tests --use-case <uc-ref> --mode agent --max 8
```

- **Always pass `--max`** (start at 8; narrow for a smoke slice, widen only when the requirement breadth or the user justifies it). It caps **scenario+test pairs — deliverable size, NOT credits**. There is no spend cap: track the `usage` events' `total_credits` and report the total. If consumption looks runaway or a turn errors, stop and report — never auto-retry a paid turn.
- Omitting `--max` makes the agent estimate a size and ask — which in agent mode is a pause.
- Output: acceptance criteria, scenarios, exactly one test per scenario — written as runnable files under `.testmuai/tests/*_test.md`, each assert step tagged with the criteria it verifies. Plus **gaps** (recorded, ranked missing pieces — budget evictions, unresolved expected results) and **warnings** (e.g. a test claiming more criteria than its check asserts).
- **Present tests, gaps, AND warnings** — gaps and warnings are first-class output, not noise. Then go to the review checkpoint (§4) before any authoring.
- `kane-cli design explain <t-ref>` replays *why* a test exists (technique, boundary values, criteria) with zero AI cost — use it when the user asks "why this test?".

## 6. The authoring bridge — designed ≠ runnable-in-batch yet

A freshly designed test has never been executed. `kane-cli testrun run` **refuses never-authored tests** (preflight failure `missing_meta`) — that is by design, not a bug. The sequence is:

1. `kane-cli testmd run <file> --agent` once per kept test — the agent authors it in a real browser and commits the recording. Designed tests may carry `{{variables}}` for values the requirements never pinned (a store URL, a product name) — supply them per `references/testmd.md`.
2. From then on the test replays like any other: batch with `kane-cli testrun run` (`references/testrun.md`), evidence packs seal per `references/evidence.md`.

## 7. What's next — let the tool tell you

```bash
kane-cli cover            # two axes: what the latest evidence pack PROVED vs what the design still OWES
kane-cli cover gaps       # ranked worklist; every row carries a ready-to-paste command
```

Use `cover gaps` output to drive the next action instead of guessing. On 0.6.x use the plain output (or `cover --json` for the panel) — do not use `cover gaps --json`.

## 8. Store rules — don't corrupt the user's graph

- `.context/` is **append-only and single-writer**. Never run two store-mutating commands concurrently (extract, review verdicts, design, ingest, retire/revert/rebuild). On a lock error, another run is live: report it and wait — never delete lock files.
- Never hand-edit anything under `.context/`. Suggest the user gitignore it.
- Safe inspection any time: `kane-cli context list --json` (nodes with trust + freshness), `kane-cli context explain <ref>` (a node's full recorded history, no AI), `kane-cli context fsck` (integrity check), `kane-cli context view --no-open --out <path>` (writes a self-contained HTML graph snapshot to that path — never opens a browser, never touches the graph).
- Destructive verbs (`context retire`, `revert`, `rebuild`, `name --backfill`) exist and take `--yes` headless — run them **only on an explicit user request**, never autonomously.

## 9. When things fail

| Signal | Meaning | Do |
|---|---|---|
| `context`/`design`/`cover` is an *unknown command* (exit 2) | the CLI predates 0.6.1 | `kane-cli --version` to confirm; have the user update; stop |
| `error` code `NO_STORE` | no `.context/` here | `context ingest` the sources first (confirm the cwd is the project root) |
| `SOURCE_MISSING` / `BLOB_MISSING` | store references a missing source | re-ingest the source file |
| `STALE_BASIS` | the graph moved under the session | re-run the extract — it re-grounds |
| `HIGH_RISK_CI` | a `--mode ci` run hit a judgement call | re-run with `--mode agent` and handle the pause |
| lock held | another assurance run is live | wait for it; never break locks |
| `error` + `done` with exit `1` | runtime failure | report the message; **do not blindly re-run a paid command** |
| auth/credit failure mid-run | token or balance problem | keep the `sid`, have the user fix auth/balance (`kane-cli whoami`, `kane-cli balance`), then resume |
| stream ends with no `done` event | the process crashed — outcome unknown | check `context sessions --json` and `context list` before any retry, to avoid duplicate paid work |
| exit `130` | force-interrupted | resumable only if a `session_paused` event was actually received |

## 10. Narration

Same philosophy as SKILL.md §1 — translate, don't transcribe:

- Surface: pause questions (the deliverable when paused), commits ("5 use-cases extracted, 3 promoted to trusted"), designed tests + gaps + warnings, the credit total, and each checkpoint decision you're asking the user for.
- Fold: `agent_activity` lines (thinking/tool noise) into at most one progress remark.
- Never show event/field names, cids, or raw NDJSON to the user.

## 11. When requirements change

kane-cli can reconcile a changed requirements document into suite updates (`kane-cli maintain reconcile`) — operational guidance for it ships with the kane-cli release that carries its finalized contract. Until then, for a changed source: re-ingest it, review what went stale (`kane-cli context list --stale`), and re-design affected use-cases with the user's approval (`design tests --use-case <ref> --force`).
