---
id: kane-cli-cli-reference
title: CLI Reference
sidebar_label: CLI Reference
description: "Complete command and flag reference for Kane CLI: all commands, options, exit codes, TUI slash commands, keyboard shortcuts, and directory structure."
keywords:
  - kane cli reference
  - kane cli commands
  - kaneai
  - testmu ai
  - cli flags
url: https://www.testmuai.com/support/docs/kane-cli-cli-reference/
site_name: TestMu AI
slug: kane-cli-cli-reference/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-cli-reference/
---

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

## Commands

### `kane-cli --tui`

Launch the interactive TUI.

```bash
kane-cli --tui
```

---

### `kane-cli run`

Run a browser automation test.

```bash
kane-cli run "<objective>" [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Starting URL for the browser | Last used or configured URL |
| `--headless` | Run Chrome without a visible window | Off |
| `--max-steps <n>` | Maximum agent reasoning steps | `30` |
| `--timeout <s>` | Abort after N seconds | No limit |
| `--cdp-endpoint <url>` | Connect to an existing Chrome via CDP | Auto-launch Chrome |
| `--ws-endpoint <url>` | Connect via WebSocket (e.g. <BrandName /> remote grid `wss://`) | Local Chrome |
| `--variables <json>` | Inline variable JSON | None |
| `--variables-file <path>` | Load variables from a JSON file | None |
| `--global-context <file>` | Override global context markdown | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override local context markdown | `.testmuai/context.md` |
| `--session-context <json>` | Prior runs context JSON | None |
| `--agent` | Output structured NDJSON (for AI coding agents) | Off |
| `--mode <name>` | Run mode: `action` (strict) or `testing` (lenient) | Config value, otherwise `testing` |
| `--code-export` | Generate code export after run uploads | Off |
| `--code-language <lang>` | Code export language (currently `python`) | `python` |
| `--skip-code-validation` | Skip post-codegen worker-side validation | On |
| `--no-skip-code-validation` | Force post-codegen worker-side validation | Off |
| `--username <user>` | Basic auth username (overrides stored profile) | N/A |
| `--access-key <key>` | Basic auth access key (overrides stored profile) | N/A |
| `--env <name>` | Environment (`prod`) | Active profile's env |

---

### `kane-cli login`

Authenticate with <BrandName />. Opens a browser for OAuth, or accepts credentials for basic auth.

```bash
# OAuth (interactive)
kane-cli login [--profile <name>]

# Basic auth (non-interactive)
kane-cli login --username <user> --access-key <key> [--profile <name>]
```

See [Authentication](/support/docs/kane-cli-authentication/) for details on profiles and auth methods.

---

### `kane-cli logout`

Revoke tokens and remove stored credentials for the active profile.

```bash
kane-cli logout
```

---

### `kane-cli whoami`

Show the active profile and authentication status.

```bash
kane-cli whoami [--profile <name>]
```

Prints profile, environment, auth method, username, and token state (for OAuth).

---

### `kane-cli balance`

Show credit balance for the active profile.

```bash
kane-cli balance [--profile <name>]
```

---

### `kane-cli profiles`

Manage named authentication profiles.

```bash
kane-cli profiles list           # List all profiles
kane-cli profiles switch <name>  # Switch the active profile
kane-cli profiles delete <name>  # Delete a profile
```

See [Authentication — Profiles](/support/docs/kane-cli-authentication/#profiles) for details.

---

### `kane-cli config`

View and modify persistent settings.

```bash
kane-cli config show                       # Show all settings
kane-cli config set-window <W>x<H>        # Set browser window size
kane-cli config set-mode <action|testing>  # Set run mode
kane-cli config chrome-profile [path]      # Set Chrome profile (interactive picker if no path)
kane-cli config project [id]               # Set Test Manager project (interactive picker if no id)
kane-cli config folder [id]                # Set Test Manager folder (interactive picker if no id)
```

:::note
Commands without arguments (`chrome-profile`, `project`, `folder`) launch an interactive picker UI. AI agents cannot run these — ask the user to run them directly.
:::

See [Configuration](/support/docs/kane-cli-configuration/) for the full settings reference.

---

### `kane-cli feedback`

Submit feedback on a completed test run.

```bash
kane-cli feedback \
  --test-id <id> \
  --feedback-type <positive|negative> \
  --details "optional message"
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Test passed |
| `1` | Test failed (assertion not met) |
| `2` | Error (auth failure, Chrome crash, infra issue) |
| `3` | Timeout or cancelled |

---

## TUI Slash Commands

| Command | Args | Description |
|---------|------|-------------|
| `/run` | `"objective"` | Execute a test run |
| `/login` | `[--profile name]` | OAuth login |
| `/logout` | `[--profile name]` | Logout and revoke tokens |
| `/whoami` | `[--profile name]` | Show profile info |
| `/balance` | | Show credit balance |
| `/profiles` | `list\|switch\|delete` | Manage profiles |
| `/config` | `show\|set-window\|set-mode\|chrome-profile\|project\|folder` | Manage configuration |
| `/new` | | Start a fresh session (uploads current session first) |
| `/summary` | `[index]` | View detailed run summaries |
| `/cancel` | | Abort the current run |
| `/help` | | Show the command reference |
| `/clear` | | Clear chat history |
| `/exit` | | Quit Kane CLI |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Submit objective |
| Ctrl+C | Cancel current run |
| Ctrl+C (twice) | Exit TUI |
| Ctrl+R | Reverse history search |
| Esc | Go back / close picker |
| Up / Down | Navigate menu or input history |
| Tab | Accept autocomplete |

---

## Settings Reference

| Setting | Default | Command |
|---------|---------|---------|
| `window_size` | `1920x1080` | `config set-window` |
| `default_url` | `https://kaneai-playground.lambdatest.io` | Internal default |
| `model` | `v16-alpha` | Internal default |
| `mode` | `testing` | `config set-mode` |
| `chrome_profile_path` | Empty (temporary per run) | `config chrome-profile` |
| `project_id` / `project_name` | None | `config project` |
| `folder_id` / `folder_name` | None | `config folder` |
| `code_export.enabled` | `false` | TUI menu or `--code-export` flag |
| `code_export.language` | `python` | `--code-language` flag |
| `code_export.skip_validation` | `true` | TUI menu or `--skip-code-validation` flag |

Settings are stored at `~/.testmuai/kaneai/tui-config.json`. See [Configuration](/support/docs/kane-cli-configuration/) for details.

---

## Directory Structure

```
~/.testmuai/kaneai/
├── tui-config.json              # Persistent settings
├── global-memory.md             # Global agent context
├── chrome-profiles/             # Named Chrome user profiles
│   └── <name>/
├── profiles/                    # Stored credentials
│   └── <profile>/
│       └── <environment>/
│           └── credentials      # OAuth tokens or basic auth (mode 0600)
├── sessions/                    # All session history
│   └── <session-id>/
│       ├── session.json         # Session metadata and run list
│       ├── tui.log              # Session event log
│       ├── runs/
│       │   └── <n>/             # Per-run directory
│       │       └── run-test/
│       │           ├── actions.ndjson
│       │           └── screenshots/
│       └── code-export/         # Generated code (when enabled)
└── variables/                   # Global variable files
    └── *.json

.testmuai/                       # Project-local (in cwd)
├── context.md                   # Project-specific agent context
└── variables/
    └── *.json                   # Project-specific variables
```
