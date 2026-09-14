# Sharing the context graph with your team

`kane-cli context sync` *(0.8.14)* shares your `.context/` store with your team through a **location**: a GitHub repository, an S3-compatible bucket, or a folder on a shared drive. Every person keeps their own store on their own machine; the location holds the team's shared history. `kane-cli context push` publishes your new records, `kane-cli context pull` takes your teammates', and `kane-cli context clone` makes a new store from the location. Nothing on a location is ever overwritten or deleted, so a published record can never be un-published by mistake.

Sharing starts from a store you already have — `kane-cli context ingest <file> --mode ci` creates one from a first document ([Building the context graph](./context.md)). Then:

```bash
kane-cli context sync setup     # guided: share this store, or join your team's
kane-cli context sync origin    # every day after that: take the team's new records, publish your own
```

Two rules stand behind every command here: **never merge `.context/` with git**, and never edit it by hand. Sharing goes through a location, and only through the commands on this page.

<a name="locations"></a>
## Three kinds of location

| Kind | Address you type | How you sign in | Who can read it |
|---|---|---|---|
| **GitHub** (recommended) | `https://github.com/<owner>/<repo>.git` or `git@github.com:<owner>/<repo>.git`; add `#<branch>` for a branch other than `main`, `?prefix=<path>` to share one repository between stores | the Git sign-in you already have (SSH key, or HTTPS through a credential helper); CI uses `KANE_SYNC_GIT_TOKEN` or a deploy key | whoever the repository's visibility and permissions allow — everyone, if the repository is public |
| **S3-compatible** (AWS S3, MinIO, R2, …) | `s3://<bucket>/<prefix>?region=<region>&endpoint=<https://host>` — `prefix`, `region` (default `us-east-1`) and `endpoint` (only for a non-AWS service) are optional | an access key pair, passed with `--credential-env` or `--credential-file` | everyone granted the bucket in the storage console |
| **Folder** | a path: `/Volumes/team/context` or `../shared/team-context` | none — the file system's own permissions | everyone who can open the folder |

**GitHub.** Use a **dedicated repository** — not your code repository — and make it private if the requirements are. kane-cli needs Git 2.31 or newer on the machine. Setup and `kane-cli context sync add` check the repository by writing a few small permanent connection-check files and commits; they never publish your context. Each push is one ordinary commit on the branch; nothing is force-pushed, merged or rebased on the server. GitHub does not accept a single object above 100 MB, so when a source document is larger than that, choose an S3-compatible bucket. For HTTPS without a stored login, the GitHub CLI does it in two commands: `gh auth login --hostname github.com --git-protocol https --web`, then `gh auth setup-git --hostname github.com`. Another Git server works the same way with that server's sign-in.

**S3-compatible.** Ask your storage administrator for an existing bucket and a key pair; kane-cli creates neither. `--credential-env TEAM_S3` reads `TEAM_S3_ID` and `TEAM_S3_SECRET`; `--credential-file keys.json` reads `{"accessKeyId": "…", "secretAccessKey": "…"}`. Either way the pair is saved in `~/.testmuai/kaneai/context-sync/<name>.json`, readable by you only (mode `0600`), and `kane-cli context sync remove <name>` deletes it. That file belongs to the location's *name*, not to one store: every store on this machine whose location is called `origin` reads the same `origin.json`, so binding a second bucket as `origin` from another store replaces the keys the first one uses. When one machine works with more than one bucket, give each its own name (`team-s3`, `archive`). `KANE_SYNC_S3_ACCESS_KEY_ID` and `KANE_SYNC_S3_SECRET_ACCESS_KEY`, both set, win over the file at use time and are never written to disk — the CI form. A key pair the location refuses never replaces one that worked.

```bash
kane-cli context sync add origin "s3://team-context/assurance?region=eu-west-1" --credential-env TEAM_S3
kane-cli context sync add origin "s3://team-context/assurance?endpoint=https://minio.example.internal:9000" --credential-file ./keys.json
```

