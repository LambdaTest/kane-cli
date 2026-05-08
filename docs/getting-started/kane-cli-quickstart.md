---
id: kane-cli-quickstart
title: Quick Start
sidebar_label: Quick Start
description: Authenticate Kane CLI and run your first browser automation test in under 5 minutes.
keywords:
  - kane cli quickstart
  - kaneai
  - testmu ai
  - browser test
  - first test
url: https://www.testmuai.com/support/docs/kane-cli-quickstart/
site_name: TestMu AI
slug: kane-cli-quickstart/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-quickstart/
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

This guide takes you from a fresh install to a passing run in under five minutes.

## Step 1: Install

```bash
npm install -g @testmuai/kane-cli
```

Once `kane-cli --version` prints a version number, you are ready. See [Installation](/support/docs/kane-cli-installation/) for platform requirements and troubleshooting.

## Step 2: Authenticate

<Tabs groupId="auth-method">

<TabItem value="oauth" label="OAuth (Recommended)">

```bash
kane-cli login
```

Your default browser opens on a <BrandName /> consent page. Sign in (or confirm, if you are already signed in), authorise the CLI, and the page will tell you it is safe to close the tab. Control returns to your terminal and your credentials are stored under `~/.testmuai/kaneai/profiles/`.

</TabItem>

<TabItem value="basic" label="Basic Auth">

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli login \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Find your username and access key on the <BrandName /> [dashboard](https://accounts.lambdatest.com/dashboard) > **Credentials**.

Use this method for environments without a browser (servers, containers, CI/CD).

</TabItem>

<TabItem value="ci" label="CI/CD">

For non-interactive CI pipelines, pass credentials inline:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli run "your objective" \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}" \\
  --headless --agent`}
</CodeBlock>
</div>

Store `LT_USERNAME` and `LT_ACCESS_KEY` as secrets in your CI/CD platform. See [CI/CD Integration](/support/docs/kane-cli-cicd/) for platform-specific guides.

</TabItem>

</Tabs>

Verify authentication at any time:

```bash
kane-cli whoami
```

If you prefer username and access key, or need to manage multiple accounts, see [Authentication](/support/docs/kane-cli-authentication/).

## Step 3: Open the TUI

Run `kane-cli --tui`:

```bash
kane-cli --tui
```

A short boot animation renders, then the main view drops you at a chat prompt with a status bar at the bottom showing your model, session ID, environment, and run count. From there, anything you type is treated as a test objective. Lines that begin with `/` are slash commands such as `/help`, `/config`, `/cancel`, and `/exit`.

## Step 4: Run Your First Test

At the chat prompt, type a natural-language objective and press Enter:

```text
Search for "wireless headphones" on Amazon and add the first result to cart
```

Kane CLI launches Chrome, hands the objective to the agent, and starts streaming progress. You see a step tree fill in as the agent thinks, observes the page, and acts: clicking, typing, scrolling, and verifying. When the agent is done, a result block reports whether the objective passed or failed and how many steps it took.

If you ever need to stop a run, press `Ctrl+C` once. Pressing it twice exits Kane CLI.

## Step 5: Or Run from the Command Line

For scripting and CI, skip the TUI and use the `run` subcommand:

```bash
kane-cli run "Click the 'More information' link" --url https://example.com
```

In CLI mode, Kane CLI streams progress to **stderr**, prints the final result as a single JSON object on **stdout**, and exits with a status code that reflects the outcome:

| Exit Code | Meaning |
|-----------|---------|
| `0` | Test passed |
| `1` | Test failed (assertion not met) |
| `2` | Error (auth failure, Chrome crash) |
| `3` | Timeout or cancelled |

Capture results in a shell script:

```bash
kane-cli run "Verify the homepage loads" > result.json
```

By default each run starts on the KaneAI playground site. The agent navigates from there based on your objective.

## What Happens at the End of a Run

When the session ends, Kane CLI uploads the run to <BrandName /> Test Manager and prints a share link. For details on the upload, the share-link experience, and the run mode toggle, see [Test Manager Integration](/support/docs/kane-cli-tms-integration/). To change settings like window size, Chrome profile, or the active project and folder, see [Configuration](/support/docs/kane-cli-configuration/).

:::tip
Run `kane-cli --tui` to open the interactive TUI: a full terminal UI where you can type objectives, see step-by-step progress, and chain multiple tests in one session with persistent browser state.
:::

## Next Steps

- [Writing Objectives](/support/docs/kane-cli-writing-objectives/): Learn the three patterns: actions, assertions, extractions
- [Modes of Operation](/support/docs/kane-cli-modes/): Understand Interactive TUI, Headless CLI, and Agent Mode
- [Authentication](/support/docs/kane-cli-authentication/): Manage profiles and credential methods
- [Variables & Context](/support/docs/kane-cli-variables-and-context/): Parameterize tests with credentials and project-specific context
- [CI/CD Integration](/support/docs/kane-cli-cicd/): Add Kane CLI to your pipeline
