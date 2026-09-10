# Kane CLI GitHub Action

Run plain English browser tests on every pull request. Pass or fail verdict, sealed evidence pack, and a PR comment with proof.

The agent builds it. Kane CLI proves it works.

[![Kane verified](https://img.shields.io/badge/Kane%20CLI-verified-2ea44f?logo=github)](https://testmuai.com/kane-cli)

## What it does

On every PR, this action:

1. Installs Kane CLI and authenticates
2. Runs your plain English objective, or every test.md file matching a glob pattern, against a real Chrome browser
3. Uploads the sealed evidence pack (screenshots, HAR network traces, console logs) as a build artifact
4. Comments the pass/fail verdict on the PR, with a per-test results table
5. Fails the check if any test fails, so broken UI never merges

## Quick start: inline objective

Add two secrets to your repo (`LT_USERNAME`, `LT_ACCESS_KEY`), then create `.github/workflows/kane.yml`:

```yaml
name: Kane browser check
on: [pull_request]

jobs:
  verify-ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: testmuai/kane-action@v1
        with:
          objective: "log in, open the dashboard, assert the revenue widget renders"
          url: "https://staging.myapp.com"
          username: ${{ secrets.LT_USERNAME }}
          access-key: ${{ secrets.LT_ACCESS_KEY }}
```

No selectors. No test framework. One plain English sentence.

## Run your test.md suite

Keep Kane tests as plain markdown files in your repo, and run all of them on every PR with a glob pattern:

```yaml
      - uses: testmuai/kane-action@v1
        with:
          test-files: "tests/**/*_test.md"
          url: "https://staging.myapp.com"
          username: ${{ secrets.LT_USERNAME }}
          access-key: ${{ secrets.LT_ACCESS_KEY }}
```

Every matching file runs, and the PR comment shows a table with each test's pass/fail and duration. The check fails if any test fails.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `objective` | one of these two | | Plain English test objective |
| `test-files` | one of these two | | Glob of test.md files to run, e.g. `tests/**/*_test.md` |
| `url` | yes | | Base URL of the app under test |
| `username` | yes | | TestMu username (use secrets) |
| `access-key` | yes | | TestMu access key (use secrets) |
| `timeout` | no | `300` | Max seconds per test run |
| `comment-on-pr` | no | `true` | Post verdict comment on the PR |
| `kane-version` | no | `latest` | Kane CLI version to install |

## Outputs

| Output | Description |
|---|---|
| `status` | `passed` or `failed` |
| `summary` | e.g. `4/5 tests passed` |
| `total` | Number of tests executed |
| `failed` | Number of failed tests |

## Badge

Add to your README:

```markdown
[![Kane verified](https://img.shields.io/badge/Kane%20CLI-verified-2ea44f?logo=github)](https://testmuai.com/kane-cli)
```

## Exit codes

The action fails the check when any test fails or Kane CLI exits non-zero: `1` test failed, `2` auth error, `3` timeout.

## Pricing

Free to start. The Starter plan is $0 with 100 credits, no credit card. [testmuai.com/kane-cli](https://testmuai.com/kane-cli)
