# Updates the package to the latest @testmuai/kane-cli on npm.
# Requires the chocolatey-au module: choco install chocolatey-au
import-module chocolatey-au

function global:au_GetLatest {
    $latest = Invoke-RestMethod 'https://registry.npmjs.org/@testmuai/kane-cli/latest'
    @{ Version = $latest.version }
}

function global:au_SearchReplace {
    @{
        'tools\chocolateyInstall.ps1' = @{
            "(?m)^\`$version = '.*'" = "`$version = '$($Latest.Version)'"
        }
    }
}

update -ChecksumFor none
