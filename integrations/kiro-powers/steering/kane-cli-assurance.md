# Kane CLI — assurance steering (requirements → designed suite → coverage → upkeep)

Load this file when the user has **requirement documents** (a PRD, a spec, acceptance notes) and wants tests designed from them, coverage accounting ("what exactly is covered?"), or the suite kept current when requirements change. For quick test cases from a one-line description, use `kane-cli generate` instead (load `kane-cli-generate.md`). Never write test cases by hand.

Requires kane-cli 0.6.1+ — on an older CLI, `kane-cli context …` fails as an *unknown command* (exit 2). That means the CLI is too old, not a typo: confirm with `kane-cli --version`, have the user update, and stop rather than improvising the workflow with other commands. Flags marked 0.7.1+ or 0.7.2+ need those releases — an *unknown option* error on one of them means the same thing.

# The journey — follow in order, stop at the checkpoints

```bash
kane-cli context ingest ./prd.md --mode agent                # 1. snapshot AND extract (0.7.1+ one flow; may pause — see below)
kane-cli context review --verdicts <file> --json             # 2. CHECKPOINT: user approves use-cases
kane-cli design tests --use-case <uc-ref> --mode agent --max 8   # 3. design ACs, scenarios, tests
kane-cli context review --verdicts <file> --json             # 4. CHECKPOINT: user approves the design
kane-cli testmd run .testmuai/tests/<t>_test.md --agent      # 5. author each kept test once (real browser)
kane-cli testrun run --match 't-'                            # 6. batch replays from then on
kane-cli cover gaps                                          # 7. designed % × proven %, with per-use-case debt + ready commands
```

