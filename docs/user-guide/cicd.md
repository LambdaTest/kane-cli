# CI/CD recipes

kane-cli works in any CI that can run a Node binary and reach Chrome. To make a run non-interactive, you authenticate with basic auth from CI secrets, force the browser into headless mode, set a wall-clock timeout, and check the exit code.

## Common patterns

These patterns apply to every CI system; the recipes below differ only in how they wire up the secrets.

- Always pass `--headless`. CI runners have no display.
- Always pass `--timeout <seconds>`. A hung run cannot be allowed to block the pipeline.
- Authenticate with `--username` and `--access-key` from CI secrets. Do not call `kane-cli login` in CI — that flow opens a browser for OAuth and will not work on a runner.
- Provide a start URL. A CI run has no interactive prompt, so if neither the objective names a site, the `--url` flag is passed, nor a `default_url` is configured, the run fails fast instead of waiting for input. The simplest options are to start the objective with the site ("Go to https://… and …") or pass `--url <url>`. To deliberately start from the browser's current page instead, add `--allow-missing-url`. See [Default start URL](./configuration.md#default-start-url).
- Load test data with `--variables-file <path>`. Check the file into your repo (without secret values), or generate it before the step.
- **Project and folder are optional.** If you want uploads filed under a specific Test Manager project/folder, pre-configure with `kane-cli config project <id>` / `kane-cli config folder <id>` (use `kane-cli projects list` / `kane-cli folders list` to find the IDs). If you skip this, kane-cli auto-defaults a project/folder on first run and reports which one it picked — see [test-manager-integration.md](./test-manager-integration.md).
- Check the exit code. The mapping is documented in [running tests](./running-tests.md#exit-codes); the short form is `0` passed, `1` failed, `2` error, `3` timeout or cancellation.

The runner spawns Chrome itself, so the CI image must have Chrome available on `PATH`. If your runner image cannot install Chrome, point kane-cli at a remote browser with `--cdp-endpoint <url>` or `--ws-endpoint <url>` (for example, a TestmuAI `wss://` endpoint).

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

If your CI image cannot install Chrome — for example, a minimal Node Alpine image — point kane-cli at a remote browser instead:

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
