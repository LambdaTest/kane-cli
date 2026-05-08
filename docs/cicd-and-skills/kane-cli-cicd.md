---
id: kane-cli-cicd
title: CI/CD Integration
sidebar_label: CI/CD
description: Integrate Kane CLI into GitHub Actions, GitLab CI, Jenkins, Bitbucket Pipelines, and Docker for automated browser testing.
keywords:
  - kane cli cicd
  - github actions browser testing
  - kaneai
  - testmu ai
  - ci cd browser tests
url: https://www.testmuai.com/support/docs/kane-cli-cicd/
site_name: TestMu AI
slug: kane-cli-cicd/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-cicd/
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import CodeBlock from '@theme/CodeBlock';
import BrandName, { BRAND_URL } from '@site/src/component/BrandName';
import {YOUR_LAMBDATEST_USERNAME, YOUR_LAMBDATEST_ACCESS_KEY} from "@site/src/component/keys";

<script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({
       "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.testmuai.com"
        },{
          "@type": "ListItem",
          "position": 2,
          "name": "Support",
          "item": "https://www.testmuai.com/support/docs/"
        },{
          "@type": "ListItem",
          "position": 3,
          "name": "Kane CLI",
          "item": "https://www.testmuai.com/support/docs/kane-cli-introduction/"
        }]
      })
    }}
></script>

Kane CLI runs headlessly in CI/CD pipelines using credentials passed as environment variables or inline flags. Tests fail fast on assertion errors and return standard exit codes for pipeline control flow.

## Common Patterns

These patterns apply to every CI system; the platform-specific recipes below differ only in how they wire up the secrets.

- **Always pass `--headless`**. CI runners have no display.
- **Always set `--timeout <seconds>`**. A hung run cannot be allowed to block the pipeline.
- **Authenticate with `--username` and `--access-key`** from CI secrets. Do not call `kane-cli login` in CI — that flow opens a browser for OAuth and will not work on a runner.
- **Load test data with `--variables-file <path>`**. Check the file into your repo (without secret values), or generate it before the step.
- **Check the exit code**. `0` passed, `1` failed, `2` error, `3` timeout or cancellation.

:::warning Chrome Requirement
The runner spawns Chrome itself, so the CI image must have Chrome available on `PATH`. If your runner image cannot install Chrome, point Kane CLI at a remote browser with `--cdp-endpoint <url>` or `--ws-endpoint <url>` (for example, a <BrandName /> `wss://` endpoint).
:::

## Authentication in CI/CD

Pass credentials directly on the run command using environment variables from your secrets store:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli run "Verify checkout flow completes" \\
  --url https://staging.myapp.com \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}" \\
  --headless \\
  --agent \\
  --timeout 300`}
</CodeBlock>
</div>

Get your username and access key from the <BrandName /> [dashboard](https://accounts.lambdatest.com/dashboard) > **Credentials**.

## Exit Codes

| Code | Meaning | Pipeline Behavior |
|------|---------|-------------------|
| `0` | Test passed | Pipeline continues |
| `1` | Test failed (assertion not met) | Pipeline stops |
| `2` | Error (auth failure, Chrome crash) | Pipeline stops |
| `3` | Timeout or cancelled | Pipeline stops |

## CI/CD Checklist

- Always use `--headless` and `--agent`: no display server in CI
- Set `--timeout`: prevents pipeline hangs (e.g. `--timeout 300`)
- Set `--max-steps`: caps run length (e.g. `--max-steps 50`)
- Use `--variables-file`: load test data from a committed config file
- Store credentials as secrets: never hardcode in pipeline files

---

## Platform Guides

<Tabs groupId="ci-platform">

<TabItem value="github" label="GitHub Actions">

Store `LT_USERNAME` and `LT_ACCESS_KEY` as repository secrets under **Settings > Secrets and variables > Actions**.

```yaml
# .github/workflows/browser-tests.yml
name: Browser Tests
on: [push, pull_request]

jobs:
  kane-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Chrome
        uses: browser-actions/setup-chrome@v1

      - name: Install Kane CLI
        run: npm install -g @testmuai/kane-cli

      - name: Run browser tests
        env:
          LT_USERNAME: ${{ secrets.LT_USERNAME }}
          LT_ACCESS_KEY: ${{ secrets.LT_ACCESS_KEY }}
        run: |
          kane-cli run \
            "Search for 'wireless headphones' on Amazon and open the first result" \
            --headless \
            --timeout 300 \
            --username "$LT_USERNAME" \
            --access-key "$LT_ACCESS_KEY" \
            --variables-file ./tests/variables.json

      - name: Upload test logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: kane-test-logs
          path: ~/.testmuai/kaneai/sessions/
