# Running tests

kane-cli runs tests in two modes: an interactive **TUI** for development and exploration, and a headless **CLI** for scripts and CI. Both modes execute the same agent against the same browser; only the surface differs.

## Writing objectives

An objective is the natural-language instruction the agent follows. The clearer the objective, the more reliably the agent completes it.

What makes a good objective:

- **Specific.** Name the site, the action, and the field values where they matter.
- **Action-oriented.** Lead with a verb: search, open, fill, click, verify.
- **Includes a success criterion.** State what "done" looks like so the agent knows when to stop.

### Examples

```text
Search for "noise-cancelling headphones" on amazon.com and confirm at least
one result appears with a price under $200.
```

```text
Fill the registration form at example.com/signup with name "Test User",
email "test@example.com", and a 12-character random password. Submit and
verify the confirmation page loads.
```

```text
Open https://app.example.com, log in with the credentials in {{tester}},
navigate to Settings > Billing, and verify the current plan is "Pro".
```

### Bad to better

| | Objective |
|---|---|
| Bad | Test the login page. |
| Better | Open https://app.example.com/login, log in as `{{tester}}`, and verify the dashboard URL contains `/home`. |

The bad version leaves "test" undefined and gives the agent no end state. The better version names the URL, the credentials, and the assertion that closes the loop.

## Interactive TUI

Launch the TUI by running `kane-cli --tui`. The TUI is the right surface when you are exploring objectives, debugging failures, or working through a multi-run flow that should share browser state.

### Boot and menu

On launch, kane-cli runs a short boot sequence (auth check, environment resolution, mascot animation), then drops into the **main menu**. The top-level entries are:

| Entry | Purpose |
|-------|---------|
| Run | Start a run or adjust per-run options. |
| Auth | Login, logout, switch profile, view identity, check credit balance. |
| Config | View and change settings (mode, project, folder, Chrome profile, window size). |
| Exit | Graceful shutdown (uploads the session if applicable). |

Use the arrow keys to navigate, Enter to select, and Esc to back out of a submenu.

### Chat

Selecting **Run > Start Run** switches the TUI into chat mode. Type your objective at the prompt and press Enter. The agent begins streaming steps into the scrollback as it works: each step shows the action taken, a short rationale, and a status icon. When the run finishes, a result summary block appears.

Subsequent runs in the same TUI session reuse the same browser, so you can iterate on objectives without re-logging in or re-navigating.

### Slash commands

Typing `/` in chat mode opens an autocomplete palette. Continue typing to filter, use the arrow keys to select, and press Enter to insert the command. The full command list:

| Command | Args | Description |
|---------|------|-------------|
| `/run` | `"objective"` | Execute a test run. |
| `/login` | `[--profile name]` | OAuth login. |
| `/logout` | `[--profile name]` | Logout and revoke tokens. |
| `/whoami` | `[--profile name]` | Show profile info. |
| `/balance` | | Show credit balance. |
| `/profiles` | `list\|switch\|delete` | Manage profiles. |
| `/config` | `show\|set-window\|set-mode\|chrome-profile\|project\|folder` | Manage configuration. |
| `/new` | | Start a fresh session (uploads the current session first). |
| `/summary` | `[index]` | View detailed run summaries. |
| `/cancel` | | Abort the current run. |
| `/help` | | Show the command reference. |
| `/clear` | | Clear chat history. |
| `/exit` | | Quit kane-cli. |

You can also send a bare line of text without a leading `/`. It is treated as the objective for `/run`.

### History search

Press **Ctrl+R** in the input prompt to open reverse history search across past inputs in this and previous sessions. Type to filter, use the arrow keys to move between matches, Enter to accept, and Esc to dismiss.

The same prompt also offers ghost-text completion: if your current input is a prefix of a recent entry or a slash command, the rest is shown dimmed and Tab accepts it.

### Status bar

A two-row status bar sits at the bottom of the TUI. It shows:

| Indicator | Meaning |
|-----------|---------|
| Model | The model in use (default `v16-alpha`). |
| Session | Last six characters of the current session ID. |
| Auth dot | Green when authenticated, red when not logged in. |
| Profile | Active profile name (or `no profile`). |
| Environment | `prod` (green) or a yellow `stage` warning. |
| Runs | Number of runs completed in this session. |
| Hint line | Context-aware shortcuts (chat: `ctrl+c cancel/exit`; menu: `↑↓ navigate ↵ select esc back`). |

### Cancelling and exiting

| Action | Shortcut |
|--------|----------|
| Cancel the current run | `/cancel`, or **Ctrl+C** once during a run. |
| Exit the TUI | `/exit`, or **Ctrl+C** twice in quick succession. |
| Force exit during shutdown upload | **Ctrl+C** twice while exit is in progress. |

A graceful `/exit` runs the upload pipeline (if applicable) and prints any final links to your terminal scrollback before the process ends.

### Multi-run sessions

