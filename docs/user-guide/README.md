# kane-cli user guide

kane-cli is one end-to-end testing package with three pillars:

1. **Generate**: point it at your requirements (a PRD, a spec, or a description) and it designs the suite: use-cases, acceptance criteria, scenarios, and one runnable `_test.md` test per scenario.
2. **Execute**: run plain-English tests on **desktop web** (Chrome), the **Android emulator**, the **iOS simulator**, and **real Android and iOS devices** in the TestMu AI cloud: one-shot objectives, committed `_test.md` files, or whole suites.
3. **Prove**: every run seals an evidence pack, and coverage reports what execution proved against each acceptance criterion and what is still owed.

```
  GENERATE                                              EXECUTE                          PROVE
requirements ──► use-cases ──► acceptance ──► scenarios ──► tests ──► runs ──────────────────► evidence ──► coverage ──► maintenance
  (ingest)       (extract       criteria                  (_test.md)  (web, emulator,           (sealed      (cover)     (reconcile)
                  + review)     (design)                               simulator, real device)   packs)
```

Every page below is standalone — start wherever your job starts.

## Start here

- [Installation](./installation.md) — npm, Homebrew, shell script; Chrome requirements.
- [Getting started](./getting-started.md) — from a fresh install to a passing run in five minutes.
- [Authentication](./authentication.md) — OAuth, username/access-key, profiles, CI logins.
- [Using kane-cli from an AI coding agent](./agents.md): what your agent does on a first run, your preferences, and the live status strip.

## 1. Generate tests

- **[The assurance lifecycle](./assurance/overview.md) — start here**: the journey, the vocabulary, and when to use it instead of `generate`.
<!-- release: needs context pull -->
- **[Shared projects](./assurance/shared-projects.md)** *(0.10.0)*: work in your team's Test Manager project. Link a folder, join a teammate's project, bring the project's tests into your folder, and see the project's coverage.
- [Building the context graph](./assurance/context.md) — ingest sources, extract use-cases, review what's trusted.
- [Designing tests](./assurance/design.md) — acceptance criteria, scenarios, and one runnable test per scenario.
- [Generate test cases](./generate-test-cases/overview.md) — scenarios and cases from a plain-language description ([workflow](./generate-test-cases/workflow.md)).
- **[Exploration](./exploration.md)**: no requirements to start from? An explorer walks your app on HyperExecute, maps its screens, flows and findings, and designs tests from what it found into your Test Manager project.
- [Sharing a local store](./assurance/sharing.md): for a local store only. One shared location (GitHub, S3-compatible, or a folder); publishing, taking your teammates' records, cloning, and decisions when two people change the same thing. For a team in Test Manager, use [Shared projects](./assurance/shared-projects.md).
- [Automation](./assurance/automation.md) — the headless contract: modes, NDJSON streams, exit codes, CI shapes.

## 2. Execute tests

| Target | Flag | Runs from |
|---|---|---|
| Desktop web (Chrome) | default | macOS, Linux, Windows |
| Android emulator | `--target emulator` | macOS Apple Silicon, or any machine with `testrun run --remote` |
| iOS simulator | `--target simulator` | macOS Apple Silicon, or any machine with `testrun run --remote` |
| Android real device | `--target android` | Any machine ([plan required](./mobile/real-device.md#plan-requirements)) |
| iOS real device | `--target ios` | Any machine ([plan required](./mobile/real-device.md#plan-requirements)) |

### Web and every target

- [Running tests](./running-tests.md) — objectives, the TUI, run flags, slash commands.
- test.md files: [overview](./testmd/overview.md) (the file format) · [running](./testmd/running.md) (replay, caching, CI) · [composition](./testmd/composition.md) (`@import` and shared helpers).
- [Batch runs (testrun)](./testrun.md) — many tests, one execution, one evidence pack.
- [Remote runs (`--remote`)](./remote-execution.md) — the same suite as one HyperExecute job: grid browsers, grid emulators/simulators, and real devices from any machine.

### Mobile

- **[Mobile testing overview](./mobile/overview.md)**: start here for the real-device, local, and cloud-grid paths and what each needs.
- [Real devices](./mobile/real-device.md): real Android and iOS devices in the TestMu AI cloud, from any machine (`--target android|ios`).
- [iOS Simulator setup](./mobile/simulator.md): install Xcode, then let kane-cli install its tooling (local runs).
- [Android Emulator setup](./mobile/emulator.md): install Android Studio and an arm64 AVD, then let kane-cli install its tooling (local runs).

## 3. Prove and maintain

- [Evidence packs](./evidence.md) — the sealed proof every run produces: screenshots, logs, results, the viewer.
- [Coverage](./assurance/coverage.md) — what execution proved vs what the design still owes.
- [Maintaining the suite](./assurance/maintain.md) — reconcile the suite when a requirement document changes.

## Checks and assertions

- [Checkpoints overview](./features/checkpoints/overview.md) — every assertion type: [visual](./features/checkpoints/visual.md), [textual](./features/checkpoints/textual.md), [URL](./features/checkpoints/url.md), [title](./features/checkpoints/title.md), and [DevTools](./features/checkpoints/devtools/overview.md) (network, console, performance, cookies, storage, clipboard).
- [API calls in objectives](./features/api-calls.md) · [Browser state](./features/browser-state.md).

## Reference

- [Configuration](./configuration.md) — settings, modes, Chrome profiles, environment variables.
- [Variables & context](./variables-and-context.md) — `{{variables}}`, secrets, agent context files.
- [Test Manager integration](./test-manager-integration.md) — projects, folders, uploads.
- [CI/CD recipes](./cicd.md) — GitHub Actions, GitLab, Jenkins, Docker.
- [Troubleshooting](./troubleshooting.md) — failure patterns and the debugging flow.
