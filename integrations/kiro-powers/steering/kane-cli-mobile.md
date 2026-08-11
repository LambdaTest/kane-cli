# Kane CLI: mobile steering (driving a native app on a virtual device)

Load this file when the user wants a `kane-cli run` (or a saved `_test.md`) to drive a **native mobile app** on a virtual Android or iOS device instead of the browser. For ordinary web work, stay on the **`kane-cli-run`** steering file. Desktop (the browser) is the **default** target and is unaffected by everything here.

The single rule that scopes this file: **mobile is opt-in and macOS-Apple-Silicon-only.** A run with no `--target` still drives Chrome exactly as before. Only reach for this file once the user asks to test a native app.

---

# Availability (check first)

- **macOS on Apple Silicon (arm64) only.** Mobile targets need a local Android emulator or iOS simulator, driven through Apple-Silicon virtualization. On an Intel Mac, Linux, or Windows, mobile is **not available**. Only desktop (browser) runs work there.
- **Desktop stays the default.** The `--target` flag is what selects mobile. Leave it off and every run drives the browser, unchanged.

If the user is not on a mac-arm64 machine, mobile is not an option. Keep them on desktop runs.

---

# The three targets

`--target` picks what the run drives:

| Target | Drives | Notes |
|---|---|---|
| `desktop` | The browser (Chrome) | **Default.** Everything in the `kane-cli-run` steering file applies unchanged. |
| `emulator` | A virtual **Android** device | Runs an Android app you provide. |
| `simulator` | A virtual **iOS** device | Runs an iOS app you provide. |

`emulator` = Android, `simulator` = iOS. There is **no** mobile-web or URL target: a mobile run always drives an **app**. WebViews inside that app are handled normally, but you never point a mobile run at a website.

---

# Selecting a target on `run`

```bash
kane-cli run "<objective>" --agent --target emulator  --app ./builds/app-debug.apk
kane-cli run "<objective>" --agent --target simulator --app ./builds/MyApp.zip
kane-cli run "<objective>" --agent --target simulator --app APP123456
```

| Flag | Purpose |
|---|---|
| `--target desktop\|emulator\|simulator` | Pick the target. Default is the saved session target, else `desktop`. |
| `--device <id>` | Choose a specific device by name, serial, `ip:port`, or udid. In a TTY, omitting it opens a one-time picker whose answer is saved; in `--agent`/non-TTY runs a device must already be set (`--device` or `config set-device`) or the run exits 2 naming the fix. |
| `--app <path\|APPid>` | The app under test. **Required for every mobile run** (see below). |

On **desktop**, `--device` and `--app` are ignored (they only apply to `emulator` / `simulator`).

Persist defaults so you don't repeat the flags each run:

```bash
kane-cli config set-target desktop|emulator|simulator
kane-cli config set-device <id>
kane-cli config set-app    <path|APPid>
```

In the interactive TUI, `/mobile` and `/desktop` switch the surface and `/doctor` runs readiness checks. (`config set-mode action|testing` is an **unrelated** axis: it controls auth-wall behavior, not the target.)

---

# The app under test: required, and its formats

A browser run navigates to a URL. A mobile run drives an **app**. Every `emulator` / `simulator` run needs one, supplied one of two ways:

1. **A local build** passed to `--app` (or `app:` in a `_test.md`):
   - Android (`emulator`): a `.apk`
   - iOS (`simulator`): a `.zip`
2. **An uploaded app id** from a previous upload: the literal `APP` followed by **6 or more digits** (e.g. `APP123456`).

kane-cli installs that app on the device and runs the objective against it.

**Not accepted:** a package / bundle id (e.g. `com.example.app`), a bare `.ipa`, or a `.app` bundle. There is **no default app**: a mobile run without a valid build or `APP…` id cannot start.

---

# One-time setup

Two halves, and kane-cli owns the second:

1. **You provide the virtual device** (one-time, per platform):
   - **iOS:** install the full **Xcode** app (version **16 or newer**). It bundles the iOS Simulator.
   - **Android:** install **Android Studio** (or the command-line SDK) and create one AVD from an **`arm64-v8a`** system image. x86 / x86_64 images do not run natively on Apple Silicon.
   - Set up only the platform(s) you intend to test.
2. **kane-cli installs the test tooling it manages and drives the device.** Sign in, then install:

   ```bash
   kane-cli login
   kane-cli doctor --install
   ```

   From then on kane-cli discovers the device, boots it, installs your app, and runs the test. **You do not boot the simulator or emulator by hand.**

## `kane-cli doctor`: readiness

`kane-cli doctor` prints one line per required check, each failing row carrying its fix. Run it first when a mobile run fails with a setup-looking error.

| Flag | Effect |
|---|---|
| `--install` | Install the test tooling kane-cli manages (the one-time step above). |
| `--targets` | List the devices (emulators / simulators) kane-cli can run against. |
| `--platform <name>` | Scope the checks to one platform. |
| `--device-class emulator\|simulator` | Scope the checks to one device class. |
| `--verbose` | More detail per check. |

---

# Committing a mobile test (`_test.md`)

A `_test.md` selects its surface through the **`target:`** frontmatter key — **one scalar**, sharing the `--target` vocabulary:

- `chrome`, `cdp`, or `ws` is a **browser** transport: the desktop path, used by every existing test.
- `emulator` (Android) or `simulator` (iOS) is **mobile**, with the app as its own root key:

  ```yaml
  ---
  target: emulator               # emulator (Android) | simulator (iOS)
  app: ./builds/app-debug.apk    # a build (.apk / .zip) or an APP… id, never a package id
  no_reset: false                # optional
  ---
  ```

  `app:` follows the same rule as `--app` and is **required** with a mobile target — and refused with a browser one; `no_reset:` pairs with a mobile target the same way. The platform never appears in the file: `emulator` is Android, `simulator` is iOS. The nested form (`target: {platform, app}`) is not accepted — the parser refuses it and spells out this flat shape.

Author it once (real device, like any first run), then replay from cache. Everything else about the `_test.md` format is unchanged. Load the **`kane-cli-testmd`** steering file. Run a mobile test with `kane-cli testmd run <path> --agent`.

**`kane-cli testrun` does not support mobile.** A batch plan that includes a mobile member is rejected. Run a mobile `_test.md` on its own with `kane-cli testmd run <path>`. Keep mobile tests out of a `testrun` batch.

---

# What works on mobile

The **same natural-language objective grammar** applies: action verbs, assertions, extractions ("store … as '<name>'"), if/else, chaining, and variables all carry over. A mobile run just drives an app instead of a page. Parsing, `--agent` output, and results presentation are identical to a web run (see the **`kane-cli-run`** steering file).

The exception is **browser / DevTools-only checkpoints**, which are **web-only** and do not apply to a mobile run:

- Network (HTTP traffic), Console, DOM / selectors, Cookies, localStorage, and Core Web Vitals (LCP / CLS / INP / FCP / TTFB).

Write mobile objectives around what the app shows and does (open a screen, tap, type, assert visible text or state, store a value). And **never point a mobile run at a URL**: a mobile run drives an app, not a website.
