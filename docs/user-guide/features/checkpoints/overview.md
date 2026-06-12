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

Assertions support these comparison operators:

| Operator | Meaning | Example |
|----------|---------|---------|
| `equals` | Exact match | price equals "29.99" |
| `contains` | Substring match | URL contains "/checkout" |
| `not_contains` | Does not contain | title not contains "Error" |
| `gt` / `gte` | Greater than / or equal | items greater than 5 |
| `lt` / `lte` | Less than / or equal | LCP less than 2500 |
| `not_equals` | Not equal | status not equals "failed" |

## Learn More

- [Visual Assertions](./visual.md) — screenshot-based text and visibility checks
- [Textual (DOM) Assertions](./textual.md) — element states and attributes
- [URL Assertions](./url.md) — URL-based checks
- [Title Assertions](./title.md) — page title checks
- [DevTools Assertions](./devtools/) — network, console, performance, cookies, localStorage, clipboard
