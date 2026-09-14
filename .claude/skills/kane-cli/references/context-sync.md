<!-- kane-cli skill reference: context sync (share the .context/ store with a team through a location; push, pull, clone, the rebase walk and its decisions). Read when the user wants to share the context store, join a teammate's, keep two stores level, or resolve a sync conflict. Requires kane-cli 0.8.14+. -->

# Context sync — Agent Surface

The assurance store (`.context/`, `references/assurance.md` §8) is one person's. **Context sync** shares it with a team through a **location**: a GitHub repository, an S3-compatible bucket, or a folder. Each person keeps their own store and publishes to the location; nothing on a location is ever overwritten or deleted. Reach for this reference when the user wants to share their context store, join a teammate's, get two stores level, or resolve a sync conflict. Sync never calls the KaneAI service — no credits, no model.

**Version gate.** `kane-cli context sync`, `push`, `pull` and `clone` exist on **kane-cli 0.8.14 and later**. On an older CLI they fail as an *unknown command* (exit 2, a "did you mean" line) — the CLI is too old, not a typo. Confirm with `kane-cli --version`, have the user update, stop.

## 1. Vocabulary — use these words

| Word | Means |
|---|---|
| **store** | the `.context/` directory on one machine |
| **location** | where a store is shared through — a GitHub repository, an S3-compatible bucket, or a folder. Bound to a store under a **name** (`origin`, `team`) |
| **local** | this store's side of anything |
| **the location's name** | the other side. Say "`origin`'s version", never "remote", never "yours/theirs" |
| **level** | local and the location hold the same records |
| **rebase** | both sides added work after the last shared record: the local records are saved, the location's are taken, the saved ones are reapplied on top — a real disagreement becomes a **decision** |
| **can publish / download only** | what a location allows this account: `tier` 1 in the events = can publish; 2 or 3 = clone and pull only |

## 2. Commands

Every verb takes `--mode agent` (NDJSON, stderr byte-empty, `done` last). `[name]` defaults to `origin`.

| Command | Does |
|---|---|
| `kane-cli context sync setup` | guided Share / Join — **terminal only**; under `--mode agent` refuses `TTY_REQUIRED`. Agents use `sync add` and `clone` |
| `kane-cli context sync add <name> <location>` | checks the location and binds this store to it. S3 keys: `--credential-env <VAR>` (reads `$VAR_ID`, `$VAR_SECRET`) or `--credential-file <path>` (`{"accessKeyId","secretAccessKey"}`); GitHub: the user's existing Git sign-in, or `KANE_SYNC_GIT_TOKEN` in CI |
| `kane-cli context sync list` / `remove <name>` | the bound locations / forget one (its saved credentials are deleted) |
| `kane-cli context sync status [name]` | how local stands against the location + the open decisions; `--show <n>` prints one moved record in full. **Never writes** — safe any time |
| `kane-cli context sync doctor` | every rebase with its id and state; `--abort` closes the open rebase; `--export <dir>` builds the pre-rebase store beside |
| `kane-cli context push [name]` | publishes local records the location lacks; refuses when the location has records local has not pulled |
| `kane-cli context pull [name]` | takes the location's new records; finishes an open rebase first; `--rebase --yes` starts one when the sides diverged |
| `kane-cli context sync [name]` | finish an open rebase, pull, then push — the everyday verb |
| `kane-cli context clone <location> [dir]` | creates a new store in `dir` from a location, bound as `origin` |
| `… --answer <id>=<choice>` | on `sync` and `pull` only: answers one open decision headless (§5) |

Location forms: `https://github.com/<owner>/<repo>.git` or `git@github.com:<owner>/<repo>.git` (optional `?prefix=<path>#<branch>`); `s3://<bucket>/<prefix>?endpoint=<origin>&region=<region>`; a folder path. A folder under Dropbox, Drive, OneDrive or iCloud is refused.

