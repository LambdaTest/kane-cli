# The generate workflow

`kane-cli generate` is built around a simple loop: **generate → refine → save → run**. Each command is one turn that exits when done; you move between turns with the request id. This page walks the loop end to end. For the feature overview and option reference, see [Generating test cases with AI](./overview.md).

## 1. Generate

Start with a plain-language description of what you want covered:

```bash
kane-cli generate "checkout flow on a shopping site"
```

kane-cli generates scenarios and cases and prints the result, ending with a **request id** and the exact commands to refine or save it:

```
✓ Generated 3 scenarios · 11 cases  (request 23271)

▸ Login
   - Valid credentials [Positive]
   - Wrong password [Negative]
   - Empty fields [Edge]
▸ Checkout
   - Guest checkout [Positive]
   - Expired card [Negative]
   ...

  Refine:  kane-cli generate "<refinement>" --refine --req 23271
  Save:    kane-cli generate --save --req 23271
```

Keep the request id — every later command uses it.

Bound the size with limits when you want a tighter or broader set:

```bash
kane-cli generate "checkout flow on a shopping site" --scenario-limit 4 --per-scenario-limit 6
```

Add `--memory` to reuse relevant existing cases and avoid duplicating coverage you already have.

## 2. Refine

Refinement is a plain-language conversation. Each refine is a fresh command with `--refine --req <id>`:

```bash
kane-cli generate "also cover an expired card and an out-of-stock item" --refine --req 23271
kane-cli generate "drop the social-login scenario, focus on guest checkout" --refine --req 23271
```

Each refine returns the updated result. Repeat until the set looks right.

### When generation asks a question

Sometimes a turn ends by asking you something instead of finishing — for example, *"Which environment should these target, staging or production?"* This is a normal outcome, not a failure (the command exits `0`). Answer it by refining with your answer:

```bash
kane-cli generate "target staging" --refine --req 23271
```

(Driving this from a script or agent? Add `--agent` — or rely on it being auto-on when stdin is not a TTY — and read the answer-needed signal from the NDJSON, then re-invoke the same way.)

## 3. Save

When you are happy with the set, save it. `--save` writes the **functional** cases as `_test.md` files:

```bash
kane-cli generate --save --req 23271
```

By default this writes under `<cwd>/.testmuai/tests`:

```
.testmuai/tests/
  checkout-23271/
    login/
      valid-credentials_test.md
      wrong-password_test.md
    checkout/
      guest-checkout_test.md
      ...
```

Choose a different location with `--out`, and name the suite with `--name`:

```bash
kane-cli generate --save --req 23271 --out ./tests --name checkout-suite
```

Only functional cases are written — non-functional cases (Security, Performance, …) are part of the generated result but are not saved as runnable tests. See [Saving is functional-only](./overview.md#saving-is-functional-only).

## 4. Run

The saved files are ordinary `_test.md` tests. Run any of them with `testmd`:

```bash
kane-cli testmd run .testmuai/tests/checkout-23271/checkout/guest-checkout_test.md
```

From here, everything in the [testmd docs](../testmd/running.md) applies — replay from cache, edit steps, compose with `@import`, and commit the output to git.

## Automating it (agents / CI)

Pass `--agent` (auto-on when stdin is not a TTY) to get structured NDJSON on stdout instead of the human display, so a script or coding agent can drive the loop:

```bash
kane-cli generate "checkout flow on a shopping site" --agent
kane-cli generate "add an expired-card case" --refine --req 23271 --agent
kane-cli generate --save --req 23271 --agent
```

Each command prints one JSON object per line; the final line is the terminal event carrying the request id, the status, and the refine/save commands to run next.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Turn completed — including a turn that ended with a clarification question |
| `1` | Generation failed |
| `2` | Error — authentication / setup / transport, or an invalid combination of flags |
| `3` | Generation stopped or cancelled |
| `130` | Interrupted (Ctrl-C) |

Invalid flag combinations exit `2` with a message explaining the fix — for example using `--refine` without `--req`, passing a description with `--save`, using `--out` without `--save`, or `--req` without `--refine` or `--save`.

## Next steps

- [Generating test cases with AI](./overview.md) — overview, modes, and the full option reference.
- [Running tests with testmd](../testmd/running.md) — run and replay the files `--save` produces.