```

</TabItem>

<TabItem value="gitlab" label="GitLab CI">

Define `LT_USERNAME` and `LT_ACCESS_KEY` as masked CI/CD variables in your project settings.

```yaml
# .gitlab-ci.yml
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
    - npm install -g @testmuai/kane-cli
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
  artifacts:
    paths:
      - ~/.testmuai/kaneai/sessions/
    when: always
    expire_in: 7 days
```

</TabItem>

<TabItem value="jenkins" label="Jenkins">

Store credentials in **Jenkins > Manage Jenkins > Manage Credentials**. The two `credentials(...)` IDs refer to Username/Password or Secret Text credentials configured in Jenkins.

```groovy
// Jenkinsfile
pipeline {
    agent any
    environment {
        LT_USERNAME   = credentials('lt-username')
        LT_ACCESS_KEY = credentials('lt-access-key')
    }
    stages {
        stage('Install') {
            steps {
                sh 'npm install -g @testmuai/kane-cli'
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
    post {
        always {
            archiveArtifacts artifacts: '~/.testmuai/kaneai/sessions/**',
                             allowEmptyArchive: true
        }
    }
}
```

The pipeline fails on any non-zero exit code from the `sh` step, which matches Kane CLI's exit-code semantics.

</TabItem>

<TabItem value="bitbucket" label="Bitbucket Pipelines">

Add `LT_USERNAME` and `LT_ACCESS_KEY` as repository variables under **Repository settings > Repository variables**.

```yaml
# bitbucket-pipelines.yml
pipelines:
  default:
    - step:
        name: Browser Tests
        image: node:20
        script:
          - npm install -g @testmuai/kane-cli
          - kane-cli run
              --url https://staging.myapp.com
              --username $LT_USERNAME
              --access-key $LT_ACCESS_KEY
              --headless
              --agent
              --timeout 300
              --max-steps 50
              "Complete the checkout flow and verify order confirmation"
        artifacts:
          - ~/.testmuai/kaneai/sessions/**
```

</TabItem>

<TabItem value="docker" label="Docker / Generic">

The shell command below works in any CI that can run a Linux container with Chrome installed:

```bash
kane-cli run "Open the pricing page and verify the Pro plan is listed" \
    --headless \
    --timeout 300 \
    --username "$LT_USERNAME" \
    --access-key "$LT_ACCESS_KEY" \
    --variables-file ./tests/variables.json
```

If your CI image cannot install Chrome — for example, a minimal Node Alpine image — point Kane CLI at a remote browser instead:

```bash
kane-cli run "Open the pricing page and verify the Pro plan is listed" \
    --headless \
    --timeout 300 \
    --ws-endpoint "$LT_BROWSER_WSS" \
    --username "$LT_USERNAME" \
    --access-key "$LT_ACCESS_KEY" \
    --variables-file ./tests/variables.json
```

`--cdp-endpoint <url>` works the same way for browsers that expose a Chrome DevTools Protocol URL. With either flag, Kane CLI skips its own Chrome launch and connects to the endpoint you provide.

</TabItem>

</Tabs>

---

## Running Multiple Tests

Run several tests and fail the pipeline if any fail:

```bash
#!/bin/bash
set -e

PASS=0
FAIL=0
FAILED_TESTS=()

run_test() {
  local name="$1"
  local objective="$2"
  echo "Running: $name"
  if kane-cli run "$objective" \
      --url https://staging.myapp.com \
      --username $LT_USERNAME \
      --access-key $LT_ACCESS_KEY \
      --headless --agent --timeout 120; then
    ((PASS++))
  else
    ((FAIL++))
    FAILED_TESTS+=("$name")
  fi
}

run_test "Login" "Log in with valid credentials and verify dashboard appears"
run_test "Search" "Search for 'laptop' and verify at least one result appears"
run_test "Checkout" "Add first product to cart and complete checkout"
run_test "Settings" "Open account settings and verify profile page loads"

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo "Failed tests: ${FAILED_TESTS[*]}"
  exit 1
fi
```

---

## Variables in CI/CD

Commit a non-secret variables file to your repo, and inject secrets at runtime:

```json
{
  "app_url": { "value": "https://staging.myapp.com" },
  "test_product_sku": { "value": "PROD-001" }
}
```

Merge with secrets in your pipeline:

```bash
kane-cli run "Log in as {{email}} with {{password}} and verify dashboard" \
  --variables-file ./test-variables.json \
  --variables "{\"email\": {\"value\": \"$TEST_EMAIL\"}, \"password\": {\"value\": \"$TEST_PASSWORD\", \"secret\": true}}" \
  --username $LT_USERNAME \
  --access-key $LT_ACCESS_KEY \
  --headless --agent
```
