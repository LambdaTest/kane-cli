$ErrorActionPreference = 'Stop'

Update-SessionEnvironment
$npm = (Get-Command npm.cmd).Path

Write-Host "Uninstalling @testmuai/kane-cli with npm..."
& $npm uninstall --global "@testmuai/kane-cli"
if ($LASTEXITCODE -ne 0) {
    throw "npm uninstall failed with exit code $LASTEXITCODE"
}
