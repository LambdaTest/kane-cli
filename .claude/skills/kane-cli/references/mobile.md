<!-- Read this when the user wants to run or author a test against a mobile app (Android emulator or iOS simulator) instead of the browser. Owns mobile availability, the target axis, target/device/app selection on `run`, the app-under-test requirement, mobile setup (login + doctor --install), doctor flags, the testmd flat `target:` + `app:` frontmatter keys, the testrun exclusion, and what objective grammar carries over to mobile. Desktop (browser) stays the default; this is the scoped mobile branch. -->

# Mobile testing (macOS Apple Silicon)

Desktop (the browser) is the **default** target and the primary use of kane-cli. Mobile is a **scoped addition**: kane-cli can also drive a native app on a virtual Android or iOS device on the same machine. Nothing about web runs changes. A run with no mobile flags still drives Chrome exactly as before.

## Availability (read first)

- **macOS on Apple Silicon (arm64) only.** Mobile is not available on Intel Macs, Linux, or Windows. On those hosts, only desktop (browser) runs work.
- **Desktop stays the default.** The `--target` axis is what selects mobile. Leave it off and you get the browser.

If the user is not on mac-arm64, mobile is not an option. Keep them on desktop runs.

## The three targets

`--target` picks what the run drives:

| Target | Drives | Notes |
|---|---|---|
| `desktop` | The browser (Chrome) | **Default.** Everything in the rest of the skill applies unchanged. |
| `emulator` | A virtual **Android** device | Runs an Android app you provide. |
| `simulator` | A virtual **iOS** device | Runs an iOS app you provide. |

`emulator` = Android, `simulator` = iOS. There is no mobile-web or URL target: a mobile run always drives an **app**. (WebViews inside that app are handled, but you never point a mobile run at a website.)

## Selecting a target on `run`

```bash
kane-cli run "<objective>" --agent --target emulator --app ./builds/app-debug.apk
kane-cli run "<objective>" --agent --target simulator --app ./builds/MyApp.zip
```

| Flag | Purpose |
|---|---|
| `--target desktop\|emulator\|simulator` | Pick the target. Default is the saved session target, else `desktop`. |
| `--device <id>` | Choose a specific device by name, serial, `ip:port`, or udid. In a TTY, omitting it opens a one-time picker whose answer is saved; in `--agent`/non-TTY runs a device must already be set (`--device` or `config set-device`) or the run exits 2 naming the fix. |
| `--app <path\|APPid>` | The app under test. **Required for every mobile run** (see below). |

On **desktop**, `--device` and `--app` are ignored. They only apply to `emulator`/`simulator`.

In the interactive TUI, switch with `/mobile` and `/desktop`; `/doctor` runs readiness checks. The first-run chooser offers Desktop / Emulator / Simulator. Persist defaults with `kane-cli config set-target`, `config set-device`, `config set-app`. (The separate `config set-mode action|testing` is an unrelated axis: it controls auth-wall behavior, not the target.)

## The app under test: required, and its formats

Every mobile run needs an app. Provide it one of two ways:

1. **A local build** passed to `--app` (or `app:` in a `_test.md`):
   - Android (`emulator`): a `.apk`
   - iOS (`simulator`): a `.zip`
2. **An uploaded app id** from a previous upload: `APP` followed by 6 or more digits (e.g. `APP123456`).

kane-cli installs that app on the device and runs the objective against it.

**Not accepted:** a package/bundle id (e.g. `com.example.app`), a bare `.ipa`, or a `.app` bundle. There is no default app: a mobile run without a valid build or `APP…` id cannot start.

## Setup path

Two halves, and kane-cli owns the second:

1. **You provide the virtual device** (one-time, per platform):
   - **iOS:** install the full **Xcode** app (version 16 or newer). It bundles the iOS Simulator.
   - **Android:** install **Android Studio** (or the command-line SDK) and create one AVD from an **`arm64-v8a`** system image. x86/x86_64 images do not run natively on Apple Silicon.
   - You only need the platform you intend to test. Set up both if you test both.
2. **kane-cli installs its own test tooling and drives the device.** Sign in, then install:

   ```bash
   kane-cli login
   kane-cli doctor --install
   ```

   `doctor --install` downloads the test tooling kane-cli manages. From then on kane-cli discovers the device, boots it, installs your app, and runs the test. **You do not boot the simulator or emulator by hand.**

## `kane-cli doctor`: readiness

`kane-cli doctor` prints one line per required check, each failing row carrying its fix. Run it any time to see what is ready and what is missing.

| Flag | Effect |
|---|---|
| `--install` | Install kane-cli's managed test tooling (the one-time setup step above). |
| `--targets` | List the devices (emulators / simulators) kane-cli can run against. |
| `--platform <name>` | Scope the checks to one platform. |
| `--device-class emulator\|simulator` | Scope the checks to one device class. |
| `--verbose` | More detail per check. |

## `target:` in a `_test.md`

The `target:` frontmatter key is **one scalar**, sharing the `--target` vocabulary. Browser transports and mobile targets are the same key; the app rides beside it as its own root key:

- `chrome`, `cdp`, `ws` — the browser (desktop path).
- `emulator` (Android), `simulator` (iOS) — mobile:

  ```yaml
  ---
  target: emulator              # emulator (Android) | simulator (iOS)
  app: ./builds/app-debug.apk   # a build (.apk / .zip) or an APP… id, never a package id
  no_reset: false               # optional
  ---
  ```

  `app:` follows the same rule as `--app` and is **required** with a mobile target — and refused with a browser one; `no_reset:` pairs with a mobile target the same way. The platform never appears in the file: `emulator` is Android, `simulator` is iOS. The nested form (`target: {platform, app}`) is not accepted — the parser refuses it and spells out this flat shape.

Everything else about `_test.md` (step bodies, replay/cascade, commands) is unchanged. See `references/testmd.md`. Run a mobile test with `kane-cli testmd run <path> --agent`.

## testrun does NOT support mobile

`kane-cli testrun run` (batch execution) rejects a mobile member. To run a mobile `_test.md`, use `kane-cli testmd run <path>` (single-test). Keep mobile tests out of a `testrun` batch.

## What works on mobile

The **same natural-language objective grammar** applies (`references/objectives-cookbook.md`): action verbs, assertions, extractions ("store as"), if/else, chaining, and variables all carry over. A mobile run just drives an app instead of a page.

The exception is **browser/DevTools-only checkpoints**, which are **web-only** and do not apply to a mobile run:

- Network (HTTP traffic), Console, DOM/selectors, Cookies, localStorage, Core Web Vitals (LCP/CLS/INP/FCP/TTFB).

Write mobile objectives around what the app shows and does (open a screen, tap, type, assert visible text/state, store a value). And never point a mobile run at a URL: a mobile run drives an app, not a website.
