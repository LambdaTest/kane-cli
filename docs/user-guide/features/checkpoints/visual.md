# Visual Assertions

Visual assertions verify what's visible on screen by analyzing the current screenshot. This is the default method — when in doubt, KaneAI uses visual analysis.

## When It's Used

- Text content: prices, labels, headings, counts, messages
- Visibility: "is the login button visible", "are search results displayed"
- Color checks using color names: "has red background", "blue text"
- Any content that appears visually on the page

## Examples

### Assertions

```
Assert: the product price is $29.99
Assert: the search results show at least 5 items
Assert: the error message is visible
Assert: the hero section displays "Welcome back"
```

### Extractions

```
Store the product price
Extract the heading text
Get the number of items in the cart
```

### If/Else

```
If the login button is visible then click it, else click Sign Up
```

## How It Works

1. KaneAI takes a screenshot of the current page
2. The AI model analyzes the screenshot to find the requested information
3. The extracted value is compared against the expected value using the specified operator

## Best Practices

- Use visual assertions for any text or content you can see on screen
- Be specific about what to look for: "the price in the cart summary" not just "the price"
- For exact CSS values (like `rgb(255,0,0)` or `#ff0000`), use [Textual (DOM)](./textual.md) instead
- For element states (disabled, checked), use [Textual (DOM)](./textual.md) instead
