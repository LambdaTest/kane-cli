# Sharing the context graph with your team

`kane-cli context sync` *(0.8.14)* shares your `.context/` store with your team through a **location**: a GitHub repository, an S3-compatible bucket, or a folder on a shared drive. Every person keeps their own store on their own machine; the location holds the team's shared history. `push` publishes your new records, `pull` takes your teammates', and `clone` makes a new store from the location. Nothing on a location is ever overwritten or deleted, so a published record can never be un-published by mistake.

```bash
kane-cli context sync setup                   # guided: share this store, or join your team's
kane-cli context sync add origin <address>    # or bind a location by hand
kane-cli context push origin                  # publish your new records
kane-cli context pull origin                  # take your teammates' new records
kane-cli context sync origin                  # pull, then push
kane-cli context clone <address> <dir>        # join: a new store built from the location
```

Two rules stand behind every command here: **never merge `.context/` with git**, and never edit it by hand. Sharing goes through a location, and only through the commands on this page.

<a name="locations"></a>
## Three kinds of location

| Kind | Address you type | How you sign in | Who can read it |
|---|---|---|---|
| **GitHub** (recommended) | `https://github.com/<owner>/<repo>.git` or `git@github.com:<owner>/<repo>.git`; add `#<branch>` for a branch other than `main`, `?prefix=<path>` to share one repository between stores | the Git sign-in you already have (SSH key, or HTTPS through a credential helper); CI uses `KANE_SYNC_GIT_TOKEN` or a deploy key | everyone invited to the repository |
| **S3-compatible** (AWS S3, MinIO, R2, …) | `s3://<bucket>/<prefix>?region=<region>&endpoint=<https://host>` — `prefix`, `region` (default `us-east-1`) and `endpoint` (only for a non-AWS service) are optional | an access key pair, passed with `--credential-env` or `--credential-file` | everyone granted the bucket in the storage console |
| **Folder** | a path: `/Volumes/team/context` or `../shared/team-context` | none — the file system's own permissions | everyone who can open the folder |

**GitHub.** Use a **dedicated repository** — not your code repository — and make it private if the requirements are. kane-cli needs Git 2.31 or newer on the machine. Setup and `sync add` check the repository by writing a few small permanent files, one commit and a scratch reference under `refs/kane/probe/`; they never publish your context. Each push is one ordinary commit on the branch; nothing is force-pushed, merged or rebased on the server. For HTTPS without a stored login, the GitHub CLI does it in two commands: `gh auth login --hostname github.com --git-protocol https --web`, then `gh auth setup-git --hostname github.com`. Another Git server works the same way with that server's sign-in.

**S3-compatible.** Ask your storage administrator for an existing bucket and a key pair; kane-cli creates neither. `--credential-env TEAM_S3` reads `TEAM_S3_ID` and `TEAM_S3_SECRET`; `--credential-file keys.json` reads `{"accessKeyId": "…", "secretAccessKey": "…"}`. Either way the pair is saved in `~/.testmuai/kaneai/context-sync/<name>.json`, readable by you only (mode `0600`), and `sync remove <name>` deletes it. `KANE_SYNC_S3_ACCESS_KEY_ID` and `KANE_SYNC_S3_SECRET_ACCESS_KEY`, both set, win over the file at use time and are never written to disk — the CI form. A key pair the location refuses never replaces one that worked.

```bash
kane-cli context sync add origin "s3://team-context/assurance?region=eu-west-1" --credential-env TEAM_S3
kane-cli context sync add origin "s3://team-context/assurance?endpoint=https://minio.example.internal:9000" --credential-file ./keys.json
```

**Folder.** A mounted shared drive serves a team; a path on your own disk serves only you (sending the path does not send its contents). A folder that does not exist yet is created by `sync add` when its parent exists. Folders synced by **Dropbox, OneDrive, Google Drive or iCloud are refused** — they keep both sides of a clash as duplicate files instead of refusing the second write, which is the one thing a location must never do:

```
$ kane-cli context sync add origin ../Dropbox/ctx
error: a folder synced by Dropbox, OneDrive, Google Drive or iCloud cannot be a location: these keep both sides of a conflict as duplicate files instead of refusing the second write — use a directory outside the sync client, a git-tracked folder, or an s3:// bucket
```

<a name="setup"></a>
## Guided setup: `context sync setup`

```bash
kane-cli context sync setup
```

Setup needs a terminal (headless it refuses with `TTY_REQUIRED` and names `sync add` and `clone` as the alternatives). It never publishes your context — publishing is always the separate `push`. The first screen asks **What do you want to do?** with two rows: **Share my context with my team** and **Join my team's context**.

