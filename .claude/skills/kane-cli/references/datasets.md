# Dataset parameters

`run`, `testmd run`, and `testrun run` accept `--dataset-id <id>` and `--dataset-row <row-id>`. The row value is the dataset row's `_id`, **not** its position or number. Dataset access requires authenticated Test Manager access; the selected dataset is fetched afresh per run.

```bash
kane-cli testmd run checkout_test.md --agent --dataset-id <dataset-id> --dataset-row <row-id>
kane-cli testrun run tests/ --dataset-id <dataset-id> --dataset-row <row-id> < /dev/null
```

A saved test can select the dataset in root frontmatter:

```yaml
dataset:
  id: <dataset-id>
  row: <row-id>
```

A scalar `dataset: <dataset-id>` also selects an id. Each CLI flag overrides its corresponding frontmatter value independently. Use `${column}` for dataset columns; `{{name}}` remains the separate variables/secrets path. Do not interchange the two syntaxes. Unknown columns, missing rows or unavailable datasets fail resolution before execution; fix the selection or data rather than retrying unchanged.

Inputs are saved under `dataset/<id>.json` with the run. Frontend requests carry the dataset identity rather than embedding all row values. Treat saved inputs as test artifacts with the same access controls as the source dataset.

Resolve the dataset and row id from the user’s Test Manager data; never guess an id or substitute a row position.
