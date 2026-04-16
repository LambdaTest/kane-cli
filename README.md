# kane-cli

Browser automation CLI for [KaneAI](https://www.lambdatest.com/kane-ai) — AI-powered testing by LambdaTest. Run automated browser tasks using natural language objectives from your terminal.

[![npm version](https://img.shields.io/npm/v/@testmuai/kane-cli)](https://www.npmjs.com/package/@testmuai/kane-cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-brightgreen)

## Quick Start

```bash
npm install -g @testmuai/kane-cli
kane-cli login
kane-cli run
```

## Installation

### npm (recommended)

```bash
npm install -g @testmuai/kane-cli
```

### Homebrew (macOS / Linux)

```bash
brew install LambdaTest/kane/kane-cli
```

### Shell script

```bash
curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh
```

Installs a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh -s -- --version 0.2.0
```

> Requires Node.js 18+ and npm. The script delegates to `npm install -g @testmuai/kane-cli` so you get the same install as the npm method above. For an install that doesn't need Node, use Homebrew.

## Supported platforms

| Platform | Architecture          | Status                |
| -------- | --------------------- | --------------------- |
| macOS    | ARM64 (Apple Silicon) | Signed + notarized    |
| Linux    | x64                   | Signed (OpenSSL)      |
| Windows  | x64                   | Signed (Authenticode) |

## Usage

```bash
# Login to your LambdaTest account
kane-cli login

# Start a test session
kane-cli run

# Check version
kane-cli --version
```

## AI Agent Skill

Teach your AI coding agent how to use kane-cli by installing the skill:

**Setup guide:** [testmuai.com/kane-cli/agents.md](https://testmuai.com/kane-cli/agents.md)

**Or install via npx:**

```bash
npx @testmuai/kane-cli-skill
```

This installs the kane-cli skill for Claude Code, Codex CLI, and Gemini CLI.

## Updating

kane-cli checks for updates automatically (once per 24h, non-blocking). When an update is available:

```
Update available: 0.1.0 → 0.2.0 — run `npm install -g @testmuai/kane-cli`
```

Or update manually:

```bash
# npm
npm update -g @testmuai/kane-cli

# Homebrew
brew upgrade kane-cli

# curl installer
curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute. We welcome improvements to documentation and skills.

## Reporting issues

Found a bug or have a feature request? [Open an issue](https://github.com/LambdaTest/kane-cli/issues/new/choose).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[Apache-2.0](LICENSE)
