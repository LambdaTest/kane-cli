# Configuration

kane-cli stores persistent settings at `~/.testmuai/kaneai/tui-config.json`. Most settings are managed through `kane-cli config` subcommands; a few are managed through interactive pickers in TUI mode, and one (the code-export block) is toggled from the TUI menu.

This page covers the persistent settings stored in `tui-config.json`. Authentication credentials are managed separately under `~/.testmuai/kaneai/profiles/` — see [authentication.md](./authentication.md).

## Viewing settings

Print the current configuration with:

```bash
kane-cli config show
```

The output groups settings under three headings:

```text
Configuration

Auth
  method   oauth | basic (user@example.com) | not configured
  profile  default
  env      prod

Defaults
  url      https://kaneai-playground.lambdatest.io
  model    v16-alpha
  mode     testing
  window   1920x1080
  project  (none)
  folder   (none)

Paths
  chrome   /Users/you/.testmuai/kaneai/chrome-profiles/work
```

Empty fields are shown as `(none)`. The `chrome` path is empty by default, in which case kane-cli launches Chrome with a temporary profile each run.

## Settings reference

Every field in `tui-config.json`:

| Field | Type | Default | Description | How to change |
|-------|------|---------|-------------|---------------|
| `window_size.width` | integer | `1920` | Chrome window width in pixels (800–3840) | `kane-cli config set-window <WxH>` |
| `window_size.height` | integer | `1080` | Chrome window height in pixels (600–2160) | `kane-cli config set-window <WxH>` |
| `chrome_profile_path` | string | `""` | Filesystem path to a Chrome user-data dir. Empty means a fresh, temporary profile is used per run. | `kane-cli config chrome-profile [path]` |
| `default_url` | string \| null | `https://kaneai-playground.lambdatest.io` | Starting URL used when a run begins. | (internal default) |
| `model` | string | `"v16-alpha"` | Reasoning + vision model used by the agent. | (internal default) |
| `project_id` | string \| null | `null` | TestmuAI TMS project ID for upload | `kane-cli config project [id]` |
| `project_name` | string \| null | `null` | Display name of the selected project (set automatically by the picker) | set by `kane-cli config project` |
| `folder_id` | string \| null | `null` | TestmuAI TMS folder ID for upload | `kane-cli config folder [id]` |
| `folder_name` | string \| null | `null` | Display name of the selected folder (set automatically by the picker) | set by `kane-cli config folder` |
| `mode` | `"action"` \| `"testing"` | `"testing"` | Agent behaviour when the run hits an authentication wall, blocked page, or error page. See below. | `kane-cli config set-mode <action\|testing>` |
| `code_export.enabled` | boolean | `false` | Whether to generate a code export after the upload pipeline completes (requires a TMS upload). | TUI menu, or per-run `--code-export` flag |
| `code_export.language` | `"python"` | `"python"` | Output language for the generated code. Only `python` is supported today. | per-run `--code-language <lang>` |
| `code_export.skip_validation` | boolean | `true` | Skip the post-codegen worker-side validation step. | TUI menu, or per-run `--skip-code-validation` / `--no-skip-code-validation` |

## Updating settings

### Window size

The Chrome window is launched at the configured resolution. Update it from the CLI:

```bash
kane-cli config set-window 1280x800
```

The format is `WIDTHxHEIGHT` (lowercase `x` separator). Width must be between 800 and 3840; height must be between 600 and 2160. Invalid values are rejected without changing the saved config.

In TUI mode, the same setting can be edited through an interactive window-size picker that lets you type the width and height, validates the bounds, and previews the new size before saving.

### TMS project

```bash
kane-cli config project
```

In a TTY, this opens an interactive project picker. The picker fetches the projects available to your active profile, lets you search and arrow-key through them, and saves the chosen `project_id` and `project_name`. Login is required before the picker can fetch projects.

You can also set a project ID directly without the picker:

```bash
kane-cli config project <project-id>
```