## 3. The stream — the minimum an agent parses

Envelope `{"type":…,"v":1,"verb":"sync",…}`; a write verb refused by the fence stamps its own name (`"verb":"name"`). **The vocabulary is open — tolerate unknown event types and fields, never fail on them.** Events not listed (`sync_locations`, `sync_removed`, `sync_doctor`, `sync_rebase_item`, …) are informational — fold or ignore.

| type | fields | handle |
|---|---|---|
| `sync_probe_started` | `name`, `kind` (`git`/`s3`/`dir`) | "checking `<name>`…" — a first GitHub check can take minutes |
| `sync_probe` | `name`, `kind`, `tier` (1 = can publish; 2/3 = download only), `detail` | one line: bound, and whether it can publish |
| `sync_status` | `name`, `relation{kind, local{seq}, storage{seq}, at?}`, `rebase_id` (or null), `decisions[]` (each a `sync_rebase_decision` payload); with `--show <n>`: `record[]` (the record in full, as lines) + `decision` (or null); `name`/`relation` are then null | translate `relation.kind`: `up-to-date` · `behind` (pull) · `ahead` (push) · `diverged` (rebase; `at` = last shared record) · `empty-storage` (push first) · `empty-local` · `foreign-lineage` (a different history — clone it instead) |
| `sync_pull_done` | `name`, `imported`, `from`, `to`, `blobs`, `proposals`; `clone` adds `dir` | "pulled N records from `<name>`" |
| `sync_push_done` | `name`, `from`, `to`, `pushed`, `blobs`, `proposals`, `already_there` | "published N records to `<name>`" |
| `sync_rebase_started` | `name`, `rebase_id`, `from`, `backup_path`, `moved[]`, `quarantined_tests[]` | "N local records saved; taking `<name>`'s version, then reapplying" |
| `sync_rebase_decision` | `rebase_id`, `decision_id` (`h<n>`), `kind`, `intent`, `seq`, `label`, `location`, `mine`, `theirs`, `answers[{answer, consequence}]` | THE deliverable when paused — one per open decision, all emitted before the walk stops (§5) |
| `sync_rebase_done` | `rebase_id`, `reapplied`, `already_present`, `not_reapplied`, `decisions_open`, `status` (`complete`/`paused`/`aborted`) | the walk's summary |
| `sync_rebase_open` | `rebase_id`, `decisions_open`, `pending` | a push met an open rebase; a `sync_error` follows |
| `sync_behind` | `name`, `local_seq`, `storage_seq`, `text` | rides `context extract`, `design tests`, `maintain reconcile` streams: `<name>` has records local has not pulled. One advisory line, not a failure |
| `sync_error` | `code` (§6), `detail`, `remedy`, `diagnostic?` | map the code; offer `remedy` verbatim |
| `error` | `code` (`USAGE`, `MODE_USAGE`, `CREDENTIALS_MISSING`, `TTY_REQUIRED`), `message`, `remedy?` | a usage refusal — fix the command line, never retry unchanged |
| `done` | `status` (`complete` 0 · `refused` 2 or 3 · `paused` 3 · `interrupted` 130 · `error` 1), `exit_code` | **always last** — build post-run logic on it |

Captured shapes (synthetic values):

```json
{"type":"sync_error","v":1,"verb":"sync","code":"SYNC_DIVERGED","detail":"you and origin both added work after position 2; nothing was pulled","remedy":"run kane-cli context pull origin --rebase to save your local work, take the team version from origin, and then reapply yours"}
{"type":"sync_rebase_decision","v":1,"verb":"sync","rebase_id":"2026-09-14T09-46-36-395Z-reset","decision_id":"h3","kind":"slug","intent":"names","seq":3,"label":"names spec","location":"origin","mine":"named prd \"spec\" at 2026-09-14T09:46:10.971Z","theirs":"\"spec\" names brief on origin (by bob at 2026-09-14T09:46:06.263Z)","answers":[{"answer":"keep-theirs","consequence":"the local change stays in the backup"},{"answer":"apply-mine","consequence":"the name moves to the local node; the node that holds it on origin is reached by its id again"}]}
{"type":"done","v":1,"verb":"sync","status":"paused","exit_code":3}
```

