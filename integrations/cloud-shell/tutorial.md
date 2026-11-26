# Kane CLI quickstart

<walkthrough-tutorial-duration duration="10"></walkthrough-tutorial-duration>

## Welcome

Kane CLI by TestMu AI (formerly LambdaTest) tests web apps from plain-English instructions. You describe what to check; an AI agent drives a real Chrome browser and reports pass or fail, with evidence.

In this tutorial you will:

1. Install Kane CLI and Chrome in Cloud Shell
2. Sign in with your TestMu AI account
3. Run a one-off test from a sentence
4. Run a saved test file you can commit to your repo

You need a TestMu AI account. If you don't have one, [sign up free](https://www.testmuai.com/register/).

Click **Start** to begin.

## Install Kane CLI and Chrome

Cloud Shell already has Node.js. The setup script adds Google Chrome, which Kane CLI drives, and installs Kane CLI from npm.

Click the copy button <walkthrough-cloud-shell-icon></walkthrough-cloud-shell-icon> on the command below to send it to the terminal, then press Enter. It moves into the quickstart folder and runs the setup script:

```sh
cd "$(git rev-parse --show-toplevel)/integrations/cloud-shell" && bash setup.sh
```

It takes about a minute. When it finishes, it prints the Chrome and Kane CLI versions.

<walkthrough-footnote>This Cloud Shell session is temporary, so you run setup again each time you open the tutorial.</walkthrough-footnote>

## Sign in

Kane CLI signs in with your TestMu AI username and access key. Find both on your [TestMu AI profile page](https://accounts.lambdatest.com/detail/profile).

Run this command. It asks for your username, then your access key (the key isn't shown as you type or paste it):

```sh
read -r -p "Username: " LT_USERNAME && read -r -s -p "Access key: " LT_ACCESS_KEY && echo && kane-cli login --username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"
```

Check that you're signed in:

```sh
kane-cli whoami
```

## Run your first test

Describe a test in one sentence. Kane CLI opens Chrome without a window (`--headless`, since Cloud Shell has no screen), works through the steps, and checks the result:

```sh
kane-cli run "Go to https://www.testmuai.com/selenium-playground/simple-form-demo/, type 'Hello Kane' into the Enter Message field, click Get Checked Value, and verify the page shows 'Hello Kane'" --headless --timeout 300
```

The run ends with a pass or fail summary, what the agent did, and a share link to the session in TestMu AI Test Manager.

Check the exit code: `0` means the test passed.

```sh
echo $?
```

## Save a test as a file

One-off runs are good for exploring. For tests you want to keep, write them as Markdown files and commit them next to your code.

Open <walkthrough-editor-open-file filePath="integrations/cloud-shell/tests/playground_test.md">tests/playground_test.md</walkthrough-editor-open-file>. Each `##` heading is a step written in plain English.

Run it:

```sh
kane-cli testmd run tests/playground_test.md --headless
```

The first run works out each step with AI and saves a recording in `tests/output-playground/`. Run the same command again: this time Kane CLI replays the recording in seconds, with no AI cost.

```sh
kane-cli testmd run tests/playground_test.md --headless
```

Try editing a step, or add a new `##` step, and run it again. Only the changed steps are worked out again.

## Conclusion

<walkthrough-conclusion-trophy></walkthrough-conclusion-trophy>

You installed Kane CLI, signed in, and ran both a one-off test and a saved test file.

Next steps:

* Write tests for your own app: copy `tests/playground_test.md` and change the steps.
* Run Kane CLI in CI: see the [CI/CD recipes](https://github.com/LambdaTest/kane-cli/blob/main/docs/user-guide/cicd.md).
* Read the full [Kane CLI documentation](https://github.com/LambdaTest/kane-cli#readme). The whole kane-cli repo is open in the editor, including `docs/user-guide/`.
* Learn more about [Kane CLI](https://www.testmuai.com/kane-cli/).
