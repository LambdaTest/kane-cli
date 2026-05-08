---
id: kane-cli-modes
title: Modes of Operation
sidebar_label: Modes
description: "Kane CLI has three modes: Interactive TUI for development, Headless CLI for scripts and CI/CD, and Agent Mode for AI coding agent integrations."
keywords:
  - kane cli modes
  - interactive tui
  - headless cli
  - agent mode
  - kaneai
  - testmu ai
url: https://www.testmuai.com/support/docs/kane-cli-modes/
site_name: TestMu AI
slug: kane-cli-modes/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-modes/
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

Kane CLI has three modes. Choose based on who (or what) is running the test.

| Mode | Command | Output | Best For |
|------|---------|--------|----------|
| **Interactive TUI** | `kane-cli --tui` | Terminal UI | Development, exploration, chained sessions |
| **Non-Interactive CLI Mode** | `kane-cli run "..." --headless` | Formatted text + JSON | CI/CD, shell scripts |
| **Agent Mode** | `kane-cli run "..." --agent` | NDJSON on stdout | AI coding agents (Claude, Codex, Gemini) |

---

## Interactive TUI

Launch the TUI:

```bash
kane-cli --tui
```

The TUI is the right surface when you are exploring objectives, debugging failures, or working through a multi-run flow that should share browser state.

### Boot and Menu

On launch, Kane CLI runs a short boot sequence (auth check, environment resolution, mascot animation), then drops into the **main menu**. The top-level entries are:

| Entry | Purpose |
|-------|---------|
| Run | Start a run or adjust per-run options |
| Auth | Login, logout, switch profile, view identity, check credit balance |
| Config | View and change settings (mode, project, folder, Chrome profile, window size) |
| Exit | Graceful shutdown (uploads the session if applicable) |

Use the arrow keys to navigate, Enter to select, and Esc to back out of a submenu.

### Chat Mode

Selecting **Run > Start Run** switches the TUI into chat mode. Type your objective at the prompt and press Enter. The agent begins streaming steps into the scrollback: each step shows the action taken, a short rationale, and a status icon. When the run finishes, a result summary block appears.

Subsequent runs in the same TUI session reuse the same browser, so you can iterate on objectives without re-logging in or re-navigating.

### Slash Commands

Typing `/` in chat mode opens an autocomplete palette. Continue typing to filter, use the arrow keys to select, and press Enter to insert the command.

| Command | Args | Description |
|---------|------|-------------|
| `/run` | `"objective"` | Execute a test run |
| `/login` | `[--profile name]` | OAuth login |
| `/logout` | `[--profile name]` | Logout and revoke tokens |
| `/whoami` | `[--profile name]` | Show profile info |
| `/balance` | | Show credit balance |
| `/profiles` | `list\|switch\|delete` | Manage profiles |
| `/config` | `show\|set-window\|set-mode\|chrome-profile\|project\|folder` | Manage configuration |
| `/new` | | Start a fresh session (uploads the current session first) |
| `/summary` | `[index]` | View detailed run summaries |
| `/cancel` | | Abort the current run |
| `/help` | | Show the command reference |
| `/clear` | | Clear chat history |
| `/exit` | | Quit Kane CLI |

You can also send a bare line of text without a leading `/`. It is treated as the objective for `/run`.

### History Search

Press **Ctrl+R** in the input prompt to open reverse history search across past inputs in this and previous sessions. Type to filter, use the arrow keys to move between matches, Enter to accept, and Esc to dismiss.

The prompt also offers ghost-text completion: if your current input is a prefix of a recent entry or a slash command, the rest is shown dimmed and Tab accepts it.

### Status Bar

A two-row status bar sits at the bottom of the TUI:

| Indicator | Meaning |
|-----------|---------|
| Model | The model in use (default `v16-alpha`) |
| Session | Last six characters of the current session ID |
| Auth dot | Green when authenticated, red when not logged in |
| Profile | Active profile name (or `no profile`) |
| Environment | `prod` (green) or a yellow `stage` warning |
| Runs | Number of runs completed in this session |
| Hint line | Context-aware shortcuts |

### Multi-Run Sessions

Every run launched from the same TUI invocation shares one Chrome instance and one session directory. Cookies, login state, and tabs persist across runs, so an early run can log in and a later run can land mid-application without re-authenticating. Starting a fresh session from inside the TUI is done with `/new`, which uploads the current session and then resets state.

