# Kane CLI: instructions for AI coding agents

Instructions for AI coding agents (Claude Code, Codex CLI, Gemini CLI, Cursor, GitHub Copilot, Kiro, Windsurf, Aider and others) working in this repository. Use them whenever a task needs a real browser, a native mobile app, or test cases.

Kane CLI (`kane-cli`) is an agentic quality verifier from TestMu AI. It runs your app the way a user would, in real Chrome, on an Android emulator or on an iOS simulator, and returns a pass or fail backed by an evidence pack. Its job is to give you quality signals you can defend, not click-throughs you have to trust.

Source: https://www.testmuai.com/kane-cli-agent/ · Skill version: mirrors `skill-installer/skills/SKILL.md` in https://github.com/LambdaTest/kane-cli (kane-cli 0.8.23).

## Rules

1. Use `kane-cli` for every task that needs a real browser: navigating, clicking, filling forms, verifying UI, taking screenshots, reading a value off a rendered page, or smoke-testing a deploy. Do not use Playwright, Puppeteer or Selenium directly.
2. Never write test cases by hand, in chat or in scratch files. Test cases come from the assurance commands (see "Test cases from requirements").
3. Always pass `--agent` to `kane-cli run` and `kane-cli testmd run`. It switches stdout to NDJSON, one JSON event per line.
4. End every `kane-cli testrun run` command in `< /dev/null` (`< NUL` in cmd.exe). Without it the command opens a terminal view that never exits.
5. The `run` subcommand is mandatory. `kane-cli "<objective>"` does not work and exits `2`.
6. Every run needs a start URL. Start the objective with the site ("Go to https://... and ..."), or pass `--url`.
7. Never ask for an access key, password or token in chat, and never echo one back. Secrets go in a variables file the user fills in.
8. Prefix every command with `KANE_CLI_USER_AGENT=<your-runtime>` (for example `claude-code`, `codex`, `gemini`, `cursor`, `kiro`). Do it inline on each command: an `export` does not survive between shell calls in most agent hosts.
9. Browser runs take from 30 seconds to a few minutes. Give your shell tool a long timeout (up to 10 minutes).

## Install and sign in

```bash
npm install -g @testmuai/kane-cli          # Node 18+. Or: brew install LambdaTest/kane/kane-cli
kane-cli whoami                            # Check sign-in
kane-cli login --oauth                     # Opens the sign-in page in the user's browser
```

On a machine with no browser window (CI, a sandbox, SSH), sign in with Basic Auth from the CI secret store:

```bash
kane-cli login --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"
```

Before the first run of a session, check readiness with `kane-cli whoami`, `kane-cli balance` and `kane-cli config show`. If the user is not signed in, offer `kane-cli login --oauth`. Chrome must be installed for local browser runs.

## Run a one-off browser task

```bash
kane-cli run "<objective>" --agent [flags]
```

| Flag | Purpose | Default |
|---|---|---|
| `--headless` | No visible browser window. Use it in CI, over SSH, or with no display | Off |
| `--timeout <s>` | Hard stop after N seconds | No limit |
| `--max-steps <n>` | Cap on agent reasoning steps | 30 |
| `--url <url>` | Start URL for the run | Config `default_url` |
| `--variables <json>` | Inline variables for `{{key}}` in the objective | None |
| `--variables-file <path>` | Variables from a JSON file | None |
| `--name <slug>` | Records the run as a `_test.md` so it can be kept | Off |
| `--ws-endpoint <url>` | Use a remote browser on the TestMu AI grid | Local Chrome |

```bash
# One-off check
kane-cli run "Go to https://app.example.com and verify the login page loads" --agent --headless --timeout 120

# With credentials from a variables file (keeps secrets out of the transcript)
kane-cli run "Go to https://app.example.com, log in with {{username}} and {{password}}, then verify the dashboard heading is visible" \
  --agent --headless --variables-file .testmuai/variables/staging.json
```

## Write the objective

The objective string decides what the run does.

| Pattern | Trigger words | What happens |
|---|---|---|
| Action | go to, click, type, search, fill | Performs browser actions |
| Assertion | assert, verify, confirm, check that | A pass or fail check on the page state |
| Extraction | store X as 'name' | Saves a value into `run_end.final_state` |
| API call | call, POST/GET a URL, a pasted curl | The agent makes the HTTP request itself |

- End every flow in an assertion about what is on screen: `verify the cart shows 1 item`, not `click Submit`. A run with no verify or assert gets no replayable pass or fail.
- Assert the outcome, not the trigger. `verify the Submit button is visible` fails exactly when the submit worked.
- Use "store as" to extract data. `read the price` or `tell me the price` does not reliably capture a value. Write `store the displayed price as 'price'`.
- Refer to a stored value in plain English (`the stored price value`), never as `{{price}}`. `{{name}}` is only for variables and secrets.
- Phrase actions as goals (`log in with {{user}}`) and keep data literal or in `{{variables}}`.
- Put a sometimes-there element, such as a cookie banner, in an `if/else`.
- Keep one objective under about 15 steps. Split longer flows into separate runs.
- Write objectives that never need input mid-run. Prompts are disabled when stdin is not a terminal, so a step that waits for an answer fails.

```text
Go to https://shop.example.com, search for "wireless headphones", open the first result,
store the displayed price as 'price', then verify the page title contains "headphones"
```

## Read the result

Stdout is NDJSON. On 0.8.17+ the first line is `{"type":"stream_start", ...}`.

- Progress events have `step`, `status` (`running`, `done`, `failed`) and `remark`, and no `type` field.
- Typed events have a `type`: `bifurcation`, `child_agent_start`, `child_agent_end`, `error`, `warning`, `project_folder_auto_defaulted`, and finally `run_end`.
- `run_end` is always the last line of a one-off run. Its fields: `status`, `summary`, `one_liner`, `duration`, `credits_consumed`, `final_state` (stored values), `test_url` (the test case in Test Manager), `session_dir`, `run_dir`.
- Ignore fields and event types you do not recognise. New ones can appear in any release.

