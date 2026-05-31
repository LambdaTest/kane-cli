# Textual (DOM) Assertions

Textual assertions extract data from the page's DOM — element states, attributes, and computed styles that aren't always visible in a screenshot.

## When It's Used

- Element states: disabled, enabled, checked, readonly, expanded
- CSS properties with exact values: `font-size: 16px`, `opacity: 0.5`, `display: none`
- HTML attributes: `placeholder`, `aria-*`, `data-*`, `class`, `id`, `href`, `src`, `type`, `value`
- Attribute existence: "has placeholder", "has aria-label"
- Exact CSS color values: `rgb(255,0,0)`, `#ff0000`

## Examples

### Assertions

```
Assert: the submit button is disabled
Assert: the checkbox is checked
Assert: the input field has placeholder "Enter email"
Assert: the element has aria-label "Close dialog"
Assert: the font-size of the heading is 24px
```

### Extractions

```
Extract the href of the first link
Store the value attribute of the email input
Get the class of the error message element
```

## When NOT to Use

- For visible text content (prices, labels) → use [Visual](./visual.md)
- For color names like "red background" → use [Visual](./visual.md) (DOM may return `transparent` or inherited values)
- For network/console/cookie data → use [DevTools](./devtools/)

## How It Works

1. KaneAI captures the DOM snapshot of the page
2. The AI model identifies the target element and extracts the requested property
3. The value is compared against the expected value
