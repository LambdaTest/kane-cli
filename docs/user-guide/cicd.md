# CI/CD recipes

kane-cli works in any CI that can run a Node binary and reach Chrome. To make a run non-interactive, you authenticate with basic auth from CI secrets, force the browser into headless mode, set a wall-clock timeout, and check the exit code.

## Common patterns

These patterns apply to every CI system; the recipes below differ only in how they wire up the secrets.

- Always pass `--headless`. CI runners have no display.
- Always pass `--timeout <seconds>`. A hung run cannot be allowed to block the pipeline.
- Authenticate with `--username` and `--access-key` from CI secrets. Do not call `kane-cli login` in CI — that flow opens a browser for OAuth and will not work on a runner.
- Provide a start URL. A CI run has no interactive prompt, so if neither the objective names a site, the `--url` flag is passed, nor a `default_url` is configured, the run fails fast instead of waiting for input. The simplest options are to start the objective with the site ("Go to https://… and …") or pass `--url <url>`. To deliberately start from the browser's current page instead, add `--allow-missing-url`. See [Default start URL](./configuration.md#default-start-url).
- Load test data with `--variables-file <path>`. Check the file into your repo (without secret values), or generate it before the step. A `{{name}}` with no value fails the job with exit `2` **before** any browser starts, with a receipt naming the variable — so fill values from CI secrets in that step, not later.
- **Project and folder are optional.** If you want uploads filed under a specific Test Manager project/folder, pre-configure with `kane-cli config project <id>` / `kane-cli config folder <id>` (use `kane-cli projects list` / `kane-cli folders list` to find the IDs). If you skip this, kane-cli auto-defaults a project/folder on first run and reports which one it picked — see [test-manager-integration.md](./test-manager-integration.md).
- Check the exit code. The mapping is documented in [running tests](./running-tests.md#exit-codes); the short form is `0` passed, `1` failed, `2` error, `3` timeout or cancellation.
- Run whole suites with one command. If your repo has committed `_test.md` tests, prefer one `testrun` invocation over a shell loop:

  ```bash
  kane-cli testrun run --tags smoke --parallel 4 --headless --on-failure fail-fast
  ```

  The suite becomes one execution with one exit code (`0` all passed, `1` any failure, `2` invalid plan, `3` cancelled) and one sealed [evidence pack](./evidence.md) — archive `.testmuai/evidence/*.evidence` as a CI artifact and anyone can drop it into the viewer. See [Batch runs with testrun](./testrun.md).

- Run the suite on the cloud grid when the runner can't run it. `kane-cli testrun run … --remote` turns the suite into one HyperExecute job: the grid supplies Chrome on a macOS runner — or, for mobile `_test.md` members, a virtual Android emulator or iOS simulator — so the runner needs no Chrome, Xcode, or Android Studio, and `--parallel N` spreads the members across N grid runners. The recordings and the evidence pack come back to the checkout as if the suite had run locally.

  ```bash
  kane-cli plugin install remote-execution

  # a web suite on 4 grid runners
  kane-cli testrun run tests/web/ --remote --parallel 4 \
    --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY" \
    --on-failure fail-fast

  # a mobile suite, from a Linux runner
  kane-cli testrun run tests/app/ --remote \
    --device-name "Pixel 7" --os-version 14 \
    --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY" \
    --on-failure fail-fast
  ```

  It needs a LambdaTest plan with HyperExecute macOS runners. Web and mobile members go in separate runs. Pick devices with `kane-cli devices list --target emulator|simulator --remote`; allow a timeout of about 10 minutes. See [Remote runs on the cloud grid](./remote-execution.md).

The runner spawns Chrome itself, so the CI image must have Chrome available on `PATH`. If your runner image cannot install Chrome, you have two options: for a single `kane-cli run` or `testmd run`, point kane-cli at a remote browser with `--cdp-endpoint <url>` or `--ws-endpoint <url>` (for example, a TestmuAI `wss://` endpoint) — kane-cli still runs on the runner and drives that browser; for a whole suite, `kane-cli testrun run … --remote` moves the run itself to the grid (above).

On slow or cold CI runners Chrome can be slow to come up over the DevTools Protocol. If you see intermittent "Chrome failed to launch" errors, raise `KANE_CLI_CDP_TIMEOUT_MS` (per-attempt readiness timeout, default `30000`) and/or `KANE_CLI_CDP_RETRIES` (launch retries after the first, default `2`). If Chrome lives at a non-standard path in the image, set `KANE_CLI_CHROME_PATH`. See [Chrome environment variables](./configuration.md#chrome-environment-variables).

## GitHub Actions

```yaml
name: kane-cli e2e

on:
  push:
    branches: [main]
  pull_request:

jobs:
  kane:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Chrome
        uses: browser-actions/setup-chrome@v1

      - name: Install kane-cli
        run: npm install -g kane-cli

      - name: Run test
        env:
          LT_USERNAME: ${{ secrets.LT_USERNAME }}
          LT_ACCESS_KEY: ${{ secrets.LT_ACCESS_KEY }}
        run: |
          kane-cli run "Search for 'wireless headphones' on Amazon and open the first result" \
            --headless \
            --timeout 300 \
            --username "$LT_USERNAME" \
            --access-key "$LT_ACCESS_KEY" \
            --variables-file ./tests/variables.json
```

## GitLab CI

```yaml
stages:
  - test

kane-cli:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y wget gnupg
    - wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    - echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    - apt-get update && apt-get install -y google-chrome-stable
    - npm install -g kane-cli
  script:
    - |
      kane-cli run "Verify the homepage loads and the login button is visible" \
        --headless \
        --timeout 300 \
        --username "$LT_USERNAME" \
        --access-key "$LT_ACCESS_KEY" \
        --variables-file ./tests/variables.json
  variables:
    LT_USERNAME: $LT_USERNAME
    LT_ACCESS_KEY: $LT_ACCESS_KEY
```

Define `LT_USERNAME` and `LT_ACCESS_KEY` as masked CI/CD variables in your project settings.

## Jenkins

```groovy
pipeline {
    agent any

    environment {
        LT_USERNAME   = credentials('lt-username')
        LT_ACCESS_KEY = credentials('lt-access-key')
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm install -g kane-cli'
            }
        }

        stage('Run kane-cli') {
            steps {
                sh '''
                    kane-cli run "Sign in and confirm the dashboard renders" \
                        --headless \
                        --timeout 300 \
                        --username "$LT_USERNAME" \
                        --access-key "$LT_ACCESS_KEY" \
                        --variables-file ./tests/variables.json
                '''
            }
        }
    }
}
```

The two `credentials(...)` IDs (`lt-username`, `lt-access-key`) refer to Username/Password or Secret Text credentials configured in Jenkins. The pipeline fails on any non-zero exit code from the `sh` step, which matches kane-cli's exit-code semantics.

## Docker / generic

The shell command below works in any CI that can run a Linux container with Chrome installed:

```bash
kane-cli run "Open the pricing page and verify the Pro plan is listed" \
    --headless \
    --timeout 300 \
    --username "$LT_USERNAME" \
    --access-key "$LT_ACCESS_KEY" \
    --variables-file ./tests/variables.json
```

If your CI image cannot install Chrome — for example, a minimal Node Alpine image — either run a whole suite on the grid with `kane-cli testrun run … --remote` (see [Remote runs](./remote-execution.md)), or point a single run at a remote browser:

```bash
kane-cli run "Open the pricing page and verify the Pro plan is listed" \
    --headless \
    --timeout 300 \
    --ws-endpoint "$LT_BROWSER_WSS" \
    --username "$LT_USERNAME" \
    --access-key "$LT_ACCESS_KEY" \
    --variables-file ./tests/variables.json
```

`--cdp-endpoint <url>` works the same way for browsers that expose a Chrome DevTools Protocol URL. With either flag, kane-cli skips its own Chrome launch and connects to the endpoint you provide.

<a name="a-shared-context-store-in-ci"></a>
## A shared context store in CI *(0.8.14)*

When your team [shares the context graph](./assurance/sharing.md) through a location, a pipeline works on the same store: clone it once, pull before each run, push the facts the run produced after. The sync commands never call the agent or spend credits; the run between them — `kane-cli context extract` below — is an ordinary extraction and consumes credits like any other.

- **Sign in without a person.** For a GitHub location over HTTPS set `KANE_SYNC_GIT_TOKEN` from a CI secret — a repository-scoped personal access token with Contents read/write, or a GitHub App installation token; a workflow's own `GITHUB_TOKEN` only reaches the workflow's repository, so a separate context repository needs its own token. Over SSH, an SSH deploy key on the context repository works with no token. For an S3-compatible location set `KANE_SYNC_S3_ACCESS_KEY_ID` and `KANE_SYNC_S3_SECRET_ACCESS_KEY`. Neither is ever written to disk by kane-cli. See [Context sync environment variables](./configuration.md#context-sync-environment-variables).
- **Use `--mode agent`** for structured output, and read the exit code: `0` done; `3` a person has to decide — the runner is behind or diverged, or a rebase stopped on decisions; `2` a precondition (the location cannot be reached, keys missing, a rebase still open).
- **Do not answer decisions blindly.** A rebase that stops on a decision is a job that stops. Save `kane-cli context sync status origin --json` as a build artifact — it is a report of what is waiting, not something a later job can replay on its own: answers go to the store that holds the open rebase, so the follow-up job must run on the same persisted `.context/` (a workspace or cache that survives between jobs), where a person or an agent answers with `kane-cli context sync origin --answer <id>=<choice>`. `keep-theirs` writes nothing, but it is a choice: the local change stays in the backup. The full contract is in [Automation → The sync verbs on the stream](./assurance/automation.md#the-sync-verbs-on-the-stream).
- **Keep `.context/` out of version control.** The store never goes through a git merge; the location is where it is shared.

```bash
set -e   # stop at the first failing command, so every exit code below is read

# GitHub Actions step — the secret CONTEXT_REPO_TOKEN grants Contents read/write on the context repository
export KANE_SYNC_GIT_TOKEN="$CONTEXT_REPO_TOKEN"

# first run on this runner: a store from the team location
[ -d .context ] || kane-cli context clone https://github.com/example-org/team-context.git . --mode agent

# before the run: take the team's new records; stop the job if a person has to decide
kane-cli context pull origin --mode agent > pull.ndjson || {
  code=$?
  [ "$code" -eq 3 ] && kane-cli context sync status origin --json > decisions.json
  exit "$code"
}

# the run itself, never guessing; a failed or paused extraction (exit 1 or 3) ends the job here, before anything is pushed
kane-cli context extract --mode ci

# after the run: publish what landed
kane-cli context push origin --mode agent
```
