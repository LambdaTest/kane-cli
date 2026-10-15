# Updating the AGENTS.md integration

`AGENTS.md` at the repository root is a single-file mirror of the Kane CLI skill for any coding agent that reads an instruction file (Codex CLI, Cursor, GitHub Copilot, Windsurf, Amp, Jules, and others). `CLAUDE.md` and `GEMINI.md` at the root only import it, so Claude Code and Gemini CLI read the same copy. The canonical source is `skill-installer/skills/SKILL.md`. **Every time `SKILL.md` changes, `AGENTS.md` may need to change too.**

The same file is published at https://www.testmuai.com/kane-cli-agent/AGENTS.md (the website copy lives in the website repo at `public/kane-cli-agent/AGENTS.md`) and documented at https://www.testmuai.com/docs/kane-cli-agents-md/. Keep all three identical.

## How AGENTS.md differs from the skill

| The skill | AGENTS.md |
|---|---|
| Thin `SKILL.md` plus `references/*.md` read on demand | One self-contained file, always in context. No `references/` lookups |
| Ready check through `scripts/preflight.sh` | The documented fallback: `kane-cli whoami`, `kane-cli balance`, `kane-cli config show` |
| Result cards, first-run tour, three choices, saved preferences, live status strip | Not mirrored. One paragraph says what a report must contain |
| Exact card tables | Plain-language reporting rules |

Keep it around 200 lines. If a fact needs more than a few lines, link to the docs instead of pasting the reference.

## SKILL.md (+ references) → AGENTS.md mapping

| Canonical source | AGENTS.md section |
|---|---|
| `SKILL.md` intro, §1.2 (runtime tag, timeout), §3 (mandatory `run`, start URL) | Rules |
| `references/ready-check.md` sign-in rules, `references/setup-and-config.md` install | Install and sign in |
| `SKILL.md` §3 flag table and examples | Run a one-off browser task |
| `SKILL.md` §4 | Write the objective |
| `SKILL.md` §5, §1.5, §1.6, exit codes | Read the result |
| `references/testmd.md` quick start, cascade rule, `output-<stem>/`, `--name` | Save a test that replays |
| `references/testrun.md` command, selection, `--remote` | Run a suite |
| `SKILL.md` §6, `references/assurance.md` command block and §6.1 | Test cases from requirements |
| `SKILL.md` §2 Mobile, `references/mobile.md` | Mobile apps |
| `references/testmd.md` CI patterns, exit codes | Before you open a pull request |

## Rules

1. Don't invent facts that are not in `SKILL.md` or `references/*.md`.
2. Update the version line near the top (`kane-cli 0.x.y`) whenever you sync.
3. Every command in the file must run as written on the version named there.
4. `CLAUDE.md` and `GEMINI.md` stay as imports. Don't paste content into them.

## Verification checklist

- [ ] Every flag in AGENTS.md appears in `SKILL.md`, a reference, or `kane-cli <command> --help`
- [ ] Every `kane-cli testrun run` line ends in `< /dev/null`
- [ ] Every `kane-cli run` and `kane-cli testmd run` line has `--agent`
- [ ] Assurance commands use `--mode agent`, not `--agent`
- [ ] No line asks the user for a secret in chat
- [ ] The version line matches the release you synced to
- [ ] The website copy (`public/kane-cli-agent/AGENTS.md`) is byte-identical: `diff AGENTS.md <website-repo>/public/kane-cli-agent/AGENTS.md`
