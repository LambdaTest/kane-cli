# Testing the kane-cli skill and installer

Two layers. The automated layer runs on every pull request and needs nobody. The manual layer is a matrix of agents, operating systems and cases that a person walks through before a release, because only a person can judge what an agent actually said.

## 1. Automated (every pull request)

```bash
cd skill-installer && npm test
```

The `Skill installer tests` workflow runs this on **ubuntu, macos and windows**, each with **Node 18 and 22**, then checks that the three skill copies are identical and that the npm package ships `lib/`, `strip/` and `skills/scripts/` but not the tests.

| Area | What is covered |
|---|---|
| `strip/kane-strip.mjs` | Every line the strip can print, from sanitized captures of real kane-cli 0.8.17 runs (`test/fixtures/`): run, saved test authored and replayed, suite with a failure. Typed text never echoed. One strip per session. Finished runs expire after five minutes |
| `lib/strip-install.mjs` | Turning the strip on wraps an existing status line, keeps every other setting, backs up once, is safe to run twice. Turning it off restores the original exactly |
| `lib/strip-prompt.mjs` | The installer asks only a person at a terminal. Unattended installs never ask and never turn the strip on. A missing answer is a no |
| `lib/agent-config.mjs` | Preferences merge, unknown keys kept, bad values rejected with the allowed list, seeding never overwrites |
| `skills/scripts/preflight.sh` | Section order, a missing kane-cli, the mobile and grid flags, parallel calls, temp folder cleanup (Linux, macOS) |
| `skills/scripts/preflight.ps1` | The same contract, run for real under Windows PowerShell against a stand-in `kane-cli.cmd` (Windows only) |

Refresh the fixtures when the kane-cli stream changes: capture `kane-cli run`, `testmd run` (twice) and `testrun run` with `--agent` or piped stdout, then replace home paths, internal hosts, share tokens and ids before committing. The repo is public.

## 2. Manual matrix (before a release)

### Hosts

| Host | How it finds the skill | Asks with | Notes |
|---|---|---|---|
| Claude Code | `~/.claude/skills/kane-cli` (user level wins over a project copy) | Question tool | The only host with the live strip |
| Codex CLI | `~/.agents/skills/kane-cli` (a project copy in `.agents/skills` wins inside a repo that has one) | A question tool that returns before the person answers | Its sandbox blocks network and writes outside the workspace. kane-cli needs both, so expect an approval per command, or a relaxed sandbox. Answers to the choices arrive as the next message |
| Gemini CLI | `~/.gemini/skills/kane-cli` | Chat | Its file tools are confined to the workspace, so the preferences file must be written through the shell |
| OpenCode | Auto-loads `~/.claude/skills` and `~/.agents/skills` | Chat | Nothing extra to install |
| Hermes | Its own skill folders. **Not installed by our installer today** | Chat | Known gap. Its terminal can run in a container, where `~` is not the person's home |
| Copilot CLI, Cursor, Kiro | Host specific. Kiro uses `integrations/kiro-powers/` | Chat | Kiro has no preflight script: it builds the ready card from three commands |

Run each host on **macOS** and on **Windows**. On Windows also run once from PowerShell and once from Git Bash if the host supports both.

### Before each pass: reset to a first session

```bash
mv ~/.testmuai/kaneai/agent-config ~/.testmuai/kaneai/agent-config.bak 2>/dev/null
npx @testmuai/kane-cli-skill          # or: node skill-installer/cli.js install
```

Restore afterwards by moving the folder back. On Windows the folder is `%USERPROFILE%\.testmuai\kaneai\agent-config`.

### Cases

Mark each cell pass, fail or not applicable. "Says" means in plain words: no event names, no field names, no paths the person does not own.

**A. Install**

| # | Case | Expected |
|---|---|---|
| A1 | Fresh install | Three agents listed, welcome text, `agent-config/config.json` holds `{"version": 1}` |
| A2 | Install over an older copy | Old files gone, `VERSION` updated, preferences untouched |
| A3 | Install by hand in a terminal, Claude Code present | Asks "Turn it on? (recommended) [Y/n]". `n` leaves settings untouched and never asks again. Enter turns it on with a backup |
| A4 | Unattended install (piped, CI) | No question. Settings untouched. Strip off |

**B. Ready check**

| # | Case | Expected |
|---|---|---|
| B1 | Everything in place, first session | Full emoji table. No `Expires` line. Environment named only when it is not production |
| B2 | Second session | One line: ready, credits, project and folder |
| B3 | Not signed in (`kane-cli logout` first) | Card stops the run, agent offers to open the sign-in page and runs `kane-cli login --oauth` itself. Never asks for an access key |
| B4 | kane-cli not on PATH | Card says it is not installed and offers to install it. Nothing else crashes |
| B5 | No display (SSH session) | Run is headless. Sign-in falls back to "run `kane-cli login` in your terminal" |
| B6 | Mobile request | Preflight gets `--mobile emulator` or `simulator`, card gains a device tooling row |

