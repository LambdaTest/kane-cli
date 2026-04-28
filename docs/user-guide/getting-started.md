# Getting started

This guide takes you from a fresh install to a passing run in under five minutes.

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

When the session ends, kane-cli uploads the run to TestmuAI Test Manager and prints a share link. For details on the upload, the share-link experience, and the run mode toggle, see [tms-integration](./tms-integration.md). To change settings like window size, Chrome profile, or the active project and folder, see [configuration](./configuration.md).

## Next steps

- [Running tests](./running-tests.md)
- [Configuration](./configuration.md)
- [Authentication](./authentication.md)
