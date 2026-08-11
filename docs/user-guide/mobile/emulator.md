# Android Emulator setup (mac-arm64)

Set up Google's Android Emulator once, and kane-cli can run mobile tests against it. This guide targets **macOS on Apple Silicon (arm64)**, the only supported host for this release. See [Mobile testing](./overview.md) for the full picture.

> The exact Android API levels and device profiles in the supported matrix are pinned by the product team. The values shown below (API 35, Pixel) are current, working examples. Confirm the officially supported set before you rely on a specific one.

> **On Apple Silicon, always use an `arm64-v8a` system image.** x86 and x86_64 images do not run natively and are effectively unusable. This is the single most common setup mistake.

## 1. Install Android Studio

kane-cli does not ship an Android SDK, emulator, or system image. Install **Android Studio**, which bundles the Android SDK, the emulator, the system-image manager, and the Device Manager. Download it from the Android developer site and run the first-launch setup wizard, which installs the SDK and `platform-tools`.

If you prefer a headless setup, install the command-line SDK tools and use `sdkmanager` and `avdmanager` directly.

## 2. Install an arm64 system image

Install a system image with the **`arm64-v8a`** ABI. In the Android Studio SDK Manager, tick an API level image whose ABI is `arm64-v8a`. From the command line:

```bash
sdkmanager "system-images;android-35;google_apis;arm64-v8a"
```

## 3. Create a virtual device (AVD)

kane-cli runs against an existing AVD; it does not create one for you. Create an Android Virtual Device from that image. In Android Studio, use **Device Manager -> Create Device** and pick the arm64 image. From the command line:

```bash
avdmanager create avd -n kane_pixel \
  -k "system-images;android-35;google_apis;arm64-v8a" \
  -d pixel
```

## 4. Point kane-cli at a non-default SDK location (only if needed)

kane-cli uses its own managed `adb`, so you do not need `platform-tools` or `adb` on your `PATH`. It only needs to find the **emulator binary and your AVDs**, which it looks for in the default SDK location `~/Library/Android/sdk`. If your SDK lives somewhere else, point kane-cli at it:

```bash
export ANDROID_HOME="/path/to/your/Android/sdk"   # only if not the default location
```

If your SDK is at the default path, skip this step.

## 5. Install the kane-cli test tooling

Sign in and let kane-cli install the tooling it manages for the emulator:

```bash
kane-cli login
kane-cli doctor --install
```

You do not need to boot the emulator or run `adb` yourself. kane-cli discovers the AVD, boots it, installs your app, and runs the test.

## Ready check

Confirm kane-cli sees a ready Android toolchain and, optionally, the AVDs on your machine:

```bash
kane-cli doctor              # required checks, each with a fix if it fails
kane-cli doctor --targets    # also list the emulators kane-cli can run against
```

When the Android checks pass and your AVD is listed, your emulator setup is complete.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Emulator boots extremely slowly or hangs | An x86 or x86_64 image on Apple Silicon | Recreate the AVD from an `arm64-v8a` system image |
| doctor cannot find the emulator, or "No Android emulator found" when picking a device | SDK in a non-default location, or no AVD created yet | Set `ANDROID_HOME`, and create an AVD in Android Studio -> Device Manager |
| Prompts to install Intel HAXM | Following an Intel-Mac guide | Not needed on Apple Silicon. It uses the built-in Hypervisor.framework, so skip HAXM |

## Next steps

- [iOS Simulator setup (mac-arm64)](./simulator.md)
- [Mobile testing overview](./overview.md)