## 4. Exit codes (these verbs only)

| Code | Meaning |
|---|---|
| `0` | complete |
| `2` | refused — usage, credentials, no terminal, a precondition (`SYNC_REBASE_PENDING`, `SYNC_READ_ONLY`, `SYNC_LOCATION_*`, `SYNC_GIT_REQUIRED`, …); nothing changed |
| `3` | **a decision or a pull is needed — not a failure.** `SYNC_BEHIND` / `SYNC_DIVERGED` / `SYNC_POSITION_TAKEN` refusals, `done{paused}` from a walk with decisions open, and `doctor --abort` that left decisions unresolved |
| `1` | a record that cannot be used (`SYNC_*_CORRUPT`, `SYNC_REMOTE_CHAIN_BROKEN`) — a person has to look; nothing changed |
| `130` | interrupted; the next `sync` or `pull` resumes the rebase |

## 5. Decisions — how to answer

A rebase starts only with `kane-cli context pull <name> --rebase --yes --mode agent` (without a terminal `--yes` is required — otherwise `SYNC_DIVERGED` with that exact line as the `remedy`). The walk reapplies what it can, emits one `sync_rebase_decision` per real disagreement, then `sync_rebase_done{paused}` + `done{paused}`, exit 3. The rebase stays **open** until every decision is answered or it is aborted.

- **One decision at a time, never guess.** Present each card in plain words: what local did (`mine`), what `<name>` holds (`theirs`), the offered answers with their `consequence`. If the user's instruction clearly settles it, answer; otherwise ask.
- **Answer by id**, only with an answer from that card's `answers[]`: `kane-cli context sync <name> --answer h3=keep-theirs --mode agent` (repeatable; also on `pull`). `keep-theirs` writes nothing (the local change stays in the backup); `apply-mine` lands the local version on top of the location's; `apply-mine-as-new` (offered only for newly created items) adds the local content as a new item.
- After an answer the stream re-emits the decisions still open and `done{paused}` again — or `sync_rebase_done{complete}` → `sync_pull_done` → `sync_push_done` → `done{complete}` when the last one lands.
- **Decide later** = do not answer; the rebase stays open. `kane-cli context sync status <name> --mode agent` lists the open decisions any time; `--show <n>` prints the moved record in full when a card is not enough.
- An unknown id, an answer the card does not offer, or `--answer` with no open rebase → `error{USAGE}` naming the fix; an answer checked against decisions that have since moved → `SYNC_REBASE_PENDING` — read `sync status` again.

## 6. Refusal codes — map to plain words, remedy verbatim

