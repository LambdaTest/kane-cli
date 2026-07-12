# Evidence packs

Every kane-cli run produces an **evidence pack**: a single sealed `.evidence` file containing everything about the run — the test definition, a result summary, per-step screenshots (plus annotated copies highlighting what the agent acted on), browser console and network logs attributed to each step, run logs, and on failures a per-step failure record with the error, page state, and pointers into the logs.

A pack is a self-contained zip. You can open it in the hosted viewer, share it with a teammate, archive it in CI, validate it, or merge several packs into one.

This page covers where packs live, how to view them, and the `kane-cli evidence` command family. For debugging a failed run with its pack, see [Debugging a failed run from its pack](#debugging-a-failed-run-from-its-pack).

## What's inside a pack

Opened in the viewer (or unzipped), a pack contains:

- **The test definition** — what was asked of the agent.
- **A result summary** — status, duration, per-step outcomes, tags, who ran it (user name/email), a share link, and the environment (browser resolution, OS version).
- **Per-step screenshots** — the page as the agent saw it, plus an **annotated** copy highlighting the element the agent acted on.
- **Browser console and network logs** — captured for the whole run and attributed to the step that produced them.
- **Run logs** — the CLI and runner logs for the execution.
- **Failure records** — on failed runs, a per-step record with the error message, the page state at failure, and references into the console/network logs.

The pack is the **only** place run artifacts live — there is no separate per-run log directory on disk.

## Inside the pack

A `.evidence` file is a standard zip (`unzip -l <pack>` lists it; `unzip -p <pack> <entry>` prints one file). The layout:

```text
<execution_id>.evidence
├── run.yaml                          # Run manifest: title, status, started/ended, totals
├── failure.yaml                      # Run-level failure rollup
└── tests/
    └── <test-id>/                    # One directory per test in the run
        ├── test.md                   # The test definition
        ├── result.yaml               # Verdict, per-step outcomes, tags, executed-by,
        │                             #   share identifiers, environment (browser/OS/resolution)
        ├── logs/
        │   ├── meta.yaml             # Declares every log file below
        │   ├── tui.log               # Session narrative
        │   ├── <n>-run.log           # Runner log, one set per run index n (0, 1, …)
        │   ├── <n>-actions.ndjson    # Step-by-step actions the agent performed
        │   ├── <n>-console.ndjson    # Browser console output, attributed per step
        │   └── <n>-network.har       # Network traffic (HAR), attributed per step
        ├── steps/
        │   └── <ordinal>-<step-id>/  # One directory per executed step
        │       ├── screenshot.png    # The page as the agent saw it
        │       ├── annotated.png     # Same shot with the acted-on element highlighted
        │       ├── step.json         # Step metadata: kind, status, duration, url,
        │       │                     #   action id, click coordinates, element rect
        │       └── failure.yaml      # Failed/broken steps only: error, page state,
        │                             #   console/network references, triage
        ├── auteur/
        │   └── execution.json        # Full execution trajectory (step.json's action id
        │                             #   joins to operations in this tree)
        └── v16-trajectory/           # Per-run planning summaries and diagrams
```

A `testrun` pack has one `tests/<test-id>/` directory per member, all under the same root.

## Where packs live

Every run seals a pack in its session directory:

```
~/.testmuai/kaneai/sessions/<session-id>/evidence/<execution_id>.evidence
```

Runs you keep are additionally copied into the **project store** in your working directory:

```
<cwd>/.testmuai/evidence/<execution_id>.evidence
```

What lands in the project store depends on the surface:

| Surface | Copied to `.testmuai/evidence/`? |
|---|---|
| `kane-cli run` / TUI session | Only when the session is **named** (`--name`, `/name` in the TUI, or the save prompt at exit) |
| `kane-cli testmd run` | Always |
| `kane-cli testrun run` | Always (the pack is created directly in the store) |

An interactive TUI session maps to one pack: it accumulates every run in the session and seals when you `/exit` or start over with `/new`.

If kane-cli crashes mid-run, the next start automatically sweeps incomplete or orphaned packs — packs belonging to live concurrent processes are untouched. There is nothing to clean up by hand.

## Viewing evidence

### After a run

After a successful run in a terminal, kane-cli offers to open the pack:

```
View evidence in browser? (y/N)
```

Accepting starts a local server and opens the hosted viewer pointed at your pack. In agent or non-interactive runs there is no prompt — kane-cli prints a hint line to stderr instead:

```
evidence: view locally with `kane-cli evidence serve <path-to-pack>`
```

### `kane-cli evidence serve`

Serves one or more sealed packs to the hosted viewer:

```bash
kane-cli evidence serve .testmuai/evidence/<execution_id>.evidence
```

```
serving 1 pack on http://127.0.0.1:54321
<execution_id>.evidence
  pack    http://127.0.0.1:54321/<token>/<execution_id>.evidence
  viewer  https://evidence.lambdatest.com/?pack=http%3A%2F%2F127.0.0.1%3A54321%2F...
press Ctrl-C to stop
```

Open the `viewer` URL in your browser. The server binds to `127.0.0.1` only and uses a random per-instance token in the URL path — **nothing is uploaded anywhere**; the viewer page in your browser reads the pack bytes from your machine and renders them locally.

| Flag | Description | Default |
|---|---|---|
| `--port <n>` | Pin the local port | ephemeral |
| `--viewer-url <base>` | Override the hosted viewer base URL | environment's viewer |
| `--env <name>` | Environment (`prod` or `stage`) | active profile's env |

`serve` accepts sealed `.evidence` files only — a live (unsealed) pack directory is rejected. Exit codes: `0` after a clean Ctrl-C shutdown, `2` for any bad input or a port that cannot be bound.

### The hosted viewer

The viewer at `https://evidence.lambdatest.com` is a static page that opens packs three ways:

- a `?pack=<url>` query parameter (this is what `evidence serve` and the post-run offer construct for you),
- drag-and-drop of a `.evidence` file,
- a file picker.

It remembers your recently opened packs, and reads packs with ranged requests — even a very large pack opens after fetching only a few kilobytes.

## Validating a pack

`kane-cli evidence validate` checks a pack's integrity and completeness:

```bash
kane-cli evidence validate <execution-id-or-path>
```

The target can be an execution id (resolved against the project store), a live pack directory, or a sealed `.evidence` file.

| Flag | Description | Default |
|---|---|---|
| `--profile <profile>` | Validation profile, `L0` or `L1` | `L1` |
| `--json` | Machine-readable report | off |

Exit codes: `0` valid · `1` invalid · `2` not found. `--json` plus the exit code makes this easy to gate in CI or scripts.

## Merging packs

`kane-cli evidence merge` combines several packs into one — for example, the packs from a set of related runs you want to hand over as a single file:

```bash
kane-cli evidence merge <targets...> --run-id nightly-2026-07-11
```

Targets are execution ids or pack paths, and **order matters** (earlier targets win where the policy has to choose).

| Flag | Description | Default |
|---|---|---|
| `--run-id <id>` | Run id for the merged pack — **required** | — |
| `-o, --out <path>` | Output path | `.testmuai/evidence/<run-id>.evidence` |
| `--rules <path>` | Custom merge-rules file (replaces the defaults wholesale) | built-in defaults |
| `--on-collision <action>` | `error` \| `prefer-first` \| `prefer-latest` \| `discard` | `error` |
| `--title <title>` | Title for the merged run | first eligible pack's |
| `--no-finalize` | Keep the merged pack live instead of sealing it | seals by default |
| `--json` | Machine-readable merge report | off |
| `--env <name>` | Environment (`prod` or `stage`) | active env |

`--rules` and `--on-collision` are mutually exclusive. The default policy requires inputs to be sealed and valid, skips duplicate run ids, and refuses to merge packs from different projects or organisations.

Exit codes: `0` merged · `1` policy abort · `2` usage error.

## Debugging a failed run from its pack

The pack is the fastest way to understand a failure, because everything is in one place and attributed per step:

1. **Open the pack** — accept the post-run offer, or `kane-cli evidence serve <pack>` and open the `viewer` URL.
2. **Go to the failed step** — the run overview marks it; the failure record shows the error message and the page state at the moment of failure.
3. **Check the step's console and network activity** — logs are sliced per step, so you see exactly what the browser logged and requested while that step ran. A 4xx/5xx response or a JS error here usually explains the failure.
4. **Look at the annotated screenshot** — it highlights the element the agent was acting on, which makes "clicked the wrong thing" and "element wasn't there" failures obvious.

If a pack won't open in the viewer, run `kane-cli evidence validate <pack>` — an unsealed or truncated pack (for example from a run that was killed hard) reports as invalid, and the run's session directory still holds the raw logs.

## Publishing to the dashboard

Runs that upload to Test Manager attach their sealed pack automatically. Replayed `testmd` runs and `testrun` executions publish their packs to your project as well, so the dashboard shows execution evidence even for cache-replayed runs that never re-author.

## Next steps

- [Batch runs with testrun](./testrun.md) — many tests, one execution, one pack.
- [Running test.md files](./testmd/running.md) — the testmd command family.
- [Troubleshooting](./troubleshooting.md) — debugging flows and escape hatches.