**Folder.** A mounted shared drive serves a team; a path on your own disk serves only you (sending the path does not send its contents). A folder that does not exist yet is created by `kane-cli context sync add` when its parent exists. Folders synced by **Dropbox, OneDrive, Google Drive or iCloud are refused** — they keep both sides of a clash as duplicate files instead of refusing the second write, which is the one thing a location must never do:

```
$ kane-cli context sync add origin ../Dropbox/ctx
error: a folder synced by Dropbox, OneDrive, Google Drive or iCloud cannot be a location: these keep both sides of a conflict as duplicate files instead of refusing the second write — use a directory outside the sync client, a git-tracked folder, or an s3:// bucket
```

<a name="setup"></a>
## Guided setup: `kane-cli context sync setup`

```bash
kane-cli context sync setup
```

Setup needs a terminal (headless it refuses with `TTY_REQUIRED` and names `kane-cli context sync add` and `kane-cli context clone` as the alternatives). It never publishes your context — publishing is always the separate `kane-cli context push`. The first screen asks **What do you want to do?**: **Share my context with my team** or **Join my team's context**.

**Share.** Setup asks where the shared context should live — **GitHub — Recommended**, **S3-compatible storage** or **Folder** — then for that kind's details. GitHub: the address of an existing repository, or a row that opens GitHub in the browser so you create a dedicated repository there and come back with its address; missing Git or GitHub CLI shows an installation link and a retry row. S3: the bucket name, the region (prefilled `us-east-1`), an optional folder inside the bucket, the service (Amazon S3, or another S3-compatible service, which then asks for its endpoint), and how to reach it — credentials already configured on this computer, or the access keys from your storage administrator typed in (the secret access key is masked) and saved in your local kane-cli credential store, never in the shared context. Folder: the path; the screen reminds you that everyone needs the same mounted drive and that consumer sync folders are not supported.

The location is bound under the name `origin`. If this store already has a location called `origin`, setup asks for another name and suggests `team`. The last screen shows the address, says that the connection check adds small permanent files (and, for a repository, commits) to the location, and waits for **Connect location**. Setup then prints what it found and ends with `Share this location with teammates:` followed by the complete address — for a Git location the repository address with the branch and prefix you chose. After a refusal, **Use a different address** re-enters the same prompts with what you typed kept, and **Choose a different storage** returns to the picker. Esc or Ctrl+C leave setup: *Setup left. Your context has not been published.*

**Join.** Setup asks you to **Paste the location your teammate shared**, then for a new folder to **Download into** (prefilled `team-context`; a folder that already exists is refused, so none of your files is replaced), then waits for **Connect and download**. It downloads the verified team context into that folder and closes with `Next: open that folder and run kane-cli context sync status`. Join never creates a location: an address that holds no records yet is refused until the teammate who shared it has pushed.

<a name="commands"></a>
## The commands

| Command | When to use it | What it prints |
|---|---|---|
| `kane-cli context sync setup` | the first time, on a terminal | the screens above |
| `kane-cli context sync add <name> <address> [--credential-env <VAR> \| --credential-file <path>]` | bind a location by hand (scripts, CI, a second location). Re-running with the same name replaces its address and keys — that is how you re-key | `added origin: dir tier 1 (all probes passed)` — the number after the kind says what the check found: `1` means the location can publish, `2` or `3` that it is download only |
| `kane-cli context sync list [--json]` | which locations this store knows | one line per location: name, kind, whether it can publish, address |
| `kane-cli context sync remove <name>` | forget a location and delete its saved keys | `removed origin` |
| `kane-cli context sync status [name] [--show <n>] [--json]` | where this store stands against the location; never writes | `up to date` / `behind` / `ahead` / `you and origin both added work after …`, then any open decisions; `--show <n>` prints saved record `n` in full |
| `kane-cli context sync doctor [--abort] [--export <dir> [--from <rebase-id>]] [--json]` | what the store looks like after an interruption; close an open rebase; rebuild the pre-rebase store beside | the chain state and every rebase with its id |
| `kane-cli context push [name]` | publish your new records | `pushed 2 records (3..4), 1 blobs, 0 proposals` |
| `kane-cli context pull [name]` | take your teammates' new records | `pulled 1 records (3..3), 0 blobs, 0 proposals` |
| `kane-cli context pull <name> --rebase [--yes]` | you and the location both added work | the walk below |
| `kane-cli context sync [name] [--answer <id>=<choice>]` | the everyday verb: finish an open rebase, pull, then push | the pull and push lines |
| `kane-cli context clone <address> [dir] [--credential-env <VAR> \| --credential-file <path>]` | join: make a new store from a location, bound as `origin`; the two flags pass an S3 key pair the same way `kane-cli context sync add` takes it | `cloned into …/bob: 2 records (1..2), 2 blobs, 0 proposals` |

