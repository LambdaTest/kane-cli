---
id: kane-cli-configuration
title: Configuration
sidebar_label: Configuration
description: Configure Kane CLI settings including window size, Chrome profiles, Test Manager project and folder, run mode, and code export.
keywords:
  - kane cli configuration
  - kane cli config
  - kane cli settings
  - kaneai
  - testmu ai
  - chrome profile
  - window size
url: https://www.testmuai.com/support/docs/kane-cli-configuration/
site_name: TestMu AI
slug: kane-cli-configuration/
displayed_sidebar: KaneCLISidebar
canonical: https://www.testmuai.com/support/docs/kane-cli-configuration/
---

import BrandName, { BRAND_URL } from '@site/src/component/BrandName';

<script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({
       "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.testmuai.com"
        },{
          "@type": "ListItem",
          "position": 2,
          "name": "Support",
          "item": "https://www.testmuai.com/support/docs/"
        },{
          "@type": "ListItem",
          "position": 3,
          "name": "Kane CLI",
          "item": "https://www.testmuai.com/support/docs/kane-cli-introduction/"
        },{
          "@type": "ListItem",
          "position": 4,
          "name": "Configuration",
          "item": "https://www.testmuai.com/support/docs/kane-cli-configuration/"
        }]
      })
    }}
></script>

Kane CLI stores persistent settings at `~/.testmuai/kaneai/tui-config.json`. Most settings are managed through `kane-cli config` subcommands; a few are managed through interactive pickers in TUI mode, and one (code export) is toggled from the TUI menu.

Authentication credentials are managed separately under `~/.testmuai/kaneai/profiles/` — see [Authentication](/support/docs/kane-cli-authentication/).

---

## Viewing Settings

Print the current configuration:

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

Empty fields are shown as `(none)`. The `chrome` path is empty by default, in which case Kane CLI launches Chrome with a temporary profile each run.

---

## Settings Reference

| Field | Type | Default | Description | How to Change |
|-------|------|---------|-------------|---------------|
| `window_size.width` | integer | `1920` | Chrome window width in pixels (800–3840) | `kane-cli config set-window <WxH>` |
| `window_size.height` | integer | `1080` | Chrome window height in pixels (600–2160) | `kane-cli config set-window <WxH>` |
| `chrome_profile_path` | string | `""` | Path to a Chrome user-data dir. Empty means a fresh profile per run. | `kane-cli config chrome-profile [path]` |
| `default_url` | string \| null | `https://kaneai-playground.lambdatest.io` | Starting URL when a run begins. | Internal default |
| `model` | string | `"v16-alpha"` | Reasoning + vision model used by the agent. | Internal default |
| `project_id` | string \| null | `null` | <BrandName /> Test Manager project ID for upload | `kane-cli config project [id]` |
| `project_name` | string \| null | `null` | Display name of the selected project | Set by `kane-cli config project` |
| `folder_id` | string \| null | `null` | <BrandName /> Test Manager folder ID for upload | `kane-cli config folder [id]` |
| `folder_name` | string \| null | `null` | Display name of the selected folder | Set by `kane-cli config folder` |
| `mode` | `"action"` \| `"testing"` | `"testing"` | Agent behaviour on auth walls, blocked pages, or error pages. | `kane-cli config set-mode <action\|testing>` |
| `code_export.enabled` | boolean | `false` | Generate code export after upload completes. | TUI menu, or `--code-export` flag |
| `code_export.language` | `"python"` | `"python"` | Output language for generated code. Only `python` is supported. | `--code-language <lang>` |
| `code_export.skip_validation` | boolean | `true` | Skip post-codegen worker-side validation. | TUI menu, or `--skip-code-validation` |

---

## Updating Settings

### Window Size

The Chrome window is launched at the configured resolution:

```bash
kane-cli config set-window 1280x800
```

The format is `WIDTHxHEIGHT` (lowercase `x` separator). Width must be between 800 and 3840; height must be between 600 and 2160. Invalid values are rejected without changing the saved config.

In TUI mode, the same setting can be edited through an interactive window-size picker.