- On 0.7.1+, `context ingest --mode agent` lands the files and extracts them in one flow. On 0.7.2+ the stream is strict — every stdout line parses as JSON, nothing precedes it, and landing failures (bad path, unsupported file, refused URL) ride the stream as `error` + `done`. On 0.7.1 the landing receipts print as a few prose lines BEFORE the NDJSON (skip to the first `{` line — harmless on 0.7.2+), and a landing failure ends with prose + exit 1/2 and no stream at all — a refusal to fix, not a crash. `kane-cli context extract --mode agent` remains the re-run/resume entry; on older releases run it after every ingest.
- Ingest accepts text/markdown/structured text (2MB), images (5MB), PDF (25MB, 0.6.7+), DOCX (25MB, 0.6.10+), Jira issue URLs (0.6.11+ — Jira must be connected in the user's LambdaTest Integrations screen; the refusal says so if not; 0.7.2+ also ingests all comments, and an issue last ingested pre-0.7.2 versions once on its next re-ingest — the upgrade catching up, not a content change), and Confluence page URLs (0.7.2+ — full URL, same Atlassian connection with Confluence access; default id `page-<id>`).
- The two checkpoints are the **user's** decisions: everything the agents emit is unreviewed (`derived`) until a human promotes it. Do not auto-approve unless the user explicitly said to — and then enumerate what you promoted. 0.7.1+ adds structured verdict flags (`context review --approve/--skip/--defer <refs...>`); `--skip`/`--defer` leave items queued. Rejections land as non-destructive holds — actually archiving needs the user's explicit `--allow-archive --because "<reason>"` (refused under `--mode ci`).
- Extract, design, and reconcile consume credits (reported per turn on the stream — surface the total). `--max` caps deliverable size (scenario+test pairs), **not** spend.
- Never run two store-mutating assurance commands at once — the `.context/` store is single-writer, and extraction holds a store lock (`EXTRACT_LOCKED` = another run is live; wait, never delete locks). Never hand-edit the store.

# The pause loop — exit 3 is a pause, NOT a failure

The conversational assurance commands (`context ingest`/`extract`, `design tests`, `maintain reconcile`) take **`--mode agent`** (never `--agent`; bare non-TTY exits 2 — the `cover` reads have no such gate). A high-risk question pauses the run: exit `3` + a `session_paused` event carrying the questions in full (options, recommended answer, risk, rationale) and the exact resume command. Never drop a pause:

1. If your context clearly answers the question, answer it; otherwise ask the user, showing the options and the recommendation.
2. Resume in **plain words**: `kane-cli context extract --resume <sid> --mode agent --message "<the answer>"` — or, on 0.7.1+, by id (`--answer q1=2 --answer q2="<typed value>"`) or by landing the source the agent needs (`--with-source <path|url>` — the pending questions defer while it reads, then only what's still open is re-asked).
3. Sessions are durable on 0.7.1+ — a crash that left a checkpoint exits 3 with the resume command. They expire in 24 h; `kane-cli context sessions --json` lists them; `sessions clean <sid>` removes one you abandoned.

This exit-3 meaning applies to these assurance commands only — `run`/`testmd`/`testrun`/`generate` keep 3 = timeout/cancelled.

# Design rules

Gates return commands, not dead ends (0.7.1+): designing an unreviewed or already-designed use-case exits 2 with the runnable follow-ups in the event's `next[]` — offer those to the user; never auto-run `--force` or `--allow-unreviewed`. There is no `--because` flag on `design tests`. Present the designed tests plus **gaps and warnings** — first-class output, not noise — then stop at the review checkpoint.

# The authoring bridge

Freshly designed tests fail `testrun` preflight (`missing_meta`) **by design** — author each once with `kane-cli testmd run` (they may carry `{{variables}}` for values the requirements never pinned), then batch. `kane-cli cover gaps` shows a dual-axis tree (designed vs proven, per-use-case debt) where every pending row carries a ready-to-paste command — use those to pick the next action (`--flat` keeps the old single-list shape for pipes; `--mode agent` on 0.7.1+ delivers the same data as one event plus `next[]`). A failing row leads with the evidence command — surface its warning that re-running an authored test against a broken app may heal the test around the failure.

# When requirements change

One command — never `context ingest` the new version first (reconcile re-ingests itself):

```bash
kane-cli maintain reconcile --from ./prd-v2.md --source-id prd --mode agent
```

It triages ADD / MODIFY / ARCHIVE rows on its own event stream; agent mode auto-applies the safe ADD/MODIFY tier and exits 3 with a stored plan when ARCHIVE rows need the user — archiving is never applied headless. Re-running the same command is idempotent (it resumes the plan, not the bill). `maintain evolve` is interactive-only — suggest the terminal rather than scripting around it.

0.7.2+ additions: in a terminal, reconcile holds every proposed change behind a review card — approve commits, reject drops with zero residue, defer mints a durable gap visible in `cover gaps`, and verdicts persist so Ctrl+C loses nothing (bare `--apply` resumes a held review agent-free; a headless run that meets one refuses, its message ending `[HELD_REVIEW]`). `--from` also takes the same Jira/Confluence URLs ingest takes — `--source-id` is then optional, and a contradicting one refuses. A head-move under a source a live session holds for review refuses with a `[SOURCE_HELD]` message marker (finish the named session first); an unreadable session file fails closed (`[SESSIONS_UNREADABLE]` — list/clean the sessions). After a deferred reconcile change, the store fails integrity checks and refuses commits on older kane-cli versions — machines sharing a store upgrade together. The re-extract child's events ride the reconcile stream itself, stamped `verb: "reconcile"`.

# Present, don't transcribe

Surface: pause questions, commits in plain language ("5 use-cases extracted, 3 promoted to trusted"), held items ("4 items are held for your review"), designed tests + **gaps + warnings** (first-class output), credit totals, and each checkpoint decision. At the checkpoints, present the material, not the counts: enumerate with `kane-cli context list --json --inferred` and pull item content with `kane-cli context explain <ref> --json`. Fold thinking/tool noise. Never show event names, cids, or raw NDJSON. `kane-cli design explain <ref>` answers "why does this test exist?" with zero AI cost.
