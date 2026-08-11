# Coverage: what execution proved vs what design still owes

`kane-cli cover` measures coverage on two independent axes over the same store:

- **Depth** — what a real execution **proved**, read from an [evidence pack](../evidence.md)'s coverage records. Facts only: the pack was sealed with these verdicts inside it; `cover` never recomputes them.
- **Completeness** — what the design still **owes**, computed live from the `.context/` graph. A perfect pack can still ship with an unverified criterion or a happy-path-only use-case; this axis never reads packs.

A run can look green and still owe you coverage — that's exactly the situation the two axes make visible.

```bash
kane-cli cover [--from <pack>] [--json]                          # the pack audit panel
kane-cli cover gaps [--stage design|cover|all] [--top <n>] [--aspect lenient|strict] [--json]
kane-cli cover gaps --flat [--stage design|cover|all] [--top <n>] [--from <pack>] [--json]
```

> **Breaking change (0.6.8):** the default `cover gaps` output — and bare `cover gaps --json` — is now the **dual-axis tree** described below, and the default `--stage` on the tree is `all`. Pipe consumers of the old flat worklist should add `--flat` (which preserves the previous surface exactly, including its old default `--stage design`) or migrate to the nested JSON document.

## `cover` — the pack panel

```
coverage — 8f0e…f2.evidence

depth (proven by the pack):
  ◐ ███░░░░░░░  38%  uc-buy-as-a-guest — partial (1/4 ACs proven, 1 failed, 1 blocked)
  ✔ ██████████ 100%  uc-mobile-sign-in — covered (1/1 ACs proven)  · 1 stale

completeness (live graph):
  [high] create ac-payment-declined-message — no test verifies this AC
         → kane-cli design tests --use-case uc-buy-as-a-guest
```

The panel always shows **both** axes: the pack's proven depth, then the live-graph completeness worklist with its ready-to-paste commands (`--json` emits both as one document).

