---
id: kane-cli-troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
description: "Fix common Kane CLI issues: Chrome launch failures, authentication errors, run timeouts, variables not resolving, upload failures, and Agent Mode output problems."
keywords:
  - kane cli troubleshooting
  - kaneai errors
  - testmu ai
  - chrome failed to launch
  - authentication failed
url: https://www.testmuai.com/support/docs/kane-cli-troubleshooting/
site_name: TestMu AI
slug: kane-cli-troubleshooting/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-troubleshooting/
---

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

## Log Locations

Before diagnosing, know where to look:

| Log | Path |
|-----|------|
| Run text log | `{run_dir}/run.log` |
| Step detail (JSON) | `{run_dir}/run-test/step_NNN.json` |
| Step screenshot | `{run_dir}/run-test/screenshots/step_NNN.png` |
| Run summary | `{run_dir}/run-test/run_summary.json` |
| Session log | `{session_dir}/tui.log` |
| All sessions | `~/.testmuai/kaneai/sessions/` |

The `run_end` event in Agent Mode provides `session_dir` and `run_dir` directly.

---

## Chrome Issues

### "Chrome failed to launch"

**Cause:** Chrome is not installed, all CDP ports in the 9222–9230 range are in use, or a profile lock from another running Chrome.

Kane CLI manages a Chrome process and connects to it over the Chrome DevTools Protocol (CDP). On macOS it looks under `/Applications/Google Chrome.app`; on Linux it looks for `google-chrome`, `google-chrome-stable`, `chromium`, and similar binaries; on Windows it looks under `Program Files\Google\Chrome\Application\chrome.exe` and `AppData\Local`.

**Fix:**
1. Install Google Chrome if not present
2. Check for processes on CDP ports:
   ```bash
   lsof -i :9222-9230
   ```
