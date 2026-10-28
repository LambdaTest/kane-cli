# Policies and verdicts

<!-- release: needs evidence policies -->
> Needs the kane-cli release after **0.10.0-rc.3** (`kane-cli --version`).

A run tells you whether each test passed. A **policy** tells you whether the run as a whole is good enough: no broken tests, a pass rate above a floor, every test asserting something, no healed tests. kane-cli judges a sealed [evidence pack](./evidence.md) against a policy and writes the outcome, the **verdict**, to a file next to the pack.

- A policy is a small YAML file of **gates**. Each gate checks one metric of the pack.
- A verdict is one policy judged against one pack. It is `pass`, `fail` or `errored`.
- The pack is never changed. You can judge any sealed pack, at any time, against any number of policies.

You can judge a pack after the fact (`kane-cli evidence verdict`), or ask a run to judge its own pack (`--policy` on `testmd run`, `testrun run` and `evidence merge`). Either way, a failing verdict gives a non-zero exit code, so a CI job can gate on it.

## A first policy

Save this as `release-policy.yaml`:

```yaml
policy: release-gate
gates:
  - id: no-failed-tests
    metric: totals.failed
    equals: 0
    severity: blocking
    message: Every test must pass.
  - id: no-broken-tests
    metric: totals.broken
    equals: 0
    severity: blocking
  - id: checkout-pass-rate
    metric: pass_rate
    where: "'checkout' in test.tags"
    min: 0.95
    severity: blocking
    message: Checkout tests must pass at least 95% of the time.
  - id: every-test-checks
    metric: metrics.tests_without_checks
    equals: 0
    severity: blocking
    message: Every test must assert something.
  - id: no-healed-tests
    metric: metrics.heal.healed_tests
    max: 0
    severity: warning
    message: A healed test means the UI moved under a recorded step. Review the heal.
```

Check it, then judge the newest pack in the project with it:

```bash
kane-cli evidence lint-policy release-policy.yaml
kane-cli evidence verdict latest --policy release-policy.yaml
```

```text
verdict: fail — release-gate fail (no-failed-tests)
  /path/to/project/.testmuai/evidence/<execution_id>.evidence.verdicts/release-gate.verdict.json
```

The exit code is `1` because a blocking gate failed.

## The policy format

A policy is a YAML mapping. Unknown keys are refused, so a typo fails loudly instead of being ignored.

| Key | Required | Meaning |
|---|---|---|
| `policy` | yes | The policy id. It names the verdict file (`<policy>.verdict.json`), so it must start with a letter or digit and use only letters, digits, `.`, `_` and `-` (at most 128 characters). |
| `gates` | yes | A list of at least one gate. |
| `requires` | no | `catalog: <id>` and an optional `version: "<comparators>"` (for example `">=1"` or `">=1 <4"`). A pack whose metric catalog is a different one, or a version outside the range, is refused. |

### Gates

A gate is either a **metric gate** (one metric and exactly one operator) or an **expression gate** (a CEL expression that must be true).

