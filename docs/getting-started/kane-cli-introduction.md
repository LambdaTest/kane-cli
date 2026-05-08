---
id: kane-cli-introduction
title: Kane CLI
sidebar_label: Introduction
description: "Kane CLI is an AI-powered command-line tool that runs browser automation tests in plain English: from your terminal, IDE, or CI pipeline."
keywords:
  - kane cli
  - kaneai
  - browser automation
  - testmu ai
  - ai cli
  - natural language testing
url: https://www.testmuai.com/support/docs/kane-cli-introduction/
site_name: TestMu AI
slug: kane-cli-introduction/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-introduction/
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import BrandName, { BRAND_URL } from '@site/src/component/BrandName';

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

**Kane CLI** `kane-cli` is an AI-powered browser automation tool that runs from your terminal. Describe what you want to test in plain English: Kane CLI navigates websites, clicks elements, fills forms, extracts data, and validates outcomes in a real Chrome browser.

- **Run browser tests from any terminal or IDE**: no test scripts, no selectors, no framework boilerplate
- **Integrate into CI/CD pipelines**: headless mode with structured JSON output and standard exit codes
- **Use as a skill in AI coding agents**: Claude Code, Codex CLI, and Gemini CLI can invoke Kane CLI directly to test and verify web UIs on your behalf

```bash
# Install
npm install -g @testmuai/kane-cli

# Authenticate
kane-cli login

# Run your first test
kane-cli run --url https://example.com "Click the 'More information' link and verify the page loads"
```

## Three Modes

| Mode | Command | Best For |
|------|---------|----------|
| **Interactive TUI** | `kane-cli --tui` | Development, exploration, chained multi-run sessions |
| **Non-Interactive CLI Mode** | `kane-cli run "..." --headless --agent` | CI/CD pipelines, shell scripts |
| **Agent Mode** | `kane-cli run "..." --agent` | AI coding agents (Claude, Codex, Gemini) |

## Next Steps

- [Installation](/support/docs/kane-cli-installation/): Install Kane CLI and verify your setup
- [Quick Start](/support/docs/kane-cli-quickstart/): Authenticate and run your first test in 5 minutes
- [Authentication](/support/docs/kane-cli-authentication/): OAuth, basic auth, and profile management
- [Writing Objectives](/support/docs/kane-cli-writing-objectives/): Learn how to write effective natural language objectives
- [Configuration](/support/docs/kane-cli-configuration/): Window size, Chrome profiles, Test Manager project, and run mode
- [Test Manager Integration](/support/docs/kane-cli-tms-integration/): Uploads, share links, code export, and session history
- [Agent Mode](/support/docs/kane-cli-agent-mode/): Use Kane CLI with AI coding agents
- [CI/CD Integration](/support/docs/kane-cli-cicd/): Add Kane CLI to your pipeline
- [Skills](/support/docs/kane-cli-skills/): Install the Kane CLI skill for Claude, Codex, or Gemini
