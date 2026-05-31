# URL Assertions

URL assertions check values in the browser's address bar — the current URL path, query parameters, fragments, and redirect targets.

## When It's Used

- URL path: "URL contains /checkout"
- Query parameters: "URL has param `sort=price`"
- Redirect verification: "redirected to /login"
- Fragment/hash: "URL hash is #section-2"

## Examples

### Assertions

```
Assert: URL contains /checkout
Assert: the page redirected to /dashboard
Assert: URL path is /products/42
```

### Extractions

```
Store the current URL
Extract the URL path
```

### If/Else

```
If URL contains /login then enter credentials, else go to profile
```

## How It Works

1. KaneAI reads the current `page.url` value directly
2. The URL string is compared against the expected value using the specified operator
3. No screenshot or DOM analysis needed — this is a direct read