Every run launched from the same TUI invocation shares one Chrome instance and one session directory. Cookies, login state, and tabs persist across runs in that session, so an early run can log in and a later run can land mid-application without re-authenticating. Starting a fresh session from inside the TUI is done with `/new`, which uploads the current session and then resets state.

### Interactive follow-ups

If the agent needs information mid-run (for example, a one-time code or a clarifying choice), it pauses and asks at the input prompt. Type your answer and press Enter; the agent resumes from where it left off. Use Ctrl+C to cancel the run instead of answering.

## Command-line mode

`kane-cli run` is the headless surface. It is the right choice for CI jobs, scripted invocations, and any environment that has no interactive TTY. Progress streams to stderr; the final JSON result is written to stdout.

### Basic invocation

A minimal run:

```bash
kane-cli run "Search for 'noise-cancelling headphones' on amazon.com"
```

A longer invocation with options:

```bash
kane-cli run "Log in as {{tester}} and verify the dashboard loads" \
  --headless \
  --max-steps 40 \
  --timeout 300 \
  --variables-file ./vars.json
```

### Run options

The customer-facing flags accepted by `kane-cli run`:

| Flag | Description | Default |
|------|-------------|---------|
| `--headless` | Run Chrome in headless mode. | Off |
| `--max-steps <n>` | Maximum agent steps. | `30` |
| `--timeout <seconds>` | Kill the run after N seconds. | None |
| `--cdp-endpoint <url>` | Connect to an existing Chrome via CDP. | None |
| `--ws-endpoint <url>` | Connect to a Playwright WebSocket endpoint (e.g. TestmuAI `wss://`). | None |
| `--global-context <file>` | Override the global context Markdown file. | `~/.testmuai/kaneai/global-memory.md` |
| `--local-context <file>` | Override the local context Markdown file. | `<cwd>/.testmuai/context.md` |
| `--variables <json>` | Inline variables JSON. | None |
| `--variables-file <path>` | Load variables from a JSON file. | None |
| `--session-context <json>` | Prior runs context JSON. | None |
| `--username <user>` | Basic auth username (skip OAuth). | None |
| `--access-key <key>` | Basic auth access key (skip OAuth). | None |
| `--env <name>` | Environment (`prod`). | Active profile's env |
| `--mode <name>` | Run mode: `action` (strict) or `testing` (lenient). | Config value, otherwise `testing` |
| `--agent` | Plain NDJSON output, no colors or UI. | Off |
| `--code-export` | Generate code export after upload. | Off |
| `--code-language <lang>` | Code export language (currently `python`). | `python` |
| `--skip-code-validation` | Skip post-codegen worker-side validation. | On |
| `--no-skip-code-validation` | Force post-codegen worker-side validation. | Off |

For variables and context file behavior, see [./variables-and-context.md](./variables-and-context.md). For code export and the run mode toggle, see [./configuration.md](./configuration.md).

### Output streams

| Stream | Contents |
|--------|----------|
| stderr | Live progress (banner, step tree, result box, links, upload progress, feedback prompt). |
| stdout | The final JSON `run_end` payload, including the share URL when an upload succeeds. |

This separation lets you capture each independently:

```bash
kane-cli run "..." > result.json 2> progress.log
```

In CI, redirect stdout to a file your job can parse and let stderr stream to the build log so engineers can read the run in real time.

When stdin is not a TTY, kane-cli automatically switches to plain NDJSON mode (the same as `--agent`). Each line on stdout is one JSON event terminated by a newline.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Run passed. |
| `1` | Run failed (agent reached an unrecoverable failure or upload failed). |
| `2` | Error (auth, configuration, Chrome, or unhandled exception). |
| `3` | Run was cancelled or hit the `--timeout`. |

Use these codes to gate downstream CI steps.

## What you see at the end of a run

When a run finishes, kane-cli prints a result summary to the terminal:

| Field | Meaning |
|-------|---------|
| Status | `PASSED` (green check) or `FAILED` (red cross). |
| Steps | Total step count, with a `(N passed, M failed)` breakdown when there were failures. |
| Duration | Wall-clock time in seconds (or minutes and seconds for longer runs). |
| Credits | Credits consumed, when reported. |
| Summary | Bullet-point summary of what the agent did. |
| Reason | Failure reason (failed runs only). |

Below the summary, kane-cli prints any of the following links that apply to the run:

| Label | Points to |
|-------|-----------|
| `ShareLink` | A shareable session URL on TestmuAI TMS. |
| `TestCase` | The test case detail page in TestmuAI TMS. |
| `CodeExport` | The local directory containing the generated code (when code export is enabled). |

Modern terminals render these as clickable hyperlinks. For details on what each link leads to, see [./tms-integration.md](./tms-integration.md).

## Feedback prompt

After the result and links print, kane-cli prompts you to rate the session with thumbs up or thumbs down. Use the left and right arrow keys to choose, Enter to submit, or Esc to skip. The rating is sent to TestmuAI TMS for the active test case; see [./tms-integration.md](./tms-integration.md) for what is recorded.
