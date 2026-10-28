# kane-cli-pr

Ask Kane CLI about a pull request in a PR comment. A reviewer writes `@kane-cli does this break checkout?`; the action works out which of your existing tests the change affects, runs them in a real headless browser against the PR's own build, and answers in the PR with the results, a link to the sealed evidence pack, a policy verdict, and two checks you can require before merge.

> **Needs the next kane-cli release after 0.10.0-rc.3.** The action calls `kane-cli testrun run --override-start-url` and `--policy`, and `kane-cli context impact` with a model judge. Those arrive in the next kane-cli release; until then, pin `kane-cli-version` to that release once it is out, or point the `kane-cli` input at a build that has them. With an older kane-cli, impact or the test run ends in an error reply on the PR, and the policy line says the policy is not available yet.

## What it does

1. Starts on a new `issue_comment` or `pull_request_review_comment` that contains `@kane-cli` (bots and other comments never start a job)
2. Reads what the reviewer is asking through kane's conversation endpoint; when the endpoint can't be reached, it falls back to simple word rules and says so under its reply
3. Checks impact: `kane-cli context impact` on the PR's diff names the existing tests the change affects, with a reason each, and splits them into **impacted** (the test exists on the base branch) and **new in this PR**
4. Starts the PR's app on the runner (`app.start` in `.github/kane-cli.yml`) and runs those tests with `kane-cli testrun run --override-start-url <app.url> --policy <policy>`
5. Edits one comment with live progress while it works, then posts the result and completes the checks `kane-cli / tests` and `kane-cli / policy`
6. Uploads the sealed evidence pack as an artifact and links it to the hosted viewer (https://evidence.lambdatest.com)

A result looks like this (trimmed):

```markdown
## kane-cli · gate-keeper

**You asked**
> does this break checkout?

@octocat **Yes — this PR breaks checkout.** Every test that reads the subtotal fails.

[impacted 4] [new in PR 0] [passing 2] [policy failed]

▸ 🧪 Tests — 4 ran · 2 failed
  | ❌ | Apply SPRING2026 without changing free shipping | discount −$13.00 instead of −$12.00 |
▸ 🔎 Why these tests — the change touches 2 requirements
### 🧾 Evidence   [Open the evidence pack ↗]
### 🛡️ Policy · checkout-pr — ❌ failed
  | ❌ | All tests pass | 0 failed | 2 failed |

kane-cli · ran on e9e1bf7 in 2 m 05 s · run log · next: @kane-cli rerun the failed ones
```

## Setup

### 1. Secrets

Add `LT_USERNAME` and `LT_ACCESS_KEY` as repository secrets (TestMu dashboard, Settings > Keys). The action signs kane-cli in with `kane-cli login --username … --access-key …` in a per-job home directory and removes that login when the job ends.

### 2. Tests in a linked folder

Impact compares the PR's diff with the requirements your tests verify, so the repository must be a folder linked to a Test Manager project (it holds `.testmuai/assurance.json`) with its designed tests committed in `.testmuai/tests/*_test.md`. Commit each test's `output-<name>/` directory beside it so CI replays the recorded steps instead of re-authoring them. Linking and designing tests: [shared projects](../../../skill-installer/skills/references/shared-projects.md) and [assurance](../../../docs/user-guide/assurance/overview.md).

### 3. `.github/kane-cli.yml`

Copy [examples/kane-cli.yml](examples/kane-cli.yml) to `.github/kane-cli.yml` on the default branch and set `app.start` and `app.url` to how your app is built and served on the runner. Every key is described in [Configuration](#configuration-githubkane-cliyml).

### 4. A policy file

Copy [examples/checkout-policy.yaml](examples/checkout-policy.yaml) to `.github/kane/checkout-policy.yaml` (or any path you name in `.github/kane-cli.yml`) and adjust the gates. kane-cli judges the run's sealed evidence pack against it, and the verdict sets the `kane-cli / policy` check. Make that check required in your branch protection to block merges on a failed policy.

### 5. The workflow, then the first comment

Copy [examples/kane.yml](examples/kane.yml) to `.github/workflows/kane.yml` on the default branch. Then open a pull request and comment:

```text
@kane-cli does this break checkout?
```

kane reacts with 👀, edits one working comment while it checks impact and runs the tests, then posts its answer with `@you` so you are notified.

## What `@kane-cli` understands

Write `@kane-cli` at the start of a line, then ask in your own words. The conversation endpoint maps the request to one of these:

| Ask | What happens |
|---|---|
| `@kane-cli check impact` / `@kane-cli does this break checkout?` | Lists the tests the change affects, with the judge's reason for each. With `auto_continue: true` it runs them straight away |
| `@kane-cli go ahead` / `@kane-cli run them` | Runs the impacted tests on the PR's build |
| `@kane-cli rerun the failed ones` | Runs only the tests that failed last time |
| `@kane-cli run them with the checkout policy` | Runs and judges against a named policy from `policies:` |
| `@kane-cli why did <test> fail?` | Answers from the last run's results without running anything |
| `@kane-cli help` | Lists what kane can do |

When the endpoint can't be reached (or `converse-url` is unset and the credentials are empty), kane falls back to word rules: `help`; `go ahead` / `run` / `rerun` (with `fail` → the failed tests); `check` / `impact` / `break` / `affect`; anything else gets a short "couldn't read that" reply. Replies made this way carry the note *kane's reader was unavailable; matched by keywords*, and the job log carries a warning when an admin needs to fix the credentials.

Who may ask and who may run is set by `access` in `.github/kane-cli.yml`. Anyone else gets a one-line refusal. A comment edited to add `@kane-cli` does not trigger a run (GitHub sends no event for it); post a new comment instead.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `username` | yes | | TestMu username (`secrets.LT_USERNAME`) |
| `access-key` | yes | | TestMu access key (`secrets.LT_ACCESS_KEY`) |
| `phase` | no | `run` | `run` answers the comment, checks impact and runs tests. `report` posts a run's result and completes the checks; call it after uploading the evidence pack so the result can link to it |
| `github-token` | no | `github.token` | Token for reading the PR and writing comments, reactions and checks |
| `kane-cli-version` | no | `latest` | Version of `@testmuai/kane-cli` to install. Ignored when `kane-cli` is set |
| `kane-cli` | no | `""` | A kane-cli command to use instead of installing one, e.g. `/opt/kane/bin/kane-cli`. Split like a shell would, never run through one |
| `kane-env` | no | `prod` | TestMu environment kane-cli signs in to. Also picks the default `converse-url` |
| `converse-url` | no | `""` | Conversation endpoint. Empty uses the kane controller: `https://kaneai-api.lambdatest.com/v16-controller/v1/integration/github/converse` |
| `impact-base-url` | no | `""` | Advanced: point only the impact step at another controller. Leave empty |
| `mention` | no | `@kane-cli` | The trigger word. The workflow's job-level `if` must test for the same word |
| `bot-login` | no | `github-actions[bot]` | The login `github-token` writes as, so kane recognises its own comments. Change it with a GitHub App or user token |
| `pipeline` | no | `true` | `false` is a dry run: kane says what it would do and runs nothing |
| `pr-path` | no | `pr` | Where the workflow checked out the PR head, relative to the workspace |
| `artifact-id` | no | `""` | `report` phase: the evidence artifact's id (`actions/upload-artifact`'s `artifact-id` output) |
| `node-version` | no | `24` | Node.js version for the action and kane-cli (20 or newer) |
| `install-chrome` | no | `true` | Install Chrome (stable) with `browser-actions/setup-chrome` and export `KANE_CLI_CHROME_PATH`. Set `false` when the runner already has Chrome |

## Outputs

| Output | Description |
|---|---|
| `evidence-path` | `run` phase: the sealed evidence pack of the turn that ran tests, for `actions/upload-artifact`. Empty when nothing ran |
| `logs-path` | `run` phase: kane-cli's raw `testrun` NDJSON for that turn. Empty when nothing ran |

## Checks

| Check | Conclusion |
|---|---|
| `kane-cli / tests` | Success when every test that ran passed; failure on any failed test or an error; neutral when nothing ran; cancelled when the job stopped mid-run |
| `kane-cli / policy` | Created only when a policy verdict came back: success on `pass`, failure otherwise. A missing verdict never turns it green or red |

## Configuration: `.github/kane-cli.yml`

kane reads this file from the default branch on every comment, so a pull request cannot change who may run tests or which policy applies. A missing file uses the defaults below; an invalid one gets a reply naming the bad key.

| Key | Default | Meaning |
|---|---|---|
| `version` | `1` | Must be `1` |
| `access.ask` | `[OWNER, MEMBER, COLLABORATOR]` | GitHub author associations that may ask kane. When the list allows `MEMBER`, a commenter with write access or above counts as `MEMBER` |
| `access.run` | `[OWNER, MEMBER, COLLABORATOR]` | Associations that may make kane run tests |
| `policies` | `{}` | Named policies a request can pick: `name: path` |
| `policy` | none | The policy file every run is judged against. Applied only when the installed kane-cli has `testrun run --policy` |
| `auto_continue` | `true` | `true`: an impact check runs the impacted tests straight away. `false`: kane lists them and waits for `go ahead` |
| `heal` | `true` | `true` lets adaptive heal re-record a step that no longer matches the page; a healed test is marked 🩹 in the comment. `false` passes `--no-adaptive-heal`, so the gate reports what it saw |
| `parallel` | `1` | Tests run at once on the runner (1 to 8), one Chrome each |
| `impact.judge` | `true` | `true` lets a model judge which tests the diff affects, with a reason each (spends credits). `false` passes `--no-judge` |
| `app.start` | none | Command that builds and serves the PR's app from the PR checkout. Without `app`, tests run against their own `url:` |
| `app.url` | `http://127.0.0.1:3000` | Where the app answers. Every test opens this URL first (`--override-start-url`) |
| `app.ready_path` | `/` | Path polled until the app answers |
| `app.timeout_seconds` | `60` | How long to wait for the app (1 to 900). Allow for the build |

The app runs with its own empty home directory and none of the job's secrets or tokens in its environment, and is stopped when the job ends.

## Runners

The examples use `ubuntu-latest`: the app under test is built and started on the runner, and Chrome is installed by the action. On a self-hosted runner, keep `install-chrome: "true"` or point `KANE_CLI_CHROME_PATH` at Chrome, make sure `app.url`'s port is free, and expect kane to wait while another kane-cli test run on the same machine finishes.

## Security

- **The PR's code runs on the runner.** `app.start` builds and serves the pull request's own code, as the runner user. Only people listed in `access.run` can make that happen, and kane refuses on pull requests from forks (the workflow carries secrets). Keep **Run workflows from fork pull requests** off for private repositories, and use an ephemeral runner (such as `ubuntu-latest`) rather than a long-lived machine that holds other credentials.
- **The policy comes from the default branch.** The workflow's first checkout is the default branch by name, and kane reads `.github/kane-cli.yml` and the policy files from there, never from the PR.
- **Secrets stay out of the app.** kane-cli signs in from flags into a per-job home directory that is removed when the job ends; the PR's app gets a separate home and an environment without `LT_*`, `GITHUB_TOKEN`, `ACTIONS_*` or the runner's output files.
- The conversation endpoint receives the comment, the PR's title, description, changed files and diff, and kane's earlier replies on the PR, authenticated with your TestMu credentials.

## Development

The action is plain Node.js (20+) with one dependency, `yaml`. Run its unit tests with:

```bash
cd integrations/github-action/kane-cli-pr
npm ci
npm test
```

The `kane-cli-pr check` workflow ([.github/workflows/kane-cli-pr-check.yml](../../../.github/workflows/kane-cli-pr-check.yml)) runs the same tests on demand from the Actions tab. `SNAPSHOT_UPDATE=1 npm test` rewrites the final-comment snapshots in `test/snapshots/`; review the diff before committing.

## Versioning

`@main` tracks the latest action. Pin to a release tag of this repository for a fixed version.
