# Test Manager integration

By default, kane-cli uploads each session to TestmuAI Test Manager as a test case. This page covers what gets uploaded, where it ends up, and the related features that hang off the upload pipeline: project and folder selection, code export, share links, the post-session feedback prompt, and the local session directory.

This is the default behaviour for every session in both the TUI and the CLI. You do not need to opt in.

## What gets uploaded

When a session ends, kane-cli runs an upload pipeline that finalises the test case in Test Manager. Two kinds of artefacts move from your machine to TestmuAI:

- **Screenshots** — uploaded incrementally as the agent runs. By the time the session ends, most of them are already in place. PNG screenshots are converted to WebP before upload.
- **Run artefacts and metadata** — packaged at session exit. This includes the per-run action logs, an execution blob describing the run (objective, status, steps, durations, variables in scope), and the zipped contents of the session run directories.

You see a short progress indicator at exit covering these stages: `convert` (preparing the metadata), `zip` (packaging the run directories), `presign` (requesting upload URLs), `upload` (sending the zip and metadata), and `finalize` (committing the test case in Test Manager). If code export is enabled, a `code_export` stage runs after `finalize`. If it is disabled, that stage is reported as skipped.

If the upload fails, kane-cli prints the error and exits. The local session directory is preserved either way — see [Session history on disk](#session-history-on-disk).

## Choosing where uploads land

Each test case is filed under a Test Manager project. Optionally, you can also choose a folder inside that project.

### Project

Configure your project once, and every subsequent session uploads under it.

```bash
kane-cli config project
```

With no value, this opens a search-as-you-type picker. Projects are loaded from your Test Manager account on demand. Type to filter, use the arrow keys to navigate pages of five, press `Enter` to select, or `Tab` to create a new project. If your account has no projects yet, the picker jumps straight to the create flow.

You can also set a project non-interactively by ID:

```bash
kane-cli config project <project-id>
```

In the TUI, the same picker is available via the `/config` command.

### Folder

Folders are optional. Once a project is set, you can pick a folder the same way:

```bash
kane-cli config folder
```

This opens a search-as-you-type folder picker. As with projects, type to filter, `Enter` to select, `Tab` to create a new folder. Each folder is shown with its current test case count.

```bash
kane-cli config folder <folder-id>
```

If you try to set a folder before choosing a project, kane-cli asks you to pick a project first.

### Finding your test case in Test Manager

After a successful upload, kane-cli prints two links to the terminal (see [Share links at session exit](#share-links-at-session-exit)). Both lead into the TestmuAI Test Manager UI for the test case that was just created. From there you can browse the project and folder you configured, view the run summary, and dig into individual steps and screenshots.

## Code export

Code export converts a completed test case into runnable Playwright code that you can check into your repository or extend by hand.

### What it produces

Currently the only supported language is **Python with Playwright**. A JavaScript backend is wired into the configuration shape but intentionally disabled for now. Setting any other language is rejected.

Code export runs server-side after the test case is finalised. kane-cli polls Test Manager until generation is complete, then downloads the resulting files.

### Enabling code export

Code export is **off by default**. Turn it on either in your stored config or per-run on the CLI.

In `~/.testmuai/kaneai/tui-config.json`, set the `code_export` block:

```json
{
  "code_export": {
    "enabled": true,
    "language": "python",
    "skip_validation": true
  }
}
```

`enabled` controls whether code export runs at all. `language` must be `python`. `skip_validation` controls whether the worker-side validator is skipped after generation.

For one-off CLI runs, you can override the config with flags:

```bash
kane-cli run "Add an item to the cart" \
  --code-export \
  --code-language python \
  --skip-code-validation
```

`--no-skip-code-validation` forces validation on for that run. `--code-language` only accepts `python`.

### Where to find the output

Generated code is downloaded into a local directory under your session, by default `~/.testmuai/kaneai/sessions/<session-id>/code-export/`. At session exit kane-cli prints a `CodeExport` line in the links box pointing to that directory; the link uses your terminal's hyperlink support to open it.

The same code is also available alongside the test case in Test Manager.

## Share links at session exit

When the upload finishes successfully, kane-cli prints a small links block to the terminal. You see up to three links, depending on what was generated:

- **ShareLink** — a public-style URL into the test case dashboard that includes a short-lived share ID. Anyone you send this link to can view the run summary in TMS without needing access to the project. Links are issued with a seven-day expiry.
- **TestCase** — a direct URL to the test case dashboard inside your Test Manager project. Use this when you are signed in to TestmuAI and want to drill into the run.
- **CodeExport** — a `file://` link to the directory on your machine that holds the generated Playwright code. Only shown when code export is enabled and produced files.

The links survive the terminal exit and remain in your scrollback, so you can come back to them after kane-cli has quit.

## Feedback prompt

After a session uploads successfully, kane-cli shows a small thumbs-up / thumbs-down prompt at the bottom of the terminal. Use the left and right arrow keys to switch between the two options, `Enter` to submit, or `Esc` to skip. Skipping sends nothing.

If you submit, kane-cli posts your choice (positive or negative) for the test case that was just finalised. The prompt only appears when there is a test case to rate — sessions that had no successful upload skip it. Both the TUI and the CLI render the same prompt; in the CLI it appears on stderr after the links block.

You can also submit feedback after the fact for a known test case:

```bash
kane-cli feedback --test-id <test-id> --feedback-type positive
kane-cli feedback --test-id <test-id> --feedback-type negative --details "..."
```

## Session history on disk

Every session, regardless of upload outcome, leaves a directory on your machine you can inspect later:

```text
~/.testmuai/kaneai/sessions/<session-id>/
├── session.json         # Metadata: started_at, ended_at, model, profile,
│                        # test_id, testcase_id, upload_status, run summaries
├── tui.log              # Append-only event log for the TUI session
├── runs/<n>/            # One directory per run in the session
│   └── run-test/
│       └── actions.ndjson  # Step-by-step record of what the agent did
└── code-export/         # (when code export is enabled) Generated code files
```

`<session-id>` is a UUID generated when the session starts. The runner writes its step logs and screenshots into `runs/<n>/`, where `n` increments per run within the session.

This directory is useful when you want to look back at a past run without going to Test Manager, debug a session that failed to upload, or hand a teammate the raw artefacts.
