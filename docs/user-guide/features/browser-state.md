# Browser State Actions

Objectives can directly manage cookies, localStorage, and the clipboard — useful for seeding state before a flow (skip a login, dismiss a consent banner) and for testing copy/paste behavior.

## Cookies

```
Set a cookie named session with value abc123
Set cookies consent=yes and tracking=off, then reload the page
Delete the consent cookie
Clear all cookies
```

- Values accept `{{variables}}`: `set a cookie named session with value {{auth_token}}`
- A cookie without an explicit domain applies to the **current page's site** — navigate first
- Reload or navigate after setting if the page must pick the cookie up
- Provide `path` together with a domain; a path alone is rejected by the browser

## localStorage

```
Set localStorage keys theme=dark and lang=en
Delete the lang key from localStorage
Clear localStorage
```

- Storage is **per-site** — navigate to the target site before setting
- Reload after setting if the app only reads storage on page load
- Values accept `{{variables}}`

## Clipboard

The run uses an **isolated test clipboard** — your real OS clipboard is never read or written. Site Copy buttons are captured into it automatically.

```
Write "John Tester" to the clipboard
Click the message field, then paste from the clipboard
Clear the clipboard
```

- **Paste targets the focused field** — click or focus the field first, then paste (`Ctrl/Cmd+V` in an objective works the same way)
- Text and images both paste; rich editors receive a real paste event
- Typical flows: *write → click field → paste*, or *click the site's Copy button → click field → paste*

## Verifying state

Each of these has a matching assertion family — see [Cookies](./checkpoints/devtools/cookies.md), [localStorage](./checkpoints/devtools/local-storage.md), and [Clipboard](./checkpoints/devtools/clipboard.md):

```
Set a cookie named session with value abc123, reload, and verify the page shows you as logged in
Set localStorage theme=dark, reload, and verify the dark theme is active
Click the Copy link button, then verify the clipboard contains "/invoice/42"
```
