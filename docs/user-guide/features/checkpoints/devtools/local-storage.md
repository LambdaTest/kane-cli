# localStorage Assertions

localStorage assertions let you verify data stored in the browser's `window.localStorage` — check key existence, values, and item counts.

## How Capture Works

localStorage is captured as a **point-in-time snapshot** when the checkpoint triggers:

- **On-demand capture**: localStorage is read from the current page at the moment the assertion runs
- **Current state only**: You see exactly what's in localStorage right now
- **Domain-scoped**: localStorage is per-origin (protocol + domain + port). You only see data for the current page's origin
- **String values**: All localStorage values are strings. If the application stores JSON objects, they're stored as JSON strings

### Planning for Multi-Step Tests

Because localStorage is captured at assertion time:

- Assert on localStorage while you're **on the page** that set the values — navigating to a different domain means a different localStorage
- If values are needed later, extract and store them before navigating away
- localStorage persists across steps (unlike network/console) as long as you stay on the same origin

### JSON Values

Applications often store structured data in localStorage as JSON strings:

```javascript
// Application code
localStorage.setItem("user_prefs", JSON.stringify({theme: "dark", lang: "en"}));
```

In assertions, the value is the raw JSON string. You can parse it to check individual fields:

```
Assert: the "theme" field in the user_prefs localStorage item is "dark"
```

KaneAI will parse the JSON and drill into the value automatically.

## What You Can Query

| Method | Returns | Description |
|--------|---------|-------------|
| `storage.all()` | dict | All key-value pairs |
| `storage.get(key)` | string or None | Value for a specific key |
| `storage.keys()` | list of strings | All key names |
| `storage.has(key)` | bool | Whether a key exists |

## Example Assertions

```
Assert: auth_token exists in localStorage
Assert: the theme preference in localStorage is "dark"
Assert: localStorage has fewer than 10 items
Assert: the user_id value in localStorage is not empty
```

## Example Extractions

```
Store all localStorage items
Extract the auth_token from localStorage
Store the user preferences from localStorage
Get all localStorage keys
```

## Example If/Else

```
If localStorage has "onboarding_complete" then show dashboard, else start onboarding
```