### Test Manager Project

```bash
kane-cli config project
```

In a TTY, this opens an interactive project picker. The picker fetches the projects available to your active profile, lets you search and arrow-key through them, and saves the chosen `project_id` and `project_name`. Login is required before the picker can fetch projects.

You can also set a project ID directly without the picker:

```bash
kane-cli config project <project-id>
```

See [Test Manager Integration](/support/docs/kane-cli-tms-integration/) for how project selection feeds into uploads.

### Test Manager Folder

```bash
kane-cli config folder
```

Opens an interactive folder picker for the currently selected project. Folders are searchable and shown with their hierarchy. You must have a project selected first.

To set a folder ID without the picker:

```bash
kane-cli config folder <folder-id>
```

See [Test Manager Integration](/support/docs/kane-cli-tms-integration/) for how folder selection feeds into uploads.

### Mode

```bash
kane-cli config set-mode action
kane-cli config set-mode testing
```

`mode` controls how the agent behaves when a run hits an authentication wall, a blocked page, or an error page:

- **`testing`** (default) — the agent treats those pages as part of the run and continues. Use this when you expect the agent to push through gates that would otherwise stop a real user.
- **`action`** — the agent hard-stops on authentication, blocked, and error pages so you can intervene manually before the run proceeds.

You can override the saved mode for a single run with `--mode <action|testing>` on `kane-cli run`.

### Code Export

The `code_export` block enables and configures generated code output produced after a successful Test Manager upload. There is no `kane-cli config` subcommand for this block. Set it from one of:

- **The TUI** — open the config menu, choose Code Export, and toggle the `enabled` and `skip_validation` switches.
- **Per-run flags** on `kane-cli run`:
  - `--code-export` to enable for this run only
  - `--code-language <lang>` to pick the output language (only `python` is supported)
  - `--skip-code-validation` / `--no-skip-code-validation` to control post-codegen validation

Code export requires a Test Manager upload, so it is only meaningful when a project is configured. See [Test Manager Integration](/support/docs/kane-cli-tms-integration/) for the full upload pipeline.

---

## Chrome Management

### Chrome Profile

By default, `chrome_profile_path` is empty and Kane CLI launches Chrome with a fresh, temporary user-data directory each run. A clean per-run profile isolates cookies and storage between runs and prevents extensions, password autofill, or signed-in sessions from leaking into automation.

When you select a named Chrome profile, Kane CLI stores it under `~/.testmuai/kaneai/chrome-profiles/<name>` and reuses that directory across runs. This is useful when a test depends on having a logged-in session, a saved address, or a specific extension installed.

### Choosing a Different Profile

```bash
kane-cli config chrome-profile
```

In a TTY, this opens an interactive Chrome-profile picker. The picker lists every profile under `~/.testmuai/kaneai/chrome-profiles/` plus a "temporary" entry that clears the path back to empty (per-run fresh profiles). You can also create a new named profile from the picker.

To set a path directly without the picker:

```bash
kane-cli config chrome-profile /absolute/path/to/profile
```

### Headless Mode

To run Chrome without a visible window, pass `--headless` on `kane-cli run`:

```bash
kane-cli run "Verify the home page loads" --headless
```

Headless mode is per-run; there is no persistent setting. It is the right choice for CI and other environments without a display.

### Window Size

The Chrome window dimensions for both headed and headless modes come from the `window_size` setting. See [Window Size](#window-size) above to update them.

---

## Resetting Settings

There is no `kane-cli config reset` subcommand. To reset persistent settings to defaults, delete the config file:

```bash
rm ~/.testmuai/kaneai/tui-config.json
```

Kane CLI recreates the file with defaults the next time it writes a setting. This only resets `tui-config.json`. It does **not** affect:

- Authentication credentials under `~/.testmuai/kaneai/profiles/` (use `kane-cli logout`)
- Session history under `~/.testmuai/kaneai/sessions/`
- Variables under `~/.testmuai/kaneai/variables/` and `.testmuai/variables/`
- Chrome profiles under `~/.testmuai/kaneai/chrome-profiles/`