- The default pack is the newest in `<cwd>/.testmuai/evidence`; `--from` takes a pack directory, a sealed `.evidence` file, or an execution id.
- Depth is **risk-weighted and lenient**: a high-risk criterion weighs more, and a passed-but-stale criterion still counts as proven — staleness is surfaced (`· N stale`), never silently demoted. Per-use-case status is `covered` (every AC proved) · `blocked` (something couldn't run, nothing failed) · `partial` · `uncovered`.
- Coverage reflects **this run**: sealed packs cover only what the run touched. Project-wide coverage lives in the graph axis, unaffected by any single pack.
- `--json` emits the full panel as structured data.

## `cover gaps` — the dual-axis tree

The default output is a nested tree over two axes, entirely graph-fed — no pack is opened or needed:

- **designed** — how much of the live requirement set has a live test verifying it (risk-weighted: high-risk criteria weigh more). Freshness never moves the number: a stale-but-designed criterion still counts as designed, and surfaces as "needs refresh" debt plus a per-use-case stale count instead. Scenario debt is an adjacent count, never blended into a percentage.
- **proven** — the store's **own execution facts** (every `testmd run` / `testrun run` records its verdicts at finalize), scored by the same formula a sealed pack uses — so the live number and a pack's number agree at the formula level. `--aspect lenient|strict` selects the scoring formula (default `lenient`). With no recorded runs anywhere, the proven axis says so in words — never a fake 0%.

Under each use-case, the tree lists its **pending debt**, hottest first: failing → blocked → needs refresh → needs tests → needs scenarios → happy path only → possible duplicate → not yet run. Failing and blocked rows render per item; groups of three or more with the same remedy compress to an id roster plus one command. A failing row names the test that failed (`via T-3 card-add_test.md`) and **leads with evidence, never a blind re-run**:

```
→ kane-cli evidence serve <pack>     (see why it failed)
```

with the re-run command second, carrying its own warning — a failed test re-run in authoring mode may heal itself around the failure, so fix the app first.

Use-case rows carry an at-a-glance mark: `✗` (something failing) · `⏸` (something blocked) · `✖` (nothing designed) · `◐` (partial) · `✔` (fully green — such a row collapses to one line).

*(0.7.2)* A change you deferred during a [reconcile review](./maintain.md#reconcile) also appears here as a durable pending row, with the reconcile command as its remedy — deferring parks a decision, it never hides one.

Flags on the tree:

- `--stage design|cover|all` (default `all`) filters **which debt renders** — it never changes a mark or a percentage, and `--stage cover` needs no pack here.
- `--top <n>` bounds the pending rows shown per use-case (`… +K more`).
- `--from` belongs to the pack world: on the tree it exits `2` with a pointer to `kane-cli cover --from <pack>`. (It still works under `--flat`.)
- `--json` emits one nested document: the designed axis, the proven axis (absent entirely when the store has no execution facts), and the per-use-case pending rows, each carrying its `ready_command`.

### `--flat` — the legacy worklist

`cover gaps --flat` preserves the pre-tree surface exactly: one ranked list (risk first), the legacy default `--stage design`, a **global** `--top` slice (on the tree, `--top` is per use-case), and the pack-backed cover stage:

```
gaps — stage design (5)
   1. [high] create uc-checkout-while-signed-in — use-case has no scenarios
      → kane-cli design tests --use-case uc-checkout-while-signed-in
```

- `--stage design` (default, no pack needed) — criteria no test verifies, use-cases with no or only-happy scenarios, recorded gap nodes from design runs, stale designed entities.
- `--stage cover` (needs a pack; `--from <pack>` selects one) — a covered criterion whose **execution** disappointed: `failed` → re-design that slice; `blocked` or never-run → the test exists, run it.
- `--stage all` — both, one ranking.

`--flat --json` keeps the legacy `{stage, pack?, total, rows}` shape (rows gain additive `id`/`title`).

## Agents and CI *(0.7.1)*

Both `cover` and `cover gaps` take `--mode agent|ci`: the run speaks the same NDJSON envelope as the other assurance commands — the whole `--json` payload arrives as a single `coverage` (or `gaps`) event, `done` is always last, and `done`'s `next[]` carries the worklist's own ready-to-paste commands. A refusal is an `error` event plus `done` with exit `2`. See [Automation](./automation.md).

## The join: how a pack knows your graph

Every per-test result in an evidence pack carries a `definition_id` — a hash of the resolved test definition, identical to the one design stamps on each test it emits. The pack↔graph join is this hash equality and nothing else: no ids to sync, no registry to maintain. A hand-edited test hashes differently and simply stops joining — honest, not broken (a redesign — [`design tests --force`](./design.md#gates-re-runs-and---force) or [`maintain evolve`](./maintain.md#evolve) — re-stamps the link).

Coverage records land in packs automatically whenever the project has a `.context/` store — the inline `run`/`testmd` path and `testrun` both write them before sealing. A project without a store gets byte-identical packs to before; a coverage-write failure never costs the seal.

<a name="the-authoring-bridge"></a>
## The authoring bridge

A freshly designed test has never been executed, and the tooling is honest about that:

1. `kane-cli design tests` writes `t-…_test.md` files — runnable, but with no recording yet.
2. [`kane-cli testrun`](../testrun.md) preflight refuses never-authored members (`missing_meta`).
3. So the first run of each designed test is `kane-cli testmd run <file>` — the agent authors it in a real browser and commits the recording.
4. From then on the test replays like any other: batch it with `testrun`, and its verdicts join the pack via `definition_id`.

Until step 3 happens, `cover` reads the test's criteria as *covered on paper, unproven in execution* (`covered_by` present, execution `not-run`). That is a deliberate reading, not a bug — a designed test is a claim until a run proves it.

## Inside the pack: `coverage/usecases.yaml`

The pack's coverage record is one YAML file you can read, diff, and archive — one row per live use-case: identity and risk, sources and provenance, scenarios, and each acceptance criterion with its verdict join (`covered_by`, `execution: passed|failed|blocked|not-run`, `fresh`, the expected answer, and what satisfied it). Diff two packs' `usecases.yaml` to see exactly what a release changed in proven coverage.

## Next steps

- [The authoring bridge in practice](./design.md#from-design-to-execution) — design → author → batch.
- [Maintaining the suite](./maintain.md) — act on what the gaps list tells you.
- [Evidence packs](../evidence.md) — everything else inside a pack.
