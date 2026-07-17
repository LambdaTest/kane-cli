# kane-cli user guide

kane-cli does two jobs: it **runs browser tests written in plain English** — one-shot objectives, committed `_test.md` files, whole suites — and it **builds the suite in the first place**: point it at your requirements and it extracts use-cases, designs requirement-linked tests, and reports exactly what's covered.

```
requirements ──► use-cases ──► designed tests ──► runs ──► evidence ──► coverage ──► maintenance
  (ingest)       (extract       (design)         (testmd,   (sealed      (cover)     (reconcile)
                  + review)                       testrun)    packs)
```

Every page below is standalone — start wherever your job starts.

## Start here

- [Installation](./installation.md) — npm, Homebrew, shell script; Chrome requirements.
- [Getting started](./getting-started.md) — from a fresh install to a passing run in five minutes.
- [Authentication](./authentication.md) — OAuth, username/access-key, profiles, CI logins.

## Run and author tests

- [Running tests](./running-tests.md) — objectives, the TUI, run flags, slash commands.
- test.md files: [overview](./testmd/overview.md) (the file format) · [running](./testmd/running.md) (replay, caching, CI) · [composition](./testmd/composition.md) (`@import` and shared helpers).
- [Batch runs (testrun)](./testrun.md) — many tests, one execution, one evidence pack.
- [Generate test cases](./generate-test-cases/overview.md) — scenarios and cases from a plain-language description ([workflow](./generate-test-cases/workflow.md)).
- [Evidence packs](./evidence.md) — the sealed proof every run produces: screenshots, logs, results, the viewer.

## Design from requirements — the test lifecycle

- **[The test lifecycle](./lifecycle/overview.md) — start here**: the journey, the vocabulary, and when to use it instead of `generate`.
- [Building the context graph](./lifecycle/context.md) — ingest sources, extract use-cases, review what's trusted.
- [Designing tests](./lifecycle/design.md) — acceptance criteria, scenarios, and one runnable test per scenario.
- [Coverage](./lifecycle/coverage.md) — what execution proved vs what the design still owes.
- [Maintaining the suite](./lifecycle/maintain.md) — reconcile the suite when a requirement document changes.
- [Automation](./lifecycle/automation.md) — the headless contract: modes, NDJSON streams, exit codes, CI shapes.

## Checks and assertions

- [Checkpoints overview](./features/checkpoints/overview.md) — every assertion type: [visual](./features/checkpoints/visual.md), [textual](./features/checkpoints/textual.md), [URL](./features/checkpoints/url.md), [title](./features/checkpoints/title.md), and [DevTools](./features/checkpoints/devtools/overview.md) (network, console, performance, cookies, storage, clipboard).
- [API calls in objectives](./features/api-calls.md) · [Browser state](./features/browser-state.md).

## Reference

- [Configuration](./configuration.md) — settings, modes, Chrome profiles, environment variables.
- [Variables & context](./variables-and-context.md) — `{{variables}}`, secrets, agent context files.
- [Test Manager integration](./test-manager-integration.md) — projects, folders, uploads.
- [CI/CD recipes](./cicd.md) — GitHub Actions, GitLab, Jenkins, Docker.
- [Troubleshooting](./troubleshooting.md) — failure patterns and the debugging flow.
