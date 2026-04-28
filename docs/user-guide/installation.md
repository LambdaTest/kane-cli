# Installation

kane-cli is published to the public npm registry as `@testmuai/kane-cli`. Install it globally with `npm` to get the `kane-cli` command on your `PATH`.

## Supported platforms

kane-cli ships native binaries for the following platforms. Installing the main package pulls in the matching platform binary automatically.

| Platform | Architecture |
|----------|--------------|
| macOS | Apple Silicon (arm64) |
| macOS | Intel (x64) |
| Linux | x64 |
| Windows | x64 |

## Install with npm

Node.js 18 or later is required.

```bash
npm install -g @testmuai/kane-cli
```

If your global `npm` prefix is not on `PATH`, add it before running `kane-cli`. You can find the prefix with `npm config get prefix`; the `kane-cli` binary lives in `<prefix>/bin` on macOS and Linux, and `<prefix>` on Windows.

## Verify installation

Confirm the install by printing the version:

```bash
kane-cli --version
```

Expected output:

```text
0.1.0
```

If the command is not found, your shell is not seeing the npm global `bin` directory. Open a new terminal or update `PATH`, then try again.

## Updates

kane-cli checks the npm registry once every 24 hours when you launch it. When a newer version is available, the CLI prints a one-line notification on startup with the current and latest versions. The check runs in the background and never blocks startup; if the network is unavailable, kane-cli silently skips it.

Upgrade with the same command you used to install:

```bash
npm install -g @testmuai/kane-cli@latest
```

After upgrading, run `kane-cli --version` to confirm the new version is active.

## Uninstall

Remove the global package:

```bash
npm uninstall -g @testmuai/kane-cli
```

This removes the `kane-cli` binary but leaves your local data in place. kane-cli stores credentials, configuration, sessions, and Chrome profile data under `~/.testmuai/kaneai/`. To wipe that state as well:

```bash
rm -rf ~/.testmuai/kaneai
```

Only do this if you want a clean reset — it logs you out of all profiles and deletes saved configuration, session history, and command history.

## Next steps

- [Getting started](./getting-started.md)
- [Authentication](./authentication.md)
