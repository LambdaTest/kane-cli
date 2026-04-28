# Variables and context

Variables let you parameterise objectives with reusable values and secrets, so the same test can be run against different inputs without editing the objective text. Context files give the agent persistent background information — guidance, conventions, and notes that apply across runs.

This page covers how `kane-cli` discovers and merges variables, how to mark values as secret, and where to put context files for the agent to read.

## Variables

### Variable format

Variables are JSON objects keyed by name. Each entry describes a single variable.

```json
{
  "username": { "value": "alice", "secret": false },
  "api_key":  { "value": "sk-live-...", "secret": true }
}
```

| Field    | Required | Type    | Default      | Description |
|----------|----------|---------|--------------|-------------|
| `value`  | yes      | string  | —            | The variable's value. Entries without `value` are ignored. |
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
