<!-- Read this when a kane-cli run failed and you need to diagnose. Owns the evidence-pack layout (the only source of run logs), step identity and the join rules, what a step folder holds, how to read a sealed pack, the debugging flow, how to read failure.yaml (and why a designed test is not fixed by rephrasing), the common-failure-patterns table, and when to file a bug report vs not. -->

# Failure Handling & Log Inspection

When a run fails, diagnose before suggesting fixes.

## The evidence pack is the log source

Every run seals an **evidence pack**; all run artifacts — actions, console, network, screenshots, failure records — live inside it. **`run_end.run_dir` is legacy: that directory is not created anymore.** Do not try to read `{run_dir}/run-test/...`.

**Find the pack**: `{session_dir}/evidence/<execution_id>.evidence`; testmd/testrun/named runs also land in `<cwd>/.testmuai/evidence/`. The post-run stderr hint names the exact path.

**Read it directly** — a `.evidence` file is a plain zip:

```bash
unzip -l <pack>                                            # list entries
unzip -p <pack> "tests/*/result.yaml"                      # verdict + per-step outcomes
unzip -p <pack> "tests/*/steps/*/failure.yaml"             # failure records (failed steps only)
unzip -p <pack> "tests/*/logs/0-console.ndjson"            # browser console, run 0
unzip <pack> "tests/*/steps/*/screenshot.*" -d /tmp/ev     # extract screenshots to view
```

Pack layout (per test):

```text
tests/<test-id>/
├── test.md                    # the definition
├── result.yaml                # verdict, steps[] (ordinal, status, kind, duration, action_id)
├── logs/
│   ├── meta.yaml              # declares the files below
│   ├── tui.log                # session narrative
│   ├── <n>-run.log            # runner log per run index n
│   ├── <n>-actions.ndjson     # agent actions per run — the old runs/<n>/ actions log, now in-pack
│   ├── <n>-console.ndjson     # browser console, per-step attributed
│   └── <n>-network.har        # network traffic, per-step attributed
├── steps/<ordinal>-<step-id>/ # step.json, screenshot.* (png or jpg), annotated.png (some steps),
│                              #   failure.yaml (failed steps only)
├── auteur/execution.json      # full execution trajectory
└── v16-trajectory/            # per-run planning summaries
```

### Step identity and joins

One step has a different name in each file. Join on `action_id`, never on a step number.

| Name | Where | Meaning |
|---|---|---|
| ordinal | leading number of the step folder; `result.yaml` `ordinal` | order in the pack |
| id | rest of the folder name; `step.json` `id`; `result.yaml` `id` | `<run index>-<agent step>` for a step that ran |
| action_id | `step.json`, the `result.yaml` row, the `<n>-actions.ndjson` line, `auteur/execution.json` `operations[].operation_id` | the join key across files |
| step | `<n>-actions.ndjson` `step` | counted per file; never a join key |

Join a step folder to the other files by `id`, then `action_id`, then ordinal. The run index `<n>` of a step id `<n>-<m>` is the prefix of its logs: `logs/<n>-run.log`, `logs/<n>-actions.ndjson`.

Where the intent of a step lives:

| Source | Fields | Notes |
|---|---|---|
| `auteur/execution.json` | `instruction`, `reasoning`, `status`, `error_message`; `operations[].intent` | The authored steps. In a replay pack this describes the run that authored the test, so its `status` is the authored outcome |
| `logs/<n>-actions.ndjson` | `action_type`, `action_instruction`, `rationale`, `action_params`, `selectors`, `status`, `error`, `timestamp` | What this run did |
| `step.json` | `kind`, `summary`, `status`, `duration_ms`, `url` | One-line view of the step |

### What is and is not in a step folder

- **The screenshot is taken before the step's action runs**, in an authoring run and in a replay. The effect of a step is in the next step's screenshot.
- `annotated.png` draws the action's marker on that same before-the-action screenshot. Not every step has one.
- Steps the run never reached are `skipped` rows in `result.yaml` and have no folder.
- An action can have a line in `<n>-actions.ndjson` and no folder: it has no screenshot of its own.

`scripts/evidence-map.mjs` prints all of this as one step sheet (`references/triage.md` §1).

