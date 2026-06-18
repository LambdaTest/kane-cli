# Network Assertions

Network assertions let you verify HTTP traffic — API responses, status codes, headers, response bodies, and request timing.

> These network assertions also cover API calls **you** make directly in an objective — not just the requests the page makes on its own. The agent records its own calls and you query them with the same fields below. To *make* a call (seed data, hit a backend), see [API Calls](../../api-calls.md).

## How Capture Works

KaneAI captures all HTTP network traffic automatically during each test step:

- **Continuous capture**: Every HTTP request and response is recorded as it happens
- **Per-step scope**: Each test step starts with a fresh capture. Traffic from previous steps is not carried over
- **Limits**: Up to 5,000 requests are stored per step. When the limit is reached, the oldest 10% of entries are dropped to make room. Response bodies are capped at 64KB per entry
- **Text bodies only**: Response bodies are captured for text-based content types (JSON, HTML, XML, CSS, JavaScript). Binary content (images, fonts, videos) is skipped
- **Multi-tab support**: Traffic from new tabs and popups is also captured

### Planning for Multi-Step Tests

Because network data resets each step, plan accordingly:

- If you need to assert on an API response **later**, extract and store it in the same step the request happens
- Navigation and API calls in step 1 won't be visible in step 3's network log
- Use extraction checkpoints to save values across steps

## What You Can Query

| Field | Type | Description |
|-------|------|-------------|
| `method` | string | HTTP method (GET, POST, PUT, DELETE, ...) |
| `url` | string | Full request URL |
| `domain` | string | Domain (e.g., "api.example.com") |
| `path` | string | URL path without query string |
| `query_params` | dict | Query parameters |
| `resource_type` | string | xhr, fetch, document, script, image, ... |
| `request_headers` | dict | Request headers |
| `request_body` | string | Request body (may be truncated) |
| `response_status` | int | HTTP status code (200, 404, 500, ...) |
| `response_headers` | dict | Response headers |
| `response_body` | string | Response body (text types only, may be truncated) |
| `timing.duration_ms` | float | Total request duration in milliseconds |
| `timing.ttfb_ms` | float | Time to first byte in milliseconds |
| `failed` | bool | True if request failed at network level |
| `failure_reason` | string | Error reason (e.g., "net::ERR_CONNECTION_REFUSED") |

## Example Assertions

```
Assert: no API calls returned 5xx status codes
Assert: the POST /api/login returned HTTP status 200
Assert: all API responses completed in under 2 seconds
Assert: no network requests failed with connection errors
Assert: the /posts endpoint returned at least 10 items in the response body
```

## Example Extractions

```
Store the response body of the POST /api/login request
Extract the status code of the last API call to /api/users
Store all API request URLs
```

## Example If/Else

```
If the /api/auth returned 200 then proceed to dashboard, else show error message
```
