# Getting started

This guide takes you from a fresh install to a passing run in under five minutes. It uses desktop web, the default target. For Android and iOS (emulator, simulator, or real device), see [Mobile testing](./mobile/overview.md). To generate a whole suite from your requirements, see [the assurance lifecycle](./assurance/overview.md).

## 1. Install

If you have not installed kane-cli yet, follow the steps in [installation](./installation.md). Once `kane-cli --version` prints a version number on your terminal, return here.

## 2. Log in

kane-cli authenticates against your TestmuAI account. The simplest path is OAuth:

```bash
kane-cli login
```

Your default browser opens on a TestmuAI consent page. Sign in (or confirm, if you are already signed in), authorise the CLI, and the page will tell you it is safe to close the tab. Control returns to your terminal and your credentials are stored under `~/.testmuai/kaneai/profiles/`.

If you prefer username and access key, or need to script logins on a CI runner, see [authentication](./authentication.md).

## 3. Open the TUI

Run `kane-cli --tui`:

```bash
kane-cli --tui
```

You see a short boot animation: a small VR-helmet sprite renders on the left and the words `KANE CLI` build up next to it in block letters. A grey footer below confirms which profile you are logged in as. After the animation, the main view drops you at a chat prompt with a status bar at the bottom showing your model, session ID, environment, and run count.

```text
[ VR helmet ]   ███   ███   █████   █████   ████████
              ████  ███   ███ ███   ███ ███   █
              ...   ...     KANE CLI       ...

  Welcome to KANE CLI · logged in as you@example.com

> Type an objective, or /help for commands_
```

The exact glyphs are decorative; what matters is that you reach the chat prompt at the bottom. From there, anything you type is treated as a test objective. Lines that begin with `/` are slash commands such as `/help`, `/config`, `/cancel`, and `/exit`.

## 4. Run your first test

At the chat prompt, type a natural-language objective and press Enter. For example:

```text
Search for "wireless headphones" on Amazon and add the first result to cart
```

kane-cli launches Chrome, hands the objective to the agent, and starts streaming progress. You see a step tree fill in as the agent thinks, observes the page, and acts: clicking, typing, scrolling, and verifying. When the agent is done, a result block reports whether the objective passed or failed and how many steps it took.

If you ever need to stop a run, press `Ctrl+C` once. Pressing it twice exits kane-cli.

## 5. Or run from the command line

For scripting and CI, skip the TUI and use the `run` subcommand:

```bash
kane-cli run "Click the 'More information' link"
```

In CLI mode, kane-cli streams progress to **stderr**, prints the final result as a single JSON object on **stdout**, and exits with a status code that reflects the outcome (`0` passed, `1` failed, `2` error, `3` timeout or cancellation). This makes it easy to capture results in a shell script:

```bash
kane-cli run "Verify the homepage loads" > result.json
```

By default each run starts on the KaneAI playground site. The agent navigates from there based on your objective.

## What happens at the end of a run

When the session ends, kane-cli uploads the run to TestmuAI Test Manager and prints a share link. The run is also captured as a sealed [evidence pack](./evidence.md) — screenshots, logs, and results in one file you can open in the browser viewer when kane-cli offers it. For details on the upload, the share-link experience, and the run mode toggle, see [test-manager-integration](./test-manager-integration.md). To change settings like window size, Chrome profile, or the active project and folder, see [configuration](./configuration.md).

## With your team

If your team keeps its tests in a Test Manager project, work in it as a **shared project**: what you design there, your teammates see and run. From an empty folder:

```bash
kane-cli projects list --search "Checkout"                 # find the project's id
kane-cli context ingest prd.md --project <id>              # link this folder, add the document, find its use-cases
kane-cli design tests --use-case uc-1                      # design one use-case's tests, then save
kane-cli testrun run                                       # run them
kane-cli cover                                             # the project's coverage
```

<!-- release: needs context pull -->
To join a project your teammate already started, run `kane-cli context pull --project <id>` in a new folder: it links the folder and brings the project's tests. See [Shared projects](./assurance/shared-projects.md).

Keep quick `kane-cli run` experiments in a different folder: `kane-cli run` uploads to your profile's project, not to the shared one.

## Next steps

- [Running tests](./running-tests.md)
- [Evidence packs](./evidence.md)
- [Configuration](./configuration.md)
- [Authentication](./authentication.md)
- [Shared projects](./assurance/shared-projects.md) — design and run tests with your team.
- [Exploration](./exploration.md) — map your app and design tests from what it finds, without a requirements document.

## Reviews

Kane CLI is listed on [agent.reviews](https://agent.reviews), where coding agents review the developer tools they use after real tasks.

If you want your agent to review the tools it works with, including this one, set it up at [agent.reviews/install](https://agent.reviews/install). Your agent writes the review, it covers the tool and the broad task only, and it never includes your code, prompts or logs.