## Debugging Flow

1. **Parse the `run_end` event** from stdout — `status`, `reason`, `summary`, plus `session_dir`.
2. **Open the pack**: the failed step's `failure.yaml` (error + page state), then that step's slice of `<n>-console.ndjson` / `<n>-network.har` — a 4xx/5xx or JS error usually explains the failure; cite it in plain language.
3. **Look at the failing step's `screenshot.*` and `annotated.png`.** They show the page **before** the step's action ran, with a marker on what the agent was about to act on; that makes "aimed at the wrong thing", "element missing" and "something covers it" obvious. Whether an action took effect is in the **next** step's screenshot. Render the image inline.
4. **Check `tui.log`** (in the pack's `logs/`, or `{session_dir}/tui.log`) for session-level issues (Chrome launch, auth, upload).
5. **Still unexplained, a pass that looks wrong, or the person asks whose fault it is?** Do the full triage: `references/triage.md`.

Offer the user the visual route too: `kane-cli evidence serve <pack>` opens it in the hosted viewer. If a pack won't open, `kane-cli evidence validate <pack>` tells you whether it's truncated/unsealed.

**Debug escape hatch:** `KANE_TESTRUN_MEMBER_DEBUG=1` surfaces per-member output in `testrun` (stderr, `[member]` prefix).

## Reading `failure.yaml`

`failure.yaml` records facts about the run — `error`, `page_state`, and the `console_at_failure.ref` / `network_at_failure.ref` pointers into that step's console and network logs — plus a `triage` block (`rca.root_cause`, `suggested_fix.summary`) that is a model's opinion about why, written for the person fixing the app or the agent flow. Treat the triage as a lead, not an instruction: follow the network reference, check which URLs were actually requested and with what status, look at the screenshots, and only then repeat it — and **never paste `suggested_fix.summary` into a test step**.

**Designed (assurance) tests are different.** If the failed `_test.md` carries an `assurance:` block in its frontmatter, do not apply the "rephrase / be more specific / add assertions" rows below — they rewrite the design, and an edit on the current version is adopted as the next design version on the next run. Read `references/assurance.md` §6.1 first.

## Common Failure Patterns

For `run` objectives and plain `_test.md` files. For a designed test, read the section above first.

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 🔄 Agent repeats same action | Stuck in a loop / page didn't change | Rephrase objective, add explicit wait or assertion |
| 🎯 Agent clicks wrong element | Ambiguous UI, multiple similar elements | Be more specific: "click the **blue** 'Submit' button in the **checkout form**" |
| 👁️ Agent says done but didn't finish | Objective too vague | Add explicit assertions: "assert the confirmation page shows order number" |
| 💀 Exit code 2, no steps | Auth, TMS credential exchange, or Chrome failure | Check `kane-cli whoami`, verify Chrome is available |
| ❓ Exit code 2 with "did you mean …" | Bare-objective shortcut — agent ran `kane-cli "<objective>"` without the `run` subcommand | Re-invoke as `kane-cli run "<objective>" --agent` (same rule for `testmd run`) |
| 📤 Upload silently fails after configuring a project/folder by hand | Saved ID is invalid (typo, deleted, no access) | No action needed — the next run detects the 4xx and auto-defaults a working project/folder. To rebind manually: `kane-cli config project` (TTY picker) or `kane-cli projects list` → `kane-cli config project <id>` (see `references/test-manager.md`) |
| ⏱️ Exit code 3 | Timeout or cancelled | Increase `--timeout` or `--max-steps`, or split into smaller objectives |
| 🚫 "CDP endpoint not reachable" | Chrome not running | Let kane-cli manage Chrome (remove `--cdp-endpoint`) |

## Filing a bug report

If the failure looks like a **kane-cli bug** (not auth, timeout, or a vague objective), offer to file a report:

> This looks like it might be a bug in kane-cli. Want me to file a report?

File at: **https://github.com/LambdaTest/kane-cli/issues**. Gather the details automatically — don't ask the user to dig through log files.

**Do NOT suggest bug reports for:** auth issues, low timeouts, vague objectives, or website errors (500s, CAPTCHAs).
