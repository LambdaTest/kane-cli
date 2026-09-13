# Kane CLI: mobile steering (driving a native app on a virtual device)

Load this file when the user wants a `kane-cli run` (or a saved `_test.md`) to drive a **native mobile app** on a virtual Android or iOS device instead of the browser. For ordinary web work, stay on the **`kane-cli-run`** steering file. Desktop (the browser) is the **default** target and is unaffected by everything here.

The single rule that scopes this file: **mobile is opt-in.** A run with no `--target` still drives Chrome exactly as before. Only reach for this file once the user asks to test a native app.

---

# Availability (check first)

| Where the device runs | Host | Commands |
|---|---|---|
| **Local** — a simulator/emulator on this machine | **macOS on Apple Silicon (arm64) only.** Not Intel Macs, Linux, or Windows | `kane-cli run --target …`, `kane-cli testmd run`, `kane-cli testrun run` |
| **Cloud grid** — a virtual device on a LambdaTest HyperExecute macOS host | **Any machine**; no Xcode or Android Studio needed. The account needs a HyperExecute plan with macOS runners | `kane-cli testrun run <paths> --remote --device-name "<grid device>" --os-version <v>` — see "Running a mobile suite on the cloud grid" below |

- **Desktop stays the default.** The `--target` flag is what selects mobile. Leave it off and every run drives the browser, unchanged.
- If the user is not on a mac-arm64 machine, local mobile is not an option — **offer the grid**: save the objective as a `_test.md` (`target: emulator|simulator` + `app:`) and run it with `--remote`. Do not tell them mobile is unavailable.

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
| `--device-name <name>` | Which device, as `kane-cli devices list --target emulator\|simulator` prints it. Needs `--os-version`. In a TTY, omitting it opens a one-time picker whose answer is saved; in `--agent`/non-TTY runs a device must already be set (flags, `config set-device-name` + `set-os-version`, or the file's `device_name:`/`os_version:`) or the run exits 2 naming the fix. |
| `--os-version <version>` | The device's OS version (`14`, `17.5`). Alone = any device on that version. |
| `--app <path\|APPid>` | The app under test. **Required for every mobile run** (see below). |

On **desktop**, the device flags and `--app` are ignored (they only apply to `emulator` / `simulator`).

Persist defaults so you don't repeat the flags each run:

```bash
kane-cli config set-target desktop|emulator|simulator
kane-cli config set-device-name "<name>"
kane-cli config set-os-version <version>
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

kane-cli installs that app on the device and runs the objective against it. `kane-cli apps list --target emulator|simulator --agent` lists the account's uploads (the `app_id` field is what `--app`/`app:` take). There is no upload subcommand: a **local** run with a local build uploads it and prints the `APP…` id. Uploads belong to an organisation; `apps list` for the active profile is the authority.

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
   kane-cli doctor --target emulator --install     # or --target simulator
   ```

   From then on kane-cli discovers the device, boots it, installs your app, and runs the test. **You do not boot the simulator or emulator by hand.** None of this is needed for `--remote` runs.

## `kane-cli doctor` and `kane-cli devices list`: readiness

`kane-cli doctor --target emulator|simulator` (the target is required) prints one line per required check, each failing row carrying its fix. Run it first when a local mobile run fails with a setup-looking error.

| Command | Effect |
|---|---|
| `kane-cli doctor --target <kind>` | Readiness checks for that toolchain. |
| `kane-cli doctor --target <kind> --install` | Install or repair the test tooling kane-cli manages (the one-time step above). |
| `kane-cli devices list --target <kind> --agent` | The devices on this machine (name + OS version — the `--device-name`/`--os-version` vocabulary). |
| `kane-cli devices list --target <kind> --remote --agent` | The devices the cloud grid can provision. `--os-version <v>` filters. |
| `kane-cli plugin doctor remote-execution` | Readiness for `--remote`. |

---

# Committing a mobile test (`_test.md`)

A `_test.md` selects its surface through the **`target:`** frontmatter key — **one scalar**, sharing the `--target` vocabulary:

- `chrome`, `cdp`, or `ws` is a **browser** transport: the desktop path, used by every existing test.
- `emulator` (Android) or `simulator` (iOS) is **mobile**, with the app as its own root key:

  ```yaml
  ---
  target: emulator               # emulator (Android) | simulator (iOS)
  app: ./builds/app-debug.apk    # a build (.apk / .zip) or an APP… id, never a package id
  device_name: Pixel 7           # optional per-test default (local list or grid catalog vocabulary)
  os_version: "14"               # optional; --device-name / --os-version override both
  no_reset: false                # optional
  ---
  ```

  `app:` follows the same rule as `--app` and is **required** with a mobile target — and refused with a browser one; `no_reset:`, `device_name:` and `os_version:` pair with a mobile target the same way. The platform never appears in the file: `emulator` is Android, `simulator` is iOS. The nested form (`target: {platform, app}`) is not accepted — the parser refuses it and spells out this flat shape.

Author it once (real device, like any first run), then replay from cache. Everything else about the `_test.md` format is unchanged. Load the **`kane-cli-testmd`** steering file. Run a mobile test with `kane-cli testmd run <path> --agent`.

**Mobile members in `kane-cli testrun`.** A mobile `_test.md` is a normal batch member (0.8.7+). Locally (mac-arm64 with the setup above): `kane-cli testrun run <paths> --device-name "<name>" --os-version <v>`. On the cloud grid, from any machine: add `--remote` (next section). Load the **`kane-cli-testrun`** steering file for the flags, events, and rollup.

---

# Running a mobile suite on the cloud grid (`testrun run --remote`)

One command turns a mobile suite into a LambdaTest HyperExecute job on a macOS host that boots the emulator/simulator, installs the app, runs the members, and returns the recordings (`output-<stem>/`) and the sealed evidence pack to the project. The user's machine needs **no** Xcode, Android Studio, or Chrome. Requirements: a HyperExecute plan with macOS runners, `kane-cli plugin install remote-execution`, and a LambdaTest username + access key (an OAuth profile is exchanged automatically).

```bash
kane-cli plugin install remote-execution                                    # once; `kane-cli plugin doctor remote-execution` checks it
kane-cli devices list --target emulator --remote --agent                    # grid catalog: name + os_versions per row
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14 --dry-run   # validate + resolve device, no job
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14
kane-cli testrun run tests/ios/ --remote --device-name "iPhone 15" --os-version 17.5
```

**Always `--dry-run` first** — it runs the remote preflight and resolves the device against the catalog at no cost. Allow several minutes for the real run.

Rules that differ from a local run (a violation is a `remote_error` before dispatch, exit 2, with the offending paths and the fix):

| Rule | Detail | Preflight code |
|---|---|---|
| **Device comes from the grid catalog** | `--device-name` must match a `devices list … --remote` row; `--os-version` alone = any device on that version; the file's `device_name:`/`os_version:` are the fallback; neither → a catalog default, reported in the `remote_device` event. A local AVD name is ignored (`remote_device_hint`, `device_name_ignored`). | — |
| **One job = one platform on one OS version** | Split emulator vs simulator, web vs device, and different Android versions into separate runs (`--match`/`--tags`), or force one version with `--os-version`. | `mobile_remote_mixed_platform`, `mobile_remote_mixed`, `mobile_os_version_split` |
| **Emulator app** | A local `.apk` **inside the project** (relative to the test file) ships in the payload; or an `APP…` id the grid downloads. | `mobile_app_not_shippable` |
| **Simulator app** | **Must be an uploaded `APP…` id** — the grid cannot fetch a local `.zip`. Get it from `kane-cli apps list --target simulator --agent` (same env/org as the run), or run the test locally once to upload it. | `mobile_app_not_cloud` |
| **Payload** | Members must live under the cwd being dispatched; recordings/builds must not be gitignored (`!output-*/`). | `member_outside_payload`, `gitignored_inputs` |

Present after `testrun_done`/`remote_done`: the suite rollup, the device line (`remote_device` name + OS), and the job link (`remote_dispatched.job_url`). A member `broken` with zero steps means the grid-side run refused before launching — check the app id's environment and the scenario log at the job link.

---

# What works on mobile

The **same natural-language objective grammar** applies: action verbs, assertions, extractions ("store … as '<name>'"), if/else, chaining, and variables all carry over. A mobile run just drives an app instead of a page. Parsing, `--agent` output, and results presentation are identical to a web run (see the **`kane-cli-run`** steering file).

The exception is **browser / DevTools-only checkpoints**, which are **web-only** and do not apply to a mobile run:

- Network (HTTP traffic), Console, DOM / selectors, Cookies, localStorage, and Core Web Vitals (LCP / CLS / INP / FCP / TTFB).

Write mobile objectives around what the app shows and does (open a screen, tap, type, assert visible text or state, store a value). And **never point a mobile run at a URL**: a mobile run drives an app, not a website.
