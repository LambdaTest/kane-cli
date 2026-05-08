---
id: kane-cli-parallel-execution
title: Parallel Test Execution
sidebar_label: Parallel Execution
description: Run multiple independent Kane CLI browser tests in parallel using shell background processes or AI agent sub-tasks.
keywords:
  - kane cli parallel
  - parallel testing
  - kaneai
  - testmu ai
  - batch tests
url: https://www.testmuai.com/support/docs/kane-cli-parallel-execution/
site_name: TestMu AI
slug: kane-cli-parallel-execution/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-parallel-execution/
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

Run multiple independent browser tests concurrently to reduce total execution time. Instead of running tests sequentially (sum of all durations), parallel execution runs them simultaneously: total time equals the longest single test.

## When to Run in Parallel

Split objectives and run in parallel when:

- An objective has **more than 15 steps**: long objectives drift; split them
- Tasks are **independent**: no shared browser state or sequential dependencies
- You're testing **different features**: login vs. checkout vs. settings
- You're testing **different user roles**: admin flow vs. customer flow

Each sub-objective must be **self-contained**: it navigates to its own URL, authenticates independently, and asserts its own outcomes.

---

## Sequential Pattern

Run three tests one after another:

```bash
kane-cli run "Log in and verify dashboard" --url https://myapp.com --headless --timeout 120
kane-cli run "Search for products and verify results" --url https://myapp.com --headless --timeout 120
kane-cli run "Complete checkout and confirm order" --url https://myapp.com --headless --timeout 120
```

**Total time:** sum of all three durations.

---

## Parallel Pattern (Shell Background Processes)

```bash
#!/bin/bash
RESULTS_DIR=$(mktemp -d)

# Start all tests in background
kane-cli run "Log in and verify dashboard" \
  --url https://myapp.com --agent --headless --timeout 120 \
  > "$RESULTS_DIR/test1.ndjson" 2>&1 &

kane-cli run "Search for products and verify results" \
  --url https://myapp.com --agent --headless --timeout 120 \
  > "$RESULTS_DIR/test2.ndjson" 2>&1 &

kane-cli run "Complete checkout and confirm order" \
  --url https://myapp.com --agent --headless --timeout 120 \
  > "$RESULTS_DIR/test3.ndjson" 2>&1 &

kane-cli run "Verify admin user management page" \
  --url https://myapp.com --agent --headless --timeout 120 \
  > "$RESULTS_DIR/test4.ndjson" 2>&1 &

# Wait for all to finish
wait

# Parse and print results
echo ""
echo "| # | Test | Status | Steps | Time | Summary |"
echo "|---|------|--------|-------|------|---------|"

i=1
for f in "$RESULTS_DIR"/test*.ndjson; do
  result=$(tail -1 "$f")
  status=$(echo "$result" | jq -r '.status')
  duration=$(echo "$result" | jq -r '.duration')
  summary=$(echo "$result" | jq -r '.one_liner')
  echo "| $i | $(basename $f .ndjson) | $status | - | ${duration}s | $summary |"
  ((i++))
done

rm -rf "$RESULTS_DIR"
```

**Total time:** duration of the longest test.

---

## Batch Summary Format

After all tests complete, present results like this:

```
🧪 Test Suite: Core Flows
📅 Run at: 2026-04-14 14:30 UTC

| # | Test                   | Status | Steps | Time | Summary                        |
|---|------------------------|--------|-------|------|--------------------------------|
| 1 | Login + dashboard      | ✅     | 5     | 12s  | Welcome banner visible         |
| 2 | Product search         | ✅     | 7     | 18s  | 3 results for 'shoes'          |
| 3 | Checkout flow          | ❌     | 9     | 25s  | Payment form did not load      |
| 4 | Admin user management  | ✅     | 6     | 15s  | Users table loaded (12 rows)   |

📊 Pass rate: 3/4 (75%) · Total steps: 27 · Total time: 25s (longest test)
```

---

## AI Agent Sub-Task Pattern

For AI coding agents (Claude Code, Codex CLI, Gemini CLI), use the agent's parallel task mechanism to spawn multiple sub-agents simultaneously. Each sub-agent runs one Kane CLI command and returns structured results.

**Agent prompt template** (give this to each sub-agent):

```
Run this Kane CLI browser test and report the results:

    kane-cli run "<objective>" --agent --headless --timeout 120

After the command completes:
1. Capture the exit code
2. Parse the run_end event (last line of stdout)
3. If status is "failed", read the failing step's screenshot from run_dir
4. Return: { status, steps, duration, summary, session_dir, failure_step, screenshot_path }
```

---

## Resource Limits

:::warning
Each parallel Kane CLI instance opens its own Chrome browser. Monitor resources when running many parallel tests:

- Each instance uses ~150–300 MB RAM
- 4 concurrent tests = ~800 MB – 1.2 GB RAM
- Each instance uses its own CDP port (9222–9230)

Start with 4 parallel tests and scale up based on your environment.
:::

:::tip
Always use `--headless` for parallel runs: multiple visible browser windows cause confusion and unnecessary resource overhead.
:::
