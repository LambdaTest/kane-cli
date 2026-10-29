<!-- kane-cli skill reference: evidence policies and verdicts (judge a sealed pack against a policy YAML: lint-policy, evidence verdict, --policy/--policy-id on testmd run, testrun run and evidence merge, kane-cli policy metrics-list|list|create). Internal parsing reference: never show event or field names to the person. -->

# Policies and Verdicts — Agent Surface

**Version.** Needs the kane-cli release after 0.10.0-rc.3. If `kane-cli policy metrics-list` is an unknown command, or `--policy` is an unknown option, the installed build predates policies: say so and stop; do not fake a verdict by reading the pack yourself.

A **policy** is a YAML file of **gates** over a sealed evidence pack's metrics. A **verdict** is one policy judged against one pack: `pass`, `fail` or `errored`. The pack is never modified; each verdict is a JSON file beside it at `<pack>.verdicts/<policy-id>.verdict.json`.

Use a policy when the person wants a run judged on more than pass/fail: "no broken tests", "pass rate at least 95% on checkout", "every test must assert something", "fail CI if a test needed a heal".

## 1. Commands

| Command | What it does |
|---|---|
| `kane-cli policy metrics-list [--pack <id\|path\|latest>] [--env prod\|stage] [--agent]` | Every metric a policy can gate on: built-in metrics, then the kane-cli catalog as `metrics.<name>`. `--pack` = what one pack supports (the catalog it was sealed with). |
| `kane-cli evidence lint-policy <files...> [--json] [--env <name>]` | Check policy files against the format and the kane-cli catalog. Prints every problem. |
| `kane-cli evidence verdict <pack> (--policy <file> \| --policy-id <id>)... [--json] [--env <name>]` | Judge one sealed pack. `<pack>` = execution id, `.evidence` path, or `latest` (newest sealed pack in `<cwd>/.testmuai/evidence/` by mtime). |
| `kane-cli testmd run <file> --policy <f> / --policy-id <id>` | Lint before the run, judge the test's own pack after it seals. |
| `kane-cli testrun run … --policy <f> / --policy-id <id> < /dev/null` | Lint after the plan (dry run too), judge the suite's pack. `--remote`: the laptop judges the consolidated pack; the grid never gets the flag. |
| `kane-cli evidence merge <targets...> --run-id <id> --policy <f> / --policy-id <id>` | Judge the sealed merged pack. Files are read but **not** linted first (a bad policy = an errored verdict). `--no-finalize` with a policy = exit 2. |
| `kane-cli policy list [--project <id> \| --all-projects] [--search <t>] [--limit 1-200] [--page <n>] [--agent]` | Policies in Test Manager (latest versions). Default scope: the profile's project. |
| `kane-cli policy create <file> [--project <id>] [--agent]` | Lint, then store in Test Manager. New content under an existing `policy:` id = a new version; identical content = the stored version (`created: false`). Project: `--project`, else the profile's (`kane-cli config project <id>`); none = exit 2. |

`policy list` / `policy create` also take `--profile`, `--env`, `--username`, `--access-key`. `evidence verdict --policy-id` signs in with the active profile; `testmd run` / `testrun run` use the run's `--username` / `--access-key` when given.

**Flag rules.** `--policy` and `--policy-id` are repeatable and combine. Repeat the flag per policy; never comma-join (`--policy a.yaml,b.yaml` is one file name). Two policies with the same `policy:` id in one command are refused. `--policy-id` takes the id `policy list` prints (the `ID` column / `uid`), not the YAML name, and always judges the **latest version**.

## 2. Policy YAML

```yaml
policy: release-gate                 # required; names the verdict file; ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$
requires:                            # optional: refuse packs with another catalog / version
  catalog: kane-cli
  version: ">=1"
gates:                               # required, at least one; at most 100; file at most 64 KB
  - { id: no-failed, metric: totals.failed, equals: 0, severity: blocking }
  - { id: checkout-rate, metric: pass_rate, where: "'checkout' in test.tags", min: 0.95, severity: blocking }
  - { id: every-test-checks, metric: metrics.tests_without_checks, equals: 0, severity: blocking }
  - { id: no-heals, metric: metrics.heal.healed_tests, max: 0, severity: warning, message: Review the heal }
  - { id: no-flaky-critical, expr: "tests.filter(t, 'critical' in t.tags).all(t, !t.flaky)", severity: warning }
```

