# Coverage: what execution proved vs what design still owes

`kane-cli cover` measures coverage on two independent axes over the same store:

- **Depth** — what a real execution **proved**, read from an [evidence pack](../evidence.md)'s coverage records. Facts only: the pack was sealed with these verdicts inside it; `cover` never recomputes them.
- **Completeness** — what the design still **owes**, computed live from the `.context/` graph. A perfect pack can still ship with an unverified criterion or a happy-path-only use-case; this axis never reads packs.

A run can look green and still owe you coverage — that's exactly the situation the two axes make visible.

```bash
kane-cli cover [--from <pack>] [--json]                     # the two-axis panel
kane-cli cover gaps [--stage design|cover|all] [--top <n>] [--from <pack>]  # the ranked worklist
```

## The panel

```
coverage — 8f0e…f2.evidence

depth (proven by the pack):
  ◐ ███░░░░░░░  38%  uc-buy-as-a-guest — partial (1/4 ACs proven, 1 failed, 1 blocked)
  ✔ ██████████ 100%  uc-mobile-sign-in — covered (1/1 ACs proven)  · 1 stale

completeness (live graph):
  [high] create ac-payment-declined-message — no test verifies this AC
         → kane-cli design tests --use-case uc-buy-as-a-guest
```

- The default pack is the newest in `<cwd>/.testmuai/evidence`; `--from` takes a pack directory, a sealed `.evidence` file, or an execution id.
- Depth is **risk-weighted and lenient**: a high-risk criterion weighs more, and a passed-but-stale criterion still counts as proven — staleness is surfaced (`· N stale`), never silently demoted. Per-use-case status is `covered` (every AC proved) · `blocked` (something couldn't run, nothing failed) · `partial` · `uncovered`.
- Coverage reflects **this run**: sealed packs cover only what the run touched. Project-wide coverage lives in the graph axis, unaffected by any single pack.
- `--json` emits the full panel as structured data.

## `cover gaps` — the worklist

One ranked list (risk first) of what to do next, each row with a ready-to-paste command:

```
gaps — stage design (5)
   1. [high] create uc-checkout-while-signed-in — use-case has no scenarios
      → kane-cli design tests --use-case uc-checkout-while-signed-in
   2. [med] create ac-the-cart-displays-an-order-subtotal — no live test verifies this acceptance criterion
      → kane-cli design tests --use-case uc-manage-the-cart
```

- `--stage design` (default, no pack needed) — criteria no test verifies, use-cases with no or only-happy scenarios, recorded gap nodes from design runs, stale designed entities.
- `--stage cover` (needs a pack) — a covered criterion whose **execution** disappointed: `failed` → re-design that slice; `blocked` or never-run → the test exists, run it.
- `--stage all` — both, one ranking. `--top <n>` trims the list.

## The join: how a pack knows your graph

Every per-test result in an evidence pack carries a `definition_id` — a hash of the resolved test definition, identical to the one design stamps on each test it emits. The pack↔graph join is this hash equality and nothing else: no ids to sync, no registry to maintain. A hand-edited test hashes differently and simply stops joining — honest, not broken (a redesign — [`design tests --force`](./design.md#re-runs-and---force) or [`maintain evolve`](./maintain.md#evolve) — re-stamps the link).

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
