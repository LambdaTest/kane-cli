# kane-cli-browser-run

Run plain-English browser tests in GitHub Actions. One step sets up Chrome and Kane CLI on the runner, runs your objective or your committed `_test.md` files in a real headless browser, uploads the sealed evidence pack, and posts the verdict on the pull request.

[![Kane verified](https://img.shields.io/badge/Kane%20CLI-verified-2ea44f?logo=github)](https://testmuai.com/kane-cli)

## What it does

1. Sets up Node.js and Google Chrome (stable) on the runner
2. Installs Kane CLI and signs in with your TestMu credentials
3. Runs an inline objective, or every `_test.md` file matching a glob as one `testrun` suite with parallel workers
4. Uploads the sealed evidence pack as its own artifact, and the raw run logs as a second one
5. Writes a results table to the job summary and, on pull requests, posts or updates one PR comment
6. Fails the check when any test fails, errors, or times out

## Quick start

Add `LT_USERNAME` and `LT_ACCESS_KEY` as repository secrets (TestMu dashboard, Settings > Keys). Then create `.github/workflows/kane.yml`:

```yaml
name: Kane browser check
on: [pull_request]

permissions:
  contents: read
  pull-requests: write   # lets the action post the verdict comment

jobs:
  verify-ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: LambdaTest/kane-cli/integrations/github-action/kane-cli-browser-run@main
        with:
          objective: "Go to https://staging.myapp.com/pricing and verify the Pro plan card shows a monthly price"
          username: ${{ secrets.LT_USERNAME }}
          access-key: ${{ secrets.LT_ACCESS_KEY }}
```

No selectors and no test framework. Name the site in the objective (or pass `url`), and end with a `verify` or `assert` so the run has a pass/fail outcome. Objective-writing guidance: [Writing objectives](../../../docs/user-guide/running-tests.md#writing-objectives).

## Run your committed tests

Keep Kane tests as Markdown files in your repo and run all of them on every PR:

```yaml
      - uses: LambdaTest/kane-cli/integrations/github-action/kane-cli-browser-run@main
        with:
          test-files: "tests/**/*_test.md"
          parallel: "3"
          username: ${{ secrets.LT_USERNAME }}
          access-key: ${{ secrets.LT_ACCESS_KEY }}
```

Every matching file becomes a member of one `kane-cli testrun run` execution: one exit code, one sealed evidence pack, and up to `parallel` isolated Chrome workers. The PR comment and job summary show one row per test with its status and duration. Set `fail-fast: "true"` to stop dispatching members after the first failure.

Three things to know about suites:

- Each test takes its start URL and step timeouts from its own frontmatter (`url:`, `timeout:`). The `url` and `timeout` inputs apply to inline objectives only. Bound the whole suite with the job's `timeout-minutes`.
- All members must belong to one Test Manager project. A mixed suite is rejected before anything runs and the rows show why.
- Commit each test's `output-<name>/` directory alongside it so CI replays the recorded steps instead of re-authoring them. An unauthored test is authored on the first run.

File format and replay rules: [test.md overview](../../../docs/user-guide/testmd/overview.md). Suite behaviour: [Batch runs with testrun](../../../docs/user-guide/testrun.md).

## Examples

Copy any of these into `.github/workflows/` and adjust the objective, URL, and secrets.

| Example | Trigger | Shows |
|---|---|---|
| [pr-check-objective.yml](examples/pr-check-objective.yml) | `pull_request` | One inline objective on every PR |
| [pr-check-test-suite.yml](examples/pr-check-test-suite.yml) | `pull_request` | Every committed `_test.md` via a glob |
| [on-demand.yml](examples/on-demand.yml) | `workflow_dispatch` | Type an objective in the Actions tab and run it |
| [preview-deployment.yml](examples/preview-deployment.yml) | `deployment_status` | Test the preview URL Vercel, Netlify, or your deploy step reports |
| [nightly-smoke.yml](examples/nightly-smoke.yml) | `schedule` | Cron smoke suite that uses the action's outputs |

This repository also runs the action on itself. The `kane-cli-browser-run check` workflow ([.github/workflows/kane-cli-browser-run-check.yml](../../../.github/workflows/kane-cli-browser-run-check.yml)) runs [tests/latest-release_test.md](tests/latest-release_test.md) on demand: it opens the releases page, calls the GitHub API for the latest release, and asserts the two agree. Trigger it from the Actions tab to verify a clean runner can install Chrome and Kane CLI and complete a run.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `objective` | one of these two | | Plain-English test objective |
| `test-files` | one of these two | | Glob of `_test.md` files, e.g. `tests/**/*_test.md`. Runs as one `testrun` suite |
| `url` | no | | Start URL for an inline objective. Optional when the objective names the site |
| `username` | yes | | TestMu username (use a secret) |
| `access-key` | yes | | TestMu access key (use a secret) |
| `timeout` | no | `300` | Max seconds for an inline objective |
| `parallel` | no | `1` | Worker count for a suite |
| `fail-fast` | no | `false` | Stop dispatching suite members after the first failure |
| `extra-args` | no | | Extra flags: `run` flags for an objective (e.g. `--max-steps 40`), `testrun` flags for a suite (e.g. `--tags smoke`) |
| `comment-on-pr` | no | `true` | Post or update the verdict comment on the PR |
| `kane-version` | no | `latest` | Kane CLI version to install |
| `node-version` | no | `24` | Node.js version set up before the install |
| `install-chrome` | no | `true` | Install Chrome with `browser-actions/setup-chrome`. Set `false` when the runner already has it |
| `artifact-name` | no | `kane-evidence` | Prefix of the evidence artifact (the `.evidence` pack only). Give each matrix leg its own |
| `logs-artifact-name` | no | `kane-logs` | Prefix of the logs artifact (results table, raw stream, stderr) |

## Outputs

| Output | Description |
|---|---|
| `status` | `passed` or `failed` |
| `summary` | e.g. `4/5 tests passed` |
| `total` | Number of tests executed |
| `failed` | Number of failed tests |
| `results-file` | Path to the Markdown results table |

## Browser setup

Kane CLI drives Google Chrome through the DevTools Protocol, so the runner needs Chrome. By default the action installs the stable channel with `browser-actions/setup-chrome` and points Kane CLI at that exact binary through `KANE_CLI_CHROME_PATH`. Headless mode and the Linux sandbox flags are handled by Kane CLI itself.

- **Runner already has Chrome.** Set `install-chrome: false`. Kane CLI then looks in the standard locations (`/usr/bin/google-chrome` on Linux). For a non-standard path, set `KANE_CLI_CHROME_PATH` in the job `env`.
- **Slow or cold runners.** The action sets `KANE_CLI_CDP_TIMEOUT_MS` to `60000` and `KANE_CLI_CDP_RETRIES` to `2`. Raise either in the job `env` if Chrome is still slow to come up.
- **No Chrome at all** (minimal containers). Set `install-chrome: false` and either pass a remote browser in `extra-args` (`--ws-endpoint wss://...` for a TestMu grid session or `--cdp-endpoint http://...` — Kane CLI still runs on the runner and drives that browser), or move a `test-files` suite to the grid entirely with `--remote` in `extra-args`: install the plugin first (`kane-cli plugin install remote-execution` in a step before the action), and the suite runs as one HyperExecute job on a macOS runner — this also lets a Linux runner execute mobile `_test.md` suites. See [Remote runs on the cloud grid](../../../docs/user-guide/remote-execution.md).
- **Runner OS.** `ubuntu-latest` is the tested path. macOS and Windows runners work with the same Chrome setup.

Chrome environment variables are documented in [Configuration](../../../docs/user-guide/configuration.md#chrome-environment-variables).

## Evidence artifacts

Every run uploads two artifacts with 30-day retention, even when the run fails:

- `<artifact-name>-<run id>-<attempt>` (default prefix `kane-evidence`) holds only the sealed `.evidence` pack: one for an inline objective, one execution pack for a whole suite, plus a member's own pack when the suite authored an unrecorded test. Download it and open the pack with `kane-cli evidence serve <pack>`.
- `<logs-artifact-name>-<run id>-<attempt>` (default prefix `kane-logs`) holds `results.md`, `stream.ndjson` (the raw Kane CLI event stream), and `stderr.log`.

What a pack contains and how to read it: [Evidence](../../../docs/user-guide/evidence.md).

## PR comment

The comment needs the job to have `pull-requests: write`. Without it the action logs a warning and moves on; the job summary always carries the same table. Pull requests from forks get a read-only token, so the comment is skipped there. Set `comment-on-pr: false` to turn the comment off.

## Exit behaviour

Kane CLI exits `0` passed, `1` failed, `2` auth, setup, or invalid suite plan, `3` timeout or cancelled. The action fails the check for any non-zero exit and for a run whose final status is not `passed`, so broken UI never merges.

## Versioning

`@main` tracks the latest action. Pin to a release tag of this repository for a fixed version.
