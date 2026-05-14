# Composing tests with @import

Real test suites repeat themselves. Many tests start with the same login flow. Many regression tests visit the same setup pages before doing anything interesting. Copy-pasting those steps into every test makes them brittle and tedious to update.

`@import` lets you extract a repeating flow into a helper file and reuse it from many tests. Helpers are first-class `_test.md`-style files that live alongside your tests. Editing one helper updates every test that imports it.

This page covers helper files, the `@import` syntax, the rules the resolver enforces, and how recordings work across imports. To learn the file format, see [overview.md](./overview.md). To learn how runs and replays work, see [running.md](./running.md).

## Why split a test

A few common cases where splitting pays off:

- **Login.** Almost every test starts logged in. Put the login flow in `helpers/login.md` and `@import` it from every test.
- **Setup.** Visiting a dashboard, switching tenants, accepting a cookie banner — pull these out so a single update fixes every test that relies on them.
- **Long regression flows.** A 30-step checkout test is hard to read and harder to debug. Split it into 4–5 helpers describing each phase (browse, add-to-cart, checkout, payment, confirmation).
- **Negative test cases.** Share a setup helper between the happy-path test and the negative-path test, so the only thing each test owns is the assertion that distinguishes them.

## Helper files

A helper file is any `.md` file whose name does **not** end in `_test.md`. There is no `kane-cli new-helper` command — just write the file:

```markdown
---
mode: testing
---

# Login helper

## Open the login page
Open https://app.example.com/login.

## Sign in
Type {{tester_email}} in the email field and {{tester_password}} in the password field, then submit. Verify the URL contains /home.
```

Save this as `helpers/login.md`. It can be referenced from any test:

```markdown
## Sign in
@import ./helpers/login.md
```

Helpers cannot be run directly — `kane-cli testmd run ./helpers/login.md` is rejected because the filename does not end in `_test.md`. Helpers are only reachable through `@import` from a test.

## `@import` syntax

`@import` is a step body. It replaces a prose objective in a step.

```markdown
## Step heading
@import <path>
```

Rules:

- The step body must contain `@import` and nothing else. Mixing prose and `@import` in the same body is a parse error.
- `<path>` may be relative or absolute. Relative paths resolve against the directory of the **importing file**, not against your shell's working directory.
- The imported file must exist; missing paths are a parse error.
- The `yaml` block of an `@import` step may only contain `optional`. Any other key is rejected.

```markdown
## OK
@import ./helpers/login.md

## OK with optional
```yaml
optional: true
```
@import ./helpers/skip-tour.md

## NOT OK — extra config
```yaml
timeout: 60
```
@import ./helpers/login.md

## NOT OK — body mixes prose and import
Click somewhere first.
@import ./helpers/login.md
```

## How paths resolve

Path resolution is relative to the file that contains the `@import`, never to your shell:

```
tests/
  e2e/
    checkout_test.md       # contains: @import ../../helpers/login.md
  helpers/
    login.md               # contains: @import ./submit-button.md
    submit-button.md
```

When `checkout_test.md` imports `../../helpers/login.md`, the path is relative to `tests/e2e/`, so it resolves to `helpers/login.md`. When `login.md` imports `./submit-button.md`, the path is relative to `helpers/`, so it resolves to `helpers/submit-button.md`.

You can also use absolute paths:

```markdown
@import /Users/me/project/helpers/login.md
```

…but absolute paths break as soon as a teammate clones the repo on a different machine. Prefer relative paths.

## What `@import` does at run time

When the resolver hits an `@import` step, it inlines every step from the imported file into the run, in order, at that position. The imported file's frontmatter — except for variables and context — is **not** merged into the run. The result is a flat list of steps from the root file's perspective.

A test like this:

```markdown
## Sign in
@import ./helpers/login.md

## Open settings
Click the user menu and choose Settings.
```

…with a `login.md` containing two steps, runs as four steps in total: two from the helper, then "Open settings". `Result.md` reports the import as one entry that summarises the helper's outcome.

## Rules the resolver enforces

The resolver catches structural problems at parse time, before any browser launches. The full list:

| Rule | What happens if you break it |
|---|---|
| Tests cannot be imported. Only files **not** ending in `_test.md` may appear after `@import`. | `cannot @import a test file: only helpers may be imported (got <path>)` |
| No cycles. A helper cannot import a chain that eventually comes back to it. | `cyclic reference: a.md → b.md → a.md` |
| Imports must resolve. The target file must exist. | `@import path not found: <path>` |
| `optional` is allowed on `@import` only at the root file. | `intermediate-ref 'optional' is not supported in v1: <file>:<line>` |
| `@import` steps may not carry config other than `optional`. | `step config on @import may only contain 'optional': got <key>` |

There is no built-in depth limit — helpers can import helpers can import helpers. In practice keep nesting shallow; deeply chained helpers are hard to read and hard to debug.

## Optional imports

A root-level `@import` step can be marked optional in the same way a prose step can:

```markdown
## Skip the tour if it shows up
```yaml
optional: true
```
@import ./helpers/dismiss-product-tour.md
```

If the helper fails, the run continues to the next step. The `Result.md` entry is suffixed with `(optional)`.

Optional is intentionally **not** allowed on nested `@import` steps — only the root test decides which imports may fail. Helpers cannot decide on their own that they may be skipped.

## What propagates through `@import`

Some settings travel with the import; others are run-wide and apply only at the root.

**Propagate to imported steps:**

- `variables` — the root file's variables (and any added by `--variables-file` / `--variables`) are visible inside helpers. A helper can reference `{{tester_email}}` if the root test defines it.
- `global_context` and `local_context` — context is shared across the whole run.
- Per-step settings on an objective inside a helper apply to that step.

