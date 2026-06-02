# Title Assertions

Title assertions check the browser tab's document title (`document.title`).

## When It's Used

- Page title verification: "title contains Dashboard"
- Navigation confirmation: "title is Home Page"

## Examples

### Assertions

```
Assert: page title contains "Dashboard"
Assert: title is "My Account - Settings"
```

### Extractions

```
Store the page title
```

## How It Works

1. KaneAI reads `page.title()` directly
2. The title string is compared against the expected value
3. No screenshot or DOM analysis needed — this is a direct read
