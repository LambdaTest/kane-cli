# Building the context graph

`kane-cli context` builds a local, content-addressed knowledge store (`.context/` in your project directory) from your requirement documents, and extracts **use-cases** from them with an AI agent. It is the first stage of the [assurance lifecycle](./overview.md): Source → Use-case → Scenario → AC → Test.

```bash
kane-cli context ingest ./prd-online-store.md   # snapshot a source
kane-cli context extract                        # extract use-cases (interactive chat)
kane-cli context review                         # promote proposals to trusted
kane-cli context list                           # see what you have
```

<a name="ingest"></a>
## `context ingest` — snapshot your sources

```bash
kane-cli context ingest <src...> [--as <id>]
```

Snapshots one or more files into `.context/` (the store is created on first use). Each source gets a stable id — by default the filename slug (`prd-online-store.md` → `prd-online-store`), or pass `--as <id>` to name it yourself.

Ingest is deterministic about identity:

| You ingest… | Result |
|---|---|
| same id, same bytes | `unchanged` — nothing written |
| same id, new bytes | `versioned` — the source's head moves; everything extracted from the old snapshot goes **stale** |
| a new id | `created` |
| identical bytes already ingested under a different id | interactive relocate offer (default yes); non-TTY mints the new id and prints a hint |

```
$ kane-cli context ingest ./prd-online-store.md
created  prd-online-store  source sha256:0661…  blob sha256:3db8…
```

Accepted media: text (`.txt`) and markdown (`.md`, `.markdown`) up to 2 MB — cited verbatim by line; PNG/JPEG/WebP images up to 5 MB — cited whole-image. Anything else is rejected with `UNSUPPORTED_MEDIA`; oversized files with `FILE_TOO_LARGE`.

When the new bytes are a **changed version of a source you already extracted from**, prefer [`kane-cli maintain reconcile`](./maintain.md) over a bare re-ingest — it records the same head move *and* triages what the change means for your suite, in one step.

<a name="extract"></a>
## `context extract` — propose use-cases

```bash
kane-cli context extract [--plan] [--force] [--source <id>] [--mode <mode>] [--resume <sid> [--message "<text>"]]
```

Runs the extraction agent over every ingested source whose current snapshot has no committed extraction yet (already-extracted snapshots are skipped — re-run with `--force` to redo one).

On a terminal the default is an **interactive chat**. Headless use is an explicit opt-in: a bare non-TTY invocation exits `2` and asks you to pass `--mode agent|ci|override` — see [Automation](./automation.md) for the headless contract.

What the agent does:

- Reads each source and proposes use-cases with **verbose descriptions** (flows, inputs, states, boundaries) and **`criteria[]`** — short, cited sketches of the acceptance-relevant promises the source states. Criteria are hints for [`kane-cli design`](./design.md), never test oracles.
- **Cites everything.** Every proposal must quote an exact line from the source; fabricated evidence is rejected before anything is written. (Image sources cite the whole image — there is no text to quote.)
- **Asks when the source is ambiguous.** Conflicting requirements become clarifying questions with options, a recommended default, and a risk level — low/medium-risk questions can be defaulted, high-risk ones want a real answer.
- **Grounds itself in what you already have.** The agent explores the existing graph read-only before proposing, so a use-case you already committed becomes new evidence on the existing node (shown as `≈ matches`) instead of a duplicate.

Extraction stops at the use-case. Scenarios, ACs, and tests are minted by the [design engine](./design.md) — each stage can only create its own kinds.

Flags:

| Flag | Meaning |
|---|---|
| `--plan` | Stop after the proposal: print it (with `≈ matches` dedup flags) and commit nothing |
| `--force` | Re-extract sources even if their current snapshot was already extracted |
| `--source <id>` | Extract exactly this ingested source instead of the whole corpus |
| `--mode <mode>` | Ask policy for headless runs: `agent` \| `ci` \| `override` — see [Automation](./automation.md) |
| `--resume <sid>` | Resume a paused session ([sessions](#sessions)) |
| `--message "<text>"` | With `--resume`: answer the pending questions in plain words |

### The interactive chat

The chat has two zones. The scrollback is the complete session journey — your words, the agent's narrative, its reasoning segments and tool lines, each proposal list as it arrived, answer receipts, commit receipts, and per-turn credit costs. The live region below shows only what is happening now: the current thinking line (**ctrl+t** expands it), the question panel, and the composer.

**Answering questions** happens right in the composer:

- Bare input answers the active question (marked `›`), and the cursor advances: `1` picks option 1, typing an option's name matches it, anything else is free text where allowed.
- `N:` targets question N explicitly (`2: yes`). Without the colon, `2 business days` stays free text.
- **Empty Enter** accepts the recommended defaults for **low/medium-risk questions only** — each is echoed back as `↳ assumed … (flagged)`. High-risk questions are never bulk-defaulted: answer them, or type `defer` to leave the rest with the agent.
- The batch submits when every question is answered, assumed, or deferred — never silently partial.

**Ctrl+C asks for a pause, not a crash.** The first press asks the agent to save the session; on success you get a pause card with the exact resume command (including the `--message` form) and the run exits `3`. If the save can't complete within a few seconds you get an honest `interrupted — session not saved` (exit `130`, not resumable), and a second Ctrl+C at any point is an immediate hard exit. `/pause` does the same from the composer; `/done` ends the session cleanly.

Slash commands (everything else you type is conversation for the agent):

| Command | Action |
|---|---|
| `/view [N \| acs\|scenarios\|tests]` | browse this session's proposals in a view-only explorer |
| `/explain <ref>` | why a committed item exists — replayed from the record, no agent turn |
| `/pause` | save + exit, resumable |
| `/done` | finish the session cleanly |

### The review checklist

After the agent proposes, the same session walks you through a review checklist: space cycles **approve / edit / reject / skip** per item, `e` opens an edit form, and Enter commits the whole batch as one record:

- **approve / edit** → committed as `trusted`
- **reject** → committed + archived (kept on record, not deleted)
- **skip** → committed as `derived` — queued for later review

### Pausing and resuming

When the agent needs an answer you're not there to give (or you Ctrl+C), the session is saved and the run exits `3`. Resume it any time within 24 hours:

```bash
kane-cli context sessions                       # list resumable sessions + their resume commands
kane-cli context extract --resume <sid>         # re-presents the pending questions
kane-cli context extract --resume <sid> --message "Account required — the update supersedes the old section"
```

`--message` answers **in plain words** — no question ids, no option indexes. The agent maps your statement to its own pending questions. A statement that answers nothing pending is treated as steering ("also cover the coupon path"). If your answer leaves a high-risk ambiguity standing, the run pauses again with refreshed questions.

<a name="review"></a>
## `context review` — review outside the extract session

```bash
kane-cli context review [--queue derived|skipped|archived|drift] [--verdicts <file>] [--json]
```

Walks existing nodes through the same review checklist, landing every verdict as one batched record:

- `derived` (default) — everything unreviewed
- `skipped` — strictly the items you skipped during an extract review
- `archived` — resurrection candidates: an explicit approve restores trust
- `drift` — a **listing only** (works without a TTY): nodes whose evidence is stale or orphaned, with their pinned sources — the re-extract worklist

In any queue: approve promotes, reject archives (a trusted node *can* be demoted), and edit mints a new version that supersedes the old one — nodes are immutable, so edits never rewrite history and existing references never break.

**Headless verdicts** — `--verdicts <file.json>` is the one non-TTY write path: a JSON array of

```json
[{ "ref": "uc-manage-the-cart", "resolution": "approved" }]
```

with `resolution` one of `approved | edited | rejected | skipped | supersede` (plus optional `reason`, `edit`, `supersede_target`). It is atomic: every ref must resolve and sit in a verdict queue, or nothing commits (exit `2`). With `--json`, each landed verdict echoes as one NDJSON row. There is deliberately no auto-approve mode for review — trust requires a human decision.

<a name="inspect"></a>
## Inspecting the graph

### `context list`

```bash
kane-cli context list [--type source|usecase] [--inferred] [--stale] [--all] [--json]
```

Lists nodes with their trust and freshness. `--inferred` shows only unreviewed (`derived`) nodes, `--stale` only stale or orphaned nodes (evidence pinned to an outdated snapshot, or no live source at all), `--all` includes superseded versions (hidden by default). `--json` emits one JSON object per line.

### `context view`

```bash
kane-cli context view [--out <path>] [--open|--no-open] [--json]
```

Renders the whole graph as a **single self-contained HTML page** — swimlanes per use-case, provenance edges back to the source, trust and staleness at a glance, a commit rail along the bottom, and click-through detail panels with each node's lineage. It is a snapshot (no server; works offline); re-run to refresh. Piped runs write the file and print its path instead of opening a browser; `--json` prints the computed payload for scripting.

### `context explain`

```bash
kane-cli context explain <ref> [--json]
```

Replays a node's recorded history straight from the store — **no model call, ever**: when it was minted and why, every review verdict, edits and supersessions, name assignments. `<ref>` is a logical id (`uc-manage-the-cart`) or a cid.

<a name="sessions"></a>
### `context sessions`

```bash
kane-cli context sessions [list|show|clean] [<sid>] [--all] [--json]
```

Paused extract *and* design sessions live under `.context/sessions/` for 24 hours. `list` shows each with its pending-question count, expiry, and ready-to-paste resume command. `show <sid>` prints everything the paused agent is waiting on — the questions in full, any defaults it assumed in your absence, and both resume forms. `clean` garbage-collects expired sessions (`clean <sid>` removes one; `--all` removes everything).

## Housekeeping

### `context retire`

```bash
kane-cli context retire <source_id> [--reason <text>] [--yes]
```

Retires a source. Its use-cases are **not** deleted — they read `orphaned` once no live source evidences them. Fully reversible via `revert`.

### `context name`

```bash
kane-cli context name <ref> <slug>          # name one node
kane-cli context name --backfill [--yes]    # assign ids to every unnamed node
```

Assigns a stable kebab-case name. Names are never part of a node's identity — renaming never re-addresses — and names follow edits, so a name assigned to version 1 keeps resolving to the current version.

### `context revert`

```bash
kane-cli context revert <seq> [--reason <text>] [--yes]
```

Inverts a record's effects by appending a compensation record — mints are tombstoned, heads move back, trust states are restored. History is never rewritten: the store keeps both the mistake and its correction. Reverting a revert restores the original effects.

### `context fsck` / `context rebuild`

`fsck` verifies the full record chain and checks the read caches for drift (exit `1` on any issue) — run it whenever hands touched `.context/` directly. `rebuild` wipes the derived caches and regenerates them from the verified records; it is always safe.

**Destructive-verb rule:** `retire`, `revert`, `name --backfill`, and `rebuild` prompt for confirmation on a terminal (default No) and require an explicit `--yes` headless. Read commands never create a `.context/` store in a directory that has none — only `ingest` and `extract` do.

## Trust and freshness

| Trust | Meaning | How you get there |
|---|---|---|
| `derived` | machine-proposed, unreviewed | extraction commit (or a skip verdict) |
| `trusted` | human-confirmed | approve or edit in review |
| `archived` | human-rejected | reject in review |

Freshness is orthogonal: `fresh` / `stale` (the source snapshot moved) / `orphaned` (no live source evidences it) / `superseded` (this version was replaced). A stale use-case is still trusted — it just needs re-verification against the new snapshot, which is exactly what [`kane-cli maintain reconcile`](./maintain.md#reconcile) is for.

## The store on disk

```
.context/
├── meta.json            # store identity + format version
├── commits/             # append-only records — the truth
├── blobs/               # write-once source snapshots
├── derived/             # regenerable read caches (delete any time; rebuild restores)
├── proposals/<ts>/      # proposal + review artifacts per extract run
├── sessions/<sid>/      # resumable paused sessions (expire after 24h)
├── logs/                # per-run trace files
├── design/              # design rationale sidecars + technique overrides
├── reconcile/plans/     # stored reconcile plans
└── signals.ndjson       # internal review bookkeeping (appears once recorded)
```

Two rules worth repeating from the [overview](./overview.md#the-store-context): the store is **single-writer**, and it is **not git-mergeable** — gitignore it and share by re-ingesting sources.

Every extract run also writes a per-run trace to `.context/logs/extract-<ts>.log` (the path is printed at the start of the run) — the first place to look when a run surprises you.

## For agents and CI

Headless extraction (`--mode agent|ci|override`), the NDJSON event stream, exit codes, and the pause/resume contract are documented in [Automation](./automation.md).

## Next steps

- [Designing tests](./design.md) — turn a trusted use-case into ACs, scenarios, and runnable tests.
- [Maintaining the suite](./maintain.md) — what to do when a source changes.
- [Automation](./automation.md) — the headless contract.
