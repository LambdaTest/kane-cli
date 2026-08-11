# Mobile testing

kane-cli can run tests against local mobile virtual devices: Apple's **iOS Simulator** and Google's **Android Emulator**. You author and run mobile tests the same way you already do for the browser. The differences are that a mobile test runs against an **app you provide** and that the target device is a simulator or emulator on your machine.

> **This release supports macOS on Apple Silicon (arm64) only.** Mobile testing is not yet available on Intel Macs, Linux, or Windows. Everything below assumes a mac-arm64 host.

## What "mobile" means here

- **Native app testing.** A mobile test drives an installed app. You pass a build (or an app id from a previous upload) with `--app`; kane-cli installs it on the device and runs your objective against it. Pointing a mobile run at a website is not supported yet. WebViews inside the app under test are handled.
- **Two targets.** `emulator` is a virtual Android device, `simulator` is a virtual iOS device. The default target stays **desktop** (the browser), so nothing changes for your existing web runs.

## Why a single architecture

Apple Silicon runs both mobile stacks natively. The iOS Simulator is a first-class Apple target, and Android ships `arm64-v8a` emulator images that run on the Mac's built-in hypervisor with hardware acceleration. Standardising on one host architecture for the first release keeps setup predictable and runs fast, with no cross-architecture translation in the path. Support for other hosts will follow in a later release.

## How setup works

There are two halves, and kane-cli owns the second:

1. **You provide the virtual device.** Install Apple's or Google's tooling (Xcode, or Android Studio) and, for Android, create one virtual device. These are the same tools Apple and Google already ship for building simulators and emulators.
2. **kane-cli installs its own test tooling and drives the device.** Sign in and run one command:

   ```bash
   kane-cli login
   kane-cli doctor --install
   ```

   This downloads the test tooling kane-cli manages for you. From then on, kane-cli discovers the device, boots it, installs your app, and runs the test. You do not boot the simulator or emulator by hand.

Run `kane-cli doctor` at any time to check what is ready and what is missing. It prints one line per required check, each with a fix.

## Prerequisites at a glance

| Target | Virtual device | You install | Setup guide |
|--------|----------------|-------------|-------------|
| iOS | iOS Simulator | Xcode (full app, version 16 or newer) | [iOS Simulator setup](./simulator.md) |
| Android | Android Emulator | Android Studio / Android SDK, plus one `arm64-v8a` AVD | [Android Emulator setup](./emulator.md) |

Both require macOS on Apple Silicon and a one-time `kane-cli doctor --install`. You only need to set up the platform you intend to test. Set up both if you test on both.

## Running a mobile test

Once a target is set up, point a run at it:

```bash
# one-off, from the command line
kane-cli run "Sign in and open the account tab" --target simulator --app ./builds/MyApp.zip

# or set a default target once, then just run
kane-cli config set-target emulator
kane-cli run "Add the first item to the cart" --app ./builds/app-debug.apk
```

In the interactive TUI, switch targets with `/mobile` and `/desktop`. For the full flag list and the app formats each target accepts, see [Running tests](../running-tests.md).

## Next steps

- [iOS Simulator setup (mac-arm64)](./simulator.md)
- [Android Emulator setup (mac-arm64)](./emulator.md)
- [Running tests](../running-tests.md): objectives, run flags, and slash commands