**C. First run**

| # | Case | Expected |
|---|---|---|
| C1 | Any browser request | Nothing is asked before the result. Launch line and the tour arrive in one message |
| C2 | The tour | Word for word as in `references/first-run.md`, "you are here" on the right item, five working doc links |
| C3 | The command | Tagged inline with the host's name, launched with `--name`, browser visible when there is a display |
| C4 | First result card | Emoji table with credits, an evidence viewer link that opens, a Test Manager link, two next moves |
| C5 | Choices after the result | Watch mode, results location, purpose. In Claude Code a fourth: the live strip, recommended first. They are the **last thing on screen**, after the result card. Chat hosts get one numbered message where "ok" keeps the defaults |
| C6 | Saving, part one | Right after the result card and before the questions, `agent-config/config.json` exists with the defaults this run used. Check the file even if you answer nothing |
| C6b | Saving, part two | Answer the choices (in the same turn, or as your next message on Codex and chat hosts): the file is rewritten with your answers, existing keys kept |
| C6c | Ignore the choices and ask for something else | Defaults kept, not asked again, and the next session shows no tour |
| C7 | Write refused (Codex default sandbox) | Answers still apply this session, the `npx ... prefs` one-liner is shown once, no nagging |

**D. Later sessions**

| # | Case | Expected |
|---|---|---|
| D1 | New session after onboarding | No tour, no questions |
| D2 | `watch: quiet` | Runs get `--headless` |
| D3 | `purpose: suite` or `ask` | Every one-off run gets `--name`, and the agent offers to keep it. Declining removes the test file |
| D4 | "kane preferences", "kane tour", "change project" | Each works on request |

**E. Result cards**

| # | Case | How to trigger | Expected |
|---|---|---|---|
| E1 | Passed | Any simple check | Table in the fixed row order |
| E2 | Failed | Verify text that is not on the page | Failed at step N, likely cause, screenshot under the card |
| E3 | Didn't start | Use `{{missing_value}}` in the objective | Yellow card, names what is missing, a secret-looking name is sent to the variables file and never asked for in chat |
| E4 | Stopped early | `--timeout 5` | Yellow card with what was done |
| E5 | Saved test, first run then again | `kane-cli testmd run` twice | "Recorded for the first time", then "Replayed from its recording, no AI cost" |
| E6 | Suite with one failure | Two tests, one wrong | Rollup, then only the failed test listed with where and why |
| E7 | Suite that cannot start | Tests from two projects | Didn't start card, one line per rejected test |

**F. Changing where results go**

| # | Case | Expected |
|---|---|---|
| F1 | Pick an existing project | Projects listed with the current one marked, the question says the change is global, project then folder saved as a pair |
| F2 | A name that does not exist | Agent searches, then creates it, then a folder |
| F3 | Folder holds saved tests | Agent warns about cloud grid suites before switching |
| F4 | After the change | The next run's Test Manager link is in the new project. Known kane-cli bug: `config show` keeps the old names after a change by id |

**G. Live strip (Claude Code)**

| # | Case | Expected |
|---|---|---|
| G1 | Default | Off. Only ever on after a yes |
| G1b | Onboarding done in another agent first (run Codex, then open Claude Code) | Claude Code shows no tour and no three choices, but asks the strip question once after its first result, recommended option first. `strip.claude-code.offered_at` is set afterwards, and a third session asks nothing |
| G2 | Turn on with an existing custom status line | Yours prints first, unchanged. Backup file written once |
| G3 | During a run | Line appears 10 to 30 seconds in, names steps, never shows typed text |
| G4 | **Two sessions open in the same project** | Only the session that started the run shows the line. On Windows both show it for now |
| G5 | After the run | Passed or failed line for five minutes, then gone |
| G6 | Turn off | Original status line back, exactly |
| G7 | No Node, or kane-cli older than 0.8.17 | The agent does not offer the strip |

**H. Nobody present**

| # | Case | Expected |
|---|---|---|
| H1 | Host's headless mode (`claude -p`, `codex exec`, `gemini -p`, `opencode run`) | No tour, no questions, headless run, preferences file not written, result card still shown |
| H2 | `CI=true` | Same |

### Reporting

For each failure note the host and its version, the operating system and shell, kane-cli's version, the case number, and what the agent said, copied as is.
