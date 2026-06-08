<!-- Read this when a kane-cli run failed and you need to diagnose. Owns log file locations (session_dir/run_dir/actions.ndjson/tui.log), the debugging flow, the common-failure-patterns table, and when to file a bug report vs not. -->

# Failure Handling & Log Inspection

When a run fails, diagnose before suggesting fixes.

## Log Locations

The `run_end` event provides `session_dir` and `run_dir` paths. Use those directly.

```text
{session_dir}/
├── session.json               # Session metadata, run list, upload status
├── tui.log                    # Timeline: session start, run start/end, errors
└── runs/{n}/
    └── run-test/
        └── actions.ndjson     # Step-by-step record of agent actions
```

## Debugging Flow

1. **Parse the `run_end` event** from stdout — it has `status`, `reason`, and `summary` plus the `session_dir` / `run_dir` paths.
2. **Read `actions.ndjson`** in `{run_dir}/run-test/` — each line is one agent action with its intent and outcome.
3. **Check `tui.log`** in `{session_dir}/` — for session-level issues (Chrome launch, auth, upload).

## Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 🔄 Agent repeats same action | Stuck in a loop / page didn't change | Rephrase objective, add explicit wait or assertion |
| 🎯 Agent clicks wrong element | Ambiguous UI, multiple similar elements | Be more specific: "click the **blue** 'Submit' button in the **checkout form**" |
| 👁️ Agent says done but didn't finish | Objective too vague | Add explicit assertions: "assert the confirmation page shows order number" |
| 💀 Exit code 2, no steps | Auth, TMS credential exchange, or Chrome failure | Check `kane-cli whoami`, verify Chrome is available |
| ❓ Exit code 2 with "did you mean …" | Bare-objective shortcut — agent ran `kane-cli "<objective>"` without the `run` subcommand | Re-invoke as `kane-cli run "<objective>" --agent` (same rule for `testmd run` / `generate`) |
| 📤 Upload silently fails after configuring a project/folder by hand | Saved ID is invalid (typo, deleted, no access) | No action needed — the next run detects the 4xx and auto-defaults a working project/folder. To rebind manually: `kane-cli config project` (TTY picker) or `kane-cli projects list` → `kane-cli config project <id>` (see `references/test-manager.md`) |
| ⏱️ Exit code 3 | Timeout or cancelled | Increase `--timeout` or `--max-steps`, or split into smaller objectives |
| 🚫 "CDP endpoint not reachable" | Chrome not running | Let kane-cli manage Chrome (remove `--cdp-endpoint`) |

## Filing a bug report

If the failure looks like a **kane-cli bug** (not auth, timeout, or a vague objective), offer to file a report:

> This looks like it might be a bug in kane-cli. Want me to file a report?

File at: **https://github.com/LambdaTest/kane-cli/issues**. Gather the details automatically — don't ask the user to dig through log files.

**Do NOT suggest bug reports for:** auth issues, low timeouts, vague objectives, or website errors (500s, CAPTCHAs).
