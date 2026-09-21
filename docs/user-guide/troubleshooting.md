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
- [Debugging a failed run with its evidence pack](#debugging-a-failed-run-with-its-evidence-pack)
- [A `--remote` run refused, failed, or came back empty](#a---remote-run-refused-failed-or-came-back-empty)
- [testrun says "plan invalid" or skips members](#testrun-says-plan-invalid-or-skips-members)
- [Context sync: Git not found or too old](#context-sync-git-not-found-or-too-old)
- [Context sync: a location cannot be reached or refuses you](#context-sync-a-location-cannot-be-reached-or-refuses-you)
- [Context sync: "a rebase is open" — every change refused](#context-sync-a-rebase-is-open--every-change-refused)
- [Context sync: publication could not be confirmed](#context-sync-publication-could-not-be-confirmed)
- [Reporting bugs](#reporting-bugs)

## "Chrome failed to launch"

kane-cli manages a Chrome process for you and connects to it over the Chrome DevTools Protocol (CDP). If launch fails, the most likely causes are:

- **Chrome is not installed** in any of the locations kane-cli searches. On macOS it looks under `/Applications/Google Chrome.app` and equivalent user paths; on Linux it looks for `google-chrome`, `google-chrome-stable`, `chromium`, and similar binaries; on Windows it looks under `Program Files\Google\Chrome\Application\chrome.exe` and the user's `AppData\Local`.
- **Chrome is installed in a non-standard location** kane-cli does not search. Point it at the binary with `KANE_CLI_CHROME_PATH=/path/to/chrome`.
- **All CDP ports in the 9222–9230 range are in use.** kane-cli scans this nine-port range for an open port; if every port is busy you will see an error like `All CDP ports 9222-9230 are in use. Close other Chrome instances.`
- **Profile lock from another running Chrome.** If a separate Chrome instance is already using the same user-data directory, the new instance can fail to start cleanly.
- **Chrome is slow to become reachable.** On cold or resource-starved machines — often CI runners — Chrome can launch but not respond over the DevTools Protocol within the per-attempt timeout (default 30s). kane-cli retries the launch automatically (twice by default), but persistent slowness needs a longer timeout or more retries.

Remediation:

1. Install Google Chrome (or Chromium / Chrome for Testing) from the official source for your platform. If it is installed but in an unusual path, set `KANE_CLI_CHROME_PATH` to the binary.
2. Quit any extra Chrome processes that may be hoarding the 9222–9230 port range. On macOS / Linux you can list them with `lsof -i :9222-9230`.
3. Pick a different Chrome user-data directory, or quit the Chrome instance currently using it. See [Chrome management](./configuration.md#chrome-management) for how kane-cli chooses and configures the profile.
4. If you only need to connect to your own already-running Chrome, start it with `--remote-debugging-port=9222` and pass `--cdp-endpoint http://127.0.0.1:9222` to `kane-cli run`.
5. On a slow runner, raise the readiness timeout with `KANE_CLI_CDP_TIMEOUT_MS` (milliseconds, default `30000`) and/or the retry count with `KANE_CLI_CDP_RETRIES` (default `2`; `0` = a single attempt). A missing or invalid binary fails immediately and is *not* retried, so retries only help with transient startup slowness. See [Chrome environment variables](./configuration.md#chrome-environment-variables).

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

1. **Raise the limits.** Increase `--timeout <seconds>` and `--max-steps <n>` on `kane-cli run`. The CLI default max-steps is `50`.
2. **Break the work into smaller objectives.** Run several sequential `kane-cli run` invocations, each focused on one logical sub-task. The session keeps the same browser between runs, so state carries over.
3. **Tighten the objective.** Vague objectives often cause the agent to wander; describe the target outcome and any required values up front.

## "Variables not resolving"

Since 0.8.12 a run **refuses to start** when an authored step references a `{{name}}` that has no value — you get a receipt naming each variable, the file that is waiting for its value (or `Not in any variables file`), and the step that uses it; exit code `2`, nothing dispatched. Read the receipt first: it tells you whether to fill an existing key or add a new one, and which file. See [Before a run](./variables-and-context.md#before-a-run-unresolved-variables).

If a `{{my_var}}` placeholder is nevertheless appearing **literally** in a browser action, one of three things is true:

- The step is a **replay** — replayed steps resolve from their tape and from TMS, and a missing value there produces a warning line rather than a refusal. Fill the value and run again.
- The reference is **escaped** — `\{{my_var}}` is typed as-is on purpose, for pages where the braces are real text.
- The variable file is not being loaded at all. Check, in order:

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

## Debugging a failed run with its evidence pack

Every run seals an [evidence pack](./evidence.md) with everything needed to diagnose a failure in one place. The short version:

1. Open the pack — accept the post-run "View evidence in browser?" offer, or run `kane-cli evidence serve <pack>` and open the printed `viewer` URL.
2. Go to the failed step and read its **failure record** — the error and the page state at the moment of failure.
3. Check the step's **console and network logs** — a 4xx/5xx response or a JS error there usually explains it.
4. Compare the **annotated screenshot** (what the agent acted on) against what you expected.

The full walkthrough is in [Evidence packs → Debugging a failed run from its pack](./evidence.md#debugging-a-failed-run-from-its-pack), and the pack's file layout is in [Inside the pack](./evidence.md#inside-the-pack). The pack is the only place run logs live — a `.evidence` file is a plain zip, so even without the viewer you can `unzip` it and read the logs directly. If a pack won't open in the viewer, run `kane-cli evidence validate <pack>` — a truncated or unsealed pack reports invalid; the session directory's `tui.log` still has the session narrative.

One more debugging aid for batch runs: `testrun` members normally run silently — set `KANE_TESTRUN_MEMBER_DEBUG=1` to route their per-member output to stderr (prefixed `[member]`).

## A `--remote` run refused, failed, or came back empty

Three different situations, told apart by the exit code and what came back:

- **Exit `2` and no job link** — the remote preflight refused the selection before anything was dispatched. The reason is printed with the offending paths: the plugin is missing (`kane-cli plugin install remote-execution`, then `kane-cli plugin doctor remote-execution`), the selection mixes web and device tests or two mobile platforms (run them as two suites), a device test names a build that is not on this machine or that the cloud cannot take (`mobile_app_missing`, `mobile_app_not_uploadable`), the build's upload from your machine failed (`mobile_app_upload_failed`), or required recordings are gitignored (`gitignored_inputs` — un-ignore with `!output-*/`). `--dry-run` reproduces the check without creating a job.
- **Exit `1` with recordings and a pack** — the job ran and a member failed. Debug it like a local failure: `output-<stem>/Result.md` names the step and reason, and the pack has the screenshots and logs (next section).
- **A member reported `broken` with no steps, nothing published** — the grid-side kane-cli refused before launching. Open the printed job link and read the scenario stage's log. For mobile members the usual cause is an `APP…` id that belongs to a different organisation than the account running the job; `kane-cli apps list --target <kind>` for the active profile is the authority. The members' session logs are also under `~/.testmuai/kaneai/sessions/remote/<job-id>/`.

Full reference: [Remote runs on the cloud grid](./remote-execution.md).

## testrun says "plan invalid" or skips members

`kane-cli testrun run` refuses to start unless every selected test passes preflight; the offenders are listed with a reason each:

| Reason | Meaning | Fix |
|---|---|---|
| `missing_meta` | The test has no recorded output directory next to it. | Run it once: `kane-cli testmd run <path>`. |
| `not_authored` | The test ran but never committed (no test id). | Run it to completion so it commits. |
| `org_mismatch` | The test belongs to a different organisation than the other members. | Check identities with `kane-cli testmd status <path>`. |
| `project_mismatch` | The test belongs to a different project than the other members. | Same check; run project-by-project, or re-home the test. |

Use `kane-cli testrun run --dry-run …` to see the full plan and every offender without executing anything. See [Batch runs with testrun](./testrun.md#preflight).

## Context sync: Git not found or too old

A GitHub location (`kane-cli context sync add`, `kane-cli context clone`, or `kane-cli context sync setup`) needs Git **2.31 or newer** on the machine that runs kane-cli. Without it the command refuses before touching anything:

```
$ kane-cli context sync add team git@github.com:example-org/team-context.git
checking team: read access and safe publishing…
error: This location needs Git 2.31 or newer.
next: Install or update Git, then run setup again: https://git-scm.com/downloads
```

Install Git from the link, or update it (`brew install git`, `apt-get install git`, or the Windows installer), open a new terminal so `git --version` reports 2.31 or newer, and run the same command again. On a CI runner, add a Git install step before kane-cli. Folder and S3-compatible locations do not need Git at all — see [Sharing the context graph](./assurance/sharing.md#locations).

## Context sync: a location cannot be reached or refuses you

Two different refusals, told apart by the message:

- **Nothing answered.** The folder does not exist and cannot be created, the host is down, or no repository answered at that address — a private repository you have not been invited to looks missing:

  ```
  error: nothing answered at /no/such/parent/team-context: that folder does not exist and cannot be created
  next: check the path, then run the command again
  ```

  Check the address (`kane-cli context sync list` shows what the store has), that the drive is mounted, and that the repository exists and is shared with your account.

- **The location answered and refused you.** Keys, a key pair, or an account without read permission:

  ```
  error: the bucket at https://team-context.s3.eu-west-1.amazonaws.com did not accept origin's access keys, even for reading
  next: ask the owner of the bucket for access, or bind it again with the right keys: kane-cli context sync add origin <descriptor> --credential-env <VAR>
  ```

  `<descriptor>` in that line is the address of the location. Ask the owner for access, or bind the location again under the same name with the right keys — `kane-cli context sync add` on an existing name replaces its keys, and a pair the location refuses never replaces one that worked. For a GitHub location over HTTPS in CI, check that `KANE_SYNC_GIT_TOKEN` grants Contents read/write on *that* repository.

- **Over SSH.** kane-cli never answers an SSH prompt. A host key this computer has not accepted yet refuses with `this computer has not accepted github.com's SSH host key yet` — run `ssh -T git@github.com` once in a terminal and answer yes. A key that is not loaded, or not on the account, refuses with `github.com did not accept your SSH key` — load it with `ssh-add`, or ask the repository owner to grant your account access. Over HTTPS without a stored login the message is `sign in is needed, or your account has no access to this repository on github.com` — sign in through Git: `gh auth login --hostname github.com --git-protocol https --web`, then `gh auth setup-git --hostname github.com`, and run the command again.

- **The connection check could not finish.** `The server did not complete the concurrent connection check. Its scratch-ref policy may differ from the storage branch.` (`SYNC_PROBE_INCONCLUSIVE`) means the concurrent connection check did not finish; repository rules that block the scratch reference the check pushes under `refs/kane/probe/` are the usual cause. Nothing was bound; ask the repository owner to check that the reference is allowed, then run the command again.

A location you can read but not write is not a refusal: it binds as download-only (`read-only: this location can be cloned and pulled, never pushed`). `kane-cli context push` to it refuses with `SYNC_READ_ONLY`, and so does `kane-cli context sync` — after its pull has already landed, so its exit `2` does not mean nothing happened. Take records from such a location with `kane-cli context pull`. The two refusals above change nothing in your store.

## Context sync: "a rebase is open" — every change refused

```
error: a rebase (2026-09-14T10-13-45-679Z-reset) is open with 2 decisions unresolved; this store takes no other change until it is finished — run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
next: run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
```

A `kane-cli context pull origin --rebase` stopped on decisions you have not answered yet (or was interrupted), and until it is finished the store takes writes from the rebase only — exactly like git mid-rebase. `kane-cli context extract`, `kane-cli design tests`, `kane-cli maintain reconcile`, `kane-cli context ingest`, `kane-cli context review`, `kane-cli context name`, `kane-cli context retire` and `kane-cli context revert` refuse with these two lines; `kane-cli context push` refuses with the same code (`SYNC_REBASE_PENDING`) and the same `next:` line, its reason naming the rebase and saying nothing was pushed. A test run does not refuse, and nothing is lost: its results wait to the side and land on the first run after the rebase closes.

1. See what is open: `kane-cli context sync status origin` lists each decision on one line; `--show <n>` prints one saved record in full.
2. Answer: `kane-cli context sync origin` walks the cards on a terminal; headless, `kane-cli context sync origin --answer <id>=keep-theirs` (or `apply-mine`), one flag per decision. `keep-theirs` writes nothing, but it is a choice, not a default: the local change stays in the backup unapplied, and a later record that was built on it is looked at again.
3. Or close it: `kane-cli context sync doctor --abort` keeps what was already reapplied and leaves the unanswered records in the backup. A rebase interrupted before it imported origin's records is undone by the same command — the store is put back as it was. Once the import has landed it can only be finished (`SYNC_RESET_IMPORTED`): run `kane-cli context sync` or `kane-cli context pull` to finish it, then close it if you still want to. `kane-cli context sync doctor --export <dir>` rebuilds the pre-rebase store beside, as its own store.

Never delete files under `.context/` to get past the refusal. See [When two people changed the same thing](./assurance/sharing.md#rebase).

## Context sync: publication could not be confirmed

A `kane-cli context push` to a GitHub location can lose the server's answer after the upload — a dropped connection, a proxy timeout. kane-cli then refuses with `SYNC_PUBLICATION_UNKNOWN` (exit `2`) rather than guess: the batch may have landed. Your store is unchanged and nothing needs to be redone. Check connectivity and run the **same** command again: it reads the location first and reconciles what actually landed — a batch that arrived is recognised as already there, never published twice; a batch that did not is published now. Only after that should anything else run. If a proxy rejects large uploads, `KANE_SYNC_GIT_HTTP_POST_BUFFER=33554432` raises Git's upload buffer for that command; a very slow link gets more time with `KANE_SYNC_GIT_TRANSFER_TIMEOUT_SECONDS` — see [Context sync environment variables](./configuration.md#context-sync-environment-variables).

## Reporting bugs

If you've worked through this page and the problem persists, please file an issue at `<your TestmuAI support channel>` with:

- The exact command you ran.
- The kane-cli version (`kane-cli --version`).
- Your OS and Chrome versions.
- The relevant section of `~/.testmuai/kaneai/sessions/<session-id>/tui.log` (redact any secrets first).
