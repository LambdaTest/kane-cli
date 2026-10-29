# @testmuai/kane-cli-skill

**Verify any browser flow from your terminal in natural language. Real Chrome, evidence-backed.**

Kane CLI by TestMu AI is a deterministic browser agent for developers, AI coding agents and CI/CD pipelines. Describe what should happen in natural language, and it drives a real Chrome browser to verify it actually happened.

No selectors, no XPath, no framework boilerplate. Write "log in as the test user, add the first product to the cart, and confirm the total updates" and the agent resolves the path itself. Deterministic refers to the verification contract: a pass is granted only when the expected state is confirmed through explicit evidence, including DOM state, accessibility labels, URL changes, network responses, screenshots and console logs.

It runs three ways: an interactive terminal for debugging, headless for CI, and agent mode that streams structured events an AI coding agent can parse. Tests export to native Playwright, so there is no lock-in.

This package installs the Kane CLI skill for AI coding agents (Claude Code, Codex CLI and Gemini CLI), so your agent can run `kane-cli` to check its own work in a real browser.

## Install

```bash
npx @testmuai/kane-cli-skill
```

You also need Kane CLI itself:

```bash
npm install -g @testmuai/kane-cli
```

Requires Node.js 18 or higher and Google Chrome.

Then open your agent in a project and ask for something that needs a browser:

```text
check that the home page loads on my app
```

## Commands

```bash
npx @testmuai/kane-cli-skill              # install the skill for all supported agents
npx @testmuai/kane-cli-skill uninstall    # remove it
npx @testmuai/kane-cli-skill prefs --watch quiet --purpose suite
npx @testmuai/kane-cli-skill strip enable # live run status in your status line
npx @testmuai/kane-cli-skill --help
```

## Links

- Docs: https://www.testmuai.com/support/docs/kane-cli-getting-started/
- Using Kane CLI from an AI coding agent: https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/agents.md
- Source and issues: https://github.com/LambdaTest/kane-cli
- Support: support@testmuai.com

## License

Apache 2.0
