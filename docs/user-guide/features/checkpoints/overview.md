# Checkpoints

Checkpoints are verification points that KaneAI evaluates during test execution. They let you assert conditions, branch on results, or extract values for later use.

## Checkpoint Types

| Type | What it does |
|------|-------------|
| **Assertion** | Verify a condition is true — fails the test if not |
| **If/Else** | Branch execution based on a condition |
| **Extraction** | Store a value for use in later steps |

All three types work with every analyze method below.

## Analyze Methods

Each checkpoint uses an analyze method to determine *where* to look for the data:

| Method | Data Source | When to Use |
|--------|-----------|-------------|
| [Visual](./visual.md) | Screenshot (what you see on screen) | Text, labels, prices, counts, colors, visibility checks |
| [Textual (DOM)](./textual.md) | Page DOM elements | Element states (disabled, checked), CSS properties, HTML attributes |
| [URL](./url.md) | Browser URL bar | URL path, query params, redirects |
| [Title](./title.md) | Page title | Document title verification |
| [DevTools](./devtools/) | Browser internals | Network traffic, console logs, performance, cookies, localStorage, clipboard |

## How to Use

Write your assertions naturally in the objective. KaneAI automatically picks the right analyze method:

```
Assert: the price is $29.99                    → Visual
Assert: the submit button is disabled          → Textual (DOM)
Assert: URL contains /checkout                 → URL
Assert: page title contains "Dashboard"        → Title
Assert: no API calls returned 5xx              → DevTools (Network)
Assert: no console errors                      → DevTools (Console)
Assert: page LCP is under 2500ms               → DevTools (Performance)
Assert: session cookie exists                  → DevTools (Cookies)
Assert: auth_token exists in localStorage      → DevTools (localStorage)
Assert: clipboard contains the copied link     → DevTools (Clipboard)
```

Extractions work the same way:

```
Store the product price                        → Visual
Store the current URL                          → URL
Store all cookies                              → DevTools (Cookies)
Store the API response body                    → DevTools (Network)
```

## Operators

Assertions and if/else conditions support these comparison operators:

| Operator | Meaning | Example |
|----------|---------|---------|
| `equals` | Exact match (numbers: see [Comparing numbers](#comparing-numbers)) | price equals "29.99" |
| `contains` | Substring match | URL contains "/checkout" |
| `not_contains` | Does not contain | title not contains "Error" |
| `gt` / `gte` | Greater than / or equal | items greater than 5 |
| `lt` / `lte` | Less than / or equal | LCP less than 2500 |
| `not_equals` | Not equal | status not equals "failed" |

## Comparing numbers

When a step calculates a number, such as the sum of the prices in a cart, the result can carry a tiny leftover in its last digits. Adding `1.0 + 0.07 + 11.0 + 0.0 + 47.7 + 3.34 + 19.95 + 1.4` gives `84.46000000000001`, not `84.46`.

This is standard computer arithmetic, not an error in your test or your app. Computers store numbers in binary, and most decimals, like 0.1 or 84.46, have no exact binary form, in the same way 1/3 has no exact decimal form (0.3333…). Each value is kept as the closest number the computer can hold, so small differences can show up after a calculation. The best-known example is `0.1 + 0.2`, which browsers and most programming languages calculate as `0.30000000000000004`.

**How KaneAI handles it:**

- **Logs and results show the value exactly as calculated.** You see `84.46000000000001` in the step output, the stored variable, and the exported code's logs. Your data is never rounded or changed.
- **Comparisons allow for the leftover.** When both sides of a check are numbers, they count as equal if they differ by less than one billionth of their size (for values near zero, by less than 0.000000001). So `84.46000000000001` equals `84.46`, and the check passes.

All the numeric operators use the same rule, so they always agree with each other:

| Check | `84.46000000000001` vs `84.46` |
|-------|-------------------------------|
| `equals` | true |
| `not_equals` | false |
| `gt` (greater than) | false: they are the same amount |
| `gte` (greater than or equal) | true |
| `lt` (less than) | false |
| `lte` (less than or equal) | true |

Real differences still fail:

| Actual | Expected | `equals` | Why |
|--------|----------|----------|-----|
| `84.46000000000001` | `84.46` | passes | calculation leftover only |
| `0.30000000000000004` | `0.3` | passes | calculation leftover only |
| `84.45` | `84.46` | fails | a real one-cent difference |
| `0.001` | `0` | fails | a real difference |

Notes:

- The values are not rounded to a fixed number of decimals, because not every number has two. Rounding would make `0.125` equal `0.13` and hide real differences in rates, weights or percentages.
- Text values, such as names, messages and labels, are always compared exactly. The rule applies only when both sides are numbers.
- Because the margin scales with the size of the number, very large values (ten million and above) can't be told apart by a one-cent difference. To check a large amount to the cent, calculate the difference between the two values and check that it is greater than 0.
- The same rule applies when you run a test with kane-cli and when you run its exported Python or JavaScript code, so a check gives the same answer in both.

## Learn More

- [Visual Assertions](./visual.md) — screenshot-based text and visibility checks
- [Textual (DOM) Assertions](./textual.md) — element states and attributes
- [URL Assertions](./url.md) — URL-based checks
- [Title Assertions](./title.md) — page title checks
- [DevTools Assertions](./devtools/) — network, console, performance, cookies, localStorage, clipboard
