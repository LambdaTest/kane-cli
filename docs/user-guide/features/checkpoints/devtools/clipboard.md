# Clipboard Assertions

Clipboard assertions let you verify what a "Copy" button actually copied, extract copied values into variables, and confirm clipboard state after your test writes or clears it.

## The Test Clipboard

Every run uses an **isolated test clipboard**:

- **Your real clipboard is safe**: the OS clipboard is never read and never written — tests can't leak your copied data into results, and nothing you copy mid-run interferes with the test
- **Automatic capture**: when the page copies something (a Copy button, Ctrl/Cmd+C on a selection), it lands in the test clipboard
- **One current entry**: like a real clipboard, every copy or clipboard write **replaces** the previous content
- **Multi-format**: a single entry can carry plain text, HTML, and an image together (e.g. a "Copy image" button)
- **Same behavior everywhere**: headless, headed, and CI runs all behave identically

### Planning for Multi-Step Tests

Because the clipboard holds one entry at a time:

- Verify a copied value **immediately after** the copy or write that produced it — a later clipboard write/clear replaces it
- To check several copies, interleave: copy A → verify → copy B → verify

## What You Can Query

| Query | Description |
|-------|-------------|
| text content | The plain-text content of the clipboard ("" when empty) |
| HTML content | The rich-text representation, when present |
| formats present | Which content types the entry carries (text, HTML, image) |
| image presence/size | Whether an image was copied, and its byte size |

## Example Assertions

```
Click the "Copy link" button, then verify the clipboard contains "/invoice/42"
Verify the clipboard text is "INV-2026-042"
Verify an image was copied to the clipboard
Verify the clipboard text is empty
```

## Example Extractions

```
Click the Copy button, store the copied coupon code as 'coupon'
Store the clipboard text as 'copied_link'
```

Stored values work like any other variable — fill `{{coupon}}` into a field later, or assert on it.

## Writing and Pasting (actions)

The clipboard isn't read-only — objectives can also drive it. See [Browser State Actions](../../browser-state.md):

```
Write "John Tester" to the clipboard, click the message field, then paste from the clipboard
```

## Tips

- **Don't paste to verify** — assert on the clipboard directly instead of pasting into a field and reading it back
- **Prefer positive phrasing** for empties: "verify the clipboard text is empty" rather than "verify X is not on the clipboard"
- Clipboard actions need a page loaded first — navigate before writing or pasting
