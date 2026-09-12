# Variables and context

Variables let you parameterise objectives with reusable values and secrets, so the same test can be run against different inputs without editing the objective text. Context files give the agent persistent background information — guidance, conventions, and notes that apply across runs.

This page covers how `kane-cli` discovers and merges variables, how to mark values as secret, and where to put context files for the agent to read.

## Variables

### Variable format

`{{variables}}` resolve anywhere a value is typed or set — form fills, cookie and localStorage values, and clipboard writes alike.

Variables are JSON objects keyed by name. Each entry describes a single variable.

```json
{
  "username": { "value": "alice", "secret": false },
  "api_key":  { "value": "sk-live-...", "secret": true }
}
```

| Field    | Required | Type    | Default      | Description |
|----------|----------|---------|--------------|-------------|
| `value`  | yes      | string  | —            | The variable's value. A number is accepted and loaded as its string (`8080` → `"8080"`); a boolean, object or array is not a value. Entries without `value` are ignored. |
| `secret` | no       | boolean | `false`      | When `true`, the value is treated as a secret. Secrets are routed to TestmuAI's secrets store instead of being synced as plain TMS variables. |
| `syntax` | no       | string  | `{{<name>}}` | Custom placeholder syntax. Defaults to the double-brace form using the variable name. |

### Loading order

Variables are merged from four sources in this order. Later sources override earlier sources for the same key.

1. **Global directory** — `~/.testmuai/kaneai/variables/*.json`
2. **Local project directory** — `{cwd}/.testmuai/variables/*.json` (relative to where you invoke `kane-cli`)
3. **File flag** — `--variables-file <path>`
4. **Inline flag** — `--variables '<json>'`

Within a directory, files are read in alphabetical order; later files override earlier files for duplicate keys. Files that fail to parse as JSON are skipped with a warning.

### Inline variables

Pass a JSON object directly on the command line. Inline variables have the highest precedence.

```bash
kane-cli run "Log in as {{username}}" \
  --variables '{"username": {"value": "alice"}}'
```

### Variables from a file

Point at a single JSON file to load all of its variables at once.

```bash
kane-cli run "Log in as {{username}}" \
  --variables-file ./vars.json
```

The file must be a JSON object whose values are variable entries (see [Variable format](#variable-format)).

### Project-local variables

Drop one or more `*.json` files into `.testmuai/variables/` inside your project's working directory. They load automatically whenever you run `kane-cli` from that directory.

```text
my-project/
├── .testmuai/
│   └── variables/
│       ├── credentials.json
│       └── urls.json
└── ...
```

Project-local variables override global variables but are overridden by file and inline flags.

### Global variables

For values you want available across every project on your machine, place `*.json` files in `~/.testmuai/kaneai/variables/`.

```text
~/.testmuai/kaneai/variables/
├── personal.json
└── shared.json
```

Global variables have the lowest precedence — anything else with the same key wins.

### Using variables in objectives

Reference a variable inside the objective using its `syntax`. With the default syntax, that means `{{<name>}}`.

`vars.json`:

```json
{
  "username": { "value": "alice@example.com", "secret": false },
  "password": { "value": "s3cret-pa55", "secret": true }
}
```

Run:

```bash
kane-cli run "Log in with email {{username}} and password {{password}}, then verify the dashboard loads" \
  --variables-file ./vars.json
```

Before the objective is sent to the agent, `{{username}}` and `{{password}}` are rewritten to internal namespaced forms; the agent sees the resolved values at runtime.

### Secrets

Mark a variable as secret by setting `"secret": true`.

```json
{
  "api_key": { "value": "sk-live-abc123", "secret": true }
}
```

Secret values are masked in displayed output and logs, and are routed to TestmuAI's secrets store instead of being synced to TMS as plain variables. Use this for credentials, tokens, and anything else that should not appear in shareable artifacts.

### Variables declared by `kane-cli design tests`

When a design session needs a value nobody has — a start URL, a test account — it references it as `{{name}}` and declares it. Before choosing a name, design reads every `*.json` in both variable directories and reuses a name you already have rather than inventing a new one. The agent sees only which names exist and whether each has a value, never the values themselves.

For each name it declares, `kane-cli` writes an **empty stub** into `.testmuai/variables/assurance.json` — never a value — and tells you during the round (`⚒ declared 2 new variables — login_email · login_password (values needed)`) and again at the end (`2 variable(s) need values — see .testmuai/variables/assurance.json`):

```json
{
  "login_email": { "value": "", "secret": false, "description": "the account the login tests sign in with" }
}
```

Fill `value`. `kane-cli` never overwrites a key that already exists in any of your variable files, so a stub cannot replace a value you set. A value you type in chat stays a literal in the step; a variable is created only when the value is unknown.

### Before a run: unresolved variables

`kane-cli run`, `kane-cli testmd run` and `kane-cli testrun run` check every `{{name}}` an authored step references **before anything starts** — no browser, no session. A name with no value stops the run there, with exit code `2`, and the receipt says what each one needs:

```
✗ 3 variables have no value — nothing was dispatched

  Waiting for a value in .testmuai/variables/assurance.json
    storefront_sign_in_url     step 1
    registered_customer_email  step 2

  Not in any variables file
    checkout_url               step 4

    Add it to .testmuai/variables/assurance.json

  If {{name}} is literal page text, write \{{name}} to keep it as-is.
  Fill the values and run again.
```

The pool file is named once per group. A test filename appears only when it is not the file you named — an `@import`ed unit and a testrun member both keep theirs, and a `kane-cli run` objective shows no location at all. A name that is in no file gets `Add it to <file>` when a pool file exists, or the JSON to create when there is none yet.

There is no flag to bypass the check: fill the value or remove the reference. Never checked: `{{smart.*}}`, `{{environment.*}}`, `{{secrets.*}}` and `{{totp.*}}` (resolved at run time); a name an earlier step stored (`store the price as 'price'`); a test's own frontmatter `variables:`; and replayed steps, which resolve from their tape and from TMS — a replay with a missing value gets a warning line, never a refusal. `${x}` is not a variable reference on this path. In agent mode the refusal is one typed `error` event with `code: "unresolved_variables"` — see [Running tests](./running-tests.md#unresolved-variables).

## Context files

Context files are plain Markdown files whose contents are passed to the agent alongside your objective. Use them for standing instructions — coding conventions, accounts to use, sites to avoid, or domain knowledge the agent should always have.

### Global context

Default path: `~/.testmuai/kaneai/global-memory.md`

Put cross-project, account-wide guidance here. The contents are loaded for every run unless overridden.

### Local context

Default path: `.testmuai/context.md` in the current working directory.

Put project-specific guidance here — anything that only makes sense for the project you are running tests against. The local context is loaded automatically when you invoke `kane-cli` from a directory that contains it.

### Overriding paths

Use the run flags to point at a different file for a single invocation:

```bash
kane-cli run "Run smoke tests" \
  --global-context ./team-conventions.md \
  --local-context ./project-notes.md
```

If a context file is missing or empty, it is silently ignored — no error is raised.
