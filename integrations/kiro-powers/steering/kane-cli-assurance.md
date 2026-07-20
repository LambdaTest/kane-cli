# Kane CLI — assurance steering (requirements → designed suite → coverage)

Load this file when the user has **requirement documents** (a PRD, a spec, acceptance notes) and wants tests designed from them, coverage accounting ("what exactly is covered?"), or the suite kept current. For quick test cases from a one-line description, use `kane-cli generate` instead (load `kane-cli-generate.md`). Never write test cases by hand.

Requires kane-cli 0.6.1+.

# The journey — follow in order, stop at the checkpoints

```bash
kane-cli context ingest ./prd.md                             # 1. snapshot the requirements
kane-cli context extract --mode agent                        # 2. propose use-cases (may pause — see below)
kane-cli context review --verdicts <file> --json             # 3. CHECKPOINT: user approves use-cases
kane-cli design tests --use-case <uc-ref> --mode agent --max 8   # 4. design ACs, scenarios, tests
kane-cli context review --verdicts <file> --json             # 5. CHECKPOINT: user approves the design
kane-cli testmd run .testmuai/tests/<t>_test.md --agent      # 6. author each kept test once (real browser)
kane-cli testrun run --match 't-'                            # 7. batch replays from then on
kane-cli cover                                               # 8. what's proven vs what's owed
```

- The two checkpoints are the **user's** decisions: everything the agents emit is unreviewed (`derived`) until a human promotes it. Do not auto-approve unless the user explicitly said to — and then enumerate what you promoted.
- Steps 2 and 4 consume credits (reported per turn on the stream — surface the total). `--max` caps deliverable size (scenario+test pairs), **not** spend.
- Never run two store-mutating assurance commands at once — the `.context/` store is single-writer. Never hand-edit it.

# The pause loop — exit 3 is a pause, NOT a failure

`context extract` and `design tests` take **`--mode agent`** (never `--agent`; bare non-TTY exits 2). A high-risk question pauses the run: exit `3` + a `session_paused` event carrying the questions in full (options, recommended answer, risk, rationale) and the exact resume command. Never drop a pause:

1. If your context clearly answers the question, answer it; otherwise ask the user, showing the options and the recommendation.
2. Resume in **plain words** — no ids, no indexes: `kane-cli context extract --resume <sid> --mode agent --message "<the answer>"`.
3. Sessions expire in 24 h — `kane-cli context sessions --json` lists them; `sessions clean <sid>` removes one you abandoned.

This exit-3 meaning applies to these assurance commands only — `run`/`testmd`/`testrun`/`generate` keep 3 = timeout/cancelled.

# The authoring bridge

Freshly designed tests fail `testrun` preflight (`missing_meta`) **by design** — author each once with `kane-cli testmd run` (they may carry `{{variables}}` for values the requirements never pinned), then batch. `kane-cli cover gaps` prints a ranked worklist with ready-to-paste commands — use it to pick the next action. On 0.6.x, use its plain output (not `cover gaps --json`).

# Present, don't transcribe

Surface: pause questions, commits in plain language ("5 use-cases extracted, 3 promoted to trusted"), designed tests + **gaps + warnings** (first-class output), credit totals, and each checkpoint decision. Fold thinking/tool noise. Never show event names, cids, or raw NDJSON. `kane-cli design explain <ref>` answers "why does this test exist?" with zero AI cost.
