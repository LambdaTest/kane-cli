---
id: kane-cli-skills
title: Kane CLI Skills for AI Agents
sidebar_label: Skills
description: Install the Kane CLI skill for Claude Code, Codex CLI, or Gemini CLI to enable browser automation directly from your AI coding agent.
keywords:
  - kane cli skill
  - claude code skill
  - codex cli
  - gemini cli
  - kaneai
  - testmu ai
  - ai agent browser testing
url: https://www.testmuai.com/support/docs/kane-cli-skills/
site_name: TestMu AI
slug: kane-cli-skills/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-skills/
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

A Kane CLI **skill** is a markdown instruction file that teaches an AI coding agent how to use `kane-cli`: when to invoke it, how to build commands, how to parse NDJSON output, how to present results, and how to handle failures. Install the skill once, and your agent handles browser automation tasks automatically whenever you ask.

Skills work on top of [Agent Mode](/support/docs/kane-cli-agent-mode/) (`--agent` flag). The skill tells the agent to always use `--agent`, parse the NDJSON stream, and present structured results back to you.

:::note
Skills are plain markdown files. Review and customize them by editing the installed file after download.
:::

---

## Install by Agent

<Tabs groupId="agent-platform">

<TabItem value="claude" label="Claude Code">

The Kane CLI skill for Claude Code is a `SKILL.md` file placed in your skills directory.

**Global install** (available in all projects):

```bash
mkdir -p ~/.claude/skills/kane-cli
curl -o ~/.claude/skills/kane-cli/SKILL.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/claude/SKILL.md
```

**Project-level install** (available only in this project):

```bash
mkdir -p .claude/skills/kane-cli
curl -o .claude/skills/kane-cli/SKILL.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/claude/SKILL.md
```

After installing, Claude Code automatically loads the skill. No restart required.

**What Claude can do with this skill:**

- Recognize when your request involves a browser and invoke `kane-cli` automatically
- Build properly structured `kane-cli run --agent` commands
- Parse the NDJSON output and present structured results with step counts, duration, extracted values, and assertion results
- Inspect failure logs and screenshots to diagnose issues
- Run multiple browser tests in parallel using sub-agents
- Suggest bug reports for agent failures, linked to the GitHub repo

**Example prompts:**

```
"Can you verify the checkout flow on staging.myapp.com works?"
"Check if our login form shows the right error for wrong passwords"
"Search for 'laptops' on Amazon and store the top 3 prices"
```

</TabItem>

<TabItem value="codex" label="Codex CLI">

The Kane CLI skill for Codex CLI is appended to your `AGENTS.md` file. Codex reads `AGENTS.md` at the project root or from `~/.codex/AGENTS.md` globally.

**Global install** (available in all projects):

```bash
curl -o /tmp/kane-cli-agents.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/codex/AGENTS.md

# Append to global AGENTS.md (creates the file if it doesn't exist)
cat /tmp/kane-cli-agents.md >> ~/.codex/AGENTS.md
```

**Project-level install**:

```bash
curl -o /tmp/kane-cli-agents.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/codex/AGENTS.md

cat /tmp/kane-cli-agents.md >> AGENTS.md
```

**What Codex can do with this skill:**

- Invoke `kane-cli run --agent` for browser tasks
- Parse NDJSON output using `jq` and `tail`
- Run parallel browser tests using shell background processes (`&` + `wait`)
- Inspect failure logs and show screenshot paths

**Example prompts:**

```
"Verify the staging site checkout flow works"
"Run the login test and tell me what happened"
```

</TabItem>

<TabItem value="gemini" label="Gemini CLI">

The Kane CLI skill for Gemini CLI is a `SKILL.md` file placed in your Gemini skills directory.

**Global install** (available in all projects):

```bash
mkdir -p ~/.gemini/skills/kane-cli
curl -o ~/.gemini/skills/kane-cli/SKILL.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/gemini/SKILL.md
```

**Project-level install**:

```bash
mkdir -p .gemini/skills/kane-cli
curl -o .gemini/skills/kane-cli/SKILL.md \
  https://raw.githubusercontent.com/LambdaTest/kane-cli/main/skills/gemini/SKILL.md
```

**What Gemini can do with this skill:**

- Identify browser automation requests and invoke `kane-cli --agent`
- Parse NDJSON events and surface the final result
- Run tests in parallel using shell subprocesses
- Diagnose failures from log files and screenshots

**Example prompts:**

```
"Test that the homepage loads correctly on staging"
"Verify the registration flow works end to end"
```

</TabItem>

</Tabs>

---

## First-Time Auth in Agent Contexts

OAuth login opens a browser window: AI agents cannot complete this flow. Use Basic Auth instead:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli login \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Get credentials from the <BrandName /> [dashboard](https://accounts.lambdatest.com/dashboard) > **Credentials**. Verify with `kane-cli whoami`.

---

## How Skills Work

When you ask your AI agent to test something on the web, the skill:

1. Checks `kane-cli` is installed (`kane-cli --version`)
2. Verifies authentication (`kane-cli whoami`)
3. Builds a `kane-cli run --agent --headless` command from your request
4. Parses the NDJSON stream, waits for `run_end`
5. Presents structured results: status, steps, duration, extracted values, assertion results
6. If failed: inspects `run_dir` logs and screenshots to diagnose the issue
7. Rates the run and suggests a bug report for low-quality agent failures

---

## Skill File Locations

| Agent | Global | Project-level |
|-------|--------|---------------|
| Claude Code | `~/.claude/skills/kane-cli/SKILL.md` | `.claude/skills/kane-cli/SKILL.md` |
| Codex CLI | `~/.codex/AGENTS.md` (appended section) | `AGENTS.md` (appended section) |
| Gemini CLI | `~/.gemini/skills/kane-cli/SKILL.md` | `.gemini/skills/kane-cli/SKILL.md` |

Source files: [github.com/LambdaTest/kane-cli/tree/main/skills](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/getting-started.md)
