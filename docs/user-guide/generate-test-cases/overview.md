# Generating test cases with AI

`kane-cli generate` turns a plain-language description of *what you want to test* into structured **test scenarios** and **test cases** — without writing them by hand and without launching a browser. This page covers AI test-case generation from both the command line and the interactive kane-cli TUI.

A generation produces:

- **Test Scenarios** — logical groupings of related checks (e.g. "Login", "Checkout").
- **Test Cases** — the individual checks inside each scenario, each typed **Positive**, **Negative**, or **Edge**.

You generate, review the result, **refine** it in plain language as many times as you like, and optionally **save** the functional cases as runnable `_test.md` files that [`kane-cli testmd`](../testmd/running.md) can execute and replay.

> For the full picture of AI test-case generation — including richer inputs (files, PDFs, issue links) and pushing cases into Test Manager or automation — see the docs at <https://www.testmuai.com/support/docs/generate-test-cases-with-ai/>. The **CLI here takes a text description** and writes local `_test.md` files. See [Limits and scope](#limits-and-scope).

## Quick start

```bash
# 1. Generate from a description
kane-cli generate "checkout flow on a shopping site"

# 2. Refine it (repeat as needed)
kane-cli generate "also cover an expired card and an out-of-stock item" --refine --req 23271

# 3. Save the functional cases as runnable tests
kane-cli generate --save --req 23271
#    → .testmuai/tests/<suite>/<scenario>/<case>_test.md

# 4. Run them
kane-cli testmd run .testmuai/tests/checkout-23271/login/valid-credentials_test.md
```

The request id (`23271` above) is printed at the end of each generation and is how you continue a request across commands.

## The three modes

`generate` runs **one turn per command, then exits** — you continue a request by running the command again with `--req <id>`. (That's the scripted/headless surface; run interactively, kane-cli opens a live TUI session instead — see [Interactive mode (TUI)](#interactive-mode-tui).)

| Mode | Command | What it does |
|---|---|---|
| **New** | `kane-cli generate "<what to test>"` | Starts a fresh request and generates scenarios + cases. Prints a request id. |
| **Refine** | `kane-cli generate "<change>" --refine --req <id>` | Adjusts an existing request in plain language — add coverage, narrow scope, change focus. |
| **Save** | `kane-cli generate --save --req <id> [--out <dir>]` | Writes the request's **functional** cases to `_test.md` files. No new generation. |

`--refine` and `--save` both require `--req`. `--refine` needs a change description; `--save` takes no description.

## Options

| Option | Purpose |
|---|---|
| `--req <id>` | The request id to refine or save. |
| `--out <dir>` | Where `--save` writes. Defaults to `<cwd>/.testmuai/tests` (the same location the TUI uses). |
| `--name <name>` | Names the run and the saved suite folder. |
| `--scenario-limit <n>` | Maximum number of scenarios to generate. |
| `--per-scenario-limit <n>` | Maximum test cases per scenario. |
| `--memory` | Use the **memory layer** — reuse relevant existing test cases and reduce duplicates. |
| `--project <id>` / `--folder <id>` | Test Manager project / folder. |
| `--agent` | Emit structured NDJSON on stdout (auto-on when run non-interactively / piped). |
| `--env`, `--username`, `--access-key` | Environment and authentication — same as [`kane-cli run`](../running-tests.md). See [Authentication](../authentication.md). |

## Interactive mode (TUI)

The commands above are the scripted surface. Running `kane-cli generate "<objective>"` in a terminal **without `--agent`** instead opens the interactive **Generate mode** in the kane-cli TUI and submits your objective. (From Run mode, `/generate` switches in; `/run` switches back.)

Unlike the one-turn command-line surface, the TUI is a **live session** — generated scenarios stay pinned in a **Scenarios** box that you refine and browse in place:

| Input | Action |
|---|---|
| *(type any text)* | **Refine** — describe a change in plain language; the set updates in place |
| `/view [S<n>]` | Open the **scenario browser** — drill scenarios → cases → case detail |
| `/save` | Save the functional cases to `<cwd>/.testmuai/tests/…` |
| `/cancel` | Cancel the current generation |
| `/run` | Switch back to Run mode |

In the scenario browser: `↑↓` move · `↵` open · `◂ ▸` previous/next sibling · `x` remove a case · `←`/`esc` back. **Non-functional cases** (Security, Performance, …) show a **gray `✓`** with a "won't be saved" note — `/save` writes only functional cases (see [Saving is functional-only](#saving-is-functional-only)).

If generation asks a **clarifying question**, just type your answer to continue. After `/save`, the files are ordinary `_test.md` tests under `.testmuai/tests/` — run them with [`kane-cli testmd run`](../testmd/running.md).

## How a result is shaped

Each generated case carries:

- a **title** and **steps**,
- a **type** — Positive (expected to pass), Negative (tests failure handling), or Edge (corner cases),
- a **category** — e.g. *Functional*, *Security*, *Performance*,
- a **priority**.

Scenarios are ordered by importance. The full result is returned at the end of the turn so it can be reviewed before you refine or save.

## Saving is functional-only

`--save` writes **only test cases whose category is *Functional*** — those are the ones that translate into runnable `_test.md` tests. Non-functional cases (Security, Performance, and so on) are still generated and shown, but they are **not** written to disk. If a request has no functional cases, `--save` writes nothing and tells you so.

Saved files are ordinary `_test.md` tests in the standard format — identical to a hand-written one. From there everything in [the testmd docs](../testmd/overview.md) applies: run them, edit them, replay them from cache, commit them to git.

This is the intended path: **generate authors test cases → testmd runs them.**

## Limits and scope

- **Input is a text description.** File, PDF, audio, and issue-link inputs (and the web product's "Create / Create and Automate") are not part of the CLI.
- **Refinement is whole-request.** You refine the request as a whole in plain language; targeting an individual scenario or case from the CLI is not yet supported.
- **Scenario and per-scenario counts** are bounded by `--scenario-limit` / `--per-scenario-limit`.

## Next steps

- [The generate workflow](./workflow.md) — the new → refine → save → run loop, worked examples, and exit codes.
- [Running tests with testmd](../testmd/running.md) — run and replay the `_test.md` files `--save` produces.
- [Authentication](../authentication.md) — logging in and choosing an environment.
