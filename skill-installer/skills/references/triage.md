<!-- Read this when the quick debugging flow in debug.md did not explain a failure, when a run passed but looks wrong, when the person asks whose fault a failure is, or when they ask whether the triage written inside a pack is right. Owns the step sheet script, the triage steps, the screen table, the triage report and the cause buckets. The pack layout and join rules stay in debug.md. -->

# Triaging a run from its evidence pack

A pack records three views of every step: what the screen showed, what the agent meant to do, and what the logs say happened. A triage is a claim that holds in all three. **The screen can hold facts no log mentions** (a dialog, a toast, a spinner, an error banner, a keyboard), so the screenshots are read every time.

Pack layout, step identity and join rules: `references/debug.md`.

## 1. Steps

1. **Map the pack.** Run the step sheet. It joins step folders, the actions log, `auteur/execution.json` and `result.yaml` by `action_id`, prints `run.yaml` and the failure index, and lists the error lines of the run logs.

   ```bash
   node "<skill dir>/scripts/evidence-map.mjs" <pack.evidence> --out <new empty dir>
   node "<skill dir>/scripts/evidence-map.mjs" <extracted pack dir> [--test <test id>]
   ```

   The first form unzips the pack into the folder you name, which must be empty. A merged or suite pack holds many tests: take them one at a time from the failure index, with `--test`.

2. **Frame the run** from `run.yaml` and `result.yaml`: `run_kind` (`author` or `replay`), `origin`, the kane-cli version, and the environment. A replay repeats recorded actions, so a wrong choice of action belongs to the run that authored the test, not to this one.

3. **Read every log signal** the sheet printed, in the log itself, with the lines around it. A sign-in, network or browser error here outranks any step-level story. The sheet only matches patterns: search the logs yourself for the failing step, by the action's `at=` time.

4. **Pick the window.** The step carrying the failure record, the step before it, and the step after it when one exists.
   - Check the sheet's `UNMAPPED` list first. An action with no step folder ran without a screenshot of its own, and it can be what ended the run.
   - Add an earlier step of the same kind as the failing one, with the step after it. A before and after pair of the same action that worked is the cheapest comparison.

5. **Fill one screen row per window step** (the table in §2). For each:
   - Open `screenshot.*` with your image-reading tool. Open `annotated.*` too when present.
   - Take the intent from the sheet: the authored `intent`, `instruction`, `reasoning` and `inside`, then the action's instruction, `params` and `rationale`. When the instruction text disagrees with the action type or the rationale, say so and trust the screenshot.
   - Compare the screen to the intent.
   - Prove the effect from the **next** step's screenshot: a step's own screenshot is taken before its action runs. If no later screenshot exists, write "not provable from the screen" and name the log line you used in its place.

6. **Check the triage inside the pack.** A step `failure.yaml` with a `triage:` block is a claim written by an automatic investigation. State whether the screen table and the logs support it.

7. **Name one cause** (§3) and report.

## 2. Report

The report has these six parts, in this order:

1. **Verdict.** One or two sentences: what failed, and the cause.
2. **Screen table.** Required, one row per window step:

   | Step folder | Mapped by | Screenshot opened | What the screen shows | What the agent was doing | Screen vs intent | Effect seen in next screenshot |
   |---|---|---|---|---|---|---|

   `Mapped by` is `id`, `action_id` or `ordinal`. A step folder with no image names the earlier image it borrows. An action with no step folder gets one row with "no image": the last folder's screenshot was taken before it and is not its screen.
3. **Log evidence.** Each claim with the file and line inside the pack.
4. **Triage inside the pack.** Agree or disagree, and why. "None in pack" when absent.
5. **Other findings.** Defects the pack shows that did not cause this failure, such as a step that passed without changing the screen. "None" when absent.
6. **Not determined.** What the pack cannot show, and what would settle it (a re-run, a look at the app, a bug report).

Label anything you have not tested as a hypothesis.

Give the person the verdict in plain words first. Show the table and the rest when they ask for the detail, or when the cause is not the obvious one.

## 3. Causes

Pick the earliest fault the pack proves.

| Cause | Typical sign | What to do next |
|---|---|---|
| The app under test | The screenshot shows the product misbehaving: an error banner, a wrong value, a button that does nothing | Tell the person it is a product bug and show the screenshot. Do not change the test to get around it |
| The test or the objective | `test.md` asks for something ambiguous, impossible, or no longer true of the app | Fix the wording. For a designed test, read `references/assurance.md` §6.1 first |
| The environment | Sign-in, network, browser or device errors in the logs around the failing step | Fix the setup and run again (`references/setup-and-config.md`) |
| kane-cli | The screen was right and the step was clear, and the action was still wrong or did not take effect; or a replay fails a step that the authoring run passed on the same screen | Offer a bug report (`references/debug.md` §Filing a bug report) |

## 4. Common mistakes

| Mistake | Fix |
|---|---|
| Matching a screenshot to a step by step number | Step numbers are counted per file. Use the sheet's join |
| Reading a screenshot as the result of its step | It is the screen before the action. Look one step later |
| Trusting a `passed` step | Passed means the action returned, not that the screen changed |
| Blaming the step that carries the failure record | Check the `UNMAPPED` list for actions after it first |
| Repeating the triage inside the pack | Check it against the log signals and the screen table first |
| Reading an off-target marker as a wrong click | The marker is drawn on a screenshot taken before the action. Confirm the click in the actions log |
| Quoting `*.har` content | It can carry credentials. Cite the request, never the secret |
