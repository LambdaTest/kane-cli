# Install fails with "sharp: Please add node-addon-api"

## Symptom

`npm install -g @testmuai/kane-cli` fails with:

```
npm error sharp: Attempting to build from source via node-gyp
npm error sharp: Please add node-addon-api to your dependencies
```

This can happen on any Node version (18, 20, 22, 26) and any platform (macOS, Linux, Windows).

> **kane-cli 0.3.4+:** sharp is an optional dependency. The install will succeed even if sharp fails — screenshots will upload as PNG instead of WebP (~30% larger, no functional impact). If you're on an older version, upgrade first: `npm install -g @testmuai/kane-cli@latest`.

## Root cause

kane-cli uses [sharp](https://sharp.pixelplumbing.com/) for optional PNG→WebP screenshot compression during upload. sharp 0.34+ ships its native binary via platform-specific optional packages (`@img/sharp-darwin-arm64`, etc.). When sharp can't load its prebuilt binary, it falls back to building from source — which fails because `node-addon-api` isn't present.

The three most common triggers, in order of likelihood:

### 1. System libvips detected (macOS — most common)

sharp's `install/check.js` runs `pkg-config --modversion vips-cpp`. If it finds a system-wide libvips, it skips the bundled prebuilt and tries to compile against the system copy — which always triggers the source-build failure.

**How libvips gets on your system:** it's a transitive dependency of several Homebrew formulas. You almost certainly didn't install it directly. The most common culprits:

- `brew install appium` — Appium depends on vips for image processing
- `brew install imagemagick` — pulls vips as a dependency on some configurations
- `brew install gdal`, `brew install inkscape` — other graphics-heavy formulas

**Diagnosis:**

```bash
# Is libvips installed?
pkg-config --modversion vips-cpp
# If this prints a version (e.g. 8.18.2), that's the cause.

# What brew formula pulled it in?
brew uses --installed vips

# When was it installed?
ls -la /opt/homebrew/Cellar/vips/
```

**Fix:**

```bash
# Option A: bypass libvips detection (recommended)
# You must uninstall first — reinstalling without uninstall won't re-resolve
# sharp because npm considers kane-cli already installed.
npm uninstall -g @testmuai/kane-cli
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g @testmuai/kane-cli

# Make it permanent so future installs/upgrades just work:
echo 'export SHARP_IGNORE_GLOBAL_LIBVIPS=1' >> ~/.zshrc
source ~/.zshrc

# Option B: remove libvips if nothing else needs it
brew uses --installed vips   # check first
brew uninstall vips && brew autoremove
```

### 2. npm skipped optional dependencies

sharp's platform-specific packages (`@img/sharp-darwin-arm64`, etc.) are in its `optionalDependencies`. If npm is configured to skip optionals, the prebuilt binary is never downloaded and sharp falls back to source build.

**Diagnosis:**

```bash
npm config get omit          # should NOT contain "optional"
cat ~/.npmrc | grep -i omit  # should be empty
env | grep -i NPM_CONFIG_OMIT
```

**Fix:**

```bash
# Force optionals for this install
npm uninstall -g @testmuai/kane-cli
npm install -g @testmuai/kane-cli --include=optional

# Or remove the config permanently
npm config delete omit
```

### 3. Proxy or firewall blocking @img/* packages

sharp's prebuilt packages live under the `@img` npm scope on the public registry. If a corporate proxy, firewall, or private registry mirror doesn't forward `@img/*`, the downloads silently fail (npm treats optional-dep download failures as non-fatal) and sharp falls back to source build.

**Diagnosis:**

```bash
# Check if proxy is set
env | grep -iE "proxy|PROXY"

# Try fetching sharp's platform package directly
npm view @img/sharp-darwin-arm64 version

# If ECONNREFUSED on localhost — you have a local proxy that's either
# down or only listening on IPv4 while npm resolves to IPv6 (::1)
```

**Fix:**

Ensure your proxy or registry mirror forwards the `@img` scope. If using a private registry (Artifactory, Verdaccio, GitHub Packages), add a pass-through in your `.npmrc`:

```ini
@img:registry=https://registry.npmjs.org/
```

## Impact when sharp is unavailable

Starting from kane-cli 0.3.4+, sharp is an optional dependency. When sharp is not installed:

- The install **succeeds** — it will not crash
- Screenshots upload as **PNG instead of WebP** (~30% larger)
- All other kane-cli functionality works normally
- No warning is printed (npm suppresses lifecycle script output for global installs)

**No action is required** if you're OK with slightly larger screenshot uploads. The fixes above are only needed if you want WebP compression.

## Quick reference

| Cause | Diagnosis | Fix |
|-------|-----------|-----|
| System libvips (macOS) | `pkg-config --modversion vips-cpp` | `export SHARP_IGNORE_GLOBAL_LIBVIPS=1` then uninstall + reinstall |
| npm skips optionals | `npm config get omit` | `npm config delete omit` then uninstall + reinstall |
| Proxy blocks @img/* | `npm view @img/sharp-darwin-arm64` | Add `@img` pass-through to proxy/registry |
| Bleeding-edge Node | `node -v` | Use Node 22 LTS |