**Share.** The next screen, **Where should your team's shared context live?**, offers **GitHub — Recommended**, **S3-compatible storage** and **Folder**.

| Choice | The screens after it |
|---|---|
| GitHub | **Choose a GitHub repository**: **Use an existing repository** asks for the **Repository address**; **Create a repository on GitHub** opens GitHub in the browser — create a dedicated, private repository there and come back with its address. Missing Git or GitHub CLI shows an installation link and a retry row. |
| S3-compatible storage | **Bucket name**, **Region** (prefilled `us-east-1`), **Folder inside the bucket (optional)**, **Which storage service?** (**Amazon S3** or **Another S3-compatible service**, which then asks for the endpoint), then **Access to the bucket**: **Use credentials already configured on this computer** or **Enter the access keys from my storage administrator** — keys you type are masked and saved in your local kane-cli credential store, never in the shared context. |
| Folder | **Folder path**. The screen reminds you that everyone needs the same mounted drive and that consumer sync folders are not supported. |

Every path ends at the same place: a **Location:** line showing exactly what will be connected, a note that connection checks add small permanent files, and one row, **Connect location**. Setup then prints what it found. This is the closing of a Folder share (a GitHub share reads the same, ending with *Invite teammates on GitHub*):

```
Connected to …/share/team-context. You can download and publish changes.
Your context has not been uploaded yet.
When ready, publish with kane-cli context push origin. This shares your context records and their referenced source documents with everyone who can read the location.
Share this location with teammates: …/share/team-context
A location address contains no password: everyone who can open this folder can read it; sending the path does not send its contents.
```

The location is bound under the name `origin`. After a refusal, **Use a different address** re-enters the same prompts with what you typed kept, and **Choose a different storage** returns to the picker. Esc or Ctrl+C leave setup: *Setup left. Your context has not been published.*