**Do not propagate (root-only):**

- Chrome settings: `target`, `chrome_profile`, `cdp_endpoint`, `ws_endpoint`, `headless`.
- `mode` (`action` vs `testing`).
- `on_lock_conflict`.
- Authentication.

These are decided once for the whole run from the root file (or its CLI flags). Setting them in a helper's frontmatter has no effect — the helper's chrome / mode / auth keys are silently ignored.

A practical consequence: there is only **one** browser per run, with **one** auth context. A helper cannot, for example, open a fresh Chrome with a different profile.

## Variables across imports

Variables are namespaced flat across the whole run — a single map merged at the root. A helper sees whatever variables the root configuration produces.

```markdown
---
# checkout_test.md
variables:
  tester_email: "alice@example.com"
  tester_password:
    value: "s3cret"
    secret: true
---

## Sign in
@import ./helpers/login.md

## Add a product
Open https://app.example.com/products and add the first item to cart.
```

```markdown
---
# helpers/login.md (variables block here is optional)
---

## Open the login page
Open https://app.example.com/login.

## Submit credentials
Type {{tester_email}} and {{tester_password}}, then submit.
```

The helper uses `{{tester_email}}` and `{{tester_password}}` directly because the root test defined them. You can also define defaults in the helper's frontmatter; the root test's values override them.

Variables set on an individual **step** in the root test are visible **only on that step** — they do not bleed into the helper that follows. If you need a value visible inside a helper, put it in the root frontmatter, not in a per-step `yaml` block.

## Helper outputs

A helper imported at multiple call sites in the same root test records each call site independently. The same helper imported by step 2 and step 4 produces two separate recordings — one per call site — because the browser state on entry is different.

The recording for each call site lives next to the helper file:

```
checkout_test.md
helpers/
  login.md
  helper-output-login-checkout-2/   # for the @import at root step 2
    Result.md
    .internal/...                   # cached recordings for this call site
  helper-output-login-checkout-4/   # for the @import at root step 4
    Result.md
    .internal/...
```

The directory name encodes:

- The helper file's stem (`login`)
- The root test's stem (`checkout`)
- The index of the importing step in the root file (`2`, `4`).

When you import the same helper from two **different** root tests, the directory name's middle segment changes. `login.md` imported by `checkout_test.md` and `dashboard_test.md` produces `helper-output-login-checkout-2/` and `helper-output-login-dashboard-1/`. They are independent recordings on disk and replay independently.

`Result.md` inside a `helper-output-...` directory has the same shape as a top-level `Result.md`. Open it in an editor or Markdown viewer to inspect what the helper did at that call site.

Like the test's own `output-<stem>/`, `helper-output-...` directories are safe — and recommended — to commit to git.

## Editing a helper

When you edit a step in a helper:

- The cache for **that step inside every call site** invalidates.
- Subsequent steps in the same helper invocation also re-author (the same "rest of the file" rule from [running.md](./running.md#edits-cascade-to-the-rest-of-the-file) applies inside helpers).
- The root tests' steps that come **after** the `@import` also re-author, because the helper changed what the browser looks like when control returns to the root test.

In practice: a one-line edit to a heavily-imported helper triggers a lot of re-authoring on the next run. That is by design — the alternative is to replay against state the helper no longer produces.

## Sharing helpers across projects

There is no built-in command to share a helper across two checkouts. Sharing is a filesystem operation:

```bash
cp /projA/common/login.md /projB/common/login.md
# Optional — copy the cached recordings too, so projB doesn't have to re-author:
cp -r /projA/common/helper-output-login-*  /projB/common/
```

Because `@import` paths resolve relative to the importing file, the same helper layout works in both projects without rewriting the imports. As long as `common/login.md` exists next to each project's tests, `@import ../common/login.md` works.

## Worked example

A small suite with a shared login helper and two tests that use it:

```
tests/
  checkout_test.md
  dashboard_test.md
helpers/
  login.md
```

### `helpers/login.md`

```markdown
---
mode: testing
---

# Login helper

## Open the login page
Open https://app.example.com/login.

## Submit credentials
Type "{{tester_email}}" in the email field and "{{tester_password}}" in the password field. Submit the form. Verify the URL contains /home.
```

### `tests/checkout_test.md`

```markdown
---
mode: testing
variables:
  tester_email: "alice@example.com"
  tester_password:
    value: "s3cret-pa55"
    secret: true
---

# Checkout

## Sign in
@import ../helpers/login.md

## Add product to cart
Click the search box, type "wireless headphones", press Enter, click the first product, then click Add to Cart.

## Verify cart badge
Verify the cart icon in the header shows a count of 1 or higher.
```

### `tests/dashboard_test.md`

```markdown
---
mode: testing
variables:
  tester_email: "alice@example.com"
  tester_password:
    value: "s3cret-pa55"
    secret: true
---

# Dashboard

## Sign in
@import ../helpers/login.md

## Open the recent activity panel
Click "Recent activity" in the left sidebar. Verify a list of activity rows is rendered.
```

After running both tests once, the layout on disk is:

```
tests/
  checkout_test.md
  dashboard_test.md
  output-checkout/
    Result.md
    .internal/...
  output-dashboard/
    Result.md
    .internal/...
helpers/
  login.md
  helper-output-login-checkout-1/
    Result.md
    .internal/...
  helper-output-login-dashboard-1/
    Result.md
    .internal/...
```

Editing the login flow in `helpers/login.md` re-authors the login steps and everything after them in both `checkout_test.md` and `dashboard_test.md` on the next run.

## Next steps

- [Writing test.md files](./overview.md) — frontmatter, step syntax, variables.
- [Running a test.md](./running.md) — the run command, flags, replay model, output.