- A gate is **either** `metric` + exactly one of `equals` / `min` / `max` / `range: [lo, hi]` / `in: [...]`, **or** `expr` (CEL over `run`, `tests`, `totals`, `failures`, must be boolean) with no metric/operator/where.
- `severity`: `blocking` fails the verdict; `warning` reports (`status: warn`) without failing. An **errored** gate errors the verdict whatever its severity.
- `where` (CEL over one `test`) only on per-test metrics.
- Unknown keys are refused.
- Operators by type: counts/integers/ms/bytes/currency → all five; ratio/percentage/decimal → `min`/`max`/`range`; string/enum → `equals`/`in`.

**Metrics.** Built-in (no prefix): `totals.tests`, `totals.passed`, `totals.failed`, `totals.broken`, `totals.skipped`, `pass_rate` (ratio; errors when every test skipped), `steps.total`, `steps.failed`, `steps.skipped` (all per test), `run.duration_ms`, `run.status` (enum `running|finalized|aborted`), `failures.count`. kane-cli catalog v1 (always `metrics.` prefix, all per test): `tests_without_checks`, `heal.healed_tests`, `heal.exhausted_tests`, `heal.reauthored_steps`, `non_replay_tests` (counts), `flaky_rate` (ratio). Run `kane-cli policy metrics-list --agent` for the installed truth before writing a gate; never invent a metric name.

**Values.** A missing value is never zero: no value for the metric, or a pack older than the metric needs, **errors** the gate. A stored number that disagrees with its recompute also errors it.

## 3. Exit codes

| Command | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `evidence verdict` | all pass | a verdict failed (none errored) | usage / I/O: no policy given, no pack, unreadable or unfetchable policy, a policy that doesn't check clean against the pack's catalog, unreadable pack, verdict files not written | a verdict errored |
| `evidence lint-policy` | clean (warnings allowed) | any error | file unreadable or lint threw | — |
| `testmd run` / `testrun run` with a policy | passed and verdict pass | tests failed, **or** tests passed and verdict failed | bad policy before anything ran (lint error, unknown `--policy-id`, sign-in failure), plus the command's usual 2s | verdict errored (tests passed), **or** cancelled / timed out |
| `evidence merge` with a policy | merged, verdict pass | merge-rules abort (no pack) or verdict failed (pack + verdicts written) | usage (incl. `--no-finalize`), verdict files not written | verdict errored |
| `policy metrics-list` | ok | — | unknown pack / catalog won't load | — |
| `policy list` | ok | Test Manager failure | bad flag / sign-in | — |
| `policy create` | created or already stored | Test Manager failure | no project, unreadable, lint errors, rejected by Test Manager (problems printed), sign-in | — |

A verdict only changes a **clean 0**: failing → 1, errored → 3. A run that already failed or was cancelled keeps its own code. `test_md_done.overall_status` / `testrun_done.overall_status` stay the **tests'** status: read the `verdict` event for the policy result. Exit 3 is ambiguous on runs (errored verdict vs cancel/timeout): the `verdict` event decides it.

## 4. The `verdict` event (agent mode)

`testmd run`, `testrun run` (local and `--remote`) emit one typed line on stdout after the pack is judged and **before** the terminal event (`test_md_done`; `testrun_summary`/`testrun_done`; `remote_done`, whose `exit` already includes the verdict):

```json
{"type":"verdict","evidence_id":"<execution_id>","result":"fail","exit_code":1,
 "policies":[{"id":"release-gate","sha256":"…","result":"fail","exit_code":1,
   "counts":{"total":5,"failed":1,"warned":0,"errored":0},
   "failed_gate_ids":["no-failed"],"errored_gate_ids":[],
   "file":"/abs/path/<execution_id>.evidence.verdicts/release-gate.verdict.json"}],
 "v":1,"ts":"…"}
```

