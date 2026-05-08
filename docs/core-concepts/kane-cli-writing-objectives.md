---
id: kane-cli-writing-objectives
title: Writing Objectives
sidebar_label: Writing Objectives
description: "Learn the three objective patterns: actions, assertions, and extractions: and how to write natural language objectives that produce reliable test results."
keywords:
  - kane cli objectives
  - natural language testing
  - kaneai
  - testmu ai
  - browser automation
  - write test objectives
url: https://www.testmuai.com/support/docs/kane-cli-writing-objectives/
site_name: TestMu AI
slug: kane-cli-writing-objectives/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-writing-objectives/
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

The objective string is the most important input to Kane CLI. How you phrase it determines what the agent does and whether it succeeds. Objectives follow three patterns that you can combine freely.

## Three Patterns

| Pattern | Keywords | Purpose |
|---------|----------|---------|
| 🎯 **Action** | go to, click, type, fill, search, scroll, hover, select, submit | Performs browser actions |
| ✅ **Assertion** | assert, verify, confirm, check that, ensure | Validates a condition: produces pass/fail |
| 📦 **Extraction** | store X as 'name' | Reads a value from the page, persists in output |

### Actions

Use imperative verbs to describe what the agent should do:

```
"go to https://example.com"
"click the 'Add to Cart' button"
"fill the email field with user@example.com"
"scroll down to the pricing section"
"select 'Premium' from the plan dropdown"
```

### Assertions

Assertions validate page state. The test fails if the condition is not met.

```
"assert the page contains 'Order Confirmed'"
"verify the cart total shows '$29.99'"
"confirm no error message is visible"
"check that the Submit button is disabled"
```

### Extractions: The "store as" Pattern

Extractions read a value from the page and store it in the run output's `final_state` field.

**Always use the explicit `store X as 'name'` syntax.** Vague phrasing like "tell me" or "read" does not reliably capture data.

❌ Bad: agent may see it but won't persist it:
```
"go to example.com and tell me the price"
"read the page title"
```

✅ Good: value is captured in `final_state`:
```
"go to example.com, store the price of the first item as 'price'"
"store the page title as 'page_title'"
```

---

## Combining Patterns

Chain all three patterns in one objective:

```
"go to {{app_url}}/dashboard,
 store the welcome message as 'welcome_text',
 store the user role in the sidebar as 'role',
 assert the role is 'Admin',
 click the Settings button,
 assert the page contains 'Account Settings'"
```

This objective: navigates → extracts two values → validates a condition → performs an action → validates the result.

---

## Real Examples

### Login flow

```bash
kane-cli run \
  --url https://app.example.com \
  --variables-file ./creds.json \
  "fill the email field with '{{email}}',
   fill the password field with '{{password}}',
   click the Login button,
   assert the page contains 'Dashboard',
   store the logged-in username as 'username'"
```

### Search with filters

```bash
kane-cli run \
  --url https://shop.example.com/products \
  "click the Category filter,
   select 'Electronics',
   click the Sort dropdown,
   select 'Price: Low to High',
   store the count of products as 'result_count',
   assert the result_count is greater than 0"
```

### Settings change

```bash
kane-cli run \
  --url https://app.example.com/account \
  "click the Settings tab,
   scroll down to the Notification section,
   check the 'Email Notifications' checkbox,
   click Save,
   assert the page shows 'Settings saved successfully'"
```

### Checkout

```bash
kane-cli run \
  --url https://shop.example.com/cart \
  --variables-file ./payment.json \
  "store the cart total as 'total',
   assert the total is greater than 0,
   click Checkout,
   fill the card number field with '{{card_number}}',
   fill the expiry field with '{{card_expiry}}',
   fill the CVC field with '{{card_cvc}}',
   click Place Order,
   assert the page contains 'Order Confirmed',
   store the order number as 'order_id'"
```

---

## Assertion Types

| Type | Example |
|------|---------|
| Exact match | `assert the total shows '$29.99'` |
| Contains | `assert the page contains 'Welcome'` |
| State | `assert the Submit button is disabled` |
| Conditional | `if a cookie banner appears, dismiss it, then assert the homepage loads` |
| Negative | `assert no error message is visible` |
| Positional | `assert 'Settings' appears in the left sidebar` |

---

## Dos and Don'ts

| ✅ Do | ❌ Don't |
|-------|---------|
| Use imperative verbs: "go to", "click", "store as" | Use vague verbs: "check out", "look at", "explore" |
| Be specific: "click the **blue** 'Submit' in the checkout form" | Be ambiguous: "click the button" |
| Name extractions: "store X as 'name'" | Expect implicit capture: "tell me the price" |
| Use `{{variables}}` for credentials and URLs | Hardcode secrets in the objective |
| Always provide `--url` | Assume the agent knows where to start |
| Split objectives with >15 steps | Cram 30 steps into one objective |

---

## Splitting Long Objectives

Objectives with more than 15 steps drift and become unreliable. Split them into multiple runs.

In **Interactive TUI**, the browser stays open between runs: state carries over automatically:

```
> go to https://myapp.com and log in as admin
  ✓ PASSED

> navigate to User Management and create a new user "qa@example.com"
  ✓ PASSED

> verify the new user appears in the users table
  ✓ PASSED
```

In **Headless CLI**, use `--max-steps` to cap each run:

```bash
kane-cli run "login flow" --url https://myapp.com --max-steps 10
kane-cli run "dashboard check" --url https://myapp.com --max-steps 10
```

:::tip
A good rule: if your objective has more than three `assert` statements or more than five distinct actions, consider splitting it.
:::
