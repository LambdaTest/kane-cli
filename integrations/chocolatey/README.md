# Chocolatey package

Source for the [`kane-cli`](https://community.chocolatey.org/packages/kane-cli) package on the Chocolatey Community Repository.

```powershell
choco install kane-cli
```

The package depends on `nodejs-lts` and installs the npm package `@testmuai/kane-cli` globally at the version pinned in `tools/chocolateyInstall.ps1`. npm adds the bundled Node runtime, browser runner and assurance agent for Windows.

## Layout

```text
integrations/chocolatey/
  kane-cli.nuspec              package metadata (version, description, dependency)
  tools/chocolateyInstall.ps1  npm install -g @testmuai/kane-cli@<version>
  tools/chocolateyUninstall.ps1
  update.ps1                   bumps both versions to the latest npm release (chocolatey-au)
```

## Publishing a new version

On Windows, with Chocolatey installed:

```powershell
cd integrations/chocolatey
./update.ps1                  # or edit the version in kane-cli.nuspec and tools/chocolateyInstall.ps1
choco pack
choco install kane-cli --source . -y   # local test
kane-cli --version
choco uninstall kane-cli -y
choco push kane-cli.<version>.nupkg --source https://push.chocolatey.org/ --api-key <key>
```

Each version goes through Chocolatey's automated checks and, until the package is trusted, a human review.
