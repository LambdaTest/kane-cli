---
id: kane-cli-error-codes
title: Error Codes Reference
sidebar_label: Error Codes
description: "Complete reference of Kane CLI result codes: what each code means, why it occurred, and what action to take. Designed for both human and AI agent consumption."
keywords:
  - kane cli error codes
  - kane cli result codes
  - kaneai errors
  - testmu ai
  - agent error handling
  - kane cli troubleshooting
url: https://www.testmuai.com/support/docs/kane-cli-error-codes/
site_name: TestMu AI
slug: kane-cli-error-codes/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-error-codes/
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

Every Kane CLI run ends with a `result_code` in the `run_end` event. This page lists every code, explains what triggered it, and tells you what to do next.

## How to Read Result Codes

Result codes follow HTTP-style groupings:

| Range | Category | Meaning |
|-------|----------|---------|
| **1xx** | Success | The objective completed successfully. |
| **2xx** | Cancelled | The run was cancelled before completion. |
| **3xx** | Stuck | The agent could not make further progress. |
| **4xx** | Agent Error | An internal agent failure prevented completion. |
| **5xx** | Infra Error | A platform or infrastructure issue stopped the run. |
| **6xx** | Blocker | An external obstacle (CAPTCHA, paywall, etc.) blocked the agent. |
| **7xx** | Assertion Error | The objective's assertions or checkpoints failed. |

The `run_end` event includes both `result_code` (numeric) and `reason_code` (descriptive string):

```json
{
  "type": "run_end",
  "status": "failed",
  "result_code": 310,
  "reason_code": "stuck.max_steps",
  "summary": "Agent reached maximum step limit..."
}
```

---

## 1xx -- Success

### 100 COMPLETE

| Field | Value |
|-------|-------|
| **Reason code** | `success.complete` |
| **Status** | `COMPLETE` |
| **What happened** | All checkpoints passed and the agent confirmed the objective is achieved. |
| **Action** | None required. |

---

## 2xx -- Cancelled

### 200 USER_CANCELLED

| Field | Value |
|-------|-------|
| **Reason code** | `cancelled.user` |
| **Status** | `CANCELLED` |
| **What happened** | The run was cancelled by the caller (e.g., Ctrl+C, `cancel` event, or API cancellation). |
| **Action** | No action required. Re-run the objective if needed. |

---

## 3xx -- Stuck

The agent ran into a dead end. These are not crashes - the agent recognized it could not make further progress.

### 310 MAX_STEPS

| Field | Value |
|-------|-------|
| **Reason code** | `stuck.max_steps` |
| **Status** | `STUCK` |
| **What happened** | The agent exceeded the configured `--max-steps` limit before completing the objective. |
| **Action** | Increase `--max-steps` (e.g., `--max-steps 60`), or break the objective into smaller, sequential runs. |

### 320 DAG_CYCLE

| Field | Value |
|-------|-------|
| **Reason code** | `stuck.dag_cycle` |
| **Status** | `STUCK` |
| **What happened** | The agent detected 3 repeated page-state cycles (it keeps returning to the same state after each action). |
| **Action** | Rephrase the objective with a different approach. The current path leads to a loop - try an alternative navigation route or add explicit intermediate steps. |

### 330 AP_STUCK

| Field | Value |
|-------|-------|
| **Reason code** | `stuck.ap_stuck` |
| **Status** | `STUCK` |
| **What happened** | The action planner determined there are no viable actions available on the current page to progress toward the objective. |
| **Action** | Manual intervention is needed. Check the screenshot at `{session_id}/runs/{run_dir}/run-test/screenshots/` to understand what page state the agent ended on. You may need to adjust the objective, provide credentials, or navigate to a different starting URL. |

---

## 4xx -- Agent Error

An internal agent component failed. These typically indicate a transient issue or a problem with the session state.

### 410 AP_NO_ACTION

