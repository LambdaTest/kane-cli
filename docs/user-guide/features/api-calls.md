# API Calls

Objectives can have the agent **make an API call directly** — not just observe the requests a page makes. This is useful for seeding data before a flow, hitting a backend to set up state, or checking a service, then asserting on or reusing the response.

## Making a call

Phrase an explicit HTTP request and name its response with "save the response as …":

```
Call POST https://api.example.com/orders with body {"item": "sku_42", "qty": 1}, save the response as order
Hit GET https://api.example.com/orders/123, save the response as fetched
Call DELETE https://api.example.com/orders/123
```

A pasted `curl` works too and is kept exactly as written — method, headers, body, and auth:

```
curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{"u":"a","p":"b"}', save the response as login
```

## Using the response

Use the response in plain English. The `{{name}}` form is reserved for global variables and secrets (see [Variables and Context](../variables-and-context.md)); a value the run produces is never written that way.

| To use | Say |
|---|---|
| the HTTP status code | `assert the response status is 201` |
| a field from the JSON body | `store the id from the response body as 'order_id'` |
| the whole body | `store the response body as 'order_body'` |
| a value later in the run | `the stored order_id value` |

When one objective makes several calls, name each response (`save the response as order`) and say which one you mean: `assert the order response status is 201`.

Assert on it, or feed it into later actions — API calls and browser actions mix freely in one objective:

```
Call POST https://api.example.com/login with body {"u": "{{user}}", "p": "{{password}}"}, save the response as login,
assert the response status is 200,
then open https://app.example.com and verify the dashboard loads
```

```
Call POST https://api.example.com/orders with body {"item": "sku_42", "qty": 1}, save the response as order,
assert the response status is 201,
then open https://app.example.com/orders and verify an order for "sku_42" is visible
```

## Tokens and secrets

Put any API token or credential in a variable marked `secret: true` (see [Variables and Context](../variables-and-context.md)) so it is masked in logs and never stored in plain text:

```
curl -X DELETE https://api.example.com/records/42 -H "Authorization: Bearer {{api_token}}"
```

## Make a call vs. observe page traffic

These are two different things:

- **Make a call (this page)** — *you* tell the agent to send a request: seed a record, call a backend, set up state.
- **[Network assertions](./checkpoints/devtools/network.md)** — *observe* the requests the page itself makes during a UI flow (status codes, bodies, timing).

They compose: seed state with a direct call, drive the UI, then assert on the page's own network traffic.