**Join.** Setup asks you to **Paste the location your teammate shared**, then **Download into a new folder** (prefilled with the location's last name part), then shows **Connect and download**. It downloads the verified team context into that new folder — existing files are never replaced — and closes with `Next: open that folder and run kane-cli context sync status`. Join never creates a location: a location that holds no records yet is refused until the teammate who shared it has pushed.

<a name="commands"></a>
## The commands

| Command | When to use it | What it prints |
|---|---|---|
| `kane-cli context sync setup` | the first time, on a terminal | the screens above |
| `kane-cli context sync add <name> <address> [--credential-env <VAR> \| --credential-file <path>]` | bind a location by hand (scripts, CI, a second location). Re-running with the same name replaces its address and keys — that is how you re-key | `added origin: dir tier 1 (all probes passed)` — tier 1 means the location can publish; tier 2 or 3 means download only |
| `kane-cli context sync list [--json]` | which locations this store knows | one line per location: name, kind, tier, address |
| `kane-cli context sync remove <name>` | forget a location and delete its saved keys | `removed origin` |
| `kane-cli context sync status [name] [--show <n>] [--json]` | where this store stands against the location; never writes | `up to date` / `behind` / `ahead` / `you and origin both added work after …`, then any open decisions |
| `kane-cli context sync doctor [--abort] [--export <dir>] [--json]` | what the store looks like after an interruption; close an open rebase; rebuild the pre-rebase store beside | the chain state and every rebase with its id |
| `kane-cli context push [name]` | publish your new records | `pushed 2 records (3..4), 1 blobs, 0 proposals` |
| `kane-cli context pull [name]` | take your teammates' new records | `pulled 1 records (3..3), 0 blobs, 0 proposals` |
| `kane-cli context pull <name> --rebase [--yes]` | you and the location both added work | the walk below |
| `kane-cli context sync [name] [--answer <id>=<choice>]` | the everyday verb: finish an open rebase, pull, then push | the pull and push lines |
| `kane-cli context clone <address> [dir]` | join: make a new store from a location, bound as `origin` | `cloned into …/bob: 2 records (1..2), 2 blobs, 0 proposals` |

`[name]` defaults to the only location; with several, name one. Every command takes `--mode agent` for an NDJSON stream — see [Automation](./automation.md#the-sync-verbs-on-the-stream).

<a name="loop"></a>
## The everyday loop

Alice shares a store she already built; Bob joins it. Then each of them works, pulls, and pushes.

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

Bob ingests a second document and publishes it. Alice, who has not pulled yet, tries to push:

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

A **position** is a record's number in the shared history; `status` compares the two sides by it. The habit that avoids almost every refusal: **pull before you start, push when you finish** — or just run `kane-cli context sync origin` at both ends. When a teammate has pushed since you last pulled, every command that writes to the store first prints one advisory line — `origin has moved past this machine — run kane-cli context pull origin` — and carries on; `KANE_SYNC_GUARD=0` turns the line off.

Ingest, extract, review and design all work exactly as before; the location only changes where records go afterwards. `push` sends the records and the source documents they cite, never anything else — see [What travels](#travels).

<a name="rebase"></a>
## When two people changed the same thing

Alice and Bob both worked after the same shared record. Bob named the source `brief` "spec" and re-ingested a new version of `prd`, then pushed. Alice, without pulling, named `prd` "spec" and retired `prd`. Now nothing moves in either direction:

```
[alice] $ kane-cli context sync status origin
you and origin both added work after position 2 — run kane-cli context pull origin --rebase to save your local work, take the team version from origin, and then reapply yours

[alice] $ kane-cli context push origin
error: you and origin both added work after position 2; nothing was pushed
next: run kane-cli context pull origin --rebase to save your local work, take the team version from origin, and then reapply yours
```

`pull --rebase` does three things: it **saves** Alice's records after the shared record in a backup, **takes** origin's records, and **reapplies** her saved records on top, one by one. Her work is never redone by hand, and nothing on origin is rewritten. On a terminal it asks first, as a panel with the facts and two rows:

```
rebase from origin
  local          2 records from position 3 saved to .context/sync/backups/2026-09-14T10-14-28-503Z-reset
  origin         records 3..4 taken into this store
  then           the local records reapplied on top; a disagreement becomes a decision you answer
  never          history on origin rewritten

? continue

❯ 1. continue  — save, take, reapply
  2. not now  — nothing changes
```

Without a terminal the same command refuses and names the line to run: `kane-cli context pull origin --rebase --yes`. `--yes` confirms exactly this; it never answers a decision.

Most saved records reapply without a word: a record the other side does not touch is reapplied, and a record the other side already made the same way is skipped as already there. Only a **real disagreement about one thing** reaches you, as a **decision card** — one at a time. The two sides are always called **local** and the location's name:

```
decision 1 of 2  ·  slug on your names from record 3
  local          named prd "spec" at 2026-09-14T10:14:25.252Z
  origin         "spec" names brief on origin (by bob at 2026-09-14T10:14:20.553Z)

? what should happen to the local names from record 3

❯ 1. keep origin's version  — the local change stays in the backup
  2. apply the local version  — the name moves to the local node; the node that holds it on origin is reached by its id again
  3. decide later  — leaves the rebase open; kane-cli context sync or kane-cli context pull asks again

  ↑↓ select · ⏎ confirm · 1–9 jump · v full record · a decide everything later · ctrl+c pause
```

| Row | What it does |
|---|---|
| **keep origin's version** (row 1, always offered, always the default) | writes nothing; your version stays in the backup |
| **apply the local version** | writes your version as a new record on top of origin's; the row says the consequence |
| **add as new** | offered only for a new item whose match origin has since retired: mint it again as its own item |
| **decide later** | leaves the card open; the next `sync` or `pull` asks again |

`v` shows the full record under the facts, `a` leaves every remaining card for later, and Ctrl+C pauses — none of these is an error. Each answered card leaves one line in the scrollback (`decision h3: kept origin's version`), and the run ends with a summary:

```
rebase summary — paused (decisions left)
  rebase         2026-09-14T10-14-28-503Z-reset
  reapplied      0
  already there  0
  not reapplied  1
  undecided      1
  test files     0 restored
  resume         kane-cli context pull origin
```

**Without a terminal** (a pipe, CI, `--mode agent`) no card is shown. Every open decision is one line — its id, the kind of record, your change in words, and the answers it takes — and `status` repeats them any time:

```
[alice] $ kane-cli context sync status origin
up to date with origin: position 4 on both sides
rebase 2026-09-14T10-13-45-679Z-reset open: 2 decisions waiting
  h3  names   named prd "spec" at 2026-09-14T10:13:36.707Z  ·  keep-theirs | apply-mine
  h4  retire  retired prd at sha256:fb3e3e5a6cfa (2026-09-14T10:13:38.250Z)  ·  keep-theirs | apply-mine
next: kane-cli context sync  ·  kane-cli context sync status --show 3 (one record in full)
```

`status --show <n>` prints one saved record in full — what it did, what origin holds instead, and the answers it accepts:

```
[alice] $ kane-cli context sync status --show 3
record 3: names spec
origin sha256:f46d…
outcome: decision h3 (slug)
local:  named prd "spec" at 2026-09-14T10:13:36.707Z
origin: "spec" names brief on origin (by bob at 2026-09-14T10:13:32.168Z)
choose: keep-theirs, apply-mine
```

Answer by id with `--answer <id>=<choice>` on `sync` or `pull` — `keep-theirs` keeps origin's version, `apply-mine` applies the local version, `apply-mine-as-new` adds it as new. Each run answers what you gave it and stops again if cards remain; the last answer finishes the rebase, and `sync` then pulls and pushes as usual:

```
[alice] $ kane-cli context sync origin --answer h3=keep-theirs
finishing rebase 2026-09-14T10-13-45-679Z-reset first: 2 decisions waiting
not reapplied: your names from record 3 (you kept origin's version)
  h4  retire  retired prd at sha256:fb3e3e5a6cfa (2026-09-14T10:13:38.250Z)  ·  keep-theirs | apply-mine
…
not synced: 1 decision waiting — run kane-cli context sync origin to answer it, or kane-cli context sync origin --answer h4=<choice>

[alice] $ kane-cli context sync origin --answer h4=apply-mine
finishing rebase 2026-09-14T10-13-45-679Z-reset first: 1 decision waiting
reapplied your retire from record 4

rebase summary — complete
  rebase         2026-09-14T10-13-45-679Z-reset
  reapplied      1
  already there  0
  not reapplied  1
  test files     0 restored
pushed 1 records (5..5), 0 blobs, 0 proposals
```

**While a rebase is open, the store takes no other change** — exactly like git mid-rebase. Extract, design, review, ingest, name, retire, a test run recording its result, and `push` all refuse with the same two lines until the rebase is finished or closed:

```
[alice] $ kane-cli context name prd other
error: a rebase (2026-09-14T10-13-45-679Z-reset) is open with 2 decisions unresolved; this store takes no other change until it is finished — run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
next: run kane-cli context sync or kane-cli context pull to continue, or kane-cli context sync doctor --abort to close it
```

`doctor` shows every rebase with its state; `doctor --abort` closes the open one, keeping what was already reapplied and leaving the unanswered decisions in the backup (exit `3` when decisions were left):

```
[alice] $ kane-cli context sync doctor --abort
closed rebase 2026-09-14T10-15-59-998Z-reset: 0 reapplied stay, 1 unresolved decision left in the backup (receipt: sync/replay/2026-09-14T10-15-59-998Z-reset.receipt.json)
```

**The way back.** The live store now holds records your teammates published, so it is never rewound in place. `doctor --export <dir>` rebuilds your store *as it was before the rebase*, beside it, as its own store — for inspection, or as a fresh start:

Everything a rebase saves stays under `.context/sync/backups/<rebase id>/` and `.context/sync/replay/`; a receipt there lists every reapplied, skipped and undecided record. Test files that a reapplied record minted are written again through the same writer; a `_test.md` path that now holds other content is left alone and listed by `status` until you move the stranger aside and run `sync` again.

<a name="what-happens-when"></a>
## What happens when

Each row stands alone. "Origin" is the location; "you" means the records saved from your store.

| You did… | Origin, meanwhile… | Result of `pull --rebase` |
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
| designed tests for a use-case | designed tests for the same use-case | a decision; keep origin's and run `design tests` again afterwards if you want both |

<a name="travels"></a>
## What travels and what never travels

| Travels to the location | Never travels |
|---|---|
| every record of the graph (sources, use-cases, criteria, scenarios, tests, reviews, names, retirements, run results) | `.context/derived/` — the read caches; every store rebuilds them from the records |
| the source documents those records cite (the snapshot bytes) | paused sessions, locks and per-run logs — one machine's state |
| the extraction proposals behind the records | your `_test.md` files — they are working files in your project, and the records already carry what a test is |
| | your keys, the location list's local bindings, and the store's own identity ids |

No command that syncs calls the agent: **pull, push, sync, clone and a rebase spend no credits.** A store that pulls a use-case gets the same records the extractor committed, cited lines included.

<a name="refusals"></a>
## When a command refuses

Every refusal prints a plain reason and a `next:` line. The common ones:

| You see | It means | Next |
|---|---|---|
| `origin holds 2 records, this store 1: it has records this store has not seen` | you are behind | `kane-cli context pull origin`, then push again |
| `you and origin both added work after position 2` | you and a teammate both worked from the same record | `kane-cli context pull origin --rebase` (add `--yes` without a terminal) |
| a push says a position is taken and names the last one that landed | a teammate's push landed while your push was running; what landed stays | `kane-cli context pull origin --rebase`; at position 1 there is no shared history — clone the location into a new folder instead |
| a pull says this store changed while it ran | something appended to the store while the pull was being prepared | run the pull again |
| `nothing answered at /no/such/parent/team-context: that folder does not exist and cannot be created` / `no repository answered at that address, or your account cannot see it; a private repository looks missing until access is granted` | the address is wrong, the host is down, or a private repository is not shared with you | check the address, then run the command again |
| `the bucket … did not accept origin's access keys, even for reading` | the location answered and refused you | ask the owner for access, or bind again with the right keys: `kane-cli context sync add origin <address> --credential-env <VAR>` |
| `--credential-env TEAM_S3: TEAM_S3_ID is not set` | half a key pair | set `TEAM_S3_ID` and `TEAM_S3_SECRET`, then run the command again |
| `nothing to clone at …: it holds no records` | the location is empty — nobody has pushed yet | ask the teammate who shared the address to `push` first, then clone again |
| `archive is a tier 3 location: it can be cloned and pulled, never pushed` | the location can be downloaded from only (no write permission, a read-only mount, a read-only key pair) | push to a location that can publish, or pull from this one |
| `a folder synced by Dropbox, OneDrive, Google Drive or iCloud cannot be a location` | those folders keep both sides of a clash as duplicate files | use a folder outside the sync client, a repository or a bucket |
| `a rebase (…) is open with 2 decisions unresolved` | the store is fenced until the rebase is finished or closed | `kane-cli context sync` to answer, or `kane-cli context sync doctor --abort` to close it |
| `This location needs Git 2.31 or newer.` | Git is missing or too old for a GitHub location | install or update Git, then run the command again |
| `origin holds a different history (its first record is not this store's)` | that location was started from another store; there is no merge | to work on it, clone it; to share this store, add an empty location |
| a push to a repository says publication could not be confirmed | the network dropped mid-push; the batch may have landed | check connectivity and run the same command again — it reconciles what landed, never duplicates it |
| a message naming a hole, a rollback, or a corrupt object | something outside kane-cli deleted or changed files at the location | nothing was changed on your side; restore the location from a copy that holds the missing records, then run the command again |

Every refusal has a stable code (`SYNC_BEHIND`, `SYNC_DIVERGED`, `SYNC_REBASE_PENDING`, …) on the agent stream and in the [troubleshooting page](../troubleshooting.md#context-sync-a-location-cannot-be-reached-or-refuses-you); exit `3` means a person has to decide something, exit `2` a precondition, exit `1` a record that cannot be used.

## For agents and CI

Every command on this page takes `--mode agent` and speaks NDJSON — `sync_status`, `sync_pull_done`, `sync_push_done`, the `sync_rebase_*` family, `sync_error{code, detail, remedy}`, `done` last — and a rebase that stops on decisions ends with `done` carrying `paused` and exit `3`. The contract, the events and a CI shape are in [Automation → The sync verbs on the stream](./automation.md#the-sync-verbs-on-the-stream); the CI recipe with a GitHub token or deploy key is in [CI/CD recipes](../cicd.md#a-shared-context-store-in-ci).

## FAQ

**Can I still gitignore `.context/`?** Yes — you should. kane-cli adds `.context/` to your `.gitignore` when it creates the store inside a git repository *(0.8.14)*; set `KANE_CONTEXT_GITIGNORE=0` to keep it out. Sharing goes through a location, never through a git merge of the store.

**Can the location be inside my code repository?** A folder inside a git checkout works as a location, and a GitHub location can be a branch of any repository — but use a dedicated repository. The location grows with every push and is never rewritten, and a code branch gains nothing from carrying it.

**Who can read a folder location?** Everyone who can open the folder. A location address carries no password and grants nothing by itself: a folder is shared by its permissions, a bucket in the storage console, a GitHub repository by an invitation.

**My teammate has not pushed yet. Can I join?** Not yet — `clone` refuses an empty location and says so. Ask them to `kane-cli context push origin` first, then clone.

**Two stores that were never connected — can I merge them?** No. A location holds one history; a store started separately is `a different history`, and the answer is to clone one of them and re-ingest the other's documents into it.

**Does `sync add` on an existing name replace it?** Yes: the address, the keys and the check are replaced under that name. That is the way to re-key a bucket or move a location.

## Next steps

- [Building the context graph](./context.md) — ingest, extract, review.
- [Automation](./automation.md) — the headless contract, including the sync verbs.
- [Configuration](../configuration.md#context-sync-environment-variables) — the sync environment variables and on-disk paths.
- [Troubleshooting](../troubleshooting.md) — the sync entries.
