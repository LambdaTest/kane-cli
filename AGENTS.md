# AGENTS.md

Kane CLI's instructions for coding agents live in the skill at [`.agents/skills/kane-cli/SKILL.md`](.agents/skills/kane-cli/SKILL.md), with details in [`.agents/skills/kane-cli/references/`](.agents/skills/kane-cli/references/). Read `SKILL.md` before you run any `kane-cli` command.

## Add Kane CLI to your own repo

- **One file for any agent:** copy [testmuai.com/kane-cli-agent/AGENTS.md](https://www.testmuai.com/kane-cli-agent/AGENTS.md) into your project as `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`:

  ```bash
  curl -fsSL https://www.testmuai.com/kane-cli-agent/AGENTS.md >> AGENTS.md
  ```

- **The full skill** for Claude Code, Codex CLI and Gemini CLI:

  ```bash
  npx @testmuai/kane-cli-skill
  ```
