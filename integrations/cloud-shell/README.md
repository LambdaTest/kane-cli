# Kane CLI quickstart in Google Cloud Shell

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/LambdaTest/kane-cli&cloudshell_git_branch=main&cloudshell_tutorial=integrations/cloud-shell/tutorial.md&show=ide%2Cterminal)

Try [Kane CLI](../../README.md) by TestMu AI (formerly LambdaTest) in your browser, with nothing to install on your machine. Kane CLI tests web apps from plain-English instructions: an AI agent drives a real Chrome browser and reports pass or fail, with evidence.

## Open in Cloud Shell

Click the button above. Google Cloud Shell clones the kane-cli repo and opens a step-by-step tutorial in the side panel. In about 10 minutes you will:

1. Install Kane CLI and Chrome
2. Sign in with your TestMu AI account
3. Run a test from one sentence
4. Run a saved test file that replays from cache

You need a Google account for Cloud Shell and a [TestMu AI account](https://www.testmuai.com/register/) for Kane CLI. Cloud Shell is free to use. Because the repo isn't published by Google, Cloud Shell opens it in a temporary session that is deleted when you close it.

## Run it on your own machine

On Debian or Ubuntu (x86_64) with Node.js 18+:

```bash
git clone https://github.com/LambdaTest/kane-cli
cd kane-cli/integrations/cloud-shell
bash setup.sh
kane-cli login
kane-cli testmd run tests/playground_test.md --headless
```

On macOS or Windows, install Kane CLI with `npm install -g @testmuai/kane-cli` and make sure Google Chrome is installed, then run the last two commands. See the [Kane CLI install guide](../../README.md#install) for other options.

## What's in this folder

| File | What it does |
|---|---|
| `tutorial.md` | The Cloud Shell walkthrough |
| `setup.sh` | Installs Google Chrome and Kane CLI (Debian/Ubuntu x86_64) |
| `tests/playground_test.md` | A sample test written in plain English, one step per `##` heading |

## Learn more

- [Kane CLI product page](https://www.testmuai.com/kane-cli/)
- [CI/CD recipes](../../docs/user-guide/cicd.md)

## Support

Email [support@testmuai.com](mailto:support@testmuai.com) or [open an issue](https://github.com/LambdaTest/kane-cli/issues).
