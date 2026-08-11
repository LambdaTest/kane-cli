# Building the context graph

`kane-cli context` builds a local, content-addressed knowledge store (`.context/` in your project directory) from your requirement documents, and extracts **use-cases** from them with an AI agent. It is the first stage of the [assurance lifecycle](./overview.md): Source → Use-case → Scenario → AC → Test.

```bash
kane-cli context ingest ./prd-online-store.md   # snapshot a source — and extract it (one flow)
kane-cli context extract                        # extract every pending source (interactive chat)
kane-cli context review                         # promote proposals to trusted
kane-cli context list                           # see what you have
```

<a name="ingest"></a>
## `context ingest` — snapshot your sources (and extract them)

```bash
kane-cli context ingest <src...> [--as <id>] [--mode <mode>] [--plan] [--force] [--trust <dial>]
```

Snapshots one or more files into `.context/` (the store is created on first use) **and then extracts them** *(0.7.1)*:

- On a terminal, the run continues straight into the interactive extract chat.
- `--mode agent` extracts headless on the NDJSON stream (one `ingested` event per landing, before the extraction begins — see [Automation](./automation.md#the-ndjson-stream---mode-agent)); `--mode override` extracts headless too, auto-taking every default.
- `--mode ci` — or piped stdin without a `--mode` — **lands only**: the files snapshot, nothing extracts, exit `0`, with a guidance line on stderr telling you what to run next.
- `--plan`, `--force`, and `--trust` pass through to the extraction; they refuse under the land-only modes.

Receipts adapt to the surface: a terminal prints the human copy (`landed prd (prd.md) — new source`); `ci`/piped runs keep the byte-exact script contract below. *(0.7.2)* Under `--mode agent` nothing prints outside the stream — the landing receipt is the `ingested` event itself.

```
$ kane-cli context ingest ./prd-online-store.md --mode ci
created  prd-online-store  source sha256:0661…  blob sha256:3db8…
```

Each source gets a stable id — by default the filename slug (`prd-online-store.md` → `prd-online-store`), or pass `--as <id>` to name it yourself.

Ingest is deterministic about identity:

| You ingest… | Result |
|---|---|
| same id, same bytes | `unchanged` — nothing written |
| same id, new bytes | `versioned` — the source's head moves; everything extracted from the old snapshot goes **stale** |
| a new id | `created` |
| identical bytes already ingested under a different id | interactive relocate offer (default yes); non-TTY mints the new id and prints a hint |

Two lineage helpers:

- **`--as` records versions**: a colleague hands you `PRD-v2.md` of an existing source `prd` — `ingest PRD-v2.md --as prd` records it as a new *version* of `prd` (head moves, dependents go stale). `--as` names one identity, so it refuses more than one file.
- **Version suggestion (terminal only)**: ingesting `prd-v2.md` when a source `prd` already exists prompts "looks like a new version of `prd` — ingest as `prd`?". Accept and it versions `prd`; decline and `prd-v2` mints as its own source. Piped runs never prompt and never auto-link — pass `--as` explicitly in scripts.

### Accepted media

Only allowlisted media is accepted — anything else is rejected with `UNSUPPORTED_MEDIA`, and each type has its own size cap (`FILE_TOO_LARGE` beyond it):

- **Text, cited verbatim by line** (2 MB): `.txt`, `.md`/`.markdown`, and the structured-text family `.json`, `.yaml`/`.yml`, `.toml`, `.xml`, `.log`. Structured files are ingested as-is — a malformed JSON is still citable evidence. Files must be valid UTF-8 (`ENCODING_UNSUPPORTED` otherwise); a file with very long lines (e.g. minified JSON) ingests with a warning, since line anchors lose granularity — consider pretty-printing first.
- **Images, cited whole-image** (5 MB): PNG, JPEG, WebP.
- **PDF** (25 MB): the document's text becomes the citable text (page-marked), and embedded images become citable parts of the same source. PDFs need selectable text — scanned documents refuse with `PDF_NO_TEXT_LAYER`, password-protected ones with `PDF_ENCRYPTED`; every refusal names its remedy (split a very large document, re-save an encrypted one).
- **Word documents (`.docx`)** (25 MB): converted to a plain-text projection (body, headers/footers, footnotes, tables; tracked changes as the final view) plus embedded images as citable parts — anything not extracted leaves an explicit marker, nothing vanishes silently. Password-protected files and legacy binary `.doc` are refused with save-as guidance.
- **Jira issues, by URL**: pass an issue URL instead of a file — `kane-cli context ingest https://<your-site>/browse/PROJ-123`. Jira must be connected in your LambdaTest Integrations screen (the refusal points you there). Ingested: the summary, description, custom fields, the attachment inventory (image attachments become citable parts), and *(0.7.2)* **all comments** — author, timestamp, and body, with every line citable. Comments are part of the issue's identity: if they can't be read, the whole ingest refuses rather than recording the issue without them. Re-running the URL is `unchanged` or `versioned`, exactly like a re-ingested file; an issue last ingested before 0.7.2 versions **once** on its next re-ingest (per source, only when you re-ingest it — nothing migrates on upgrade). The default source id is the lowercased issue key (`--as` overrides). Refusals name their remedy: an expired Atlassian connection asks you to resync it in the Integrations screen, a missing connection to create one there, and an issue outside the integration's selected projects to add that project there.
- **Confluence pages, by URL** *(0.7.2)*: pass a page URL — `kane-cli context ingest https://<site>/wiki/spaces/<KEY>/pages/<id>/…`. The same Atlassian connection serves Jira and Confluence, but it must have Confluence access — a Jira-only connection refuses up front with reconnect guidance. Ingested: the title, space, labels, the page body (every line citable), and the attachment inventory (image attachments become citable parts). Re-ingesting reads the **latest** page version, and identity follows content: an edit that changes nothing you'd cite — or a bare version bump — is `unchanged`; a body change is `versioned`, with staleness flowing to items extracted from the old snapshot. The default source id is `page-<id>`; short-links (`/wiki/x/…`) aren't supported — open the page and use its full URL.

When the new bytes are a **changed version of a source you already extracted from**, prefer [`kane-cli maintain reconcile`](./maintain.md) over a bare re-ingest — it records the same head move *and* triages what the change means for your suite, in one step.

<a name="extract"></a>
## `context extract` — propose use-cases

```bash
kane-cli context extract [--plan] [--force] [--source <id>] [--mode <mode>] [--trust <dial>]
kane-cli context extract --resume <sid> [--message "<text>"] [--answer <q>=<v> ...] [--with-source <ref>]
```

Runs the extraction agent over **every ingested source whose current snapshot has no committed extraction yet**. `context ingest` is the primary entry (it lands your files and then runs exactly this); the bare `extract` sweep is for re-runs, `--source` pins, and `--resume`.

Two batch rules *(0.7.1)*:

- **The sweep continues past failures.** A per-source failure prints one line and the sweep moves to the next source; the run exits `1` at the end if anything failed. A failed source simply retries on the next run — no `--force` needed.
- **One extraction per store.** A run holds an extraction lock for its duration; a second concurrent run refuses immediately with `another extraction is running on this context (pid N) — retry when it finishes` (exit `2`, code `EXTRACT_LOCKED`). A dead run's lock clears itself.

What the agent does:

- Reads each source and proposes use-cases with **verbose descriptions** (flows, inputs, states, boundaries) and **`criteria[]`** — short, cited sketches of the acceptance-relevant promises the source states. Criteria are hints for [`kane-cli design`](./design.md), never test oracles.
- **Cites everything.** Every proposal must quote exact evidence from the source; fabricated evidence is rejected before anything is written. (Image evidence cites the image itself — there is no text to quote.)
- **Asks when the source is ambiguous.** Conflicting requirements become clarifying questions with options, a recommended default, and a risk level.
- **Grounds itself in what you already have.** The agent explores the existing graph read-only before proposing, so a use-case you already committed becomes new evidence on the existing node (shown as `≈ matches`) instead of a duplicate.

Extraction stops at the use-case. Scenarios, ACs, and tests are minted by the [design engine](./design.md) — each stage can only create its own kinds.

Flags:

| Flag | Meaning |
|---|---|
| `--plan` | Stop after the proposal: print it (with `≈ matches` dedup flags) and commit nothing |
| `--force` | Re-extract sources even if their current snapshot was already extracted |
| `--source <id>` | Extract exactly this ingested source instead of the whole corpus |
| `--mode <mode>` | Ask policy for headless runs: `agent` \| `ci` \| `override` — see [Automation](./automation.md) |
| `--trust <dial>` *(0.7.1)* | `auto` (the default: new items commit as `derived`, queued for review) \| `hold` (everything new is **held** for your review — nothing commits until you decide; headless-only, and `ci` refuses it). Hold works best one source at a time (`--source <id>`) |
| `--resume <sid>` | Resume a paused session ([sessions](#sessions)) |
| `--message "<text>"` | With `--resume`: answer the pending questions in plain words |
| `--answer <q>=<v>` *(0.7.1)* | With `--resume --mode agent`: answer a pending question by id — see [Automation](./automation.md) |
| `--with-source <ref>` *(0.7.1)* | With `--resume`: land this file or URL **first**, set the pending questions aside, let the agent read it — it then re-asks only what's still open |

### The interactive session

The chat has two zones. The **scrollback** is the complete session journey — source banners, the agent's narrative, its reasoning and tool lines, each turn's proposals as an **item table**, answer receipts, commit receipts, pause cards, and a session summary. The **live region** below holds only what's happening now: the working line (**ctrl+t** expands the agent's reasoning), and one panel.

**Everything is a panel** — there is no free-typing command line. Each state presents its actions as selectable rows; the cursor starts on row 1, and **row 1 is always the recommended next step**. `↑↓` move, `⏎` selects, digits jump, and **typing anywhere** seeds the trailing `✎` free-text row's inline editor — your words become an answer on a question, or steering between turns ("make UC-4 high risk", "also cover the coupon path").

**Item tables and ids.** Every new item mints a short sequential id — `UC-4`, `AC-12`, `T-3` — assigned at mint and never renumbered. Both sides of the conversation use them: the agent discusses items by id, and your steering resolves them case-insensitively. Each turn's items render as a table (id · title · a kind-appropriate badge · summary), sorted high → medium → low risk; a row whose commit hasn't landed yet shows `(staged)` instead of a fake id. The id namespace is reserved — [`context name`](#housekeeping) refuses it. Legacy nodes keep their verbose slugs; they receive ids only if you explicitly run `context name --backfill`.

**Questions.** When the agent needs answers, the question panel takes over: each question shows its options with the recommended one pre-selected, its rationale, and its risk. Multi-select questions render real checkboxes — **space** toggles, `✔ done — confirm selection` submits. **Esc steps back** onto a previously answered question for a re-pick (echoed as `↳ changed`). One batch action — `» Go with recommendations (tab)` — answers everything unresolved with the recommended picks. When an option needs a typed value ("Provide the URL"), the row opens an inline editor so the answer carries the pick and your value together.

**Adding a source mid-session** *(0.7.1)*. The **`@` key** (shown in the panel legend when available) opens the attach panel: one editor for a path or URL. Submitting sets the whole question batch aside — nothing is answered, nothing is lost. The source lands and commits, the agent reads it, narrates what it settled, and re-asks only what's still open; answers you had already given pre-fill on the re-ask. Only sources **you** provide can land — a path the agent invents on its own refuses (`INGEST_UNAUTHORIZED_REF`) and nothing lands. Headless, the same move is `--resume <sid> --with-source <path|url>`.

*(0.7.2)* When a landed source is a **new version of a source the graph already knows**, it is never blindly re-extracted. Instead, the next check-in offers `review change(s) detected in <source>` as its first row — `later` stays available, and the offer returns at each check-in until you take it. Selecting it walks the held changes as review cards, the same review [`maintain reconcile`](./maintain.md) runs. While a source is held for review, a reconcile cannot move its head until that review finishes.

**Between turns**, the idle panel offers the state's actions — typically `looks good — finish the session` (row 1), `design tests for a use-case…` (a picker that chains straight into a design run and returns), `view the N drafts`, and `✎ tell me what to change`.

**The view explorer.** Any `view …` row opens a read-only explorer over the session's items; `⏎` on an item opens its full dossier — status, risk, every content field, its criteria with their raw cites (`cite <source-id> <anchor> — "verbatim quote"`), provenance, and dependencies by id. Esc walks back. It is view-only by construction — decisions happen in the panels.

**Ctrl+C asks for a pause, not a crash.** The first press asks the agent to save the session; on success you get a pause card with the exact resume command (including the `--message` form) and the run exits `3`. If the save can't complete within a few seconds you get an honest `interrupted — session not saved` (exit `130`), and a second Ctrl+C at any point is an immediate hard exit. Finishing cleanly is the idle panel's row 1.

During the chat, proposals commit as **drafts** (`derived`) — reviewing and promoting them is [`context review`](#review)'s job, below.

### Pausing and resuming

When the agent needs an answer you're not there to give (or you Ctrl+C, or the process dies), the session is saved and the run exits `3` with the exact resume command — even when the process dies mid-run *(0.7.1)*. Resume any time within 24 hours:

```bash
kane-cli context sessions                       # list resumable sessions + their resume commands
kane-cli context extract --resume <sid>         # re-presents only what's still unanswered
kane-cli context extract --resume <sid> --message "Account required — the update supersedes the old section"
kane-cli context extract --resume <sid> --mode agent --answer q1=2 --answer q3="staging URL"
kane-cli context extract --resume <sid> --with-source ./addendum.md
```

`--message` answers **in plain words** — the agent maps your statement to its own pending questions; a statement that answers nothing pending is treated as steering. `--answer` *(0.7.1)* answers **by id** for scripted resumes (`--resume --mode agent` only). Resume is honest about what happened in between: questions answered elsewhere are never re-asked, defaults assumed in your absence are reported (`N default(s) were assumed while you were away`), and your earlier answers pre-fill rather than auto-submit.

<a name="review"></a>
## `context review` — review outside the extract session

```bash
kane-cli context review [--queue derived|skipped|archived|drift] [--verdicts <file>] [--json]
kane-cli context review --approve <refs...> | --skip <refs...> | --defer <refs...>       # 0.7.1
kane-cli context review --verdicts <file> --allow-archive --because "<reason>"           # 0.7.1
```

Walks existing nodes through the review checklist, landing every verdict as one batched record:

- `derived` (default) — everything unreviewed
- `skipped` — strictly the items you skipped during an extract review
- `archived` — resurrection candidates: an explicit approve restores trust
- `drift` — a **listing only** (works without a TTY): nodes whose evidence is stale or orphaned, with their pinned sources — the re-extract worklist

In any queue: approve promotes, reject archives (a trusted node *can* be demoted), and edit mints a new version that supersedes the old one — nodes are immutable, so edits never rewrite history and existing references never break.

**Headless verdicts** — `--verdicts <file.json>` is a JSON array of

```json
[{ "ref": "uc-manage-the-cart", "resolution": "approved" }]
```

with `resolution` one of `approved | edited | rejected | skipped | supersede` (plus optional `reason`, `edit`, `supersede_target`). It is atomic: every ref must resolve and sit in a verdict queue, or nothing commits (exit `2`). With `--json`, each landed verdict echoes as one NDJSON row.

**Archives need explicit consent** *(0.7.1)*. A headless rejection no longer destroys anything: `--verdicts` holds rejected entries as non-destructive `pending_archive` facts (exit `0`, with a loud summary). Actually archiving them requires `--allow-archive` **and** `--because "<reason>"` — the reason goes on the record. Under `--mode ci`, archives are refused under any flag (exit `2`, atomic).

**Structured verdicts** *(0.7.1)* — the flag form for scripted single decisions: `--approve <refs...>` lands approvals; `--skip` and `--defer` record nothing and leave the items queued. The three are mutually exclusive with `--verdicts`.

There is deliberately no auto-approve mode for review — trust requires a human decision; the structured flags and `--verdicts` land *your* decisions, they never invent them.

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

Paused extract *and* design sessions live under `.context/sessions/` for 24 hours. `list` shows each with its pending-question count, expiry, and ready-to-paste resume command. `show <sid>` prints everything the paused agent is waiting on — the questions in full, any defaults it assumed in your absence, and the resume forms. `clean` garbage-collects expired sessions (`clean <sid>` removes one; `--all` removes everything).

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

Assigns a stable name. Names are never part of a node's identity — renaming never re-addresses — and names follow edits, so a name assigned to version 1 keeps resolving to the current version. The sequential-id namespace (`uc-3`, `ac-12`, …) is reserved for ids assigned at mint — `name` refuses it (exit `2`).

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
├── locks/               # advisory run locks (transient)
├── logs/                # per-run trace files (see "Tracing a run")
├── design/              # design rationale sidecars + technique overrides
├── reconcile/plans/     # stored reconcile plans
└── signals.ndjson       # internal review bookkeeping (appears once recorded)
```

Two rules worth repeating from the [overview](./overview.md#the-store-context): the store is **single-writer**, and it is **not git-mergeable** — gitignore it and share by re-ingesting sources.

### Tracing a run

Every extract and design run prints a `trace: <path>` line naming its log file — the first place to look when a run surprises you.

## For agents and CI

Headless extraction (`--mode agent|ci|override`), the NDJSON event stream, exit codes, and the pause/resume contract are documented in [Automation](./automation.md).

## Next steps

- [Designing tests](./design.md) — turn a trusted use-case into ACs, scenarios, and runnable tests.
- [Maintaining the suite](./maintain.md) — what to do when a source changes.
- [Automation](./automation.md) — the headless contract.