```bash
kane-cli run "..." --agent --headless | tail -1 | jq -r '.status, .summary'
kane-cli run "..." --agent --headless | tail -1 | jq -r '.final_state.price'
```

| Exit code | Meaning |
|---|---|
| `0` | Passed |
| `1` | Failed: the objective ran but did not pass |
| `2` | Did not start: auth, setup, Chrome, network or parse error |
| `3` | Timeout or cancelled |

Report the result to the user in plain language, not as raw JSON or internal field names. Include: passed or failed, what happened (`summary`), duration, credits used, any stored values, and the Test Manager link (`test_url`). On a failure, name the failing step and its `remark`, give your diagnosis (missing element, slow page, ambiguous objective, auth wall), and offer a retry. Exit `2` means nothing ran: report it as "did not start" with the fix, not as a test failure.

Every run also seals a `.evidence` pack in `.testmuai/evidence/` with step traces, screenshots, video, and network and console logs. Open one with `kane-cli evidence serve <path>`. Do not commit `.testmuai/evidence/`.

## Save a test that replays

When the user wants to keep, commit or re-run a test, write a `_test.md` file and run it with `kane-cli testmd run`. The first run records each step. Later runs replay from the recording with no AI cost, as long as the step text does not change.

```markdown
---
mode: testing
max_steps: 30
---

# Checkout smoke test

## Open the store
Open https://shop.example.com.

## Add an item
Search for "wireless headphones", open the first result and add it to the cart.
Verify the cart shows 1 item.
```

```bash
kane-cli testmd run tests/checkout_test.md --agent --headless
```

- The file name must end in `_test.md`.
- Under `--agent`, wait for the `test_md_done` event (`overall_status`, `duration_s`, `session_id`). A `run_end` inside the stream only finishes one step.
- Editing step N re-records step N and every step after it. Edit only the step that changed.
- Commit the `output-<stem>/` folder next to each test. That is how teammates and CI replay the same recording.
- To keep a one-off run, launch it with `--name <slug>`. kane-cli writes `.testmuai/tests/<slug>_test.md`, which you move into the repo.

## Run a suite

```bash
kane-cli testrun run --match '^tests/' --parallel 4 --headless < /dev/null   # Every *_test.md under tests/
kane-cli testrun run --tags smoke --dry-run < /dev/null                      # Preview the plan, run nothing
kane-cli testrun run --tags smoke --remote --dry-run < /dev/null             # Same suite on the HyperExecute grid
```

With no paths, `testrun run` picks up every `*_test.md` under the current directory; explicit paths must end in `_test.md`. Use it for two or more saved tests. Do not loop over `testmd run` in bash. The suite produces one summary, one exit code and one evidence pack, and ends with a `testrun_done` event. `--remote` needs `kane-cli plugin install remote-execution` and a HyperExecute plan. Always `--dry-run` a remote suite first.

## Test cases from requirements

Never draft test cases yourself. Kane CLI designs them from requirements, links each test to the requirement it verifies, and accounts for coverage.

- The user has a PRD, spec or acceptance notes: ingest them, then design.
- The user only describes what to test in chat: write their words, unchanged, to `requirements/<feature>.md`, tell them the file exists, then ingest and design from it.

```bash
kane-cli context ingest requirements/checkout.md --mode agent   # Snapshot the document, extract use cases
kane-cli design tests --use-case <ref> --mode agent             # Acceptance criteria, scenarios, one test per scenario
kane-cli cover                                                  # What evidence proves vs what the requirements owe
kane-cli cover gaps                                             # What to design next
kane-cli maintain reconcile --from requirements/checkout-v2.md --source-id <id> --mode agent   # A requirement changed
```

The assurance commands take `--mode agent`, not `--agent`, and their stream ends in a `done` event. For these commands only, exit `3` means paused and resumable, not timeout. Show the user the extracted use cases and the designed tests for review before running anything. A designed `_test.md` carries an `assurance:` block: when one fails, decide first whether the app is broken, the requirement changed, or the wording is wrong, before you edit the file.

## Mobile apps

The browser is the default target. To drive a native app, pass `--target emulator` (Android) or `--target simulator` (iOS) with `--app <build path or APP ID>`. Mobile runs never take a URL.

```bash
kane-cli doctor --target simulator                    # Check local tooling, with a fix per row
kane-cli run "Open the app and verify the login screen appears" --agent --target simulator --app ./build/MyApp.app
```

Local mobile runs need macOS on Apple Silicon. From any other machine, run saved mobile tests on the cloud grid: `kane-cli testrun run <paths> --remote --device-name "Pixel 7" --os-version 14 < /dev/null`. Never tell a user mobile testing is impossible on their machine. Point them at `--remote`.

## Before you open a pull request

When the user asks you to gate your own work on a browser check:

1. Run the committed tests, not new objectives: `kane-cli testmd run tests/login_test.md --agent --headless`, or `kane-cli testrun run --tags smoke --headless < /dev/null`.
2. Exit `0`: continue with the commit or PR.
3. Any other exit code: stop, read `output-<stem>/Result.md` for the failing step, and report that step to the user with its screenshot instead of pushing.

## More

- Docs: https://www.testmuai.com/docs/kane-cli-agents-md/
- Full skill with references (Claude Code, Codex CLI, Gemini CLI): `npx @testmuai/kane-cli-skill`
- CLI reference: https://www.testmuai.com/docs/kane-cli-cli-reference/
- Source and issues: https://github.com/LambdaTest/kane-cli