```
> go to https://myapp.com and log in as admin
  ✓ PASSED (5 steps, 8.2s)

> navigate to User Management and create a new user "testuser@example.com"
  ✓ PASSED (7 steps, 12.1s)

> verify the new user appears in the users table
  ✓ PASSED (3 steps, 4.5s)
```

### Interactive Follow-Ups

If the agent needs information mid-run (for example, a one-time code or a clarifying choice), it pauses and asks at the input prompt. Type your answer and press Enter; the agent resumes from where it left off. Use Ctrl+C to cancel the run instead of answering.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Submit objective |
| Ctrl+C | Cancel current run |
| Ctrl+C (twice) | Exit TUI |
| Ctrl+R | Reverse history search |
| Esc | Go back / close picker |
| Up / Down | Navigate menu or history |
| Tab | Accept autocomplete in chat mode |

### Cancelling and Exiting

| Action | Shortcut |
|--------|----------|
| Cancel the current run | `/cancel`, or **Ctrl+C** once during a run |
| Exit the TUI | `/exit`, or **Ctrl+C** twice in quick succession |
| Force exit during shutdown upload | **Ctrl+C** twice while exit is in progress |

A graceful `/exit` runs the upload pipeline (if applicable) and prints any final links to your terminal scrollback before the process ends.

---

## Non-Interactive CLI Mode

```bash
kane-cli run "Search for 'automation testing' on Google" \
  --url https://google.com \
  --headless
```

This mode is best for shell scripts, CI/CD pipelines, and any scenario where the interactive TUI is not needed.

### Output Streams

| Stream | Contents |
|--------|----------|
| stderr | Live progress (banner, step tree, result box, links, upload progress, feedback prompt) |
| stdout | The final JSON `run_end` payload, including the share URL when an upload succeeds |

This separation lets you capture each independently:

```bash
kane-cli run "..." > result.json 2> progress.log
```

In CI, redirect stdout to a file your job can parse and let stderr stream to the build log.

When stdin is not a TTY, Kane CLI automatically switches to plain NDJSON mode (the same as `--agent`). Each line on stdout is one JSON event terminated by a newline.

### Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| `0` | Test passed |
| `1` | Test failed (assertion not met) |
| `2` | Error (auth failure, Chrome crash) |
| `3` | Timeout or cancelled |

### What You See at the End of a Run

When a run finishes, Kane CLI prints a result summary:

| Field | Meaning |
|-------|---------|
| Status | `PASSED` (green check) or `FAILED` (red cross) |
| Steps | Total step count, with a `(N passed, M failed)` breakdown when there were failures |
| Duration | Wall-clock time in seconds (or minutes and seconds for longer runs) |
| Credits | Credits consumed, when reported |
| Summary | Bullet-point summary of what the agent did |
| Reason | Failure reason (failed runs only) |

Below the summary, Kane CLI prints any of the following links:

| Label | Points to |
|-------|-----------|
| `ShareLink` | A shareable session URL on <BrandName /> Test Manager |
| `TestCase` | The test case detail page in <BrandName /> Test Manager |
| `CodeExport` | The local directory containing generated code (when code export is enabled) |

### Feedback Prompt

After the result and links print, Kane CLI prompts you to rate the session with thumbs up or thumbs down. Use the left and right arrow keys to choose, Enter to submit, or Esc to skip. See [Test Manager Integration](/support/docs/kane-cli-tms-integration/) for details.

---

## Agent Mode

Add `--agent` to get structured NDJSON output designed for AI coding agents:

```bash
kane-cli run "Verify login page loads" --url https://myapp.com --agent --headless
```

With `--agent`:
- The interactive TUI is **fully suppressed**: no boot screen, no menus
- Each event is a **single JSON line** on stdout
- Progress UI renders to **stderr** (clean separation)
- Stdin is not used (no interactive prompts)

This mode is how Claude Code, Codex CLI, and Gemini CLI consume Kane CLI results. The agent reads the NDJSON stream, parses the final `run_end` event, and presents results to you.

See [Agent Mode](/support/docs/kane-cli-agent-mode/) for the full event schema and parsing guide.

:::tip
Always combine `--agent` with `--headless` in non-interactive environments to prevent display server errors.
:::
