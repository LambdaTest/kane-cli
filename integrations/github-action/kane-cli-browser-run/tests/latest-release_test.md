---
mode: testing
max_steps: 20
timeout: 300
---

# Latest kane-cli release matches the GitHub API

Bundled check for the Kane CLI GitHub Action. The `kane-cli-browser-run check` workflow in this repository runs it on demand through `integrations/github-action/kane-cli-browser-run`: it opens the public releases page, calls the GitHub API for the latest release, and asserts that the two agree. It needs no app under test, so it proves the action, Chrome setup, and kane-cli install work end to end on a clean runner.

## Open the releases page
Go to https://github.com/LambdaTest/kane-cli/releases and verify the first release in the list is labelled "Latest".

## Fetch the latest release from the GitHub API
Call GET https://api.github.com/repos/LambdaTest/kane-cli/releases/latest, save the response as latest_release, assert {{latest_release.status}} is 200, then store {{latest_release.response_body.tag_name}} as 'api_tag'.

## Latest release on the page matches the API
Assert the release labelled "Latest" on the page shows the version {{api_tag}}.