See [tms-integration.md](./tms-integration.md) for how project selection feeds into uploads.

### TMS folder

```bash
kane-cli config folder
```

Opens an interactive folder picker for the currently selected project. Folders are searchable and shown with their hierarchy. The picker writes both `folder_id` and `folder_name`. You must have a project selected first.

To set a folder ID without the picker:

```bash
kane-cli config folder <folder-id>
```

See [tms-integration.md](./tms-integration.md) for how folder selection feeds into uploads.

### Mode

```bash
kane-cli config set-mode action
kane-cli config set-mode testing
```

`mode` controls how the agent behaves when a run hits an authentication wall, a blocked page, or an error page:

- **`testing`** (default) — the agent treats those pages as part of the run and continues. Use this when you have set up the test and expect the agent to push through gates that would otherwise stop a real user.
- **`action`** — the agent hard-stops on authentication, blocked, and error pages so you can intervene manually before the run proceeds.

You can override the saved mode for a single run with `--mode <action|testing>` on `kane-cli run`.

### Code export

The `code_export` block enables and configures generated code output that is produced after a successful TMS upload. There is no `kane-cli config` subcommand for this block. Set it from one of:

- **The TUI** — open the config menu, choose Code Export, and toggle the `enabled` and `skip_validation` switches. The TUI writes the change back to `tui-config.json`.
- **Per-run flags** on `kane-cli run`:
  - `--code-export` to enable for this run only.
  - `--code-language <lang>` to pick the output language (only `python` is supported today).
  - `--skip-code-validation` / `--no-skip-code-validation` to control post-codegen worker-side validation.

Code export requires a TMS upload to run, so it is only meaningful when `mode` is `testing` and a project/folder are configured. See [tms-integration.md](./tms-integration.md) for the full upload pipeline.

## Chrome management

### Chrome profile

By default, `chrome_profile_path` is empty and kane-cli launches Chrome with a fresh, temporary user-data directory each run. A clean per-run profile keeps state out of your everyday browser, isolates cookies and storage between runs, and prevents extensions, password autofill, or signed-in sessions from leaking into automation.

When you select a named Chrome profile, kane-cli stores it under `~/.testmuai/kaneai/chrome-profiles/<name>` and reuses that directory across runs. This is useful when a test depends on having a logged-in session, a saved address, or a specific extension installed.

### Choosing a different profile

```bash
kane-cli config chrome-profile
```

In a TTY, this opens an interactive Chrome-profile picker. The picker lists every profile under `~/.testmuai/kaneai/chrome-profiles/` plus a "temporary" entry that clears the path back to empty (per-run fresh profiles). You can also create a new named profile from the picker — kane-cli creates the directory under `~/.testmuai/kaneai/chrome-profiles/<name>` and saves the path.

To set a path directly without the picker:

```bash
kane-cli config chrome-profile /absolute/path/to/profile
```

### Headless mode

To run Chrome without a visible window, pass `--headless` on `kane-cli run`:

```bash
kane-cli run "Verify the home page loads" --headless
```

Headless mode is per-run; there is no persistent setting in `tui-config.json`. It is the right choice for CI and other environments without a display.

### Window size

The Chrome window dimensions used for both headed and headless modes come from the `window_size` setting. See [Window size](#window-size) above to update them.

## Resetting settings

There is no `kane-cli config reset` subcommand today. To reset persistent settings to defaults, delete the config file:

```bash
rm ~/.testmuai/kaneai/tui-config.json
```

kane-cli will recreate the file with defaults the next time it writes a setting. This only resets `tui-config.json`. It does **not** affect:

- Authentication credentials under `~/.testmuai/kaneai/profiles/` (use `kane-cli logout` to remove those).
- Session history under `~/.testmuai/kaneai/sessions/`.
- Variables under `~/.testmuai/kaneai/variables/` and `.testmuai/variables/`.
- Chrome profiles under `~/.testmuai/kaneai/chrome-profiles/`.