- Combined `result`: errored if any policy errored, else fail if any failed, else pass.
- `error` (top level): nothing could be judged (e.g. the pack did not seal) — `policies` is empty.
- `policies[].error`: that verdict errored as a whole — `{code, message, hint}`.
- `files_error`: verdicts were made but files could not be written; the run warns and continues (verdicts still upload with the evidence).
- In a terminal the same information is one stderr line: `verdict: fail — release-gate fail (no-failed)`.

`evidence verdict --json` prints the same object without `type`, plus `verdicts: [<full verdict documents>]`. `evidence merge --json` adds it to the merge report as `verdict: {…}`.

Parsing:

```text
if type === "verdict":
  policy_result = result            # pass | fail | errored
  for p in policies: note p.id, p.result, p.failed_gate_ids, p.errored_gate_ids, p.file
  if error: the pack could not be judged — report error, not a gate failure
```

## 5. The verdict file

`<pack>.verdicts/<policy-id>.verdict.json` (the `policy:` value). Fields: `result`, `exit_code`, `evaluated_at`, `evaluator`, `pack {run_id, sha256, contract}`, `policy {id, sha256}`, `catalog`, `error`, `failed_gates[]`, `warnings[]`, `errored_gates[]`, and `gates[]` with `{id, metric | expr, where, op, expected, actual, severity, status: pass|fail|warn|errored, message, error}`. To explain a failure, read `gates[]` where `status` is `fail` or `errored` and give `expected` vs `actual`.

**Where the folder is.** Always beside the pack that was judged; trust `policies[].file` over guessing.

| Surface | Pack judged |
|---|---|
| `evidence verdict` | the pack you named (`latest` → `<cwd>/.testmuai/evidence/<id>.evidence`) |
| `testmd run` | the session-directory pack `~/.testmuai/kaneai/sessions/<session-id>/evidence/<id>.evidence` (not the `.testmuai/evidence/` copy) |
| `testrun run` (local or `--remote`) | the suite's pack in `<cwd>/.testmuai/evidence/` |
| `evidence merge` | the merged pack (`-o`, default `<cwd>/.testmuai/evidence/<run-id>.evidence`) |

Judging again overwrites that policy's file; the pack never changes.

## 6. Presenting results

Never show event or field names. One row in the result card:

```markdown
| 🔴 **Policy** | release-gate failed: 2 tests failed (expected 0) · 1 warning: a test needed a heal |
```

Use 🟢 pass, 🔴 fail, 🟡 errored (say *why* it couldn't be judged — a missing value, a pack that didn't seal — not "failed"). When the tests passed but the policy failed, say both plainly: "All 12 tests passed, but the release-gate policy failed: …". Offer to open the evidence (`references/evidence.md`).

## 7. Common mistakes

- **`kane-cli run` has no `--policy`.** Judge a one-off run afterwards: `kane-cli evidence verdict <pack> --policy <f>` (the pack path is in the stderr evidence hint).
- **Built-in metrics never take `metrics.`** (`totals.failed`, not `metrics.totals.failed`); kane-cli catalog metrics always do (`metrics.flaky_rate`). Lint reports `policy.builtin_prefixed` / `policy.unknown_metric`.
- **Two operators on one gate**, or `where` on an expression gate / a non-per-test metric: lint error.
- **`min`/`max` on a ratio means 0–1**, not percent: `min: 0.95`, not `95`.
- **Judge sealed packs only.** An unsealed pack directory cannot be judged (the verdict errors), and `evidence merge --no-finalize` with a policy is refused.
- **Lint before you run** a newly written policy: `kane-cli evidence lint-policy <file> --json`, then fix every `diagnostics[]` entry (`location`, `message`, `code`, `hint`). Runs lint for you, but a lint error there costs an exit 2 the person sees.
- **Don't parse `testrun_done.overall_status` for the gate** — it is the tests' status. The policy result is only in the `verdict` event, the exit code, and the files.
- **`--policy-id` needs a sign-in**; a failed sign-in is exit 2 before anything runs. Never ask for an access key in chat (`references/ready-check.md`).
- **Writing a policy for the person**: write the YAML from their words, run `metrics-list` to pick real metrics, lint it, and show them the gates before storing it with `policy create` (which shares it with their Test Manager project).
