# kane-cli

Browser automation CLI for [KaneAI](https://www.lambdatest.com/kane-ai) — AI-powered testing by LambdaTest.

## Installation

### npm (recommended)

```bash
npm install -g @testmuai/kane-cli
```

### Homebrew (macOS / Linux)

```bash
brew tap lambdatest/kane
brew install kane-cli
```

### Shell script

```bash
curl -fsSL https://raw.githubusercontent.com/samyakLambda/kane-cli/main/install.sh | bash
```

Options:

```bash
# Install a specific version
curl -fsSL https://raw.githubusercontent.com/samyakLambda/kane-cli/main/install.sh | bash -s -- --version 0.2.0

# Install to a custom directory
curl -fsSL https://raw.githubusercontent.com/samyakLambda/kane-cli/main/install.sh | bash -s -- --dir /usr/local/bin
```

### Direct download

Download the binary for your platform from [GitHub Releases](https://github.com/samyakLambda/kane-cli/releases) and verify:

```bash
# Download
curl -LO https://github.com/samyakLambda/kane-cli/releases/latest/download/kane-cli-darwin-arm64

# Verify checksum
curl -LO https://github.com/samyakLambda/kane-cli/releases/latest/download/SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing
# or on macOS:
shasum -a 256 -c SHA256SUMS --ignore-missing

# Install
chmod +x kane-cli-darwin-arm64
sudo mv kane-cli-darwin-arm64 /usr/local/bin/kane-cli
```

## Supported platforms

| Platform | Architecture          | Status                |
| -------- | --------------------- | --------------------- |
| macOS    | ARM64 (Apple Silicon) | Signed + notarized    |
| Linux    | x64                   | Signed (OpenSSL)      |
| Windows  | x64                   | Signed (Authenticode) |

## Signature verification

### macOS

Automatic — macOS Gatekeeper verifies the Apple notarization on first launch.

### Linux

```bash
curl -LO https://github.com/samyakLambda/kane-cli/releases/latest/download/kane-cli-linux-x64.sig
curl -LO https://github.com/samyakLambda/kane-cli/releases/latest/download/public_key.pem

openssl dgst -sha256 -verify public_key.pem -signature kane-cli-linux-x64.sig kane-cli-linux-x64
```

### Windows

Automatic — Windows SmartScreen verifies the Authenticode signature.

## Usage

```bash
# Login to your LambdaTest account
kane-cli login

# Start a test session
kane-cli run

# Check version
kane-cli --version
```

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
curl -fsSL https://raw.githubusercontent.com/samyakLambda/kane-cli/main/install.sh | bash
```

## Reporting issues

Found a bug? Please [open an issue](https://github.com/samyakLambda/kane-cli/issues/new).

Include:

- kane-cli version (`kane-cli --version`)
- OS and architecture
- Steps to reproduce
- Error output

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[Apache-2.0](LICENSE)
