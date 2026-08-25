# Coverage: what execution proved vs what design still owes

`kane-cli cover` measures coverage on two independent axes over the same store:

- **Depth** — what a real execution **proved**, read from an [evidence pack](../evidence.md)'s coverage records. Facts only: the pack was sealed with these verdicts inside it; `cover` never recomputes them.
- **Completeness** — what the design still **owes**, computed live from the `.context/` graph. A perfect pack can still ship with an unverified criterion or a happy-path-only use-case; this axis never reads packs.

A run can look green and still owe you coverage — that's exactly the situation the two axes make visible.

```bash
kane-cli cover [--from <pack>] [--json] [--mode agent|ci]        # the pack audit panel
kane-cli cover gaps [--stage design|cover|all] [--top <n>] [--rollup lenient|strict] [--json] [--mode agent|ci]
kane-cli cover gaps <uc-id> [--json] [--mode agent|ci]           # the per-use-case dossier
```

> **Breaking changes (0.8.2):** `cover gaps --flat` and `cover gaps --from` are removed, and `--aspect` is renamed `--rollup`. The default output is the **coverage ribbon** described below. The nested `--json` document is the machine surface (its shape is unchanged), and `kane-cli cover --from <pack>` remains the pack-world audit.

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

## `cover gaps` — the coverage ribbon *(0.8.2)*

The default output is one continuous band-table over two axes, entirely graph-fed — no pack is opened or needed:

- **designed** — how much of the live requirement set has a live test verifying it (risk-weighted: high-risk criteria weigh more). Freshness never moves the number — stale criteria surface as `STALE` debt instead.
- **proven** — the store's **own execution facts** (every `testmd run` / `testrun run` records its verdicts at finalize), scored by the same formula a sealed pack uses — so the live number and a pack's number agree at the formula level. `--rollup lenient|strict` selects the formula (default `lenient`). With no recorded runs anywhere, the proven line says so in words — never a fake 0%.

The ribbon is deliberately high-level. A three-line header — the title with the rollup and how recently anything ran, then both axis bars, the proven line carrying the class census — then **one row per live use-case**, ordered by severity (failing → blocked → design debt → stale → pending-run → clean): id, title, designed and proven percent bars colored by value, and per-class debt counts (`FAILING · BLOCKED · STALE · TO DESIGN · TO RUN`). A count column renders only when some use-case carries that debt, and a narrow terminal drops the counts and keeps id, title, and bars. The last line is the drill-in hint. There are no AC rows, commands, or gap rosters at this level — detail lives in the dossier. With zero execution facts the all-clear reads `designed · nothing run yet`; the ribbon only ever says "proven" when every criterion's verifying test actually passed. Piped output keeps the same grammar; color and the width-responsive layout differ.

*(0.7.2)* A change you deferred during a [reconcile review](./maintain.md#reconcile) still surfaces here — in the ribbon's debt counts, and as a pending row in the dossier and the `--json` document with the reconcile command as its remedy. Deferring parks a decision, it never hides one.

### `cover gaps <uc-id>` — the dossier *(0.8.2)*

The dossier owns the detail for one use-case: its axis bars scoped to that use-case, then **every live acceptance criterion** in a full-text census table — `id · STATE · RISK · criterion`, wrapped, never truncated — proven and not-yet-run rows included. A failing row cites the test file when its id resolves to exactly one file (id-only otherwise), and a `next` actions block **leads with evidence, never a blind re-run**:

```
→ kane-cli evidence serve <pack>     (see why it failed)
```

with the run/design remediation second, carrying its own warning — a failed test re-run in authoring mode may heal itself around the failure, so fix the app first.

### Flags

- `--stage design|cover|all` (default `all`) filters the `--json` document's pending rows — it never moves a number, a row, or the table order.
- `--top <n>` bounds pending rows per use-case in the `--json` document; the table always renders one row per use-case and is never truncated.
- `--rollup lenient|strict` selects the proven-axis formula (default `lenient`).
- `--json` emits the nested machine document: the designed axis, the proven axis (absent entirely when the store has no execution facts), and the per-use-case pending rows, each carrying its `ready_command`. With a `<uc-id>` the document **closes over that use-case** — one entry, project-wide leftovers emptied. Debt that belongs to no live use-case rides only the `--json` document, never the human views.

## Agents and CI *(0.7.1)*

Both `cover` and `cover gaps` take `--mode agent|ci`: the run speaks the same NDJSON envelope as the other assurance commands — the whole `--json` payload arrives as a single `coverage` (or `gaps`) event — with a `<uc-id>`, the closed-over document *(0.8.2)* — `done` is always last, and `done`'s `next[]` carries the worklist's own ready-to-paste commands. A refusal is an `error` event plus `done` with exit `2`. See [Automation](./automation.md).

## The join: how a pack knows your graph

Every per-test result in an evidence pack carries a `definition_id` — a hash of the resolved test definition, identical to the one design stamps on each test it emits. The pack↔graph join is this hash equality and nothing else: no ids to sync, no registry to maintain. A hand-edited test hashes differently, so it stops joining — until the graph catches up at the test's next run, which records the edit as a superseding version and re-forms the link. A redesign ([`design tests --force`](./design.md#gates-re-runs-and---force) or [`maintain evolve`](./maintain.md#evolve)) re-stamps it the same way.

Coverage records land in packs automatically whenever the project has a `.context/` store — the inline `run`/`testmd` path and `testrun` both write them before sealing. A project without a store gets byte-identical packs to before; a coverage-write failure never costs the seal.

<a name="the-authoring-bridge"></a>
## The authoring bridge

A freshly designed test has never been executed, and the tooling is honest about that:

1. `kane-cli design tests` writes `t-…_test.md` files — runnable, but with no recording yet.
2. *(0.8.4)* [`kane-cli testrun`](../testrun.md) takes them anyway: at preflight each member classifies as **replay** (authored before) or **author** (fresh). Author members run standalone — the agent authors each in a real browser — and after both passes a **best-effort consolidation** merges the evidence into one published execution, with coverage recomputed and the facts synced into the graph. When consolidation cannot complete (a cancelled run, a merge that degrades), the source evidence is kept split rather than lost.
3. `kane-cli testmd run <file>` remains the way to author one test by itself.
4. Either way, an authored test replays like any other and its verdicts join the pack via `definition_id`. *(0.8.4)* `testrun --from-context` selects members by their assurance test ids and follows edit supersessions, so a superseded test stays connected — only tombstoned tests are excluded.

(Before 0.8.4 the bridge was manual: `testrun` refused never-authored members and each designed test had to run under `testmd run` once first.)

Until a test's first authored run, `cover` reads its criteria as *covered on paper, unproven in execution* (`covered_by` present, execution `not-run`). That is a deliberate reading, not a bug — a designed test is a claim until a run proves it.

## Inside the pack: `coverage/usecases.yaml`

The pack's coverage record is one YAML file you can read, diff, and archive — one row per live use-case: identity and risk, sources and provenance, scenarios, and each acceptance criterion with its verdict join (`covered_by`, `execution: passed|failed|blocked|not-run`, `fresh`, the expected answer, and what satisfied it). Diff two packs' `usecases.yaml` to see exactly what a release changed in proven coverage.

## Next steps

- [The authoring bridge in practice](./design.md#from-design-to-execution) — design → author → batch.
- [Maintaining the suite](./maintain.md) — act on what the gaps list tells you.
- [Evidence packs](../evidence.md) — everything else inside a pack.