`[name]` defaults to the only location; with several, to the one called `origin`; otherwise the command asks you to name one. Every command takes `--mode agent` for an NDJSON stream — see [Automation](./automation.md#the-sync-verbs-on-the-stream). Joining an S3-compatible location with keys from the environment:

```bash
kane-cli context clone "s3://team-context/assurance?region=eu-west-1" team-context --credential-env TEAM_S3
```

<a name="loop"></a>
## The everyday loop

Alice shares a store she already built; Bob joins it. Then each of them works, pulls, and pushes. Bob's commands after the clone run inside the cloned folder.

```
[alice] $ kane-cli context sync add origin ../shared/team-context
checking origin: read access and safe publishing…
added origin: dir tier 1 (all probes passed)

[alice] $ kane-cli context push origin
wrote kane-context/v1/meta.json on origin
pushed 1 records (1..1), 1 blobs, 0 proposals

[bob] $ kane-cli context clone ../shared/team-context bob
checking origin: read access and safe publishing…
bound origin: dir tier 1 (all probes passed)
cloned into …/bob: 1 records (1..1), 1 blobs, 0 proposals
```

Bob ingests a second document and publishes it. Alice, who has not pulled yet, tries to push. In the output, `position 2` is the second record of the shared history — this page says record 2:

```
[bob] $ kane-cli context ingest brief.md --mode ci
created  brief  source sha256:f2e4…  blob sha256:60af…
landed 1 source(s) — run kane-cli context extract to extract them

[bob] $ kane-cli context push origin
pushed 1 records (2..2), 1 blobs, 0 proposals

[alice] $ kane-cli context sync status origin
behind origin: this store is at position 1, origin at 2 — run kane-cli context pull origin

[alice] $ kane-cli context push origin
error: origin holds 2 records, this store 1: it has records this store has not seen
next: kane-cli context pull origin

[alice] $ kane-cli context pull origin
pulled 1 records (2..2), 1 blobs, 0 proposals

[alice] $ kane-cli context sync origin
up to date
```

The habit that avoids almost every refusal: **pull before you start, push when you finish** — or just run `kane-cli context sync origin` at both ends. When a teammate has pushed since you last pulled, a command that writes to the store first prints one advisory line — `origin has moved past this machine — run kane-cli context pull origin` — and carries on. The line is a best-effort courtesy, not a check you can rely on: it refuses nothing, it gives up silently after 1.5 seconds or when the location cannot be reached, it is not printed under `--mode agent` (`kane-cli context extract`, `kane-cli design tests` and `kane-cli maintain reconcile` emit a `sync_behind` event there instead), `kane-cli context review` prints it only on a terminal, and a test run writes it to its session log. `KANE_SYNC_GUARD=0` turns it off.

Ingest, extract, review and design all work exactly as before; the location only changes where records go afterwards. What a push sends, and what stays on your machine, is listed in [What travels](#travels).

<a name="rebase"></a>
## When two people changed the same thing

Alice and Bob both worked after the same shared record (record 2). Bob named the source `brief` "spec" and re-ingested a new version of `prd`, then pushed. Alice, without pulling, named `prd` "spec" and retired `prd`. Now `kane-cli context sync status origin` says `you and origin both added work after position 2` and names the command to run; `kane-cli context push origin` refuses with the same words (exit `3`), and so does a plain pull.

`kane-cli context pull origin --rebase` does three things: it **saves** Alice's records after the shared record in a backup, **takes** origin's records, and **reapplies** the saved records on top, one by one. Nothing on origin is rewritten. On a terminal it asks first, as a panel with the facts and two rows:

```
rebase from origin
  local          2 records from position 3 saved to .context/sync/backups/2026-09-14T10-45-07-658Z-reset
  origin         records 3..4 taken into this store
  then           the local records reapplied on top; a disagreement becomes a decision you answer
  never          history on origin rewritten

? continue

❯ 1. continue  — save, take, reapply
  2. not now  — nothing changes

  ↑↓ select · ⏎ confirm · esc not now
```

Without a terminal the same command refuses and names the line to run: `kane-cli context pull origin --rebase --yes`. `--yes` confirms exactly this; it never answers a decision.

Most saved records reapply without a word: a record the other side does not touch is reapplied, and a record the other side already made the same way is skipped as already there. A **real disagreement about one thing** reaches you as a **decision card**, one at a time. The two sides are always called **local** and the location's name:

```
decision 1 of 2  ·  slug on your names from record 3
  local          named prd "spec" at 2026-09-14T10:44:20.253Z
  origin         "spec" names brief on origin (by bob at 2026-09-14T10:44:15.529Z)

? what should happen to the local names from record 3

❯ 1. keep origin's version  — the local change stays in the backup
  2. apply the local version  — the name moves to the local node; the node that holds it on origin is reached by its id again
  3. decide later  — leaves the rebase open; kane-cli context sync or kane-cli context pull asks again

  ↑↓ select · ⏎ confirm · 1–9 jump · v full record · a decide everything later · ctrl+c pause
```

**Keep origin's version** is always offered and always the default: it writes nothing, and the local change stays in the backup. **Apply the local version** writes the local change as a new record on top of origin's; the row says the consequence. A third row, **add as new**, appears only for a new item whose match origin has since retired. **Decide later** leaves the card open; `kane-cli context sync` or `kane-cli context pull` asks again. `v` shows the full record under the facts, `a` leaves every remaining card for later, and Ctrl+C pauses — none of these is an error. Each answered card leaves one line in the scrollback (`decision h3: kept origin's version`), and the run ends with a summary counting what was reapplied, already there, not reapplied and undecided.

Some saved records cannot be reapplied at all, and their card offers only **keep origin's version**: a record this build cannot read or replay, one that refers to an item origin no longer has, or one the store's own checks refuse. The change stays in the backup, and that piece of work has to be done again once the rebase is finished. Keeping origin's version can also bring a later card back: a saved record that was built on the one you set aside is looked at again.

**Without a terminal** (a pipe, CI, `--mode agent`) no card is shown. Every open decision is one line — its id, the kind of record, the local change in words, and the answers it takes — and `kane-cli context sync status` repeats them any time:

```
[alice] $ kane-cli context sync status origin
up to date with origin: position 4 on both sides
rebase 2026-09-14T10-45-07-658Z-reset open: 2 decisions waiting
  h3  names   named prd "spec" at 2026-09-14T10:44:20.253Z  ·  keep-theirs | apply-mine
  h4  retire  retired prd at sha256:fb3e3e5a6cfa (2026-09-14T10:44:21.854Z)  ·  keep-theirs | apply-mine
next: kane-cli context sync  ·  kane-cli context sync status --show 3 (one record in full)
```

`kane-cli context sync status --show <n>` prints saved record `n` in full — what it did, what origin holds instead, the answers it accepts, and the raw detail behind the card:

```
[alice] $ kane-cli context sync status --show 3
record 3: names spec
origin sha256:1a52…
outcome: decision h3 (slug)
local:  named prd "spec" at 2026-09-14T10:44:20.253Z
origin: "spec" names brief on origin (by bob at 2026-09-14T10:44:15.529Z)
choose: keep-theirs, apply-mine
{
  "slug": "spec",
  "mine": "sha256:fb3e…",
  "theirs": "sha256:f2e4…"
}
```

Answer by id with `--answer <id>=<choice>` on `kane-cli context sync` or `kane-cli context pull` — `keep-theirs` keeps origin's version, `apply-mine` applies the local version, `apply-mine-as-new` adds it as new. Each run answers what you gave it; with cards still open it stops again and says so (`not synced: 1 decision waiting — run kane-cli context sync origin to answer it, or kane-cli context sync origin --answer h4=<choice>`). The last answer finishes the rebase; `kane-cli context sync` then pulls and pushes as usual, while `kane-cli context pull` only pulls. Here, after `--answer h3=keep-theirs` in the run before:

```
[alice] $ kane-cli context sync origin --answer h4=apply-mine
finishing rebase 2026-09-14T10-45-07-658Z-reset first: 1 decision waiting
reapplied your retire from record 4

rebase summary — complete
  rebase         2026-09-14T10-45-07-658Z-reset
  reapplied      1
  already there  0
  not reapplied  1
  test files     0 restored
pushed 1 records (5..5), 0 blobs, 0 proposals
```

**While a rebase is open, the store takes no other change** — exactly like git mid-rebase. `kane-cli context extract`, `kane-cli design tests`, `kane-cli maintain reconcile`, `kane-cli context ingest`, `kane-cli context review`, `kane-cli context name`, `kane-cli context retire` and `kane-cli context revert` refuse until the rebase is finished or closed, all with the same code (`SYNC_REBASE_PENDING`) and the same two ways out:

```
[alice] $ kane-cli context name prd other
error: a rebase (2026-09-14T10-45-07-658Z-reset) is open with 2 decisions unresolved; this store takes no other change until it is finished — run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
next: run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
```

`kane-cli context push` refuses with the same code and the same `next:` line; its reason names the rebase, counts the decisions unresolved, and says nothing was pushed. A test run does not refuse: the results it records are kept to the side and land on the first run after the rebase is finished.

`kane-cli context sync doctor` shows every rebase with its id and state, open or closed. `kane-cli context sync doctor --abort` closes the open one, keeping what was already reapplied and leaving the unanswered decisions in the backup (exit `3` when decisions were left). From another run, with one decision open:

```
[alice] $ kane-cli context sync doctor --abort
closed rebase 2026-09-14T10-45-52-997Z-reset: 0 reapplied stay, 1 unresolved decision left in the backup (receipt: sync/replay/2026-09-14T10-45-52-997Z-reset.receipt.json)
```

A rebase that was interrupted before origin's records had been imported is undone by the same `kane-cli context sync doctor --abort`: your records are put back and the store is as it was. Once the import has landed, the rebase can only be finished (`SYNC_RESET_IMPORTED`): `kane-cli context sync` or `kane-cli context pull` finishes it before doing anything else — then close it with `kane-cli context sync doctor --abort` if you still want to.

**The way back.** The live store holds records your teammates published, so it is never rewound in place. `kane-cli context sync doctor --export <dir>` rebuilds your store *as it was before the rebase*, beside it, as its own store — for inspection, or as a fresh start. Without `--from <rebase-id>` it exports the open rebase, or the only one; with several closed rebases, name one. Everything a rebase saves stays under `.context/sync/backups/<rebase id>/` and `.context/sync/replay/`; a receipt there lists every reapplied, skipped and undecided record. Test files that a reapplied record created are written again; a `_test.md` path that now holds other content is left alone and listed by `kane-cli context sync status` until you move that file aside and run `kane-cli context sync` again.

<a name="what-happens-when"></a>
## What happens when

"Origin" is the location; "you" means the records saved from your store.

| You did… | Origin, meanwhile… | Result of `kane-cli context pull origin --rebase` |
|---|---|---|
| ingested a new document, or extracted a new use-case | did something unrelated | reapplied, no question asked; a short id that origin has since used (`uc-5`) is renumbered (`uc-6`) and the alias is in the receipt |
| extracted a use-case | extracted the same use-case | kept once — origin's; your review verdicts and evidence attach to it |
| edited a use-case | edited it the same way | not reapplied: already done |
| edited a use-case | edited it differently | a decision; both versions are kept until you answer |
| reviewed an item (approve, reject) | reviewed the same item differently | a decision |
| named a node "spec" | named a *different* node "spec" | a decision: keep origin's name, or move the name to your node (origin's node is still reachable by its id) |
| retired or archived something | built new scenarios or tests on it | a decision — nothing another person built on is removed silently |
| retired a source | re-ingested a new version of that source | a decision: keep origin's new version, or retire the source as it is now, new version included |
| ran tests and recorded results | ran the same tests | both results apply, each to the exact version that ran |
| designed tests for a use-case | designed tests for the same use-case | a decision; keep origin's and run `kane-cli design tests` again afterwards if you want both |

<a name="travels"></a>
## What travels and what never travels

| Travels to the location | Never travels |
|---|---|
| every record of the graph (sources, use-cases, criteria, scenarios, tests, reviews, names, retirements, run results) | `.context/derived/` — the read caches; every store rebuilds them from the records |
| the source documents those records cite (the snapshot bytes) | paused sessions, locks and per-run logs — one machine's state |
| the extraction proposals behind the records | your `_test.md` files — they are working files in your project, and the records already carry what a test is. A teammate who wants to run them takes them from the project's code checkout; a rebase writes again the ones its reapplied records created |
| | your keys, the location list's local bindings, and the store's own identity ids |

No command that syncs calls the agent: **push, pull, sync, clone and a rebase spend no credits.** A store that pulls a use-case gets the same records the extractor committed, cited lines included.

<a name="refusals"></a>
## When a command refuses

Every sync refusal prints a plain reason; nearly all add a `next:` line with the command to run, and on the agent stream the same refusal is a `sync_error` event with a stable code, the reason and the remedy. The common ones:

| You see | Code | It means | Next |
|---|---|---|---|
| `origin holds 2 records, this store 1: it has records this store has not seen` | `SYNC_BEHIND` | you are behind | `kane-cli context pull origin`, then push again |
| `you and origin both added work after position 2` | `SYNC_DIVERGED` | you and a teammate both worked from the same record | `kane-cli context pull origin --rebase` (add `--yes` without a terminal) |
| a push says a teammate's record took the place it was writing to, and names the last record that landed | `SYNC_POSITION_TAKEN` | a teammate's push landed while your push was running; what landed stays. At the very first record there is no shared history at all | `kane-cli context pull origin --rebase`; at the very first record, clone the location into a new folder instead |
| a pull says this store changed while it ran | `SYNC_LOCAL_MOVED` | something appended to the store while the pull was being prepared | run the pull again |
| `nothing answered at /no/such/parent/team-context: that folder does not exist and cannot be created` / `no repository answered at that address, or your account cannot see it; a private repository looks missing until access is granted` | `SYNC_LOCATION_UNREACHABLE` | the address is wrong, the host is down, or a private repository is not shared with you | check the address, then run the command again |
| `the bucket … did not accept origin's access keys, even for reading` | `SYNC_LOCATION_DENIED` | the location answered and refused you | ask the owner for access, or bind again with the right keys: `kane-cli context sync add origin <address> --credential-env <VAR>` |
| `--credential-env TEAM_S3: TEAM_S3_ID is not set` | `CREDENTIALS_MISSING` | half a key pair | set `TEAM_S3_ID` and `TEAM_S3_SECRET`, then run the command again |
| `nothing to clone at …: it holds no records` | `SYNC_LOCATION_EMPTY` | the location is empty — nobody has pushed yet | ask the teammate who shared the address to run `kane-cli context push origin` first, then clone again |
| `archive is a tier 3 location: it can be cloned and pulled, never pushed` | `SYNC_READ_ONLY` | the location can be downloaded from only (no write permission, a read-only mount, a read-only key pair). `kane-cli context sync` meets this too, after its pull has already landed | take records from it with `kane-cli context pull`; publish to a location that can publish |
| `a folder synced by Dropbox, OneDrive, Google Drive or iCloud cannot be a location` | — | those folders keep both sides of a clash as duplicate files; the address is refused before any check runs | use a folder outside the sync client, a repository or a bucket |
| `a rebase (…) is open with 2 decisions unresolved` | `SYNC_REBASE_PENDING` | the store is fenced until the rebase is finished or closed | `kane-cli context sync` to answer, or `kane-cli context sync doctor --abort` to close it |
| `This location needs Git 2.31 or newer.` | `SYNC_GIT_REQUIRED` | Git is missing or too old for a GitHub location | install or update Git, then run the command again |
| `origin holds a different history (its first record is not this store's)` | `SYNC_FOREIGN_LINEAGE` | that location was started from another store; there is no merge | to work on it, clone it; to share this store, add an empty location |
| a push to a repository says publication could not be confirmed | `SYNC_PUBLICATION_UNKNOWN` | the network dropped mid-push; the batch may have landed | check connectivity and run the same command again — it reconciles what landed, never duplicates it |
| a message naming a hole or a rollback at the location | `SYNC_REMOTE_HOLE` / `SYNC_REMOTE_ROLLED_BACK` | something outside kane-cli deleted or changed files at the location | nothing was changed on your side; restore the location from a copy that holds the missing records, then run the command again |
| a message saying an object *on the location* does not hash to its name | `SYNC_OBJECT_CORRUPT` | a file at the location is damaged | nothing was changed on your side; a person has to look at the location before anything more is pushed to it |
| a message saying a *local* record or blob does not hash to its file name | `SYNC_LOCAL_RECORD_CORRUPT` / `SYNC_LOCAL_BLOB_CORRUPT` | a file in your own store is damaged; the location is fine | run `kane-cli context fsck`, then restore that record or blob from a backup or a clone of your store |

Exit `3` means a person has to decide something, exit `2` a precondition, exit `1` a record that cannot be used. A refusal says what stopped, not that nothing happened: `kane-cli context sync` finishes its pull before its push can be refused, and a push can land before its confirmation is lost. The full code list is in [Automation → The sync verbs on the stream](./automation.md#the-sync-verbs-on-the-stream); the entries a person meets most are in the [troubleshooting page](../troubleshooting.md#context-sync-a-location-cannot-be-reached-or-refuses-you).

## For agents and CI

Every command on this page takes `--mode agent` and speaks NDJSON — `sync_status`, `sync_pull_done`, `sync_push_done`, the `sync_rebase_*` family, `sync_error{code, detail, remedy}`, `done` last — and a rebase that stops on decisions ends with `done` carrying `paused` and exit `3`. The contract and the events are in [Automation → The sync verbs on the stream](./automation.md#the-sync-verbs-on-the-stream); the CI recipe with a GitHub token or deploy key is in [CI/CD recipes](../cicd.md#a-shared-context-store-in-ci).

## FAQ

**Two stores that were never connected — can I merge them?** No. A location holds one history; a store started separately is `a different history`, and the answer is to clone one of them and re-ingest the other's documents into it.

## Next steps

- [Building the context graph](./context.md) — ingest, extract, review.
- [Automation](./automation.md) — the headless contract, including the sync verbs.
- [Configuration](../configuration.md#context-sync-environment-variables) — the sync environment variables and on-disk paths.
- [Troubleshooting](../troubleshooting.md) — the sync entries.