| Field | Value |
|-------|-------|
| **Reason code** | `agent_error.ap_no_action` |
| **Status** | `ERROR` |
| **What happened** | The action planner returned 3 consecutive empty decisions (no action selected). |
| **Action** | Retry the run. If the error persists, simplify the objective or file a [bug report](https://github.com/LambdaTest/kane-cli/issues). |

### 420 REASONING_FAILURE

| Field | Value |
|-------|-------|
| **Reason code** | `agent_error.reasoning_failure` |
| **Status** | `ERROR` |
| **What happened** | An unhandled exception occurred in the reasoning engine. |
| **Action** | Check `{session_id}/runs/{run_dir}/run.log` for the full stack trace. Retry the run - this is usually transient. If it persists, file a [bug report](https://github.com/LambdaTest/kane-cli/issues) with the log file. |

### 430 CLEAN_START_INVALID

| Field | Value |
|-------|-------|
| **Reason code** | `agent_error.clean_start_invalid` |
| **Status** | `ERROR` |
| **What happened** | The `clean_start` validation failed - the agent could not establish a valid initial session state (e.g., the starting URL did not load, or the browser context is corrupted). |
| **Action** | Verify the `--url` is accessible and loads correctly. If using `--cdp-endpoint`, ensure the browser is in a clean state. |

### 440 CHILD_FAILED

| Field | Value |
|-------|-------|
| **Reason code** | `agent_error.child_failed` |
| **Status** | `ERROR` |
| **What happened** | A child agent (spawned for a sub-objective during analysis) failed. The parent run cannot continue. |
| **Action** | Check the `child_agent_end` event in the NDJSON output for the child's failure details. Fix the child objective, then re-run the parent. |

---

## 5xx -- Infra Error

Platform or infrastructure failures. These are independent of the objective itself.

### 510 SCREENSHOT_FAILED

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.screenshot_failed` |
| **Status** | `ERROR` |
| **What happened** | The browser failed to capture a screenshot (Playwright exception). The agent cannot proceed without visual input. |
| **Action** | Check that the browser is still running. If using `--cdp-endpoint`, verify the connection is alive. Restart the browser and retry. |

### 520 BROWSER_CRASHED

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.browser_crashed` |
| **Status** | `ERROR` |
| **What happened** | The browser process crashed or became unresponsive. |
| **Action** | Restart the browser and retry the run. If this happens repeatedly, check available system memory and ensure no other processes are competing for resources. |

### 530 TIMEOUT

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.timeout` |
| **Status** | `ERROR` |
| **What happened** | The run exceeded its configured timeout. |
| **Action** | Increase `--timeout` (in seconds): `--timeout 300`. If the objective is complex, break it into smaller runs. |

### 540 EVENT_DISPATCH

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.event_dispatch` |
| **Status** | `ERROR` |
| **What happened** | A custom event dispatch (e.g., browser event injection) failed. |
| **Action** | Check `{session_id}/runs/{run_dir}/run.log` for the failing event handler. This usually indicates a page script error or an incompatible browser state. Retry the run, and if it persists, file a [bug report](https://github.com/LambdaTest/kane-cli/issues). |

### 550 CONTROLLER_AUTH

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.controller_auth` |
| **Status** | `ERROR` |
| **What happened** | The <BrandName /> controller returned a `401 Unauthorized` response. Your authentication token has expired or is invalid. |
| **Action** | Refresh your authentication token: |

<div className="lambdatest__codeblock">
<CodeBlock className="language-bash">
{`kane-cli login
# or re-run login with basic auth
kane-cli login --username "${ YOUR_LAMBDATEST_USERNAME()}" --access-key "${ YOUR_LAMBDATEST_ACCESS_KEY()}"`}
</CodeBlock>
</div>

Verify with `kane-cli whoami`, then retry the run.

### 560 CREDITS_EXHAUSTED

| Field | Value |
|-------|-------|
| **Reason code** | `infra_error.credits_exhausted` |
| **Status** | `ERROR` |
| **What happened** | The <BrandName /> controller returned a `402 Payment Required` response. Your account has no remaining credits for AI agent runs. |
| **Action** | Purchase additional credits or upgrade your plan on the [<BrandName /> billing page](https://billing.lambdatest.com/billing/plans/). Contact your account administrator if you are on a team plan. |

---

## 6xx -- Blocker

An external obstacle on the target website prevented the agent from completing the objective. These are not agent bugs - they require changes to the environment or objective.

### 610 CAPTCHA

| Field | Value |
|-------|-------|
| **Reason code** | `blocker.captcha` |
| **Status** | `ERROR` |
| **What happened** | The page presented a CAPTCHA challenge that the agent cannot solve. |
| **Action** | Solve the CAPTCHA manually in an interactive session first, then re-run. Alternatively, use a test environment that has CAPTCHAs disabled, or allowlist the test IP. |

### 620 PAYWALL

| Field | Value |
|-------|-------|
| **Reason code** | `blocker.paywall` |
| **Status** | `ERROR` |
| **What happened** | The page requires a paid subscription to access the content the objective needs. |
| **Action** | Provide credentials for a subscribed account via [variables](/support/docs/kane-cli-variables-and-context/), or test against a non-paywalled environment. |

### 640 BLOCKED

| Field | Value |
|-------|-------|
| **Reason code** | `blocker.blocked` |
| **Status** | `ERROR` |
| **What happened** | The target site blocked access (IP ban, WAF rule, geo-restriction, or bot detection). |
| **Action** | Use a different IP address, allowlist the test IP on the target site, or use a different test account. Check whether the site has bot-detection that needs to be configured for testing. |

### 650 ERROR_PAGE

| Field | Value |
|-------|-------|
| **Reason code** | `blocker.error_page` |
| **Status** | `ERROR` |
| **What happened** | The page returned an HTTP error (404 Not Found, 500 Internal Server Error, etc.) instead of the expected content. |
| **Action** | Verify the `--url` is correct and the target site is operational. Check `{session_id}/runs/{run_dir}/run-test/screenshots/` to see the error page. |

### 660 AUTH_NO_CREDENTIALS

| Field | Value |
|-------|-------|
| **Reason code** | `blocker.auth_no_credentials` |
| **Status** | `ERROR` |
| **What happened** | The agent encountered a login page but no credentials were provided in the objective or variables. |
| **Action** | Provide login credentials using [variables](/support/docs/kane-cli-variables-and-context/): |

```bash
kane-cli run "Log in and navigate to dashboard" \
  --url https://myapp.com/login \
  --variables '{"username": {"value": "test@example.com"}, "password": {"value": "s3cret", "sensitive": true}}' \
  --agent
```

---

## 7xx -- Assertion Error

The agent completed its actions but one or more assertions or checkpoints did not pass.

### 710 FINAL_VERIFICATION

| Field | Value |
|-------|-------|
| **Reason code** | `assertion_error.final_verification` |
| **Status** | `ASSERTION_ERROR` |
| **What happened** | The final checkpoint failed. The agent performed all actions but the end state did not match the expected outcome. |
| **Action** | This means the objective was **not achieved**. Review the screenshot at `{session_id}/runs/{run_dir}/run-test/screenshots/` to see the final page state. The objective itself may need adjustment, or the application under test may have a bug. |

### 720 CHECKPOINT_FAILED

| Field | Value |
|-------|-------|
| **Reason code** | `assertion_error.checkpoint_failed` |
| **Status** | `ASSERTION_ERROR` |
| **What happened** | An inline checkpoint (mid-run assertion) failed. The agent detected that an intermediate condition was not met. |
| **Action** | Check which checkpoint failed in the step logs at `{session_id}/runs/{run_dir}/run-test/step_N.json`. The assertion condition may be too strict, or the application did not reach the expected state at that point. |

### 730 NO_BRANCH_MATCHED

| Field | Value |
|-------|-------|
| **Reason code** | `assertion_error.no_branch_matched` |
| **Status** | `ASSERTION_ERROR` |
| **What happened** | An if-else objective had multiple branches, but none of the conditions matched the actual page state. |
| **Action** | Review your branching conditions. Add a fallback branch, or check the screenshot to see what state the page was actually in. Adjust conditions to cover the observed state. |

---

## Quick Lookup Table

| Code | Name | Reason Code | Action |
|------|------|-------------|--------|
| 100 | COMPLETE | `success.complete` | Done |
| 200 | USER_CANCELLED | `cancelled.user` | Re-run if needed |
| 310 | MAX_STEPS | `stuck.max_steps` | Increase `--max-steps` or simplify |
| 320 | DAG_CYCLE | `stuck.dag_cycle` | Try a different approach |
| 330 | AP_STUCK | `stuck.ap_stuck` | Manual intervention needed |
| 410 | AP_NO_ACTION | `agent_error.ap_no_action` | Retry the run |
| 420 | REASONING_FAILURE | `agent_error.reasoning_failure` | Check logs, retry |
| 430 | CLEAN_START_INVALID | `agent_error.clean_start_invalid` | Fix session state |
| 440 | CHILD_FAILED | `agent_error.child_failed` | Check child agent details |
| 510 | SCREENSHOT_FAILED | `infra_error.screenshot_failed` | Check browser |
| 520 | BROWSER_CRASHED | `infra_error.browser_crashed` | Restart browser |
| 530 | TIMEOUT | `infra_error.timeout` | Increase `--timeout` |
| 540 | EVENT_DISPATCH | `infra_error.event_dispatch` | Check event handler |
| 550 | CONTROLLER_AUTH | `infra_error.controller_auth` | Run `kane-cli login` |
| 560 | CREDITS_EXHAUSTED | `infra_error.credits_exhausted` | Purchase credits |
| 610 | CAPTCHA | `blocker.captcha` | Solve manually or disable |
| 620 | PAYWALL | `blocker.paywall` | Provide subscription |
| 640 | BLOCKED | `blocker.blocked` | Change IP or account |
| 650 | ERROR_PAGE | `blocker.error_page` | Fix the URL |
| 660 | AUTH_NO_CREDENTIALS | `blocker.auth_no_credentials` | Provide credentials |
| 710 | FINAL_VERIFICATION | `assertion_error.final_verification` | Objective not achieved |
| 720 | CHECKPOINT_FAILED | `assertion_error.checkpoint_failed` | Check assertion condition |
| 730 | NO_BRANCH_MATCHED | `assertion_error.no_branch_matched` | Update branch conditions |

---

## Handling Errors in Agent Mode

When consuming Kane CLI output programmatically, use `result_code` ranges to determine your next action:

```bash
# Run and capture the result
RESULT=$(kane-cli run "..." --agent --headless 2>/dev/null | tail -1)
CODE=$(echo "$RESULT" | jq -r '.result_code')

case $CODE in
  100) echo "Passed" ;;
  2*) echo "Cancelled" ;;
  3*) echo "Stuck: $(echo $RESULT | jq -r '.reason_code')" ;;
  4*) echo "Agent error: retry recommended" ;;
  5*) echo "Infra error: check environment" ;;
  6*) echo "Blocked: manual intervention needed" ;;
  7*) echo "Assertion failed: check test conditions" ;;
esac
```

---

## Related Resources

- [Agent Mode](/support/docs/kane-cli-agent-mode/): NDJSON output format and event schema
- [Troubleshooting](/support/docs/kane-cli-troubleshooting/): Common issues and fixes
- [CLI Reference](/support/docs/kane-cli-cli-reference/): Full flag and command reference
