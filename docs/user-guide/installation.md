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

## Install with pnpm or yarn

Installing kane-cli via **pnpm** is not currently supported. pnpm places packages inside a nested `node_modules/.pnpm/` store, so the project-root `node_modules/` ends up deeper on disk than it would with npm. kane-cli's resolver for the platform-specific `v16-runner` binary does not yet search that far up the directory tree, so the runner is never found and the CLI aborts. The symptom is a silent exit with status 2 shortly after startup — see [CLI exits with code 2 and no output](./troubleshooting.md#cli-exits-with-code-2-and-no-output) in the troubleshooting guide. This limitation is tracked in [issue #24](https://github.com/LambdaTest/kane-cli/issues/24).

Until that is resolved, install kane-cli through one of the supported paths:

- **npm** globally (`npm install -g @testmuai/kane-cli`, above).
- **Homebrew** on macOS or Linux (`brew install LambdaTest/kane/kane-cli`). Does not require Node.
- The **shell installer** for any POSIX system (`curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh`).

yarn (classic and Berry) has not been verified end-to-end. If you use yarn, prefer the Homebrew or shell-installer path until it is explicitly supported.

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
