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

For values you want available across every project on your machine (not to be confused with `{{global.<name>}}`, which reads a Test Manager global variable — see [Runtime namespaces](#runtime-namespaces-global-environment-smart)), place `*.json` files in `~/.testmuai/kaneai/variables/`.

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

Before the objective is sent to the agent, `{{username}}` is rewritten to `{{global.username}}` and the secret `{{password}}` to a secrets reference; the agent sees the resolved values at runtime. Saved `_test.md` files keep the bare `{{name}}` form.

### Secrets

Mark a variable as secret by setting `"secret": true`.

```json
{
  "api_key": { "value": "sk-live-abc123", "secret": true }
}
```

Secret values are masked in displayed output and logs, and are routed to TestmuAI's secrets store instead of being synced to TMS as plain variables. Use this for credentials, tokens, and anything else that should not appear in shareable artifacts.

### Runtime namespaces: `global`, `environment`, `smart`

> Requires kane-cli 0.9.0 or later. Check with `kane-cli --version`.

Besides your own variables, an objective can use values that kane-cli resolves at run time from a namespace:

| Reference | Resolves to |
|---|---|
| `{{global.<name>}}` | A global variable from Test Manager. Locally, a value you pass with the same name (pool file or `--variables`) wins. |
| `{{environment.<name>}}` | A variable of the run's Test Manager environment. |
| `{{smart.<name>}}` | A generated value: a date, random test data, or session info (table below). |
| `{{secrets.<…>}}`, `{{totp.<…>}}` | A secret, or a one-time code generated when it is typed. These are never shown to the agent. |

How they behave:

- **Resolved when each objective starts.** The agent sees the real value, so it can type it, reason about it, and assert on it. The saved test keeps the reference, not the value, so every replay resolves it fresh: a `{{smart.random_email}}` is a new address on every run, and in an interactive session on every objective.
- **`{{…}}` only.** `${global.x}` is not a namespace reference: `${…}` is reserved for dataset columns.
- **Two references can sit side by side.** `{{smart.random_int}}.{{smart.random_int}}` is two values joined by a dot.
- **A value the test stored wins.** If an earlier step stored a value under the same name, that value is used.
- **A `global` or `environment` reference that can't be resolved stops the run before step 1**, with the reason. A `smart` reference never stops a run: an unknown name resolves to an empty string, so check the spelling.

### Smart variables

| Variable | Example value | Format |
|---|---|---|
| `{{smart.current_date}}` | `2026-10-15` | `YYYY-MM-DD` |
| `{{smart.current_day}}` | `Thursday` | Day name |
| `{{smart.current_month}}` | `October` | Month name |
| `{{smart.current_month_number}}` | `10` | Two digits |
| `{{smart.current_year}}` | `2026` | Four digits |
| `{{smart.current_hour}}` | `14` | 24-hour, two digits |
| `{{smart.current_minute}}` | `05` | Two digits |
| `{{smart.current_timestamp}}` | `2026-10-15 14:05:09` | `YYYY-MM-DD HH:MM:SS` |
| `{{smart.current_timezone}}` | `UTC` | Zone name |
| `{{smart.next_day}}` | `2026-10-16` | Tomorrow, `YYYY-MM-DD` |
| `{{smart.previous_day}}` | `2026-10-14` | Yesterday, `YYYY-MM-DD` |
| `{{smart.start_of_week}}` | `2026-10-12` | This week's Monday |
| `{{smart.end_of_week}}` | `2026-10-18` | This week's Sunday |
| `{{smart.start_of_month}}` | `2026-10-01` | First day of this month |
| `{{smart.end_of_month}}` | `2026-10-31` | Last day of this month |
| `{{smart.random_int}}` | `482` | Integer from 100 to 999 |
| `{{smart.random_float}}` | `37.42` | 1 to 100, two decimals |
| `{{smart.random_string_8}}` | `aZ3kP9qL` | 8 letters and digits |
| `{{smart.random_string_56}}` | `Xk2…` | 56 letters and digits |
| `{{smart.random_email}}` | `k3j9x0a1bq@example.com` | 10 random characters `@example.com` |
| `{{smart.random_phone}}` | `7294810356` | 10 digits |
| `{{smart.user_name}}` | `jane` | Your TestMu AI username |

- Smart variables take no arguments. For a date format or offset the table doesn't have, describe it in the objective instead ("pick the date one week from today").
- Dates and times in a browser run are in **UTC**, not your machine's time zone. Keep that in mind around midnight.
- On Windows, releases before 0.9.0 resolved smart variables to empty strings.

Examples:

```bash
kane-cli run "Sign up with email {{smart.random_email}} and password {{smart.random_string_8}}, then verify the welcome page"
kane-cli run "Search for hotels in Paris with check-in {{smart.next_day}} and verify results are listed"
kane-cli run "Create a project named Demo {{smart.random_int}} and verify it appears in the project list"
```

### Variables declared by `kane-cli design tests`

When a design session needs a value nobody has — a start URL, a test account — it references it as `{{name}}` and declares it. Before choosing a name, design reads every `*.json` in both variable directories and reuses a name you already have rather than inventing a new one. The agent sees only which names exist and whether each has a value, never the values themselves.

For each name it declares, `kane-cli` writes an **empty stub** into `.testmuai/variables/assurance.json` — never a value — and tells you during the round (`⚒ declared 2 new variables — login_email · login_password (values needed)`) and again at the end (`2 variable(s) need values — see .testmuai/variables/assurance.json`):

```json
{
  "login_email": { "value": "", "secret": false, "description": "the account the login tests sign in with" }
}
```

Fill `value`. `kane-cli` never overwrites a key that already exists in any of your variable files, so a stub cannot replace a value you set. A value you type in chat stays a literal in the step; a variable is created only when the value is unknown.

### Variables in a shared project

In a folder linked to a [shared project](./assurance/shared-projects.md), the tests are shared but the values aren't. The project holds each test's `{{name}}` references, never a value. Each person fills the values in their own folder.

- **Design writes the stubs where it ran.** When a design ends, and again when it's saved, kane-cli writes an empty stub for each value the tests need into `.testmuai/variables/assurance.json` in that folder, as it does locally.
<!-- release: needs context pull -->
- **A teammate's folder has no values.** When the project's tests come to another folder through [`kane-cli context pull`](./assurance/shared-projects.md#bringing-the-projects-tests-into-your-folder), the pull writes no stubs. It names the values the tests need, and where to add them:

  ```text
  ⚒ 2 variables need values before these tests run: login_email and login_password
      add them to .testmuai/variables/assurance.json
  ```

- **A run sends its values to Test Manager.** Every run sends the non-secret values it loads to Test Manager: those in your global and folder variable files, in `--variables` and `--variables-file`, and in the test's own `variables:`. Test Manager keeps one value per name for your whole organisation, so each run's value replaces the one before it, for everyone. An empty stub is sent as an empty value. Values marked `"secret": true` go to your account's secrets instead, never to Test Manager's variables.

So fill real values before a run, keep test accounts and passwords `secret`, and never fill a value only to quiet the warning.

### Before a run: unresolved variables

`kane-cli run`, `kane-cli testmd run` and `kane-cli testrun run` check every `{{name}}` an authored step references **before anything starts**. A name with no value is a warning: the run goes ahead and types the name as written, unless a step sets it first:

```
warning: 3 variables have no value

  Waiting for a value in .testmuai/variables/assurance.json
    storefront_sign_in_url     step 1
    registered_customer_email  step 2

  Not in any variables file
    checkout_url               step 4

    Add it to .testmuai/variables/assurance.json

  If {{name}} is literal page text, write \{{name}} to keep it as-is.
  A step that sets a name first binds it; anything else is typed as written. Fill the values to bind them.
```

The pool file is named once per group. A test filename appears only when it is not the file you named — an `@import`ed unit and a testrun member both keep theirs, and a `kane-cli run` objective shows no location at all. A name that is in no file gets `Add it to <file>` when the pool file exists, or the JSON to create when there is none yet.

Never checked: an explicit `{{global.*}}` (it resolves from Test Manager at run time — only a bare `{{name}}` is a pool question), `{{smart.*}}`, `{{environment.*}}`, `{{secrets.*}}` and `{{totp.*}}` (resolved at run time); a name an earlier step stores (`store the price as 'price'`); a name the test's own frontmatter `variables:` declares, even with an empty value; and replayed steps, which resolve from their tape and from TMS (a `testrun run` preflight still lists a replayed step's names, because it checks the file before it knows which steps replay). `${x}` is a dataset column reference, not a pool reference; a `${x}` that is no column of the dataset row the run was given gets its own warning. In agent mode the same content is one `warning` event with `code: "unresolved_variables"` — see [Running tests](./running-tests.md#unresolved-variables).

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