| Code | Say | Then |
|---|---|---|
| `SYNC_BEHIND` (3) | `<name>` has records this store has not pulled; nothing was published | `kane-cli context pull <name>` |
| `SYNC_DIVERGED` (3) | local and `<name>` both added work after the last shared record; nothing moved | the remedy's `pull <name> --rebase` line — with `--yes` under agent mode, and only with the user's go-ahead |
| `SYNC_POSITION_TAKEN` (3) | someone published to `<name>` while this push was in flight; nothing lost | `kane-cli context pull <name> --rebase`; at the very first record: clone the location into a new folder instead |
| `SYNC_REBASE_PENDING` (2) | a rebase is open on this store; it takes no other change until it is finished | `kane-cli context sync` or `kane-cli context pull` to continue, or `kane-cli context sync doctor --abort` to close it — the user's call |
| `SYNC_LOCATION_UNREACHABLE` (2) | nothing answered at the address (missing folder, unreachable host, no repository there) | check the address, run again |
| `SYNC_LOCATION_DENIED` (2) | `<name>` refused this account even a read | ask the owner for access, or bind again with the right credentials (`sync add … --credential-env <VAR>`) |
| `SYNC_LOCATION_EMPTY` (2) | `clone` found nothing to join yet | ask the teammate to `kane-cli context push <name>` first, then clone again |
| `SYNC_LOCATION_REFUSED_WRITE` (2) | the location refused the publication (permissions, branch policy, a named setting) | relay the remedy; do not retry unchanged |
| `SYNC_READ_ONLY` (2) | this account can only download from `<name>` | pull from it, or publish to a location the account can write |
| `SYNC_GIT_REQUIRED` (2) | Git is missing or older than 2.31 | install or update Git, then run again |
| `SYNC_PUBLICATION_UNKNOWN` (2) | the push may or may not have landed (a lost response) | keep the local work; check connectivity; run the same command again — it reconciles, never duplicates |
| `SYNC_COPIED_STORE_UNRESOLVED` (2) | this store is a copy or a moved directory, not the one `<name>` was bound from | `kane-cli context sync add <name> <location>` from this directory to bind it, then run again |
| any other `SYNC_*` | read `detail` + `remedy` — every refusal carries the next command | relay both; never improvise a workaround |

## 7. The fence

While a rebase is open, the store takes writes from the walk only. Every other write verb — `name`, `retire`, `revert`, `context ingest`/`extract`, `design tests`, `maintain reconcile`, `context review` — refuses `SYNC_REBASE_PENDING` (exit 2; a `sync_error` under `--mode agent`, stamped with that verb's name); `push` emits `sync_rebase_open` then the same refusal; a test run's results wait in a side queue and land on the first run after the rebase is finished. Reads (`status`, `doctor`, `list`, `explain`, `fsck`, `view`) never block. Two ways out, both the user's: **finish it** (`kane-cli context sync <name>`, answering decisions per §5) or **close it** (`kane-cli context sync doctor --abort` — reapplied items stay, unresolved local changes stay in the backup, `sync_rebase_done{aborted}`, exit 3 when decisions were left). **Never delete files under `.context/` to lift the fence** — the backup and the rebase record are the way back.

## 8. Never

- Never edit, copy around, or hand-repair anything under `.context/`; never `git add`/`git merge` `.context/` — keep it gitignored. Sharing happens through a location, even when the location is a Git repository.
- Never put a secret in a location address or on the command line: S3 keys go through `--credential-env`/`--credential-file` (or `KANE_SYNC_S3_ACCESS_KEY_ID` + `KANE_SYNC_S3_SECRET_ACCESS_KEY` at use time), a GitHub token through `KANE_SYNC_GIT_TOKEN`. An address is safe to paste; it grants nothing by itself.
- Never `push` to work around a refusal — `SYNC_BEHIND` and `SYNC_DIVERGED` mean pull (or rebase) first; a push never overwrites anything, so there is nothing to force.
- Never delete a lock, a backup, a journal or a rebase record; never start `--rebase --yes` or `doctor --abort` without the user's explicit instruction.
- Never answer a decision the user has not settled, and never pass an answer the card did not offer.
- Never run `sync setup` from an agent — it needs a terminal; `sync add` shares, `clone` joins.

## 9. Narration

- Translate codes; never show event or field names, ids, hashes or raw NDJSON. Name the location by its name: "origin has 3 records you have not pulled", "published 2 records to team".
- The two sides of a decision are **local** and the location's name — never "remote", never "yours/theirs".
- One line per decision, from `label` + `mine` + `theirs` + the offered answers; one line per answer landed ("h3: kept origin's version").
- On exit 3 say what is waiting (a pull, or N decisions) and the exact next command; it is not a failure. On exit 2 relay `remedy` verbatim.
- `sync_behind` on an assurance stream is one advisory line ("origin has moved past this machine — pull when convenient"); the run continues.
