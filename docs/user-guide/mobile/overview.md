# Mobile testing

kane-cli can run tests against mobile virtual devices: Apple's **iOS Simulator** and Google's **Android Emulator**. You author and run mobile tests the same way you already do for the browser. The differences are that a mobile test runs against an **app you provide** and that the target device is a simulator or emulator instead of a browser.

There are two places that device can live:

| | Where the device runs | Host requirement | How |
|---|---|---|---|
| **Local** | A simulator or emulator on your machine | **macOS on Apple Silicon (arm64)** with Xcode and/or Android Studio | `kane-cli run … --target emulator\|simulator`, `kane-cli testmd run`, `kane-cli testrun run` |
| **Cloud grid** | A virtual device on a **HyperExecute macOS host** | **Any machine** — Linux, Windows, Intel or Apple Silicon Mac, no mobile tooling needed. Your LambdaTest plan must include HyperExecute with macOS runners | `kane-cli testrun run … --remote` — see [Remote runs](../remote-execution.md) |

> **Local mobile runs need macOS on Apple Silicon (arm64).** Intel Macs, Linux, and Windows cannot boot the simulator or emulator locally — on those hosts, run mobile suites on the cloud grid with `--remote`. The setup sections below are for the local path.

## What "mobile" means here

- **Native app testing.** A mobile test drives an installed app. You pass a build (or an app id from a previous upload) with `--app`; kane-cli installs it on the device and runs your objective against it. Pointing a mobile run at a website is not supported yet. WebViews inside the app under test are handled.
- **Two targets.** `emulator` is a virtual Android device, `simulator` is a virtual iOS device. The default target stays **desktop** (the browser), so nothing changes for your existing web runs.

## Why a single architecture for local runs

Apple Silicon runs both mobile stacks natively. The iOS Simulator is a first-class Apple target, and Android ships `arm64-v8a` emulator images that run on the Mac's built-in hypervisor with hardware acceleration. Standardising on one host architecture keeps local setup predictable and runs fast, with no cross-architecture translation in the path. Other hosts get the same devices through the cloud grid instead — the grid's macOS runners do the booting.

## How setup works

There are two halves, and kane-cli owns the second:

1. **You provide the virtual device.** Install Apple's or Google's tooling (Xcode, or Android Studio) and, for Android, create one virtual device. These are the same tools Apple and Google already ship for building simulators and emulators.
2. **kane-cli installs its own test tooling and drives the device.** Sign in and run one command:

   ```bash
   kane-cli login
   kane-cli doctor --target simulator --install    # or --target emulator
   ```

   This downloads the test tooling kane-cli manages for you. From then on, kane-cli discovers the device, boots it, installs your app, and runs the test. You do not boot the simulator or emulator by hand.

Run `kane-cli doctor --target emulator|simulator` at any time to check what is ready and what is missing. It prints one line per required check, each with a fix. `kane-cli devices list --target emulator|simulator` lists the devices kane-cli can run against.

## Prerequisites at a glance

| Target | Virtual device | You install | Setup guide |
|--------|----------------|-------------|-------------|
| iOS | iOS Simulator | Xcode (full app, version 16 or newer) | [iOS Simulator setup](./simulator.md) |
| Android | Android Emulator | Android Studio / Android SDK, plus one `arm64-v8a` AVD | [Android Emulator setup](./emulator.md) |

Both require macOS on Apple Silicon and a one-time `kane-cli doctor --target emulator|simulator --install`. You only need to set up the platform you intend to test. Set up both if you test on both. None of this is needed for `--remote` runs.

## Running a mobile test locally

Once a target is set up, point a run at it:

```bash
# one-off, from the command line
kane-cli run "Sign in and open the account tab" --target simulator --app ./builds/MyApp.zip

# or set a default target once, then just run
kane-cli config set-target emulator
kane-cli run "Add the first item to the cart" --app ./builds/app-debug.apk

# a saved test, or a whole suite of them
kane-cli testmd run tests/checkout_test.md
kane-cli testrun run tests/app/ --device-name "Pixel 7 API 35" --os-version 15
```

Pick a device with `--device-name` and `--os-version` as `kane-cli devices list --target emulator|simulator` prints them, or save defaults with `kane-cli config set-device-name` / `set-os-version`. In the interactive TUI, switch targets with `/mobile` and `/desktop`. For the full flag list and the app formats each target accepts, see [Running tests](../running-tests.md).

## Running a mobile suite on the cloud grid

Skip the local setup entirely: `kane-cli testrun run --remote` sends your mobile `_test.md` files to LambdaTest HyperExecute, which boots a virtual device on a macOS host, installs the app, runs the suite, and returns the recordings and evidence pack to your project. Anyone on the team can author and run mobile tests this way, from any operating system.

```bash
kane-cli plugin install remote-execution                              # once
kane-cli devices list --target emulator --remote                      # what the grid can provision
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14 --dry-run
kane-cli testrun run tests/app/ --remote --device-name "Pixel 7" --os-version 14
```

Three things differ from a local run: the device comes from the **grid catalog** (`devices list … --remote`), one job runs **one platform on one OS version**, and a **simulator** test must reference an uploaded `APP…` id rather than a local `.zip`. The details — prerequisites, the app rules, and what one job can hold — are in [Remote runs on the cloud grid](../remote-execution.md).

## Next steps

- [Remote runs on the cloud grid](../remote-execution.md): mobile suites from any machine
- [iOS Simulator setup (mac-arm64)](./simulator.md)
- [Android Emulator setup (mac-arm64)](./emulator.md)
- [Running tests](../running-tests.md): objectives, run flags, and slash commands
