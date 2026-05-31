<!-- Read this when authoring objective strings — for either `kane-cli run "..."` or step bodies inside a `_test.md`. Owns the full catalog of action verbs, assertion patterns, checkpoint analyze methods (Visual, Textual/DOM, URL, Title, DevTools→Network/Console/Performance/Cookies/localStorage), operators, extraction patterns, chaining, variables, and common pitfalls. The same objective grammar applies to one-shot runs and testmd steps. -->

# Writing Kane-CLI Objectives — Pattern Cookbook

Read this whenever you're constructing the prose objective for `kane-cli run "<objective>"` or the body of a `## Step` in a `_test.md` file. Both surfaces feed the same agent and accept the same grammar.

---

## 1. Anatomy of a good objective

Three properties make an objective reliable:

- **Specific** — name the site, the action, and the field values where they matter.
- **Action-oriented** — lead with a verb (`go to`, `search`, `open`, `fill`, `click`, `verify`).
- **Has a success criterion** — state what "done" looks like so the agent knows when to stop.

Bad → better:

| | Objective |
|---|---|
| ❌ | Test the login page. |
| ✅ | Open `https://app.example.com/login`, log in as `{{tester}}`, and verify the dashboard URL contains `/home`. |

The bad version leaves "test" undefined and gives the agent no end state. The better version names the URL, the credentials, and the assertion that closes the loop.

---

## 2. Action verbs — quick catalog

Reference list. Use these in your prose; the agent recognizes them all.

| Category | Verbs |
|---|---|
| **Navigation** | go to, open, navigate to, visit, reload, go back, switch to tab/window |
| **Input** | type, fill, enter, paste, clear, select (dropdown), check (checkbox), uncheck, toggle |
| **Click/hover** | click, double-click, right-click, hover, long-press |
| **Scroll/drag** | scroll to, scroll down/up, drag to, drop on |
| **Wait** | wait for, wait until, pause for |
| **File** | upload, attach, download |
| **Misc** | dismiss, accept dialog, switch frame, take screenshot |

Always include a **starting URL** somewhere in the first action verb if the agent needs to navigate. Never assume the agent knows where to start.

---

## 3. Assertions, extractions, and if/else — using checkpoints

Checkpoints are the agent's verification primitives. There are three kinds, and each one works with every analyze method below:

| Kind | Phrasing | What happens |
|---|---|---|
| **Assertion** | "Assert: …", "Verify …", "Confirm …" | Fails the run if the condition is false. |
| **Extraction** | "Store …", "Extract …", "Get …" | Saves a value into `run_end.final_state` for later use. |
| **If/Else** | "If … then … else …" | Branches the run based on a condition. |

### 3.1 Analyze methods — where the agent looks

The agent automatically picks the right method based on phrasing. To get the method you want, use the language column.

| Method | Use it for | Phrasing the agent recognizes |
|---|---|---|
| **Visual** (default) | Visible text, prices, labels, counts, color names, visibility | "the price …", "the heading …", "is visible", "displays", "is shown" |
| **Textual (DOM)** | Element states, CSS properties, HTML attributes, exact CSS color values | "is disabled / enabled / checked / readonly", "the placeholder of …", "the aria-label of …", "the font-size of …", "rgb(…)" / "#hex" |
| **URL** | Address bar — path, query, fragment, redirects | "URL contains …", "URL path is …", "URL has param …", "redirected to …" |
| **Title** | Browser tab `document.title` | "page title contains …", "title is …" |
| **DevTools** | Things not visible on screen — network, console, performance, cookies, localStorage | see §3.2 below |

### 3.2 DevTools analyze methods

Five subdomains. Each one is the right choice when the data you care about lives in the browser's internals rather than on the page.

#### Network (HTTP traffic)

The agent captures every HTTP request/response per step. **Resets each step** — assert on traffic in the same step it happens (or extract and carry forward).

Queryable fields: `method`, `url`, `domain`, `path`, `query_params`, `resource_type`, `request_headers`, `request_body`, `response_status`, `response_headers`, `response_body`, `timing.duration_ms`, `timing.ttfb_ms`, `failed`, `failure_reason`.

```text
Assert: no API calls returned 5xx status codes
Assert: the POST /api/login returned HTTP status 200
Assert: all API responses completed in under 2 seconds
Assert: no network requests failed with connection errors
Assert: the /posts endpoint returned at least 10 items in the response body

Store the response body of the POST /api/login request
Extract the status code of the last API call to /api/users
Store all API request URLs

If the /api/auth returned 200 then proceed to dashboard, else show error message
```

Limits: up to 5,000 requests per step, response bodies capped at 64KB, binary content (images/fonts/videos) skipped.

#### Console (browser console output)

Captures every `console.log/warn/error/info/debug` and every uncaught JS exception. **Resets each step**. Top frame only — iframes (payment widgets, third-party embeds) are not captured.

