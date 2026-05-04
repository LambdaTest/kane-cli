# Changelog

All notable changes to kane-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.11] - 2026-05-04

### Setup is faster and safer
- **Picking a project is instant** — even on accounts with hundreds of projects, the list shows up right away. You can start typing to search the moment it opens.
- **No more "lost" tests** — KaneAI now stops you from running a test until a project and folder are picked, so your runs always end up in the right place in TMS.
- **One-key defaults** — press **Esc** during setup to auto-pick "KaneAI Generated" / "Untitled" defaults if you just want to get going. KaneAI tells you exactly what it picked.
- **Profile mix-ups fixed** — switching between accounts/profiles no longer carries the previous profile's project across.

### Login that just works
- **Wrong username or access key?** KaneAI tells you immediately, lets you fix it in place — no more saving bad credentials and finding out later.
- **Headless login** (`kane-cli login --oauth` or with a username/access-key) now finishes cleanly instead of hanging.
- **Logging in from the terminal** uses the same simple guided flow as the rest of the app.

### A nicer in-browser indicator
- A small floating badge sits in the top-right corner of Chrome while a test runs. It now **shows what KaneAI is currently thinking** ("Clicking the Add to cart button…") so you can follow along without watching the terminal.
- Between steps it shows an animated "Thinking…" so you always know it's working.
- The helper **no longer shows up in your Mac dock or Windows/Linux taskbar** — no more confusing extra icon.
- The badge **automatically hides when you switch to another app** and reappears when you go back to Chrome.

### Easier to discover what KaneAI can do
- **`/help` now opens a tabbed help screen** — Commands, Shortcuts, Setup, About — all in one place.
- **Every slash command shows a small confirmation box** with a ✓ / ✗ so you know what just changed (e.g. "Project switched to My Project").
- A **breadcrumb at the bottom** of the screen shows where you are in any flow.
- **Consistent on-screen hints** for keyboard shortcuts in every screen.

### Better text editing
- **Cursor is now visible** even when the input box is empty.
- **Slash commands**: press **Tab** to fill in a command, **Enter** to run it (used to need two Enters).
- **Word jump and word delete** keyboard shortcuts now work the way you'd expect on macOS, Windows, and Linux (Option/Ctrl + Arrow keys, Option/Ctrl + Delete, etc.).

### New defaults
- **Code Export is now ON by default** so every test run also gives you Python (or JavaScript) automation code you can take away.
- **"Testing" mode is the new default** — runs upload to TMS automatically.
- The first time you launch v0.2.11, KaneAI shows a **one-time summary of what changed** and tells you how to revert any of it from `/config`.


---

**Close this issue to approve.** The workflow will timeout after 6h.
