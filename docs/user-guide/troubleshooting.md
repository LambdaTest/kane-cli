# Troubleshooting

This page lists common problems you may hit while using kane-cli, what causes them, and how to resolve them.

## "Chrome failed to launch"

kane-cli manages a Chrome process for you and connects to it over the Chrome DevTools Protocol (CDP). If launch fails, the most likely causes are:

- **Chrome is not installed** in any of the locations kane-cli searches. On macOS it looks under `/Applications/Google Chrome.app` and equivalent user paths; on Linux it looks for `google-chrome`, `google-chrome-stable`, `chromium`, and similar binaries; on Windows it looks under `Program Files\Google\Chrome\Application\chrome.exe` and the user's `AppData\Local`.
- **All CDP ports in the 9222–9230 range are in use.** kane-cli scans this nine-port range for an open port; if every port is busy you will see an error like `All CDP ports 9222-9230 are in use. Close other Chrome instances.`
- **Profile lock from another running Chrome.** If a separate Chrome instance is already using the same user-data directory, the new instance can fail to start cleanly.

Remediation:

1. Install Google Chrome (or Chromium / Chrome for Testing) from the official source for your platform.
2. Quit any extra Chrome processes that may be hoarding the 9222–9230 port range. On macOS / Linux you can list them with `lsof -i :9222-9230`.
3. Pick a different Chrome user-data directory, or quit the Chrome instance currently using it. See [Chrome management](./configuration.md#chrome-management) for how kane-cli chooses and configures the profile.
4. If you only need to connect to your own already-running Chrome, start it with `--remote-debugging-port=9222` and pass `--cdp-endpoint http://127.0.0.1:9222` to `kane-cli run`.

## "Authentication failed"

This means kane-cli could not produce a valid auth token for the configured environment.

For interactive use:

1. Re-run the login flow:

   ```bash
   kane-cli login
   ```

2. Confirm which profile, environment, and token state are active:

   ```bash
   kane-cli whoami
   ```

   If the token is missing or expired and refresh did not succeed, log in again.

For CI / non-interactive use, kane-cli can authenticate with username + access key instead of OAuth. Verify both values against the credentials shown in your TestmuAI dashboard, then pass them on the command line:

```bash
kane-cli run "<objective>" \
  --username "<your-testmuai-username>" \
  --access-key "<your-testmuai-access-key>"
```

If they still do not work, regenerate the access key in the dashboard and retry.

## "Run timed out" or "max steps exceeded"

A run ends with a timeout when it hits the wall-clock limit, and with a max-steps error when the agent exhausts its allowed step budget before finishing.

You have three options:

1. **Raise the limits.** Increase `--timeout <seconds>` and `--max-steps <n>` on `kane-cli run`. The default max-steps is `30`.
2. **Break the work into smaller objectives.** Run several sequential `kane-cli run` invocations, each focused on one logical sub-task. The session keeps the same browser between runs, so state carries over.
3. **Tighten the objective.** Vague objectives often cause the agent to wander; describe the target outcome and any required values up front.

## "Variables not resolving"

If `{{my_var}}` placeholders are appearing literally in actions, the variable isn't being loaded.

Check, in order:

1. **JSON syntax.** Variable files are JSON. A missing comma or unquoted key will cause the file to be skipped silently.
2. **File location.** Variable files have to live in one of the directories kane-cli scans. Confirm yours is in the right place — see [loading order](./variables-and-context.md#loading-order) for the exact precedence.
3. **Inline test.** Bypass file loading entirely by passing the variable on the command line:

   ```bash
   kane-cli run "log in as {{user}}" \
     --variables '{"user":{"value":"alice"}}'
   ```

   If the inline form works, the issue is with file loading, not the variable itself.

## "Upload failed" or "TMS error"

kane-cli uploads run artifacts to TestmuAI TMS at the end of the session. If the upload fails:

1. **Authentication.** Re-check `kane-cli whoami` and re-login if needed. TMS upload requires a valid token (or basic auth) for the configured environment.
2. **Network connectivity.** The upload talks to the TestmuAI control plane and a cloud storage endpoint. Verify outbound HTTPS to your environment's TestmuAI hosts is not blocked by a proxy or firewall.
3. **Project is set.** The pipeline will not commit a test case without a project. Confirm one is configured:

   ```bash
   kane-cli config show
   ```

   If `project_id` is empty, set it with `kane-cli config project` or pick one in the TUI.

## CLI exits with code 2 and no output

If `kane-cli run` ends with exit status 2 and the run produces no stdout or stderr after the early startup lines, one of two things is usually happening:

1. **Authentication or setup is missing.** This is the common case on a fresh machine. Run `kane-cli whoami`; if it reports "not configured", re-run `kane-cli login` (or pass `--username` / `--access-key` in non-interactive environments). See also ["Authentication failed"](#authentication-failed) above.
2. **kane-cli was installed via an unsupported package manager** — most commonly **pnpm**. pnpm stores packages under a nested `node_modules/.pnpm/` directory, and the resolver for the bundled `v16-runner` binary does not yet search that layout, so the CLI aborts before it can print a useful error. This limitation is tracked in [issue #24](https://github.com/LambdaTest/kane-cli/issues/24); switch to one of the supported install paths listed in [Install with pnpm or yarn](./installation.md#install-with-pnpm-or-yarn) as a workaround.

To surface the underlying error instead of a silent exit, re-run the same command with `KANE_DEV_MODE=1`:

```bash
KANE_DEV_MODE=1 kane-cli run "<objective>" --agent --headless
```

In dev mode, setup and resolver failures print an explanatory line before the process exits. Use that message to decide which of the two cases above applies; do not ship `KANE_DEV_MODE=1` in production scripts.

## "Update available" notice

kane-cli checks the public npm registry for a newer release of `@testmuai/kane-cli` once every 24 hours. The result is cached locally so the check itself is non-blocking and silent on failure. When a newer version exists, kane-cli surfaces it as an "update available" notification with the current and latest versions and a severity label (`major`, `minor`, or `patch`).

The notice is informational — your current version still works. To upgrade, follow the steps in [updates](./installation.md#updates).

## Reporting bugs

If you've worked through this page and the problem persists, please file an issue at `<your TestmuAI support channel>` with:

- The exact command you ran.
- The kane-cli version (`kane-cli --version`).
- Your OS and Chrome versions.
- The relevant section of `~/.testmuai/kaneai/sessions/<session-id>/tui.log` (redact any secrets first).