Levels normalize to: `log`, `warning`, `error`, `info`, `debug`. `errors` includes both `console.error()` and uncaught exceptions; `exceptions` is just the uncaught-exception subset (where `is_exception: true`).

```text
Assert: no console errors on the page
Assert: no uncaught JavaScript exceptions
Assert: no JS errors after clicking Submit
Assert: console contains "Amplitude SDK triggered"
Assert: no console warnings

Store all console error messages
Extract the first console error text

If console contains "feature_flag_enabled" then use new flow, else use legacy flow
```

#### Performance (Core Web Vitals)

Point-in-time read of the **last full page navigation's** metrics. Place the assertion after the page has loaded; use a wait step if the page needs time to settle.

Available metrics with good thresholds:

| Metric | Measures | Good |
|---|---|---|
| **LCP** | Largest Contentful Paint | < 2,500ms |
| **CLS** | Cumulative Layout Shift | < 0.1 |
| **INP** | Interaction to Next Paint (requires user interaction) | < 200ms |
| **FCP** | First Contentful Paint | < 1,800ms |
| **TTFB** | Time to First Byte | < 800ms |

```text
Assert: page LCP is under 2500ms
Assert: CLS is below 0.1
Assert: TTFB is under 800ms
Assert: page performance meets Core Web Vitals thresholds

Store the page LCP value
Extract all web vitals metrics
```

#### Cookies

Snapshot at assertion time. Sees `httpOnly` cookies too (unlike `document.cookie`). Cookies persist across steps; asserting on a different domain may show different cookies.

Fields: `name`, `value`, `domain`, `path`, `expires`, `http_only`, `secure`, `same_site` (`Strict`/`Lax`/`None`).

```text
Assert: a cookie named "session_id" exists
Assert: the session cookie is httpOnly
Assert: no cookies are set without the Secure flag
Assert: the auth cookie has sameSite set to "Strict"

Store all cookies
Extract the value of the "session_id" cookie

If a cookie named "auth_token" exists then go to dashboard, else go to login
```

#### localStorage

Snapshot at assertion time. Per-origin (protocol + domain + port). Persists across steps as long as you stay on the same origin. Values are always strings — if the app stores JSON, the value is the raw JSON string but the agent will parse it to drill into fields.

```text
Assert: auth_token exists in localStorage
Assert: the theme preference in localStorage is "dark"
Assert: localStorage has fewer than 10 items
Assert: the "theme" field in the user_prefs localStorage item is "dark"

Store all localStorage items
Extract the auth_token from localStorage
Get all localStorage keys

If localStorage has "onboarding_complete" then show dashboard, else start onboarding
```

### 3.3 Operators

Assertions support these comparisons. Phrase them naturally — the agent maps to the right operator.

| Operator | Meaning | Example |
|---|---|---|
| `equals` | Exact match | "price equals $29.99", "title is 'Home'" |
| `contains` | Substring match | "URL contains /checkout" |
| `not_contains` | Does not contain | "title not contains 'Error'" |
| `gt` / `gte` | Greater than / or equal | "items greater than 5" |
| `lt` / `lte` | Less than / or equal | "LCP less than 2500" |
| `not_equals` | Not equal | "status not equals 'failed'" |

### 3.4 Picking the right method when in doubt

