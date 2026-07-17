# The test lifecycle

kane-cli began as a way to author and replay browser tests. The **lifecycle** commands take on the step before and after: describe what your product must do, and kane-cli designs the tests that prove it — each one permanently linked to the requirement it verifies. Run them, and coverage stops being a guess: every run reports exactly what it proved and what it still owes. And as your product changes, the suite is reconciled instead of quietly rotting.

> Requires kane-cli **0.6.1 or later** (`kane-cli --version`). On 0.6.0 these commands fail after a fresh install — upgrade.

## The loop

```
  requirement docs                          product changes
        │                                          │
        ▼                                          ▼
  context ingest ──► context extract ──► context review ──► design tests
  (snapshot the      (agent proposes       (promote to       (ACs, scenarios,
   sources)           use-cases, cites      trusted)          one test per
                      every claim)                            scenario — written
                                                              as *_test.md files)
                                                                     │
                                                                     ▼
  maintain ◄── cover ◄── evidence pack ◄── testrun run ◄── testmd run ◄── context review
  (reconcile   (proven     (sealed proof)   (batch replay)   (author each    (approve the
   a changed    vs owed)                                      test once)      design output)
   source)
```

Every stage is a separate command, so you can stop, review, and resume at any point — nothing downstream happens without the upstream commit.

| Stage | Command | What it does |
|---|---|---|
| Capture | [`kane-cli context ingest`](./context.md#ingest) | Snapshot requirement documents into a local, content-addressed store (`.context/`) |
| Extract | [`kane-cli context extract`](./context.md#extract) | An agent reads the sources and proposes **use-cases**, citing the exact lines it read |
| Review | [`kane-cli context review`](./context.md#review) | You promote proposals to **trusted**, edit them, or reject them |
| Design | [`kane-cli design tests`](./design.md) | Turn one use-case into acceptance criteria, scenarios, and runnable tests — each test tagged with the criteria it verifies |
| Review the design | [`kane-cli context review`](./context.md#review) | Design output is `derived` too — approve, edit, or reject the generated ACs, scenarios, and tests |
| Execute | [`kane-cli testmd run`](../testmd/running.md), [`kane-cli testrun run`](../testrun.md) | Author and replay the designed tests; every run seals an [evidence pack](../evidence.md) |
| Measure | [`kane-cli cover`](./coverage.md) | Two axes: what a pack **proved** vs what the design still **owes** |
| Maintain | [`kane-cli maintain`](./maintain.md) | Reconcile the suite when a source document changes |

## The vocabulary

| Term | Meaning |
|---|---|
| **Source** | A requirement document you ingested — a PRD, a spec, a policy page. Content-addressed: editing the file and re-ingesting creates a new version. |
| **Use-case** | One thing a user needs to accomplish, extracted from sources with cited evidence. |
| **Acceptance criterion (AC)** | A single verifiable promise ("the cart holds at most 10 items"), with a machine-checkable oracle. |
| **Scenario** | One path through a use-case — happy, negative, boundary, edge. |
| **Test** | Exactly one runnable test per scenario (strict 1:1), written as a normal `*_test.md` file. |
| **derived / trusted / archived** | Trust states. Everything an agent proposes starts `derived` (unreviewed); your review promotes it to `trusted` or rejects it to `archived`. Nothing is silently trusted. |
| **fresh / stale / orphaned** | Freshness. When a source document changes, everything extracted from the old snapshot reads `stale` until re-verified; a node whose sources are all retired reads `orphaned`. |
| **Gap** | A recorded, ranked piece of missing coverage — a criterion no test verifies, a question nobody answered, a scenario cut by budget. Gaps are first-class output, not silence. |
| **Evidence pack** | The sealed `.evidence` file every run produces — the proof coverage is measured from. |

## The lifecycle vs `generate`

kane-cli has two ways to author tests, for two different jobs:

- **[`kane-cli generate`](../generate-test-cases/overview.md)** — quick test cases from a plain-language description. One prompt in, scenarios and cases out. Great for exploring coverage of a feature you can describe in a sentence.
- **The test lifecycle** — tests derived from your actual requirement documents, with every claim cited, every proposal reviewed, and a permanent, auditable link from each test back to the criteria it verifies. Use it when you need to answer "what exactly is covered, and how do we know?"

If you have a PRD and care about coverage accounting, start with the lifecycle. If you want ten good test ideas in a minute, start with `generate`.

## The store: `.context/`

The lifecycle commands work over a local store in your project directory, created on first `ingest`:

- It is **append-only**: nothing is ever deleted or rewritten. Edits create new versions; mistakes are reverted with compensation records. `kane-cli context explain` can replay the full history of any node.
- It is **yours and local**: sources, use-cases, designs, and review verdicts live in your project, not on a server. The extract and design agents run against the KaneAI service using your login, but the store they commit to is on your disk.
- **Keep `.context/` out of git merges.** The store is single-writer and not git-mergeable — two branches appending records will corrupt it on the next read. Gitignore it; share by re-ingesting sources.
- `kane-cli context fsck` verifies the whole store; `kane-cli context rebuild` regenerates the read caches from the verified records.

## What costs credits

`context extract`, `design tests`, and `maintain reconcile` (which embeds them) call the KaneAI agent and consume credits (`kane-cli balance` to check; each agent turn's cost is reported as it happens). Everything else — list, view, review, explain, cover, fsck — is local and free.

## Next steps

- [Building the context graph](./context.md) — ingest, extract, review.
- [Designing tests](./design.md) — from a use-case to runnable `*_test.md` files.
- [Coverage](./coverage.md) — proven vs owed, and how designed tests join execution.
- [Maintaining the suite](./maintain.md) — reconcile a changed source.
- [Automation](./automation.md) — running all of this headless in CI or from an agent.
