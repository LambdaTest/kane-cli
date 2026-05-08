---
id: kane-cli-agent-mode
title: Agent Mode
sidebar_label: Agent Mode
description: "Use the --agent flag to get structured NDJSON output from Kane CLI: designed for AI coding agents like Claude Code, Codex CLI, and Gemini CLI."
keywords:
  - kane cli agent mode
  - ndjson
  - kaneai
  - testmu ai
  - ai agent integration
  - claude code
  - codex cli
url: https://www.testmuai.com/support/docs/kane-cli-agent-mode/
site_name: TestMu AI
slug: kane-cli-agent-mode/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-agent-mode/
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

Agent Mode outputs structured NDJSON instead of the interactive terminal UI. It's how AI coding agents (Claude Code, Codex CLI, Gemini CLI) consume Kane CLI results: parse events programmatically, extract the final result, and present it to the user.

## Enable Agent Mode

Add `--agent` to any run command:

```bash
kane-cli run "Verify the checkout flow completes successfully" \
  --url https://myapp.com \
  --agent \
  --headless
```

When `--agent` is active:
- The interactive TUI is fully suppressed (no boot screen, no menus)
- Stdin is not used (no interactive prompts)

:::tip
Always combine `--agent` with `--headless` in non-interactive environments (CI/CD, agent contexts) to avoid display server errors.
:::

---

## Output Format

Kane CLI outputs one JSON object per line (NDJSON) to stdout:

```
{"type":"run_start","objective":"Verify checkout","timestamp":"2026-04-14T10:30:45Z"}
{"type":"step_start","index":0,"objective":"Navigate to cart page"}
{"type":"step_event","index":0,"event":"action","detail":"Navigated to /cart","success":true}
{"type":"step_event","index":0,"event":"screenshot","detail":"Screenshot captured"}
{"type":"step_end","index":0,"status":"passed","duration":2.3,"summary":"Navigated to cart"}
{"type":"step_start","index":1,"objective":"Click checkout button"}
...
{"type":"run_end","status":"passed","summary":"...","duration":45.2,...}
```

---

## Event Schema

### Step Events

| Type | Key Fields | Description |
|------|-----------|-------------|
| `step_start` | `index`, `objective`, `child_id`* | Step began |
| `step_event` | `index`, `event`**, `detail`, `success`* | Activity within a step |
| `step_end` | `index`, `status` (passed\|failed), `duration`, `summary` | Step completed |

*optional  
**`event` values: `screenshot`, `reasoning`, `action`, `vision`, `assertion`, `evaluation`

### Flow Events

| Type | Key Fields | Description |
|------|-----------|-------------|
| `run_start` | `objective`, `timestamp` | Run started |
| `bifurcation` | `flows[]`, `count` | Agent branched into sub-flows |
| `child_agent_start` | `child_id`, `objective`, `parent_step` | Child agent spawned |
| `child_agent_end` | `child_id`, `success`, `steps_taken`, `summary` | Child agent finished |
| `ask_user` | `question`, `step_index`, `options`* | Agent needs input (auto-disabled when stdin is not TTY) |
| `error` | `message` | Error occurred |
| `run_end` | *(see below)* | Terminal event: always the last line |

---

## The `run_end` Event

`run_end` is always the last line. It contains the complete test result:

```json
{
  "type": "run_end",
  "status": "passed",
  "summary": "Searched for laptop and added first result to cart",
  "one_liner": "Searched for laptop on Amazon and added to cart",
  "reason": "Objective completed",
  "duration": 45.2,
  "final_state": {
    "price": "$29.99",
    "product_name": "Wireless Headphones"
  },
  "context": {
    "memory": {},
    "variables": {},
    "pointer": "(passed) Searched for laptop on Amazon"
  },
  "token_usage": {
    "reasoning_input": 12000,
    "reasoning_output": 800,
    "vision_input": 5000,
    "vision_output": 200
  },
  "session_dir": "~/.testmuai/kaneai/sessions/2026-04-14_10-30-45_a1b2c3",
  "run_dir": "~/.testmuai/kaneai/sessions/2026-04-14_10-30-45_a1b2c3/runs/0",
  "test_url": "https://test-manager.lambdatest.com/projects/123/test-cases/456"
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `status` | `"passed"` or `"failed"` |
| `summary` | Full description of what the agent did |
| `one_liner` | Short single-sentence summary |
| `reason` | Why the run stopped (present on failure) |
| `final_state` | Values extracted via "store as" objectives |
| `test_url` | Link to the <BrandName /> dashboard for this run |
| `session_dir` | Path to session-level logs |
| `run_dir` | Path to run-level logs, step JSON, screenshots |
| `token_usage` | Token consumption breakdown |

---

## Parsing Output

Get the `run_end` event:

```bash
# Get just the final result
kane-cli run "..." --agent 2>/dev/null | tail -1 | jq .

# Extract status
kane-cli run "..." --agent 2>/dev/null | tail -1 | jq -r '.status'

# Extract a stored value
kane-cli run "go to example.com, store the price as 'price'" --agent 2>/dev/null \
  | tail -1 | jq -r '.final_state.price'
```

---

## Handling `ask_user` Events

If an objective requires user input mid-run, Kane CLI fires `ask_user`:

```json
{"type": "ask_user", "question": "Which item should I select?", "options": ["Small", "Medium", "Large"]}
```

:::note
`ask_user` is **auto-disabled when stdin is not a TTY**. In CI/CD and AI agent contexts, stdin is never a TTY, so `ask_user` never fires. Write objectives that don't require interactive prompts.
:::

If stdin IS a TTY, respond by writing JSON to stdin:

```json
{"type": "user_response", "answer": "Medium"}
```

To cancel:

```json
{"type": "cancel"}
```

---

## Agent Mode vs Interactive Mode

| | Agent Mode (`--agent`) | Interactive Mode |
|--|----------------------|------------------|
| TUI | Suppressed | Full terminal UI |
| Output | NDJSON to stdout | Formatted text |
| Stderr | Logs only | Logs + progress UI |
| Use case | AI agents, programmatic tools | Human development |

---

## Next Steps

- [Error Codes](/support/docs/kane-cli-error-codes/): Complete reference of `result_code` values and recommended actions
- [Parallel Execution](/support/docs/kane-cli-parallel-execution/): Run multiple tests concurrently
- [Skills](/support/docs/kane-cli-skills/): Install the Kane CLI skill for Claude, Codex, or Gemini
- [CLI Reference](/support/docs/kane-cli-cli-reference/): Full flag and command reference
