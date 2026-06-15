<!-- Read this for first-time install, auth flows (basic / OAuth / interactive), config commands, full variables precedence chain, global/local context files, the Chrome management notes, and the ~/.testmuai directory layout. Rarely needed once a user is set up. -->

# kane-cli Setup, Variables, and Config Reference

## Install and auth

Before first use, verify installation and auth.

### Install

```bash
npm install -g @testmuai/kane-cli
```

### Check Auth Status

```bash
kane-cli whoami
```

If this shows "not configured" or errors, run login:

### Login (Basic Auth)

```bash
kane-cli login --username <user> --access-key <key>
```

This creates the default profile with basic auth, auto-selects the KaneAI project, and marks setup complete. Credentials come from the user's TestmuAI dashboard (Settings → Keys).

Optional flag:
- `--profile <name>` — profile name (default: last selected profile check using `config show`)

### Login (OAuth)

```bash
kane-cli login --oauth
```

This opens the browser for OAuth consent and waits for the callback. Works in both TTY and non-TTY (agent) mode.

### Login (Interactive — TTY only)

In a terminal, run `kane-cli login` with no flags for the interactive wizard (auth method → project picker → folder picker). If the user needs this, ask them to run it directly:

> Please run `! kane-cli login` and complete the sign-in.

### Verify

```bash
kane-cli whoami          # Auth status
kane-cli config show     # Current configuration
```

## Variables — full precedence chain

Variables parameterize objectives with reusable values and secrets. Use `{{key}}` syntax in objectives.

**Format:**
```json
{
  "username": { "value": "alice", "secret": false },
  "password": { "value": "s3cret!", "secret": true }
}
```

`secret: true` masks the value in logs and routes it to TestmuAI's secrets store instead of being synced as plain TMS variables.

**Loading order** (later wins):
1. `~/.testmuai/kaneai/variables/*.json` (global, alphabetical)
2. `{cwd}/.testmuai/variables/*.json` (local project overrides)
3. `--variables-file <path>`
4. `--variables '{...}'` (inline JSON)

**Always parameterize:** credentials, API keys, tokens, environment-specific URLs.
**OK to hardcode:** one-off URLs, static UI text, navigation paths.

## Context files

Context files provide additional instructions to the agent:
- **Global:** `~/.testmuai/kaneai/global-memory.md` — shared across all runs
- **Local:** `.testmuai/context.md` in cwd — project-specific

Override per-run with `--global-context` / `--local-context` flags.

## Config commands

```bash
kane-cli config show                          # Show all current settings (includes default_url)
kane-cli config set-window <W>x<H>           # Browser window size (e.g. 1920x1080)
kane-cli config set-url <url>                 # Default start URL (bare domains get https://; used when --url / test.md url: is absent)
kane-cli config chrome-profile <path>         # Chrome profile path (or interactive picker in TTY)
kane-cli config project <project-id>          # TMS project ID (or interactive picker in TTY)
kane-cli config folder <folder-id>            # TMS folder ID (or interactive picker in TTY)
```

**Start URL resolution** (first match wins): `--url <url>` flag → (test.md only) `url:` frontmatter → config `default_url`. The built-in playground default counts as "unset". With none of these set, the agent uses a site named in the objective; if nothing supplies a URL, a TTY run asks and a non-TTY run fails — pass `--allow-missing-url` to a non-TTY run to start from the current page instead.

> **Project / folder management — Read `references/test-manager.md`** for the full agent surface: `kane-cli projects list|create` and `kane-cli folders list|create` (with `--search` / `--limit` / `--offset` / `--description`), the NDJSON wire shape for `--agent` callers, and the `project_folder_auto_defaulted` event the run-startup gate emits when nothing is configured.

### Feedback

Submit feedback on a completed test run:
```bash
kane-cli feedback --test-id <id> --feedback-type <positive|negative> --details "..."
```

## Directory structure

```text
~/.testmuai/kaneai/
├── tui-config.json              # Persistent CLI settings
├── config.json                  # Shared auth configuration
├── global-memory.md             # Global agent context
├── chrome-profile/              # Default Chrome user profile
├── profiles/                    # Stored credentials
│   └── {profile}/{env}/
│       └── credentials
├── sessions/                    # Session history
│   └── {session-id}/
│       ├── session.json         # Metadata, run list, upload status
│       ├── tui.log              # Session event log
│       ├── runs/{n}/
│       │   └── run-test/
│       │       └── actions.ndjson   # Step-by-step record of agent actions
│       └── code-export/         # (when --code-export) generated code files
└── variables/                   # Global variable files
    └── *.json

# Project-local overrides (in cwd):
.testmuai/
├── context.md                   # Project-specific agent context
└── variables/
    └── *.json                   # Project-specific variables
```

## Chrome management

kane-cli auto-launches Chrome with CDP (DevTools Protocol) on ports 9222–9230. Chrome runs as a detached process and outlives the CLI.

- `--headless` — runs Chrome in headless mode (no visible window)
- `--cdp-endpoint <url>` — connect to an already-running Chrome instance
- `--ws-endpoint <url>` — connect to a remote browser (LambdaTest grid)

If Chrome fails to launch, ensure Google Chrome is installed and no other process is using CDP ports 9222–9230.

### Chrome environment variables

Read from the process environment (not `tui-config.json`) — handy for CI:

| Variable | Effect |
|---|---|
| `KANE_CLI_CHROME_PATH` | Absolute path to the Chrome binary, for non-standard installs. |
| `KANE_CLI_SKIP_BROWSER_DOWNLOAD` | Truthy (`1`/`true`/`yes`) skips the Chrome-availability startup check; uses whatever `chrome` is on PATH. |
| `KANE_CLI_CDP_TIMEOUT_MS` | Per-attempt CDP readiness timeout in ms (default `30000`). Raise on slow/cold CI runners. |
| `KANE_CLI_CDP_RETRIES` | Extra Chrome launch attempts after the first on a CDP-readiness failure (default `2`; `0` = single attempt). |

CDP timeout/retries only help with transient startup slowness — a missing or invalid binary fails immediately without retrying.
