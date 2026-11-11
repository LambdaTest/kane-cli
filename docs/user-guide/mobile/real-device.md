# Real devices

kane-cli can run your native app tests on **real Android and iOS devices in the TestMu AI cloud**. You author and run them the same way as an emulator or simulator test, from **any machine**: macOS (Intel or Apple Silicon), Linux, or Windows. No Xcode, Android Studio, or `kane-cli doctor --install` is needed. kane-cli asks the TestMu AI device hub for a device, installs your app on it, and drives it.

> Requires kane-cli 0.9.0 or later. Check with `kane-cli --version`.

| Target | Drives | Builds it takes |
|---|---|---|
| `android` | A real Android device in the TestMu AI cloud | `.apk`, `.aab`, or an `APP…` id |
| `ios` | A real iOS device in the TestMu AI cloud | `.ipa`, or an `APP…` id |

`emulator` and `simulator` still mean virtual devices on your Mac (see [Mobile testing](./overview.md)). `android` and `ios` always mean real devices.

## Plan requirements

A real-device run needs one of these on your TestMu AI account (see [pricing](https://www.testmuai.com/pricing/)):

| Plan | What you get |
|---|---|
| **KaneAI Max** | **One real device.** One real-device session runs at a time. |
| **KaneAI credits + Real Device Plus Automation Cloud** | Real devices from the automation plan, as many at once as its parallel tests allow. Credits are account-wide, so credits from any KaneAI plan qualify. |

When you start more real-device sessions than your plan allows (for example `--parallel 2` on KaneAI Max), the extra session **queues for up to 15 minutes**. If a device frees up in that time, it runs. Otherwise the run fails with `failed to open the mobile hub session: <reason>`.

A run on an account with neither plan fails the same way, with the hub's reason after the colon.

## Quick start

```bash
kane-cli login                                                    # once
kane-cli run "Sign in and open the account tab" --target android --app ./builds/app-release.apk
kane-cli run "Add the first item to the cart" --target ios --app ./builds/MyApp.ipa
```

kane-cli prints the device it got before the first step:

```
Connecting to a real Android device…
Running on: Real device · Galaxy S24 · Android 14 · App APP1234567
```

## Choosing a device

You don't have to choose. With no device named, the hub picks any free device for the platform.

To pick one, list what the cloud has. This needs **no login**:

```bash
kane-cli devices list --target android --remote
kane-cli devices list --target ios --remote --os-version 17
```

Then name it on the run, or save it as a default:

```bash
kane-cli run "<objective>" --target android --device-name "Galaxy S24" --app ./app.apk
kane-cli run "<objective>" --target ios --os-version 17 --app ./MyApp.ipa      # any iPhone on iOS 17

kane-cli config set-target android
kane-cli config set-device-name "Pixel.*"     # a name or a pattern
kane-cli config set-os-version 15
```

- **Either half alone is enough.** `--device-name` alone means that device on any version. `--os-version` alone means any device on that version. (Emulators and simulators need both.)
- **A name can be a pattern.** A name the list carries exactly is that device. Anything else is read as a case-insensitive regular expression, so `Pixel.*` means any Pixel.
- **Versions match by major.** `17.5` matches any iOS 17 device.
- **Order of precedence:** flag, then saved config (or the test file's `device_name:` / `os_version:`), then the hub picks.

kane-cli checks your choice against the device list before it asks for a session. If the list can't be read, it warns and runs anyway; the hub has the final say.

## The app under test

Every real-device run needs an app:

1. **A local build.** Android takes `.apk` or `.aab`; iOS takes `.ipa`. kane-cli uploads it to your account the first time (a per-machine cache skips a build the account already has) and prints its `APP…` id.
2. **An uploaded app id**, `APP` followed by digits. List your real-device uploads with:

   ```bash
   kane-cli apps list --target android
   kane-cli apps list --target ios
   ```

A simulator `.zip` never runs on a real iPhone: build an `.ipa`. Every session starts with a **fresh install** of the app.

## In the TUI

- Run `/mobile` and choose **Android** or **iOS** (real device). `/mobile` works on any machine.
- Pick a device ("Any available Android device" is the top row), then the app: a local build, one of your uploads, or an app id.
- A **live view** of the device opens in its own Chrome window while the test runs. It is view-only, with a "View only — the test is driving this device" badge. Its address carries your account key, so kane-cli never prints it.
- One device session lasts for the whole TUI session. `/new` and exit close it. If the hub drops an idle session, the next objective opens a new one.
- To change the device or app mid-session, run `/new` first.

Turn the live view off for one run with `--no-stream`, or always with:

```bash
kane-cli config set-device-stream off
```

The live view needs Google Chrome (or `KANE_CLI_CHROME_PATH`). Without it, kane-cli prints `note: no live view of the device — <reason>` and the test runs anyway. Agent and non-interactive runs never open a live view.

## Permissions and alerts

| Setting | Applies to | Default |
|---|---|---|
| `kane-cli config set-auto-grant-permissions on\|off` | Android (`android`, and `emulator`) | on |
| `kane-cli config set-auto-accept-alerts on\|off` | iOS (`ios`, and `simulator`) | on |

Real devices and virtual devices keep separate values. The command changes the value for your **saved** target, so run `kane-cli config set-target android` (or `ios`) first to change the real-device one. The setting is also saved on the mobile test kane-cli creates in Test Manager, so a cloud re-run gets the same behaviour.

## Saved tests (`_test.md`)

```yaml
---
target: android            # android | ios
app: ./builds/app-release.apk
device_name: Pixel.*       # optional: a name or a pattern
os_version: "15"           # optional
---
```

- `app:` is required (or pass `--app`).
- `no_reset:` is refused: a real-device session always starts with a fresh install.
- `kane-cli testmd run <path> --target android|ios` overrides the file's target. `--device-name`, `--os-version`, `--app`, `--no-stream`, `--tunnel` and `--tunnel-name` work as on `run`.

## Suites (`testrun`)

**Locally**, real-device members run from any machine. Each member opens its own device session, so `--parallel` works, up to what your plan allows (extra sessions queue, as above).

```bash
kane-cli testrun run --match '^tests/devices/' --parallel 2 < /dev/null
```

**On the cloud grid** with `--remote`, a real-device suite runs as a HyperExecute job on **Linux** runners. Each member's device is resolved on your machine (flag, then file, then the hub picks) and printed before dispatch:

```
Devices:
  tests/devices/login_test.md  Real device · any Android device · Android 15  (test file)
```

Android and iOS real-device members can share one job. A job can't mix real-device members with web, emulator, or simulator members. `testrun` takes the app from each file's `app:` (there is no `--app` on `testrun`), and `--device-slug` is refused for real devices. See [Remote runs](../remote-execution.md).

## A private or local backend (LT tunnel)

> Requires kane-cli 0.10.3 or later.

A device in the cloud can't reach `localhost` or your private network on its own. If your app talks to a backend that
only your machine (or your VPN) can reach, route the device's traffic through a LambdaTest tunnel (LT) running on
**your machine**:

```
real device ── LT tunnel ── your machine ── your backend
```

kane-cli never starts or stops the tunnel. You run it in your own terminal, so your access key stays with you.

1. If `LT --version` doesn't work, download LT and put it on your PATH:

   | Machine | Download |
   |---|---|
   | Apple silicon Mac | https://downloads.lambdatest.com/tunnel/v3/mac/arm64/LT_Mac.zip |
   | Intel Mac | https://downloads.lambdatest.com/tunnel/v3/mac/64bit/LT_Mac.zip |
   | Linux | https://downloads.lambdatest.com/tunnel/v3/linux/64bit/LT_Linux.zip (`linux/arm64/LT_Linux.zip` on ARM) |
   | Windows | https://downloads.lambdatest.com/tunnel/v3/windows/64bit/LT_Windows.zip, then run `LT.exe` |

   If macOS blocks it from opening: `xattr -d com.apple.quarantine /usr/local/bin/LT` (or wherever you put it).
2. Start the tunnel as the same user kane-cli is signed in as, and leave it running. Where the run happens decides
   the `--env`:

   | The run | Start LT with |
   |---|---|
   | `run`, `testmd run` or `testrun run` from your machine | `LT --user "$LT_USERNAME" --key "$LT_ACCESS_KEY" --tunnelName dev` (no `--env`) |
   | `testrun run --remote` (the cloud grid) | `LT --user "$LT_USERNAME" --key "$LT_ACCESS_KEY" --env ht-prod --tunnelName dev` |

   (`$LT_USERNAME` and `$LT_ACCESS_KEY` are your username and access key: set them in your shell first.
   [Where to find your access key](../authentication.md#where-to-find-your-access-key).) Wait until LT says the tunnel
   is connected.
3. In another terminal, run with the tunnel:

   ```bash
   kane-cli run "Sign in and open the orders tab" --target android --app ./builds/app-debug.apk --tunnel-name dev
   kane-cli testmd run tests/devices/orders_test.md --tunnel-name dev
   kane-cli testrun run --match '^tests/devices/' --tunnel-name dev < /dev/null
   kane-cli testrun run --match '^tests/devices/' --remote --tunnel-name dev
   ```

   kane-cli says which tunnel it uses before the device opens:

   ```
   Connecting to a real Android device through LT tunnel dev…
   ```

- **`--tunnel-name` must match `--tunnelName`** from step 2, and it turns the tunnel on. With only one tunnel running,
  `--tunnel` alone is enough: the device uses your one running tunnel.
- **Every member uses it.** On `testrun run`, the tunnel applies to every real-device member, locally and on the grid.
- **On the grid, name it.** With `--remote` and `--tunnel-name`, the cloud checks that the tunnel is up before the job
  starts, so a missing tunnel fails fast instead of mid-run.
- **Keep the tunnel and your machine up** until the run ends. If the tunnel drops, the app stops reaching its backend.
- **Real devices only.** On the `desktop`, `emulator` and `simulator` targets the flags do nothing: a browser or a
  virtual device on your Mac already reaches your machine. For an exploration through a tunnel, see
  [Exploration](../exploration.md#an-app-on-localhost-or-a-private-network).

## Limitations

- **No adaptive heal.** A replay step that fails is not repaired, and the test fails. kane-cli prints `note: adaptive heal is off on real devices…` on a replay.
- **No `no_reset`.** Every session installs the app fresh.
- **Idle sessions drop.** The hub ends a session left idle too long. In the TUI, the next objective opens a new one.
- **The live view needs Chrome** and never opens for agent runs.

## Troubleshooting

| You see | Fix |
|---|---|
| `failed to open the mobile hub session: <reason>` | Check that your account has KaneAI Max or KaneAI credits + Real Device Plus Automation Cloud, and that you aren't over your plan's devices. The reason comes from the hub. |
| `a real-device run needs your TestMu AI username and access key, and none were found.` | `kane-cli login`, or pass `--username` and `--access-key`. |
| `"X" is not available as a real Android device.` | Pick a name from `kane-cli devices list --target android --remote`. |
| `no real Android device runs Android 9.` | Pick a version the list shows, or drop `--os-version`. |
| `no real Android devices are listed right now — try again later.` | The hub has no devices for that platform at the moment. Try again later. |
| `… cannot run on a real iOS device — use an .ipa file, or an iOS app ID …` | Use the build type the platform takes (see the table at the top). |
| `no app for this real-device test — add app: <path-to-build \| AppId> to the file, or pass --app.` | Add `app:` to the file, or pass `--app`. |
| `… has to be uploaded before it can run on a real device, but your account's org id was not found.` | `kane-cli login` again, or use an `APP…` id from `kane-cli apps list`. |
| `error: real devices are not listed from this machine — add --remote` | Add `--remote` to `devices list`. |
| `failed to start: the mobile hub refused the tunnel (hub: either tunnel is not running or disconnected)` | The lines after it list what to check: an LT tunnel is running under the same account; only one is running, or you passed `--tunnel-name`; and it was started with no `--env` for a run from your machine, or `--env ht-prod` for `--remote`. See [A private or local backend](#a-private-or-local-backend-lt-tunnel). |
| A tunnel error from the cloud on `--remote`, followed by `next: start LT with --env ht-prod … --tunnelName <name>, under the same account` | The grid couldn't find the named tunnel. Start LT with `--env ht-prod` and the same `--tunnelName`, as the same user. |
| `error: --tunnel-name: the name the LT tunnel was started with (--tunnelName)` | The name was blank. Pass the name from LT's `--tunnelName`. |

## Next steps

- [Mobile testing](./overview.md): all mobile targets compared
- [Remote runs on the cloud grid](../remote-execution.md)
- [Evidence](../evidence.md): what a real-device run records
