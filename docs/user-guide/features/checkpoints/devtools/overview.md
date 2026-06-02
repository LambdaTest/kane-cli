# DevTools Assertions

DevTools assertions let you verify data that isn't visible on the page — HTTP network traffic, browser console output, performance metrics, cookies, and localStorage. KaneAI captures this data automatically in the background; you just write what to check.

## Available Domains

| Domain | What It Captures | Documentation |
|--------|-----------------|---------------|
| [Network](./network.md) | HTTP requests and responses | Status codes, headers, response bodies, timing |
| [Console](./console.md) | Browser console messages | Errors, warnings, log messages, JS exceptions |
| [Performance](./performance.md) | Core Web Vitals | LCP, CLS, INP, FCP, TTFB |
| [Cookies](./cookies.md) | Browser cookies | Names, values, flags (httpOnly, secure, sameSite) |
| [localStorage](./local-storage.md) | Browser localStorage | Key-value pairs stored in the browser |

## How It Works

Each DevTools domain follows the same pattern:

1. **Capture** — KaneAI captures the data automatically during your test run
2. **Generate** — When a checkpoint triggers, the AI generates code to query the captured data
3. **Execute** — The code runs in an isolated sandbox and returns a result
4. **Assert** — The result is compared against your expected value

You don't write code — you write natural language objectives, and KaneAI handles the rest.

## Examples

```
Assert: no API calls returned 5xx
Assert: no console errors on the page
Assert: page LCP is under 2500ms
Assert: session cookie exists and is httpOnly
Assert: auth_token is stored in localStorage
```

## All Checkpoint Types Work

DevTools assertions support all three checkpoint types:

- **Assert**: "Assert: no console errors" — fails the test if there are errors
- **Extract**: "Store all cookies" — saves the data for later steps
- **If/Else**: "If the API returned 200 then proceed, else retry" — branch on the result

## Important Notes

- DevTools data is **not visible in a screenshot** — KaneAI will never try to open the browser DevTools panel
- Each domain captures data differently — see individual pages for details on timing and scope
- All assertions run in an isolated sandbox — generated code cannot access the file system or network