- "Is the price $29.99?" — **Visual** (it's on screen).
- "Is the submit button disabled?" — **Textual/DOM** (state, not visible text).
- "Does this red background match exactly `rgb(220, 38, 38)`?" — **Textual/DOM** (exact CSS).
- "Are we on the checkout page?" — **URL** (address bar).
- "Did the page send any failed API calls?" — **DevTools/Network**.
- "Are there console errors?" — **DevTools/Console**.
- "Is the page fast?" — **DevTools/Performance** (LCP/FCP/TTFB).
- "Did the login set a session cookie?" — **DevTools/Cookies**.
- "Did the app store the auth token?" — **DevTools/localStorage**.

If you're not sure which method, default to **Visual** — that's what the agent does too.

---

## 4. Extraction — the "store as" rule

Vague phrasing like "read", "tell me", "report" does NOT reliably persist data. The agent may *observe* the value but won't *capture* it into `run_end.final_state`.

```text
❌ "go to example.com and read the page title"
❌ "go to example.com and tell me the price"

✅ "go to example.com, store the page title as 'page_title'"
✅ "go to example.com, store the price of the first item as 'price'"
```

For DevTools extractions, the same rule applies — use "store" or "extract":

```text
✅ "store the response body of the POST /api/login as 'login_response'"
✅ "extract the value of the session_id cookie as 'session'"
```

Stored values land in `run_end.final_state` and feed the second results table per `SKILL.md §1.4`.

---

## 5. Chaining — action → extraction → assertion

Multi-clause objectives are fine — and often preferable to splitting into multiple steps when the operations are tightly coupled.

```text
"go to {{app_url}}/dashboard,
 store the welcome message as 'welcome_text',
 store the user role in the sidebar as 'role',
 assert the role is 'Admin'"
```

```text
"open https://shop.example.com,
 add the first 'Wireless Headphones' result to the cart,
 navigate to the cart,
 store the cart total as 'total',
 assert the cart contains exactly one item"
```

```text
"go to {{app_url}}/api-health,
 store the API response body as 'health',
 assert no console errors,
 assert no API calls returned 5xx"
```

When chaining, keep each clause as a complete instruction. The agent processes them in order.

### Splitting vs. chaining — when to break into multiple steps

| Chain in one objective | Split into separate steps |
|---|---|
| ≤ 15 clauses, related state | > 15 reasoning steps expected |
| All happen on one page or flow | Different flows / different user roles |
| Extraction needed for the assertion in the same objective | Each step is independently testable |

For `_test.md` step bodies, each step is its own objective — split aggressively. For one-shot `kane-cli run`, chain when the operations share state.

---

## 6. Variables and context

Use `{{name}}` syntax for values that should be parameterized:

```text
"Log in as {{username}} with password {{password}}, then verify the dashboard loads"
```

**Always parameterize:** credentials, API keys, tokens, environment-specific URLs.
**OK to hardcode:** one-off URLs, static UI text, navigation paths.

Mark credentials with `secret: true` in the variables JSON so they're masked in logs and routed to the secrets store:

```json
{
  "username": { "value": "alice", "secret": false },
  "password": { "value": "s3cret!", "secret": true }
}
```

For the full variables-loading precedence and context-file behavior, Read `references/setup-and-config.md`.

---

## 7. Conditional and negative patterns

Conditional objectives let the agent handle optional UI states without failing:

```text
"go to {{app_url}}, if a cookie banner appears then dismiss it, then assert the homepage loads"

"open the dashboard, if a 'What's new' modal is visible then close it, then click Settings"
```

Negative assertions verify the *absence* of something:

```text
"after submitting, assert no error message or red banner is visible"
"assert no console errors after clicking Save"
"assert no API calls failed during the checkout flow"
```

Positional assertions check where something is on the page:

```text
"assert 'Settings' appears in the left sidebar navigation"
"assert the 'Cancel' button is on the right side of the modal footer"
```

---

## 8. Common pitfalls

| ❌ Don't | ✅ Do | Why |
|---|---|---|
| "Test the checkout flow" | "Go to /cart, click Checkout, fill the address form with {{tester}}, click Pay, assert the order confirmation page loads" | "Test" has no end state — the agent doesn't know when to stop. |
| "Add the item" | "Click the 'Add to Cart' button on the first product card" | Vague target — agent may click the wrong element. |
| "Tell me the price" | "Store the cart total as 'total'" | Vague verbs don't extract — use "store" / "extract" / "get". |
| Hardcode credentials in the objective | Use `{{username}}` / `{{password}}` from `--variables-file` | Credentials in plain text leak into logs and TMS. |
| Omit the URL | "Go to https://example.com/login first, then …" | Agent doesn't know where to start. |
| Cram 25 operations into one objective | Split at logical boundaries (login, navigate, action, verify) | Long runs drift and stall. |
| "Check the page is fast" | "Assert LCP is under 2500ms and CLS is below 0.1" | Use the explicit web-vital metric, not a vague "fast." |
| "Make sure no errors" | "Assert no console errors and no API calls returned 5xx" | Be explicit about which kind of error you're checking. |

---

## 9. Worked end-to-end examples

### Example A — Single-page assertion suite

```text
"go to https://shop.example.com/products/42,
 assert the product title is 'Wireless Headphones',
 assert the price is $129.99,
 store the SKU as 'sku',
 assert URL contains /products/42,
 assert page LCP is under 2500ms,
 assert no console errors"
```

This exercises Visual (title, price), Extraction (SKU), URL, Performance, and Console — all in one objective.

### Example B — Login + dashboard verification

```text
"open https://app.example.com/login,
 log in with email {{tester.email}} and password {{tester.password}},
 assert the URL redirected to /dashboard,
 assert a cookie named 'session_id' exists and is httpOnly,
 assert no API calls returned 5xx during login,
 store the user role from the sidebar as 'role',
 assert the role is 'Admin'"
```

### Example C — testmd step body (same grammar)

In a `_test.md` file:

```markdown
## Verify checkout flow happy path
Open https://shop.example.com, log in as {{tester}}, add the first
'Wireless Headphones' result to the cart, navigate to checkout,
fill the shipping address with {{tester.address}}, click Pay.
Assert the order confirmation page loads.
Assert no console errors and no API calls returned 5xx.
Store the order number as 'order_id'.
```

The step body is exactly the same grammar as `kane-cli run`. Everything in this cookbook applies.
