# Troubleshooting

This page lists common problems you may hit while using kane-cli, what causes them, and how to resolve them. If you're new to the CLI, start with [Installation](./installation.md) and [Getting started](./getting-started.md); for setup-level concerns see [Configuration](./configuration.md) and [Authentication](./authentication.md).

## Contents

- [Install fails with "sharp: Please add node-addon-api"](./troubleshooting/sharp-install-failure.md) — system libvips, npm optional deps, proxy issues
- [Chrome failed to launch](#chrome-failed-to-launch)
- [Authentication failed](#authentication-failed)
- [Login failed — fetch failed / SSL certificate errors](#login-failed--fetch-failed--ssl-certificate-errors) — Node TLS trust against a corporate proxy
- [Runner SSL: CERTIFICATE_VERIFY_FAILED behind a TLS-inspecting proxy](#runner-ssl-certificate_verify_failed-behind-a-tls-inspecting-proxy) — Python runner TLS trust (Netskope, Zscaler, GlobalProtect)
- [Run timed out or max steps exceeded](#run-timed-out-or-max-steps-exceeded)
- [Variables not resolving](#variables-not-resolving)
- [Upload failed or TMS error](#upload-failed-or-tms-error)
- [CLI exits with code 2 and no output](#cli-exits-with-code-2-and-no-output)
- [Update available notice](#update-available-notice)
- [Reporting bugs](#reporting-bugs)

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

## "Login failed — fetch failed" / SSL certificate errors

If `kane-cli login` exits immediately with `Login failed — fetch failed`, or a `NODE_DEBUG=undici` trace shows an OpenSSL error code like `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, kane-cli could not validate the TLS certificate of an auth or upload endpoint. Browsers and `curl` on the same machine will typically still work — this is specific to Node's default trust store.

The cause is that Node ships with its own bundled Mozilla CA list and does not read the operating-system keychain by default. If corporate endpoint security software (EDR), a TLS-inspecting proxy (Zscaler, Netskope, GlobalProtect), or any similar tool signs traffic with a root certificate that lives only in the OS keychain, Node has no way to validate it. Browsers and `curl` succeed because they trust the keychain natively; Node does not.

Fixes, in order of preference:

1. **Tell Node to trust the system keychain.** Built-in env var, available on Node 22.19+ / 24.6+:

   ```bash
   export NODE_USE_SYSTEM_CA=1
   kane-cli login
   ```

   See the [Node docs](https://nodejs.org/api/cli.html#node_use_system_ca1). On macOS this reads the default and system keychains using the same trust policy your browser uses, so whatever root makes `curl` and your browser work will work for kane-cli too.

2. **Point Node at a specific CA bundle.** If you are in a corporate setup and your IT or security team can provide the corporate CA file directly, use the standard Node env var:

   ```bash
   export NODE_EXTRA_CA_CERTS=/path/to/corp-ca.pem
   kane-cli login
   ```

   This is also the fallback for Node versions older than 22.19, where `NODE_USE_SYSTEM_CA` is unavailable.

3. **Persist the setting** by adding the `export` line to your shell profile (`~/.zshrc`, `~/.bashrc`, or equivalent) so every new terminal session inherits it. Otherwise the env var only applies to the shell where you ran `export`.

## Runner: "[SSL: CERTIFICATE_VERIFY_FAILED]" behind a TLS-inspecting proxy

If `kane-cli login` succeeds but a run fails mid-execution with an error like:

```
[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain
```

the failure is in the bundled `v16-runner`, not in Node. The runner is a standalone Python binary (built with Nuitka) and ships with [certifi](https://github.com/certifi/python-certifi)'s `cacert.pem` baked in. It does **not** consult the Windows / macOS / Linux system trust store, and the Node fixes above (`NODE_USE_SYSTEM_CA`, `NODE_EXTRA_CA_CERTS`) do not affect it.

On a corporate network with a TLS-inspecting proxy (Netskope, Zscaler, GlobalProtect, etc.), the proxy decrypts and re-encrypts HTTPS using its own self-signed root CA. That root is in your OS keychain but not in certifi's bundle, so the runner's TLS handshake fails. On a home network there is no MITM, so the chain validates against certifi and the same command works.

Fix — give the runner a CA bundle that includes the corporate root:

1. **Get the corporate root CA from IT.** On Windows you can export it yourself: open `certmgr.msc` → **Trusted Root Certification Authorities** → **Certificates**, find the proxy's CA (often named after Netskope / Zscaler / your company), right-click → **All Tasks → Export**, choose **Base-64 encoded X.509 (.cer)**.

2. **Concatenate it with certifi's `cacert.pem`** into a single PEM file. On Windows, for example, save the combined file as `C:\certs\corp-bundle.pem`.

3. **Point the runner at the combined bundle** with `SSL_CERT_FILE`.

   Windows (persists across new terminals):

   ```cmd
   setx SSL_CERT_FILE "C:\certs\corp-bundle.pem"
   ```

   Restart the terminal after `setx` — the variable is only picked up by new shells.

   macOS / Linux:

   ```bash
   export SSL_CERT_FILE=/path/to/corp-bundle.pem
   ```

   Add the `export` line to `~/.zshrc` / `~/.bashrc` to persist it.

If your environment also breaks `kane-cli login`, apply the Node-side fix in the previous section as well — the two env vars cover two different processes and you may need both.

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
3. **Project / folder.** If `kane-cli config show` reports `project_id` empty, you don't need to do anything — kane-cli auto-defaults a project on first run. If you want uploads in a specific project or folder, set it explicitly with `kane-cli config project <id>` / `kane-cli config folder <id>` (use `kane-cli projects list` / `kane-cli folders list` to discover IDs), or pick one in the TUI. A previously-configured project that has been deleted or renamed is detected automatically and replaced via auto-default; an invalid ID typed by mistake is handled the same way. See [test-manager-integration.md](./test-manager-integration.md) for the full behavior.

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