| Key | Meaning |
|---|---|
| `id` | Gate id, unique within the policy. Same character rule as `policy`. |
| `severity` | `blocking`: a failure fails the verdict. `warning`: a failure is reported but does not fail the verdict. |
| `metric` | A built-in metric (`totals.failed`) or a kane-cli metric (`metrics.tests_without_checks`). See [Metrics](#metrics). |
| `equals` | Pass when the metric equals this number or string. |
| `min` | Pass when the metric is at least this number. |
| `max` | Pass when the metric is at most this number. |
| `range` | `[lo, hi]`: pass when `lo <= metric <= hi`. |
| `in` | A list: pass when the metric is one of these values. |
| `where` | Metric gates on a per-test metric only: a CEL expression over one test (`test`) that narrows the metric to the tests it holds for, for example `"'checkout' in test.tags"`. |
| `expr` | Expression gates only: a CEL expression over the pack (`run`, `tests`, `totals`, `failures`) that evaluates to a boolean. An expression gate takes no `metric`, `where` or operator. |
| `message` | Optional text, copied into the gate's result. |

Which operators a metric allows depends on its type:

| Metric type | Operators |
|---|---|
| `count`, `integer`, `ms`, `bytes`, `currency` | `equals`, `min`, `max`, `range`, `in` |
| `ratio`, `percentage`, `decimal` | `min`, `max`, `range` |
| `string`, `enum` | `equals`, `in` |

An expression gate:

```yaml
  - id: no-flaky-critical
    expr: "tests.filter(t, 'critical' in t.tags).all(t, !t.flaky)"
    severity: warning
```

### Limits

kane-cli refuses a policy before it judges anything when:

- the file is over 64 KB, or has more than 100 gates;
- its `policy` id breaks the character rule above;
- two policies given to one command share a `policy` id (each verdict needs its own file name).

### How values are read

Values are recomputed from the pack's own files where possible. A stored number that disagrees with its recompute **errors** the gate rather than passing it. A missing value is never read as zero: a test with no value for the metric, or a pack written by a kane-cli older than the metric needs, errors the gate. An errored gate errors the whole verdict, whatever its severity.

## Metrics

A policy can gate on two kinds of metric:

- **Built-in metrics**, which every pack has. Use them by their own name.
- **kane-cli metrics**, from the metric catalog kane-cli seals into every pack (`meta/metrics-catalog.yaml`). Always prefix them with `metrics.`.

List every metric your kane-cli can gate on:

```bash
kane-cli policy metrics-list
```

```text
METRIC                         TYPE   UNIT               LABEL
totals.tests                   count                     Tests
totals.failed                  count                     Failed tests
...
metrics.tests_without_checks   count  tests              Tests without checks
...

Built-in metrics: evidence-core 0.1. Producer metrics: kane-cli catalog v1 (controller).
```

Add `--pack <execution-id|path|latest>` to list what one pack supports: the built-in metrics plus the catalog that pack was sealed with. Use it when you judge an old pack. A pack with no catalog supports only the built-in metrics.

### Built-in metrics

| Metric | Type | Per test | Meaning |
|---|---|---|---|
| `totals.tests` | count | yes | Tests in the pack. |
| `totals.passed` | count | yes | Passed tests. |
| `totals.failed` | count | yes | Failed tests. |
| `totals.broken` | count | yes | Broken tests: the test could not be evaluated. |
| `totals.skipped` | count | yes | Skipped tests. |
| `pass_rate` | ratio | yes | passed ÷ (tests − skipped). Errors when every test was skipped. |
| `steps.total` | count | yes | Steps. |
| `steps.failed` | count | yes | Failed steps. |
| `steps.skipped` | count | yes | Skipped steps. |
| `run.duration_ms` | ms | no | The run's end time minus its start time. |
| `run.status` | enum | no | `running`, `finalized` or `aborted`. |
| `failures.count` | count | no | Rows in the pack's failure index. |

"Per test" metrics take a `where`.

### kane-cli metrics (catalog version 1)

| Metric | Type | Meaning |
|---|---|---|
| `metrics.tests_without_checks` | count | Tests with no assert step. Analyze steps that only read a value do not count as checks. |
| `metrics.heal.healed_tests` | count | Tests that failed on replay and passed after adaptive heal re-authored them. |
| `metrics.heal.exhausted_tests` | count | Tests that still failed after adaptive heal used its retries. |
| `metrics.heal.reauthored_steps` | count | Steps adaptive heal re-authored, summed over the tests where a heal ran. `--author` runs are left out. |
| `metrics.non_replay_tests` | count | Tests whose run was not a replay, so the result rests on an authoring run. |
| `metrics.flaky_rate` | ratio | Tests whose attempts disagreed, divided by all tests. |

kane-cli downloads the current catalog when it can and falls back to a cached or built-in copy. `kane-cli policy metrics-list` always shows what your installation will use.

## Checking a policy: `kane-cli evidence lint-policy`

```bash
kane-cli evidence lint-policy release-policy.yaml smoke-policy.yaml
```

```text
release-policy.yaml: ok
error: smoke-policy.yaml#/gates/0/metric: <message> (policy.unknown_metric)
```

Lint checks each file against the policy format and the kane-cli metric catalog: YAML that does not parse, unknown keys, a missing operator or two operators on one gate, duplicate gate ids, an unknown metric, a built-in metric written with the `metrics.` prefix, an operator the metric's type does not allow, a threshold of the wrong type, a `where` on a metric that is not per test, a CEL expression that does not parse or is not a boolean, the size and gate limits, and the id rules. It prints every problem in every file, each with its location (`<file>#/gates/0/metric`) and a code such as `policy.unknown_metric`.

| Flag | Meaning | Default |
|---|---|---|
| `--json` | One JSON object: `{"valid": true\|false, "files": [{"path", "diagnostics": [...]}]}` | off |
| `--env <name>` | Environment whose metric catalog to check against (`prod` or `stage`) | your default environment |

| Exit | Meaning |
|---|---|
| `0` | Every file is clean (warnings are allowed). |
| `1` | At least one file has an error. |
| `2` | A file could not be read, or the lint itself failed. |

You rarely need to run lint by hand before a run: `testmd run`, `testrun run` and `policy create` lint every policy first and stop with exit `2` on an error.

## Judging a pack: `kane-cli evidence verdict`

```bash
kane-cli evidence verdict <pack> --policy <file> [--policy <file> ...] [--policy-id <id> ...]
```

`<pack>` is an execution id (looked up in `.testmuai/evidence/`), the path to a sealed `.evidence` file, or `latest` (the newest sealed pack in `.testmuai/evidence/`, by modification time). You need at least one `--policy` or `--policy-id`.

| Flag | Meaning |
|---|---|
| `--policy <file>` | Policy YAML to judge against. Repeatable. |
| `--policy-id <id>` | A policy stored in Test Manager, at its latest version. Repeatable. See [Policies in Test Manager](#policies-in-test-manager). |
| `--json` | Print one JSON object: the summary and the full verdict documents. |
| `--env <name>` | Environment a `--policy-id` is read from (`prod` or `stage`). Defaults to your default environment. |

Repeat a flag for each policy (`--policy a.yaml --policy b.yaml`); a comma-separated list is read as one file name.

A `--policy-id` signs in with your active profile, the same credentials `kane-cli projects list` uses.

| Exit | Meaning |
|---|---|
| `0` | Every verdict passed. |
| `1` | At least one verdict failed, and none errored. |
| `3` | At least one verdict errored. |
| `2` | Usage or I/O error: no policy given, no such pack, a policy that cannot be read or fetched, a policy that does not check clean against the pack's catalog, a pack that cannot be read, or verdict files that cannot be written. |

When several policies are given, the combined result is `errored` if any verdict errored, else `fail` if any failed, else `pass`.

## Judging at run time

Pass `--policy` or `--policy-id` to a run and it judges its own sealed pack when it ends:

```bash
kane-cli testmd run tests/checkout_test.md --policy release-policy.yaml
kane-cli testrun run --tags smoke --policy release-policy.yaml --policy-id <id>
kane-cli evidence merge <targets...> --run-id nightly --policy release-policy.yaml
```

Both flags are repeatable and can be combined. They work the same on all three commands, with these rules:

- **Before anything runs**, `testmd run` and `testrun run` read and lint every policy. A policy error, an unknown `--policy-id` or a failed sign-in stops the run with exit `2`, so a policy mistake never costs you a run. Lint warnings print on stderr as `warn: policy …` and the run goes ahead. `testrun run --dry-run` checks the policies too.
- **After the pack seals**, the run judges it and writes the verdict files next to it. In a terminal, one `verdict: …` line prints on stderr. In agent mode, a `verdict` event goes out on stdout before the run's last event.
- **The exit code**: a failing verdict turns a passing run's `0` into `1`, and an errored verdict turns it into `3`. A run that already failed or was cancelled keeps its own exit code. The tests' own status (`test_md_done`, `testrun_done`) is not changed by the verdict.
- **A pack that did not seal** cannot be judged, so the verdict is `errored`.

Command by command:

| Command | Which pack is judged | Notes |
|---|---|---|
| `kane-cli testmd run` | The test's pack, in the session directory (`~/.testmuai/kaneai/sessions/<session-id>/evidence/<execution_id>.evidence`) | A replay's evidence upload to Test Manager carries the policies and verdicts. A run that authors or commits a test writes the verdict files and sets the exit code but uploads no verdict. |
| `kane-cli testrun run` | The suite's pack in `.testmuai/evidence/`, the one the run publishes | With `--remote`, the policies are not sent to the grid. Your machine judges the suite's pack once it is back. The policies are never passed on to the individual tests. |
| `kane-cli evidence merge` | The sealed merged pack | Policies are read before the merge but not linted: a policy that does not check clean is an `errored` verdict. `--policy` with `--no-finalize` is a usage error (exit `2`). `--json` adds a `verdict` object to the merge report. Exit `1` means a merge-rules abort or a failing verdict, `3` an errored verdict. |

`kane-cli run` (a one-off objective) does not take `--policy`. Judge its pack afterwards with `kane-cli evidence verdict`.

Exit `3` also means "cancelled or timed out" on run commands. When it matters which one happened, read the `verdict` event, or run `evidence verdict` on the pack yourself.

## Verdict files

Each verdict is its own JSON file in a folder next to the pack:

```text
<pack>.evidence
<pack>.evidence.verdicts/
  release-gate.verdict.json
  smoke.verdict.json
```

The file name is the policy's `policy` id. The verdict file is never written inside the pack, so judging a pack again overwrites the verdict file for that policy and leaves the pack as it was.

A verdict file looks like this (shortened):

```json
{
  "result": "fail",
  "exit_code": 1,
  "evaluated_at": "2026-10-27T10:15:02.000Z",
  "evaluator": "evidence-cli 0.2.0",
  "pack": { "run_id": "<execution_id>", "sha256": "…", "contract": "…" },
  "policy": { "id": "release-gate", "sha256": "…" },
  "catalog": { "...": "the catalog the pack was judged with" },
  "error": null,
  "failed_gates": ["no-failed-tests"],
  "warnings": ["no-healed-tests"],
  "errored_gates": [],
  "gates": [
    {
      "id": "no-failed-tests",
      "metric": "totals.failed",
      "where": null,
      "op": "equals",
      "expected": 0,
      "actual": 2,
      "severity": "blocking",
      "status": "fail",
      "message": "Every test must pass.",
      "error": null
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `result` | `pass`, `fail` or `errored`. |
| `exit_code` | `0`, `1` or `3`, matching `result`. |
| `gates[]` | One entry per gate: `status` is `pass`, `fail`, `warn` (a warning gate that failed) or `errored`; `expected` and `actual` show the comparison. |
| `failed_gates`, `warnings`, `errored_gates` | Gate ids by outcome. |
| `error` | Set when the whole verdict errored: `{code, message, hint}`. |
| `policy.sha256` | Hash of the exact policy bytes, so you can tell which version judged the pack. |

### `--json` output

`kane-cli evidence verdict --json` prints one object:

```json
{
  "evidence_id": "<execution_id>",
  "result": "fail",
  "exit_code": 1,
  "policies": [
    {
      "id": "release-gate",
      "sha256": "…",
      "result": "fail",
      "exit_code": 1,
      "counts": { "total": 5, "failed": 1, "warned": 0, "errored": 0 },
      "failed_gate_ids": ["no-failed-tests"],
      "errored_gate_ids": [],
      "file": "/path/to/<execution_id>.evidence.verdicts/release-gate.verdict.json"
    }
  ],
  "verdicts": [ { "...": "the full verdict documents" } ]
}
```

The `verdict` event a run prints in agent mode has the same fields as this object, with `"type": "verdict"` and without `verdicts`. An `error` field appears when nothing could be judged, and `files_error` when the verdicts were made but their files could not be written (a run warns and goes on; `evidence verdict` and `evidence merge` exit `2`).

## Policies in Test Manager

Store a policy in Test Manager once and the whole team judges with the same one, by id, without copying the YAML around.

### Create a policy

```bash
kane-cli policy create release-policy.yaml
```

```text
Created policy "release-gate" version 1 (<id>).
Judge with it: --policy-id <id>
```

`policy create` lints the file first and refuses it (exit `2`) on any error. Creating it again with new content stores a new version under the same id. Creating it again with the same content changes nothing and prints `Test Manager already has this content: …`.

The policy is scoped to a project: `--project <id>`, else the project your profile is set to (`kane-cli config project <id>`). With neither, the command stops with exit `2`.

### List policies

```bash
kane-cli policy list
```

```text
ID       NAME           VERSION  GATES  LAST RESULT
<id>     release-gate   2        5      pass

1 of 1
Judge with one: --policy-id <ID>
```

The list shows each policy's latest version, for your profile's project.

| Flag | Meaning | Default |
|---|---|---|
| `--project <id>` | Project whose policies to list | your profile's project |
| `--all-projects` | List every policy in the organization | off |
| `--search <term>` | Search by name | — |
| `--limit <n>` | Policies per page, 1 to 200 | `10` |
| `--page <n>` | Page number | `1` |

### Judge with a stored policy

Use `--policy-id <id>` anywhere `--policy <file>` works: `evidence verdict`, `testmd run`, `testrun run` and `evidence merge`. kane-cli fetches the **latest version** of that policy, checks that its content matches the hash Test Manager stored, and judges with it exactly like a file.

### Shared flags

`policy list` and `policy create` take the same sign-in flags as `kane-cli projects list`:

| Flag | Meaning |
|---|---|
| `--profile <name>` | Profile to use (default: the active one) |
| `--env <name>` | Environment (`prod` or `stage`) |
| `--username <user>` / `--access-key <key>` | Basic auth, skipping stored credentials |
| `--agent` | NDJSON output. On by default when stdin or stdout is not a terminal. |

`policy metrics-list` takes `--pack`, `--env` and `--agent`.

| Command | Exit `0` | Exit `1` | Exit `2` |
|---|---|---|---|
| `policy metrics-list` | listed | — | unknown pack, or a catalog that cannot be loaded |
| `policy list` | listed | Test Manager request failed | bad flag, or sign-in failed |
| `policy create` | created, or already stored | Test Manager request failed | no project, file unreadable, lint errors, sign-in failed, or Test Manager rejected the policy (its reasons are printed) |

## In CI

A run with `--policy` already fails the job on a failing verdict. Keep the verdict files with the packs so you can read them later:

```yaml
      - name: Run the smoke suite and judge it
        env:
          LT_USERNAME: ${{ secrets.LT_USERNAME }}
          LT_ACCESS_KEY: ${{ secrets.LT_ACCESS_KEY }}
        run: |
          kane-cli testrun run --tags smoke --headless \
            --policy .github/kane/release-policy.yaml \
            --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY" < /dev/null

      - name: Keep the evidence and verdicts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: kane-evidence
          path: .testmuai/evidence/
```

`testrun run` writes both the pack and its `.verdicts/` folder in `.testmuai/evidence/`, so one artifact path keeps both. The step fails on exit `1` (a test failed, or a verdict failed), `2` (a bad policy, before anything ran) or `3` (cancelled, or a verdict errored).

To keep "the tests failed" and "the policy failed" apart, run the suite in one step and judge it in another:

```yaml
      - name: Run the smoke suite
        env:
          LT_USERNAME: ${{ secrets.LT_USERNAME }}
          LT_ACCESS_KEY: ${{ secrets.LT_ACCESS_KEY }}
        run: kane-cli testrun run --tags smoke --headless --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY" < /dev/null

      - name: Judge the suite
        if: always()
        run: kane-cli evidence verdict latest --policy .github/kane/release-policy.yaml
```

Lint policy files in a pull request that changes them:

```bash
kane-cli evidence lint-policy .github/kane/*.yaml
```

More pipeline recipes: [CI/CD](./cicd.md).

## Next steps

- [Evidence packs](./evidence.md): what a pack holds, and how to view, validate and merge packs.
- [Batch runs with testrun](./testrun.md): one pack for a whole suite.
- [Running test.md files](./testmd/running.md): single-test runs and their flags.
- [Test Manager integration](./test-manager-integration.md): projects, folders and uploads.
