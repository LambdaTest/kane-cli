# Running test.md files

This page covers the `kane-cli testmd` command family: how to run a test, what the flags do, how replay works, what shows up in the output directory, and what the exit codes mean.

To learn the `_test.md` file format, see [overview.md](./overview.md). To reuse flows across tests, see [composition.md](./composition.md).

## Commands

```bash
kane-cli testmd run <path>          # run a test
kane-cli testmd list                 # list *_test.md files in the current directory
kane-cli testmd status <path>        # show recorded status for a test
kane-cli testmd delete <path>        # delete a test and its output directory
kane-cli testmd export <path>        # regenerate code export from existing recordings
```

In a TTY, `kane-cli testmd` with no subcommand opens an interactive picker that walks the current directory and lets you pick a `_test.md` to run.

## `kane-cli testmd run`

The main command. Point it at a `_test.md` file and it runs:

```bash
kane-cli testmd run amazon_test.md
```

You can run files anywhere on disk by giving an absolute path or a path relative to your shell's working directory:

```bash
kane-cli testmd run ./tests/e2e/checkout_test.md
kane-cli testmd run /Users/me/project/tests/checkout_test.md
```

### Flag reference

Every flag accepted by `kane-cli testmd run`:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--headless` | flag | off | Launch Chrome without a visible window. Per-run; no persistent setting. Equivalent to `headless: true` in frontmatter. |
| `--max-steps <n>` | integer | `30` | Maximum agent reasoning steps per test step. |
| `--timeout <s>` | integer | none | Hard kill timer per step, in seconds. |
| `--url <url>` | string | frontmatter `url:` / config `default_url` | Start URL for the first step. Overrides the frontmatter `url:` key and the configured `default_url`; bare domains are normalized to `https://`. |
| `--allow-missing-url` | flag | off | Non-TTY only: proceed from the browser's current page instead of failing when the first step has no start URL (`url:` / `--url` are still used if present). |
| `--cdp-endpoint <url>` | string | none | Reuse an external Chrome over CDP. |
| `--ws-endpoint <url>` | string | none | LambdaTest / Playwright WebSocket endpoint. |
| `--global-context <file>` | path | `~/.testmuai/kaneai/global-memory.md` | Override the global context file. |
| `--local-context <file>` | path | `<cwd>/.testmuai/context.md` | Override the local context file. |
| `--variables <json>` | JSON string | none | Inline variables JSON for this run. |
| `--variables-file <path>` | path | none | Load variables from a JSON file. |
| `--session-context <json>` | JSON string | none | Pre-loaded prior-run context for the agent. |
| `--username <user>` | string | profile | Basic-auth username. Skips OAuth for this run. |
| `--access-key <key>` | string | profile | Basic-auth access key. Skips OAuth for this run. |
| `--mode <name>` | `action` \| `testing` | profile or `testing` | Agent behaviour on auth walls and error pages. See [Run mode](#run-mode). |
| `--agent` | flag | auto when stdin not TTY | Plain NDJSON output; no TUI. Use this in CI. |
| `--code-export` | flag | off | Generate Playwright code after the run. See [Code export](#code-export). |
| `--code-language <lang>` | `python` \| `javascript` | `python` | Code-export target language. |
| `--skip-code-validation` | flag | on | Skip the post-codegen validation pass. |
| `--no-skip-code-validation` | flag | off | Force the post-codegen validation pass. |
| `--name <name>` | string | none | Persist a session name. Must match `[a-zA-Z0-9_-]+`. |
| `--on-lock-conflict <mode>` | `readonly` \| `fail` \| `wait` | none | Policy when another user holds the lock. See [Lock conflicts](#lock-conflicts). |
| `--push` | flag | off | Always commit at the end of the run. |
| `--retry` | flag | off | On replay failure, restart the run with a shrinking replay window. |
| `--retry-count <n>` | integer | `3` | Maximum replay restart attempts before falling back to a full re-author. |
| `--author` | flag | off | Skip the replay decision and author every step from scratch. |

Most flags have a frontmatter counterpart with the same name (with underscores). Where both are set, the CLI flag wins — except for `variables`, which the file owns; see [overview.md](./overview.md#variables).

## How a run works

A run proceeds in four phases:

1. **Parse** — kane-cli reads the `_test.md` file (and any helper it imports) and validates frontmatter, step bodies, and the `@import` graph. Parse errors abort here with exit `2`; no browser is launched.
2. **Decide replay vs author per step** — for each step, kane-cli decides whether to **replay** a cached recording or **author** a fresh one. See [Replay vs author](#replay-vs-author).
3. **Execute** — kane-cli launches Chrome and works through every step in order. Each step either replays its cached recording or asks the agent to figure it out.
4. **Finalize** — kane-cli writes `Result.md`, saves recordings, uploads the run to Test Manager, and (if enabled) generates code export.

Each step launches its own runner subprocess. The browser is shared across steps; cookies, login state, and tabs carry over.

## Replay vs author

The first time you run a `_test.md`, every step is **authored**: the agent works out how to satisfy the objective and a recording is saved next to the test. On every subsequent run, kane-cli tries to **replay** the saved recording for each step — no agent involved, no LLM cost, much faster.

A step replays if and only if all of the following are true:

- A recording exists for it on disk.
- The step's objective text has not changed since the recording.
- The step's `yaml` block has not changed since the recording.
- No earlier step in the same file invalidated it (see below).

If any of those fail, the step authors again.

### Edits cascade to the rest of the file

Editing one step does not just re-record that step — it re-records that step **and every step after it in the same file**. The reason: each step starts where the previous step left off (same browser, same URL, same logged-in state). When you change step 3, the state step 4 expected to find may no longer be there, so it is not safe to replay step 4 from cache.

In practice this means: an isolated text fix at the top of a test can re-author the whole file. If you are iterating on a test and want only the last step to re-record, edit that last step.

### Forcing a fresh recording

Two ways to author everything:

- **`--author`** — bypasses the replay decision for one run. Every step authors.
- **Delete the output directory** — `rm -rf output-<stem>/` resets the cache for the next run.

### Handling replay failures

A replay can fail if the site changed under you — a button moved, the page is slower than expected, an extra modal appears. Two flags help:

- **`--retry`** — on replay failure, kane-cli restarts the run with a smaller replay window: it authors the failing step and replays fewer earlier steps. This often recovers transient issues without a full re-author.
- **`--retry-count <n>`** — maximum restart attempts. Default `3`. After this many retries, kane-cli falls back to a full re-author.

## Run mode

The `--mode` flag controls how the agent handles authentication walls, blocked pages, and error pages. The same setting can be put in frontmatter as `mode:` (root-only).

- **`testing`** (default) — the agent treats those pages as part of the run and continues. Negative-test cases (e.g., "verify the error message is shown") work because the run does not bail out on the first error page it sees.
- **`action`** — the agent hard-stops on auth, blocked, and error pages so a human can intervene before the run continues.

`testing` is the right default for automated suites; `action` is for one-off authoring sessions where you want manual control.

## The output directory

A successful run writes everything it needs to replay next time into `output-<stem>/` next to the test file, where `<stem>` is the filename without `_test.md`:

```
amazon_test.md
output-amazon/
  Result.md
  .internal/                     # cached recordings — do not edit by hand
  playwright-python-code/        # only if code export is enabled
```

`Result.md` is the human-readable run report. `.internal/` holds the recordings kane-cli replays on the next run. The whole `output-<stem>/` directory is safe — and recommended — to commit to git: it makes your tests reproducibly replayable on any teammate's machine and on CI.

For tests that `@import` helpers, kane-cli also writes one `helper-output-...` directory per call site next to the helper file. See [composition.md](./composition.md#helper-outputs).

## `Result.md`

`Result.md` is generated on every run. It is intended to be read in a browser or editor — drop it into any Markdown viewer.

The file begins with frontmatter:

```yaml
---
test: ../amazon_test.md
status: passed
started: 2026-05-13T06:22:43.641Z
duration_s: 78
session_id: 1de66066-fc38-4ed4-9427-f28b2e081171
---
```

Followed by one entry per root-level step:

```markdown
## Open Amazon ✓ passed (3s)
Open https://www.amazon.com.

## Search ✓ passed (15s)
Type "wireless headphones" into the search box and submit.

## Add to cart ✗ failed (12s)
Click "Add to Cart" on the product page.
```

Step status icons:

| Icon | Meaning |
|---|---|
| `✓ passed` | The step completed successfully. |
| `✗ failed` | The step failed and the run did not continue. |
| `⏭ skipped` | The step did not run because an earlier non-optional step failed. |
| `(optional)` | Suffix added when a step marked `optional: true` failed but the run continued. |

When an `@import` step fails, the badge points at the failing leaf inside the helper, e.g. `✗ failed (via @import ./helpers/login.md — at sub-step 2 → 3, 8s → ./helpers/helper-output-login-checkout-3)`. The sub-step chain walks from the import down to the actual failing step.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Run passed (or the file had no steps). |
| `1` | At least one non-optional step failed. |
| `2` | Error before or during the run: parse error, auth error, organisation mismatch, Chrome launch failure, invalid flag, lock conflict with `--on-lock-conflict fail`. |
| `3` | Cancelled (Ctrl+C confirmed) or timed out (including `--on-lock-conflict wait` timing out). |

Use these to gate downstream CI steps.

## Lock conflicts

Each test in Test Manager has a single-writer lock so two engineers cannot author the same test at the same time. When you run a test and someone else already holds the lock, `--on-lock-conflict` decides what to do:

| Policy | Behaviour | Exit |
|---|---|---|
| `readonly` | Proceed in replay-only mode. No commit, no upload. Useful when you just want to verify a test still passes. | `0` on success |
| `fail` | Abort immediately. Use this in CI to flag contention rather than waiting. | `2` |
| `wait` | Block until the lock releases or times out. Use this for serialised CI lanes. | `0` on success, `3` on timeout |

The lock is acquired before Chrome launches, so a `fail` policy aborts with zero side effects.

## Code export

`kane-cli testmd run` can generate runnable Playwright code from a successful run. Enable it via frontmatter:

```yaml
code_export: true
code_language: "python"   # or "javascript"
```

…or for a single run, with flags:

```bash
kane-cli testmd run amazon_test.md --code-export --code-language python
```

The generated project lands at `output-<stem>/playwright-<lang>-code/`. Code export requires a successful Test Manager upload to run, and only meaningful when a project and folder are configured.

For the configurable options (default language, validation toggle, persistent enable from the TUI), see [configuration.md](../configuration.md#code-export).

## Running in CI

A CI-friendly invocation:

```bash
kane-cli testmd run ./tests/checkout_test.md \
  --agent \
  --headless \
  --on-lock-conflict wait \
  --retry
```

- `--agent` — plain NDJSON to stdout, no TUI redraws. Auto-enabled when stdin is not a TTY, but pass it explicitly for clarity.
- `--headless` — Chrome runs without a window.
- `--on-lock-conflict wait` — block instead of failing if a teammate is editing the same test.
- `--retry` — recover transient replay failures automatically.

In a non-interactive run (stdin is not a TTY), there is no one to answer an interactive `ask_user` prompt, so kane-cli disables it: a step that would otherwise wait for input fails cleanly instead of blocking forever. Write test steps that do not depend on mid-run prompts when running in CI.

Capture exit code in a shell script:

```bash
kane-cli testmd run ./tests/checkout_test.md --agent --headless
status=$?
if [ "$status" -eq 0 ]; then
  echo "passed"
elif [ "$status" -eq 1 ]; then
  echo "failed; check Result.md"
  exit 1
else
  echo "error or cancellation (exit=$status)"
  exit 1
fi
```

The runner streams NDJSON events to stdout in `--agent` mode. Each line is a JSON object you can parse in a downstream step.

## `kane-cli testmd list`

Walks the current directory and prints every `*_test.md` file it finds:

```bash
kane-cli testmd list
```

Useful for sanity-checking that your tests live where you think they do, and for piping into other commands.

## `kane-cli testmd status <path>`

Shows the Test Manager identity of a recorded test: the project, the folder, the testcase ID, and whether the local recordings are in sync with the last upload.

```bash
kane-cli testmd status amazon_test.md
```

If you have never run the test, status reports it as not yet recorded.

## `kane-cli testmd delete <path>`

Removes the test source and its `output-<stem>/` directory:

```bash
kane-cli testmd delete amazon_test.md
```

This is a local-only delete — it does not remove the test from Test Manager. Use it when you have abandoned a test or want to start over from scratch.

## `kane-cli testmd export <path>`

Regenerates the code export from existing recordings without re-running the test:

```bash
kane-cli testmd export amazon_test.md --code-language python
```

This is faster than a full run because the browser is not launched; it reuses what was recorded last time.

## Next steps

- [Writing test.md files](./overview.md) — file format, frontmatter, steps, variables.
- [Composition with @import](./composition.md) — reusable helpers across tests.
- [Configuration](../configuration.md) — persistent settings: Chrome profile, window size, code export defaults.
- [Test Manager integration](../test-manager-integration.md) — what happens during the upload.