3. Quit any extra Chrome processes hoarding the 9222–9230 port range
4. Pick a different Chrome user-data directory, or quit the Chrome instance using it. See [Chrome Management](/support/docs/kane-cli-configuration/#chrome-management)
5. If you only need to connect to an already-running Chrome:
   ```bash
   kane-cli run "..." --cdp-endpoint http://localhost:9222
   ```

### "CDP endpoint not reachable"

**Cause:** Using `--cdp-endpoint` but Chrome is not running on that port.

**Fix:** Remove `--cdp-endpoint` and let Kane CLI manage Chrome automatically. Or start Chrome with remote debugging before running:

```bash
google-chrome --remote-debugging-port=9222 &
kane-cli run "..." --cdp-endpoint http://localhost:9222
```

### Chrome opens then closes immediately

**Cause:** Another Kane CLI instance is already running and holds the Chrome profile lock.

**Fix:** Check for running kane-cli processes:
```bash
ps aux | grep kane-cli
```
Kill any existing processes, then retry.

---

## Authentication Issues

### "Authentication failed" (exit code 2)

**Cause:** Expired tokens or incorrect credentials.

**Fix for interactive use:**
1. Re-run the login flow:
   ```bash
   kane-cli login
   ```
2. Confirm which profile, environment, and token state are active:
   ```bash
   kane-cli whoami
   ```
   If the token is missing or expired and refresh did not succeed, log in again.

**Fix for CI / non-interactive use:**

Verify both values against the credentials shown in your <BrandName /> dashboard, then pass them on the command line:

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli run "<objective>" \\
  --username "${ YOUR_LAMBDATEST_USERNAME()}" \\
  --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

If they still do not work, regenerate the access key in the dashboard and retry.

### "Not configured" on first run

**Cause:** No profile exists yet.

**Fix:** Run the login flow:
<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli login --username "${ YOUR_LAMBDATEST_USERNAME()}" --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Get credentials from the <BrandName /> [dashboard](https://accounts.lambdatest.com/dashboard) > **Credentials**.

### Basic auth not working

**Cause:** Wrong username or access key.

**Fix:** Verify your credentials on the <BrandName /> dashboard. Username and access key are case-sensitive. Make sure you're using the access key (not the password).

---

## Run Issues

### "Run timed out" or "max steps exceeded"

**Cause:** Objective is too complex, page is slow to load, or `--max-steps` is too low.

**Fix:**
- Increase `--timeout`: `--timeout 300`
- Increase `--max-steps`: `--max-steps 60`
- Break the work into smaller objectives. Run several sequential `kane-cli run` invocations, each focused on one logical sub-task. The session keeps the same browser between runs, so state carries over.
- Tighten the objective. Vague objectives often cause the agent to wander; describe the target outcome and any required values up front.

### Agent repeats the same action

**Cause:** The agent is stuck in a loop: the page didn't change after the action.

**Fix:** Rephrase the objective to be more explicit. Add an assertion after the action to confirm state changed:
```
"click the Save button, assert the page shows 'Saved successfully'"
```

### "Variables not resolving": `{{key}}` appears literally

**Cause:** Variable file not loaded, wrong JSON format, or wrong variable key name.

**Fix:**
1. **JSON syntax.** Variable files are JSON. A missing comma or unquoted key will cause the file to be skipped silently.
2. **File location.** Confirm your file is in the right place — see [loading order](/support/docs/kane-cli-variables-and-context/#loading-order).
3. **Inline test.** Bypass file loading by passing the variable on the command line:
   ```bash
   kane-cli run "log in as {{user}}" \
     --variables '{"user":{"value":"alice"}}'
   ```
   If the inline form works, the issue is with file loading, not the variable itself.

### Assertions fail even though the page looks correct

**Cause:** The assertion phrasing doesn't match what's on the page, or there's a timing issue.

**Fix:**
1. Check the screenshot at `{run_dir}/run-test/screenshots/step_NNN.png`: see exactly what the agent saw
2. Refine the assertion: use `assert the page contains` (substring) instead of exact text
3. Add a wait: `"wait for the confirmation message to appear, then assert..."`

---

## Upload Issues

### "Upload failed" or "Test Manager error"

**Cause:** Kane CLI uploads run artifacts to <BrandName /> Test Manager at the end of the session. If the upload fails:

**Fix:**
1. **Authentication.** Re-check `kane-cli whoami` and re-login if needed. Test Manager upload requires a valid token (or basic auth) for the configured environment.
2. **Network connectivity.** The upload talks to the <BrandName /> control plane and a cloud storage endpoint. Verify outbound HTTPS is not blocked by a proxy or firewall.
3. **Project is set.** The pipeline will not commit a test case without a project. Confirm one is configured:
   ```bash
   kane-cli config show
   ```
   If `project_id` is empty, set it with `kane-cli config project` or pick one in the TUI.

---

## Agent Mode Issues

### No NDJSON output / only seeing TUI

**Cause:** Missing `--agent` flag.

**Fix:** Add `--agent` to your command:
```bash
kane-cli run "..." --agent --headless
```

### NDJSON parsing fails: `jq` errors or unexpected output

**Cause:** Stderr is mixing with stdout, or you're trying to parse mid-stream events.

**Fix:** Redirect stderr and use `tail -1` to get only the `run_end` event:
```bash
kane-cli run "..." --agent 2>/dev/null | tail -1 | jq .
```

### `ask_user` event fires and blocks the run

**Cause:** The objective requires human input in an agent context.

**Fix:** Rewrite the objective to avoid prompts. For example, instead of "navigate through the sign-up flow", be explicit:
```
"click Sign Up, fill email with '{{email}}', fill password with '{{password}}', click Create Account"
```

---

## Installation Issues

### `kane-cli: command not found` after install

**Cause:** npm global bin directory is not in your PATH.

**Fix:**
```bash
npm config get prefix

# Add to PATH (adjust path based on above output)
export PATH="$(npm config get prefix)/bin:$PATH"

# Make permanent: add to ~/.zshrc or ~/.bashrc
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
```

### Installation fails

**Cause:** Node.js version is below 18.

**Fix:** Check your version and upgrade:
```bash
node --version   # Must be 18 or higher
```

---

## "Update available" Notice

Kane CLI checks the public npm registry for a newer release once every 24 hours. The result is cached locally so the check itself is non-blocking and silent on failure. When a newer version exists, Kane CLI surfaces an "update available" notification with the current and latest versions and a severity label (`major`, `minor`, or `patch`).

The notice is informational — your current version still works. To upgrade, follow the steps in [Updates](/support/docs/kane-cli-installation/#update).

---

## Filing a Bug Report

If you encounter behavior that looks like an agent bug (not auth, timeout, or a vague objective), file an issue:

**[github.com/LambdaTest/kane-cli/issues](https://github.com/LambdaTest/kane-cli/issues)**

Include the following:

| Field | How to Get It |
|-------|---------------|
| Kane CLI version | `kane-cli --version` |
| OS | macOS (ARM/Intel), Linux (x64/ARM64), Windows (x64) |
| What happened | Describe the behavior |
| Reproduction steps | The exact `kane-cli run` command and objective |
| Expected behavior | What should have happened |
| Logs | `run_summary.json` and `step_NNN.json` from `run_dir` |
| Screenshot | `screenshots/step_NNN.png` from `run_dir` |

Do NOT file bug reports for: auth issues, low timeouts, vague objectives, or site-side errors (CAPTCHAs, 500 errors).
