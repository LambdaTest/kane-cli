# Cookie Assertions

Cookie assertions let you verify browser cookies — check existence, values, and security attributes like httpOnly, secure, and sameSite.

## How Capture Works

Cookies are captured as a **point-in-time snapshot** when the checkpoint triggers:

- **On-demand capture**: Cookies are read from the browser context at the moment the assertion runs — not accumulated over time
- **Current state only**: You see exactly what cookies exist right now, including any set by the page's JavaScript or server responses
- **All cookies visible**: Unlike `document.cookie` in JavaScript, KaneAI can see httpOnly cookies too
- **Domain-scoped**: Cookies are captured for all domains the browser has visited in this session

### Planning for Multi-Step Tests

Because cookies are captured at assertion time:

- If you need to check cookies set by a specific page, assert on the **same page** or **after** you've visited it
- If cookies are needed in a later step (e.g., after navigating away), extract and store them first
- Cookies persist in the browser across steps (unlike network/console which reset) — but asserting on a different domain may show different cookies

## What You Can Query

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Cookie name (e.g., "session_id") |
| `value` | string | Cookie value |
| `domain` | string | Domain (e.g., ".example.com") |
| `path` | string | Cookie path (e.g., "/") |
| `expires` | float | Expiry as epoch seconds (-1 for session cookies) |
| `http_only` | bool | True if HttpOnly flag is set |
| `secure` | bool | True if Secure flag is set |
| `same_site` | string | "Strict", "Lax", or "None" |

## Example Assertions

```
Assert: a cookie named "session_id" exists
Assert: the session cookie is httpOnly
Assert: no cookies are set without the Secure flag
Assert: at least 3 cookies are set on the page
Assert: the auth cookie has sameSite set to "Strict"
```

## Example Extractions

```
Store all cookies
Extract the value of the "session_id" cookie
Store all cookie names
Get all cookies for the example.com domain
```

## Example If/Else

```
If a cookie named "auth_token" exists then go to dashboard, else go to login
```
