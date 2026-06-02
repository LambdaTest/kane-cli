# Console Assertions

Console assertions let you verify browser console output — error messages, warnings, log messages, and uncaught JavaScript exceptions.

## How Capture Works

KaneAI captures all browser console output automatically during each test step:

- **Continuous capture**: Every `console.log()`, `console.warn()`, `console.error()`, and uncaught JS exception is recorded
- **Per-step scope**: Each test step starts with a fresh capture. Console messages from previous steps are not carried over
- **Limits**: Up to 50,000 messages are stored per step. When the limit is reached, the oldest 10% are dropped
- **No truncation**: Message text is stored in full — unlike network response bodies, console messages are never truncated
- **Object resolution**: When JavaScript logs an object (`console.log({status: "ok"})`), KaneAI resolves it to the actual value instead of storing "JSHandle@object"
- **Multi-tab support**: Console messages from new tabs and popups are also captured
- **Top-frame only**: Messages from embedded iframes (payment widgets, third-party components) are not captured

### Planning for Multi-Step Tests

Because console data resets each step, plan accordingly:

- If you need to verify a console message **later**, extract and store it in the same step it appears
- Console output from step 1 won't be visible in step 3's console log

### Level Normalization

Console message levels are normalized to 5 values:

| Level | What triggers it |
|-------|-----------------|
| `log` | `console.log()`, `console.dir()`, `console.table()`, and other info-level calls |
| `warning` | `console.warn()` |
| `error` | `console.error()` and uncaught exceptions |
| `info` | `console.info()` |
| `debug` | `console.debug()` |

## What You Can Query

| Field | Type | Description |
|-------|------|-------------|
| `level` | string | Message level: "log", "warning", "error", "info", "debug" |
| `text` | string | Full message text (not truncated) |
| `url` | string | Source file URL |
| `line_number` | int | Source line number |
| `is_exception` | bool | True for uncaught JS exceptions (pageerror events) |
| `stack_trace` | string | Stack trace (exceptions only) |

### Errors vs Exceptions

- **`errors`** includes ALL error-level messages: both `console.error()` calls AND uncaught exceptions
- **`exceptions`** is a subset of errors — only uncaught JavaScript exceptions
- To check for app-level errors without exceptions: query errors where `is_exception` is false

## Example Assertions

```
Assert: no console errors on the page
Assert: no uncaught JavaScript exceptions
Assert: console contains "Amplitude SDK triggered"
Assert: no console warnings
Assert: no JS errors after clicking Submit
```

## Example Extractions

```
Store all console error messages
Extract the first console error text
Store all console log output
```

## Example If/Else

```
If console contains "feature_flag_enabled" then use new flow, else use legacy flow
```
