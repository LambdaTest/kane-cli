# Using kane-cli from an AI coding agent

You can drive kane-cli by talking to your coding agent (Claude Code, Codex CLI, Gemini CLI, and others) instead of typing commands. The kane-cli skill teaches the agent how to check that everything is ready, run your request in a real browser, and show you the result. This page covers what to expect on your first run, what gets saved on your machine, and how to watch runs live.

## Install the skill

```bash
npx @testmuai/kane-cli-skill
```

This installs the skill for Claude Code, Codex CLI and Gemini CLI in one go, and creates the folder that holds your agent preferences. You also need kane-cli itself ([Installation](./installation.md)).

Then open your agent in a project and ask for something that needs a browser:

```text
check that the home page loads on my app
```

## What happens on your first run

1. **A ready check.** The agent runs one short script and shows a card: who is signed in, credits left, Chrome found, your app if it is already running locally, and where results will be saved. If something is missing, such as a sign-in, the card says so and offers the fix. The agent can open the sign-in page for you. It never asks you to paste an access key into the chat.
2. **The run starts straight away.** Nothing is asked first. The browser opens visibly so you can watch, unless you are on a machine with no display.
3. **A short tour while you wait.** A run takes from 30 seconds to a few minutes, so the agent uses that time to explain what kane-cli does: one-off runs, saved tests that replay in seconds, requirement-driven assurance, where runs land in Test Manager, and what an evidence pack is.
4. **A result card.** Pass or fail, what happened, credits used, a link to your evidence pack, a link to the test case in Test Manager, and two things the agent can do next.
5. **Three quick choices, asked once.** After you have seen a result, the agent asks whether to keep showing the browser, whether results are going to the right place, and whether you are doing one-off checks or building a saved suite. It never asks again.

From the second session on, the ready check shrinks to a single line and the tour is gone. Say "kane tour" any time to see it again.

## Your preferences

Your answers are saved in one small file next to kane-cli's own settings:

```text
~/.testmuai/kaneai/agent-config/config.json
```

| Preference | Values | Effect |
|---|---|---|
| Watch mode | `visible` · `quiet` · `results-only` | Show the browser window, run in the background, or run in the background and show only the result |
| Purpose | `one-off` · `suite` · `ask` | Whether the agent offers to keep passing runs as saved tests |

The file works across all your agents and projects. To change a preference, tell your agent ("kane preferences"), or set it yourself:

```bash
npx @testmuai/kane-cli-skill prefs --watch quiet --purpose suite
```

Deleting the file is safe. The agent falls back to sensible defaults and treats the next session as a first run.

### Where results are saved

Every run is saved as a test case in a Test Manager project and folder ([Test Manager integration](./test-manager-integration.md)). The ready check always shows which one. To move it, tell your agent "change project". The agent lists your projects, lets you pick or create one, and saves it.

This setting belongs to kane-cli, not to the agent, so a change applies to **every later kane-cli session for your sign-in**: every project folder, every agent, and the terminal. Tests you already ran stay in their original project.

## Watch runs live (Claude Code)

In Claude Code you can turn on a live status strip. While a run works, one line in your status bar names the current step:

```text
◆ kane run ▸ step 7 · clicking "Add to cart"          0:42
◆ kane test ▸ step 3 "Search for headphones" · replaying   0:12
◆ kane suite ▸ 5 of 12 · 4 ✓ 1 ✗ · now: login_test.md      2:10
◆ kane run ✓ passed · 12 steps · 1:54 · 58 credits
```

Your agent offers it once, after your first run. You can also manage it yourself:

```bash
npx @testmuai/kane-cli-skill strip enable      # turn it on
npx @testmuai/kane-cli-skill strip status      # check it
npx @testmuai/kane-cli-skill strip disable     # turn it off
```

What to know:

- **It keeps your existing status line.** Yours prints first, unchanged. The kane line appears under it only while a run is live and for five minutes afterwards.
- **Only the session that started the run shows it.** If you have several Claude Code sessions open, even in the same project, the others stay as they are. (On Windows, every session open in the run's project shows it for now.)
- **Turning it on edits `~/.claude/settings.json`.** A backup is kept next to it, and `strip disable` restores your original status line exactly.
- **It needs kane-cli 0.8.17 or newer and Node 18 or newer.**
- **It stays on your machine.** The strip reads two things kane-cli writes locally while it runs, a small pointer file for each live run and that run's event log. It makes no network calls.
- **It never shows what was typed.** A typing step appears as "typing in" plus the field's name.
- It picks up a run roughly 10 to 30 seconds after launch, once the browser is up and kane-cli has created the session. While a step is still working, the line shows the last finished action, marked `last:`.

Other agents have no scriptable status bar today, so the strip is not offered there. Everything else on this page works the same everywhere.

## What leaves your machine

Driving kane-cli through an agent changes nothing about what kane-cli uploads. By default each run is saved to your TestMu AI account as a Test Manager test case, with its screenshots and run details ([Test Manager integration](./test-manager-integration.md)). Evidence packs are sealed on your machine, and the evidence viewer reads them from your machine ([Evidence packs](./evidence.md)). The agent preferences file and the status strip are local only.

## Running with no person present

In CI, or with a cloud agent that cannot ask you anything, the agent skips the tour and the questions, runs headless with default settings, and does not write the preferences file. It still stops and reports clearly if kane-cli is not installed, not signed in, or out of credits. For pipelines, calling kane-cli directly is usually simpler: see [CI/CD recipes](./cicd.md).

## Next steps

- [Getting started](./getting-started.md): the same first run, typed by hand.
- [Running tests](./running-tests.md): objectives, flags and what a run does.
- [test.md files](./testmd/overview.md): keep a flow as a saved test that replays in seconds.
- [Evidence packs](./evidence.md): what every run captures and how to view it.
