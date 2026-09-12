# Kane CLI GitHub Actions

Composite actions for running Kane CLI inside GitHub Actions. Each action lives in its own directory and is referenced by that path.

| Action | Reference | What it does |
|---|---|---|
| [kane-cli-browser-run](kane-cli-browser-run/) | `LambdaTest/kane-cli/integrations/github-action/kane-cli-browser-run@main` | Runs a plain-English objective or a committed `_test.md` suite in a real headless browser, uploads the evidence pack, and posts the verdict on the PR |

## Layout

Every action follows the same shape, so a new one slots in beside the others:

```text
integrations/github-action/
  README.md                 this index
  <action-name>/
    action.yml              the composite action
    README.md               usage, inputs, outputs, examples table
    examples/               copy-paste workflows for common triggers
    tests/                  _test.md files this repository runs against the action
```

Each action also has an on-demand check workflow at `.github/workflows/<action-name>-check.yml`. It runs the action on a clean runner against the files in that action's `tests/` directory, so a change to the action can be proven before it ships. Adding an action means adding the directory above, its check workflow, and a row in the table.

## Secrets

The actions authenticate with `LT_USERNAME` and `LT_ACCESS_KEY` (TestMu dashboard, Settings > Keys), passed from repository secrets. The check workflows need the same two secrets on this repository.
