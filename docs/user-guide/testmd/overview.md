# Writing test.md files

A `_test.md` file is a kane-cli test you can commit to git. It captures the same kind of natural-language objective you would type into `kane-cli run`, but in a structured Markdown file that:

- Lives in your repository alongside the code it tests.
- Reads as a human-friendly description of what the test does.
- Splits a flow into named steps you can edit independently.
- Caches each step on first run, so a passing test replays in seconds the next time you run it.
- Composes — one test can `@import` another file to reuse a flow such as login.

This page covers the file format end-to-end. To run a test once you have written one, see [running.md](./running.md). To reuse flows across tests, see [composition.md](./composition.md).

## Quick start

Create `amazon_test.md` next to your project:

```markdown
---
mode: testing
max_steps: 30
---

# Amazon search

## Open Amazon
Open https://www.amazon.com.

## Search for headphones
Type "wireless headphones" into the search box and submit.
Verify at least one product result is visible.
```

Run it:

```bash
kane-cli testmd run amazon_test.md
```

The agent launches Chrome, works through each step in order, writes a result file to `output-amazon/Result.md`, and exits `0` if everything passed.

## File anatomy

```markdown
---
key: value         # frontmatter (YAML)
---

# Optional title

## Step 1 heading
Plain prose objective describing what the agent should do.

## Step 2 heading
```yaml             # optional per-step config block
timeout: 60
optional: true
```
Another prose objective.

## Step 3 heading
@import ./helpers/login.md
```

Four pieces:

1. **Frontmatter** — run-wide settings inside `--- ... ---` at the top of the file.
2. **`## Step heading`** — every step starts with an H2. Anything before the first `## ` is silently ignored, so the optional `# Title` is decorative.
3. **Optional `yaml` block** — fenced ` ```yaml ... ``` ` immediately under the step heading, overriding the frontmatter for that step only.
4. **Step body** — either a prose objective **or** a single `@import <path>` line. Not both.

### File name

Files that end in `_test.md` are tests — they are valid entry points for `kane-cli testmd run`. Files that do **not** end in `_test.md` are helpers and can only be reached through `@import` from a test. See [composition.md](./composition.md).

## Frontmatter

Frontmatter is YAML inside `---` fences at the top of the file. Every key is optional. The keys you can set:

| Key | Type | Scope | Description |
|---|---|---|---|
| `mode` | `"action"` \| `"testing"` | root only | How the agent reacts to auth walls, blocked pages, and error pages. `testing` (default) pushes through so negative-test assertions can run; `action` halts so you can intervene. See [Run mode](./running.md#run-mode). |
| `max_steps` | integer | root + per-step | Maximum agent reasoning steps for the run or step. Default is `30`. |
| `timeout` | integer (seconds) | root + per-step | Hard kill timer applied per step. No default. |
| `global_context` | string (Markdown text) or file path | root + per-step | Standing instructions inlined into the agent's context. See [variables-and-context.md](../variables-and-context.md). |
| `local_context` | string or file path | root + per-step | Project-scoped guidance. Same shape as `global_context`. |
| `variables` | object | root + per-step | Named values usable as `{{name}}` in objectives. See [Variables](#variables). |
| `session_context` | `{ prior_runs: [...] }` | root + per-step | Pre-loaded prior-run context for the agent. |
| `target` | `"chrome"` \| `"cdp"` \| `"ws"` | root only | How kane-cli reaches a browser. Default is `chrome`. |
| `chrome_profile` | string | root only | Named Chrome profile under `~/.testmuai/kaneai/chrome-profiles/`. |
| `cdp_endpoint` | string | root only | Reuse an external Chrome over CDP. |
| `ws_endpoint` | string | root only | LambdaTest / Playwright WebSocket endpoint. |
| `headless` | boolean | root only | Launch Chrome without a visible window. |
| `code_export` | boolean | root + per-step | Generate Playwright code after the run. See [Code export](./running.md#code-export). |
| `code_language` | `"python"` \| `"javascript"` | root + per-step | Code-export target language. |
| `on_lock_conflict` | `"readonly"` \| `"fail"` \| `"wait"` | root only | Policy when another user holds the lock on this test in Test Manager. See [Lock conflicts](./running.md#lock-conflicts). |

Keys not in this table are rejected with `unknown config key: <key>` at parse time. Authentication is set via CLI flags or your active profile, never in frontmatter.

### Root-only vs root-or-per-step

- **Root only** — Chrome settings (`target`, `chrome_profile`, `cdp_endpoint`, `ws_endpoint`, `headless`), `mode`, and `on_lock_conflict`. These apply to the whole run; setting them on an individual step is a parse error.
- **Root or per-step** — everything else can appear in the per-step `yaml` block to override the frontmatter for that step only.

## Steps

Every step begins with an `## H2` heading. The heading is purely a label for humans and for the result file — the agent reads the step body, not the heading.

### Per-step `yaml` block

A step can carry its own settings in a fenced ` ```yaml ``` ` block placed directly under the heading. The block must be closed with a matching ` ``` `.

```markdown
## Submit the form
```yaml
timeout: 90
optional: true
```
Click submit and verify the confirmation banner.
```

Allowed keys: any root-or-per-step key from the frontmatter table, plus `optional` (see below). Chrome keys, `mode`, and `on_lock_conflict` are rejected with a clear error if you try to set them here.

### `optional`

`optional: true` marks a step as soft-failing. If the step fails:

- The overall run does **not** halt.
- Subsequent steps still execute.
- The step is reported as failed in `Result.md` with an `(optional)` suffix.

Default is `false`, in which case any failure stops the run and marks the remaining steps as skipped.

`optional` is allowed on every prose step. On an `@import` step it is allowed only at the top level of a test file — see [composition.md](./composition.md#optional-imports).

### Step body shapes

The body of a step (everything after the optional `yaml` block) must be exactly one of:

- **A prose objective** — one or more lines of natural language describing what the agent should do.
- **An `@import`** — a single line of the form `@import <path>` and nothing else.

Mixing prose and `@import` in the same body is a parse error.

```markdown
## OK — prose
Click the cart icon and verify two items are listed.

## OK — import
@import ./helpers/login.md

## NOT OK — both
Click the cart icon.
@import ./helpers/login.md
```

## Variables

Variables let you parameterise objectives with reusable values and secrets. Reference a variable inside any prose objective using its placeholder syntax (default `{{name}}`):

```markdown
## Sign in
Open the login page and sign in as {{tester_email}} with password {{tester_password}}.
```

### Defining variables in a test.md

Variables can be set in three places inside a `_test.md` file, in order of increasing specificity:

```markdown
---
variables:
  tester_email:
    value: "alice@example.com"
  tester_password:
    value: "s3cret-pa55"
    secret: true
---

## Switch to the staging tenant
```yaml
variables:
  tenant: "staging-eu"
```
Open https://{{tenant}}.example.com and verify the login page loads.
```

Shorthand `name: "value"` works too — `tester_email: "alice@example.com"` is equivalent to `tester_email: { value: "alice@example.com" }`.

| Field | Required | Type | Default | Description |
|---|---|---|---|---|
| `value` | yes | string | — | The variable's value. Entries without `value` are rejected. |
| `secret` | no | boolean | `false` | When `true`, the value is masked in logs and routed to the secrets store. |
| `syntax` | no | string | `{{<name>}}` | Custom placeholder syntax. |

### Where else variables can come from

Variables defined inline in a `_test.md` are merged with variables loaded from JSON files and command-line flags. The full pipeline is documented in [variables-and-context.md](../variables-and-context.md). One difference matters for test.md authors:

> **Inside a `_test.md` file, variables declared in frontmatter or in a step's `yaml` block win over `--variables` and `--variables-file` for the same key.**

Every other flag overrides what is in the file; variables are the exception. The reasoning: the test author's choice of test data stays close to the test. You can still **add** new keys from the CLI that the file does not define.

### Secrets

Secrets are variables with `secret: true`. They are masked in displayed output, redacted in `Result.md`, and routed to TestmuAI's secrets store instead of being synced as plain Test Manager variables.

```yaml
variables:
  api_key:
    value: "sk-live-abc123"
    secret: true
```

## Context

Context files are plain Markdown text that the agent reads alongside your objective. Use them for standing instructions — coding conventions, accounts to use, sites to avoid.

```yaml
---
global_context: "~/work/team-conventions.md"
local_context: ".testmuai/project-notes.md"
---
```

You can pass either a file path (resolved at runtime) or inline Markdown text. See [variables-and-context.md](../variables-and-context.md#context-files) for the full discovery rules.

## Recording a test.md from a live session

You can author a test.md by hand, or record one from an interactive `kane-cli run` session:

```bash
kane-cli run "Search for noise-cancelling headphones on amazon.com" --name amazon-search
```

On exit, kane-cli writes the session to `<cwd>/.testmuai/tests/amazon-search_test.md`. You can move that file into your repository and re-run it as any other test.

The recorded file is a regular `_test.md` — it is parsed and executed exactly like a hand-written one, and you can edit it freely.

## Worked example

A complete test that signs in, searches, adds to cart, and verifies the badge — using a variable for the search term and a per-step timeout.

```markdown
---
mode: testing
max_steps: 35
headless: false
variables:
  search_term:
    value: "wireless headphones"
---

# Amazon — add to cart

## Open Amazon
Open https://www.amazon.com.

## Search
Type "{{search_term}}" into the search box and submit.
Verify at least one product result is visible.

## Open the first result
```yaml
timeout: 60
```
Click the first non-sponsored product card. Verify the product detail page loads.

## Add to cart
Click "Add to Cart" on the product page.
Verify the cart icon shows a count of 1 or higher.
```

Running this file on a fresh machine takes one author pass — the agent figures out the page and records each step. Re-running it later replays each passed step from cache, taking a fraction of the time. Edit any step's objective and that step (and the steps after it in the same file) author again on the next run; see [Replay vs author](./running.md#replay-vs-author) for the rules.

## Common parse errors

Mistakes the parser catches before any browser launches:

| Message | Cause |
|---|---|
| `frontmatter is missing closing '---'` | The `---` fence was opened but not closed. |
| `invalid YAML in frontmatter: <details>` | Frontmatter is not valid YAML. |
| `step-config fenced ```yaml block is not closed` | A per-step `yaml` block is missing its closing ` ``` `. |
| `invalid YAML in step config: <details>` | Per-step YAML is malformed. |
| `step body must be exactly one of prose / @import` | The step contains both prose and an `@import`. |
| `step config 'optional' must be boolean: got <type>` | `optional` was set to a non-boolean. |
| `variable '<k>' must be a string or { value: ... } object` | A variable entry is the wrong shape. |
| `auth/identity keys are CLI-only: <key>` | `username`, `access_key`, or another auth key appeared in frontmatter. |
| `unknown config key: <key>` | A frontmatter or per-step key is not recognised. See [Common key-name confusions](#common-key-name-confusions) below. |
| `chrome config is global-only: <key>` | A Chrome-related key was set on an individual step. |
| `'<key>' is run-level and cannot be set per-step` | `mode` or `on_lock_conflict` was set on an individual step. |
| `step config on @import may only contain 'optional': got <key>` | An `@import` step's `yaml` block contains anything other than `optional`. |

Parse errors abort the run before any browser launch, auth call, or upload. The exit code is `2`.

### Common key-name confusions

The frontmatter table is the single source of truth for the keys a `_test.md` file accepts. A few intuitive-sounding keys are **not** in that table and produce `unknown config key: <key>`. The right place for each:

| Key you reached for | Where the value actually lives |
|---|---|
| `startUrl`, `url`, `baseUrl` | The first step's prose body. There is no frontmatter key for the start URL — the agent reads it from the step text, e.g. `## Open the app\nOpen https://example.com.`. The `target` frontmatter key looks similar but selects the **browser transport** (`chrome` / `cdp` / `ws`), not a URL. |
| `name`, `title` | The file name (which is what `kane-cli testmd run` reports) and the per-step `## H2` headings. The optional `# Title` above the first step is decorative; the parser ignores anything before the first `## ` heading. |
| `objective`, `description`, `goal` | The prose body of each step, directly under the `## H2` heading. The agent reads the step body as the objective. |
| `auth`, `username`, `access_key`, `api_key` | CLI flags or your active profile, never frontmatter. Frontmatter rejects these with `auth/identity keys are CLI-only: <key>`. |

If your error is `unknown config key:` and the key you tried isn't covered above, double-check it against the [frontmatter table](#frontmatter) — every accepted key is listed there.

## Next steps

- [Running a test.md](./running.md) — the `kane-cli testmd run` command, flags, the replay model, and what the output directory contains.
- [Composition with @import](./composition.md) — break a long test into reusable helpers.
- [Variables and context](../variables-and-context.md) — the full variables pipeline.
