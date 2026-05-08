---
id: kane-cli-variables-and-context
title: Variables & Context
sidebar_label: Variables & Context
description: Use variables to parameterize objectives with secrets and reusable values. Use context files to give the agent project-specific knowledge.
keywords:
  - kane cli variables
  - kane cli context
  - kaneai
  - testmu ai
  - secrets
  - test data
url: https://www.testmuai.com/support/docs/kane-cli-variables-and-context/
site_name: TestMu AI
slug: kane-cli-variables-and-context/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-variables-and-context/
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

**Variables** keep credentials and test data out of your objectives. **Context files** give the agent persistent background information — guidance, conventions, and notes that apply across runs.

---

## Variables

### Format

Variables are JSON objects keyed by name. Each entry describes a single variable:

```json
{
  "username": { "value": "alice", "secret": false },
  "api_key":  { "value": "sk-live-...", "secret": true }
}
```

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `value` | Yes | string | — | The variable's value. Entries without `value` are ignored. |
| `secret` | No | boolean | `false` | When `true`, the value is masked in logs and routed to the <BrandName /> secrets store instead of being synced as plain Test Manager variables. |
| `syntax` | No | string | `{{<name>}}` | Custom placeholder syntax. Defaults to the double-brace form using the variable name. |

### Usage in Objectives

Reference variables with `{{key}}` syntax:

```bash
kane-cli run \
  --url https://myapp.com \
  --variables-file ./creds.json \
  "fill the email field with '{{email}}',
   fill the password field with '{{password}}',
   click Login,
   assert the Dashboard is visible"
```

Before the objective is sent to the agent, `{{email}}` and `{{password}}` are rewritten to internal namespaced forms; the agent sees the resolved values at runtime.

### Loading Order

Variables are merged from four sources in this order. Later sources override earlier ones for the same key:

1. **Global directory** — `~/.testmuai/kaneai/variables/*.json`
2. **Local project directory** — `.testmuai/variables/*.json` (relative to where you invoke `kane-cli`)
3. **File flag** — `--variables-file <path>`
4. **Inline flag** — `--variables '<json>'` (highest priority)

Within a directory, files are read in alphabetical order; later files override earlier files for duplicate keys. Files that fail to parse as JSON are skipped with a warning.

### Inline Variables

Pass a JSON object directly on the command line:

```bash
kane-cli run "Log in as {{username}}" \
  --variables '{"username": {"value": "alice"}}'
```

### Variables from a File

Point at a single JSON file:

```bash
kane-cli run "Log in as {{username}}" \
  --variables-file ./vars.json
```

### Project-Local Variables

Drop one or more `*.json` files into `.testmuai/variables/` inside your project's working directory. They load automatically whenever you run `kane-cli` from that directory.

```text
my-project/
├── .testmuai/
│   └── variables/
│       ├── credentials.json
│       └── urls.json
└── ...
```

Project-local variables override global variables but are overridden by file and inline flags.

### Global Variables

For values you want available across every project on your machine, place `*.json` files in `~/.testmuai/kaneai/variables/`.

```text
~/.testmuai/kaneai/variables/
├── personal.json
└── shared.json
```

Global variables have the lowest precedence — anything else with the same key wins.

### Example Variable File

```json
{
  "app_url": { "value": "https://staging.myapp.com" },
  "admin_email": { "value": "admin@example.com" },
  "admin_password": { "value": "admin_pass_123", "secret": true },
  "customer_email": { "value": "customer@example.com" },
  "customer_password": { "value": "customer_pass_456", "secret": true },
  "test_product_sku": { "value": "PROD-2024-001" }
}
```

### Secrets

Mark a variable as secret by setting `"secret": true`:

```json
{
  "api_key": { "value": "sk-live-abc123", "secret": true }
}
```

Secret values are masked in displayed output and logs, and are routed to the <BrandName /> secrets store instead of being synced to Test Manager as plain variables. Use this for credentials, tokens, and anything else that should not appear in shareable artifacts.

:::warning
Do not commit credential files to version control. Add `.testmuai/variables/` to your `.gitignore`, or use environment variable substitution in CI/CD.
:::

---

## Context Files

Context files are plain Markdown files whose contents are passed to the agent alongside your objective. Use them for standing instructions — coding conventions, accounts to use, sites to avoid, or domain knowledge the agent should always have.

### Two Levels

| Level | Path | Use For |
|-------|------|---------|
| **Global** | `~/.testmuai/kaneai/global-memory.md` | Company-wide terminology, shared test accounts, universal patterns |
| **Local** | `.testmuai/context.md` (in project directory) | App-specific navigation, known UI quirks, test environment details |

### Example Local Context File

```markdown
# MyApp Staging Context

## Application Overview
MyApp is a SaaS project management tool. Users create projects, invite members, and track tasks.

## Test Environment
- URL: https://staging.myapp.local
- Database resets daily at 2 AM UTC
- File uploads are disabled in staging

## Navigation Patterns
- Main menu is in the left sidebar (hover to expand)
- Settings is under the top-right user avatar menu
- Deep links work: /dashboard/projects/123/tasks

## Known UI Quirks
- The modal close button sometimes needs two clicks
- Date picker defaults to today: click the field to open
- The "Copy Link" toast appears bottom-right for 3 seconds

## Common Test Flows
1. Create a project: Dashboard > "New Project" > fill name > "Create"
2. Invite a member: Project Settings > "Team" > "Invite" > enter email > "Send"
3. Complete a task: Tasks page > click task > "Mark Complete" > confirm dialog

## Test Data
- Existing project for testing: "Test Project" (ID: proj_12345)
- Existing user: john@example.com
```

### Override Per Run

Override either context file for a single run:

```bash
kane-cli run "your objective" \
  --global-context ./custom-global.md \
  --local-context ./custom-local.md
```

If a context file is missing or empty, it is silently ignored — no error is raised.

### What to Put in Context

**Global context:**
- Company terminology and naming conventions
- Standard test account references (no hardcoded values)
- Performance expectations (e.g., "page loads in under 3 seconds")
- Universal navigation patterns

**Local context:**
- App overview and purpose
- Test environment URL and known limitations
- Navigation patterns specific to this app
- Known UI quirks and workarounds
- Common test flows
- Test data references (IDs, emails: no passwords)

**Keep out of context:**
- Hardcoded secrets (use variables)
- Large code blocks or logs
- Information that changes frequently
