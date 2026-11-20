$ErrorActionPreference = 'Stop'

$version = '0.10.5'

Update-SessionEnvironment
$npm = (Get-Command npm.cmd).Path

Write-Host "Installing @testmuai/kane-cli@$version with npm..."
& $npm install --global "@testmuai/kane-cli@$version"
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE"
}
