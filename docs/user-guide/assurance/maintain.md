# Maintaining the suite as sources change

Products change; tests shouldn't rot. `kane-cli maintain` closes the [assurance loop](./overview.md): when a requirement document changes, `maintain reconcile` turns that one changed source into an honest, row-by-row update plan for your suite, and `maintain evolve` re-designs a use-case whose design went stale. Everything works over the same `.context/` store — maintain adds no new knowledge kinds, it moves the existing ones.

```bash
kane-cli maintain reconcile --from <file> --source-id <id>          # the in-chat review (TTY default)
kane-cli maintain reconcile --from <file> --source-id <id> --plan   # preview: stage + store the plan
kane-cli maintain reconcile --apply [path]                          # continue a stored plan
kane-cli maintain reconcile --from <file> --source-id <id> --mode agent   # headless — see Automation
kane-cli maintain evolve <ref> [--because "<reason>"]               # re-design one stale use-case (interactive)
kane-cli maintain evolve --from-stale                               # …or every use-case with stale designs
```

<a name="reconcile"></a>
## `maintain reconcile` — one changed source, one triage

Reconcile is the on-change front door: a requirement document changed — what should the suite do about it? It re-ingests the source, re-extracts use-cases over the new snapshot, and leads with a changeset (what the change did to your knowledge). *(0.7.2)* In a terminal, every proposed change then **holds behind a review card** — adds, updated versions, archives — and nothing from the changeset commits until you give a verdict. Only two pass-throughs land at finalize: evidence attached to unchanged matches, and the extraction record itself.

It takes **two explicit inputs** — reconcile never guesses which source a file belongs to:

- `--from <file|url>` — the **new** version of the document: a file path, or *(0.7.2)* a Jira issue / Confluence page URL (the same URLs [`context ingest`](./context.md#ingest) takes — see [Remote sources](#remote-sources)).
- `--source-id <id>` — the **existing** source this file succeeds; its head moves. Find ids with `kane-cli context list --type source`. Required with a file; optional beside a URL, whose id is intrinsic.

With a file, both are required on a fresh run. `--apply <path>` alone is enough to continue a stored plan — the plan remembers its source.

> Hand reconcile the changed file directly — don't `context ingest` the new version first. Reconcile does the re-ingest itself, and [re-running the same command](#running-again) is always safe.

### Fail-fast validations

Before anything runs — no questions asked, nothing written, identical in every mode — reconcile validates its inputs, in order:

1. both `--from` and `--source-id` are present;
2. the file exists and is a regular file;
3. it is an ingestable document type;
4. the source id names a known source;
5. that source isn't retired (restore it first with [`kane-cli context revert`](./context.md#housekeeping));
6. the file doesn't already back a **different** live source — the fork guard: the error suggests the `--source-id` you probably meant, so one document's history never silently forks into another's;
7. *(0.7.2)* the **held-source guard**: a live session already holding review work pinned to this source refuses the head move and names the session to finish first (`kane-cli context extract --resume <sid>`) — the head never moves under held evidence. A session file that can't be read fails **closed**, with the [`context sessions`](./context.md#sessions) list/clean remedy: a file that can't be read can't prove the absence of a hold.

Any failure exits `2` with a message naming the next command to run. In `--mode agent`, validation failures ride the NDJSON stream (`error` + `done`), never stderr alone.

### The changeset — what the change did

Rendered first, before any actions:

```
changeset: 3 item(s)
  [MODIFY] uc-manage-the-cart — updated: title, criteria
  [ADD] uc-save-cart-for-later
  [ARCHIVE] uc-legacy-flow — evidence decayed: no quote from the source relocates into the new text, no other live source, no fresh evidence this run
```

- **MODIFY** — the re-extract matched an existing use-case whose content moved. Each MODIFY knows *why*: a content change in the source, or a structural break the change caused.
- **ADD** — a use-case newly extracted from the changed source.
- **ARCHIVE** — a strict, three-part evidence decay: every quote fails to relocate into the new text, *and* no other live source evidences the node, *and* this run attached no fresh evidence. All three, or it isn't proposed for archiving.

### The in-chat review (the default in a terminal)

*(0.7.2)* A terminal reconcile runs as an **in-chat review**. The extraction runs over the change, every proposed change holds, and the check-in offers `review N change(s) from <source>` as its first row — `later` stays available, every other row keeps working, and the offer returns at each check-in until you take it. Selecting it walks the held changes **one card at a time, highest risk first**. Each card shows what changed (a compact diff), why it matched, its evidence cite, and its honest downstream cost (`impact: approving marks 14 item(s) stale`); a longer diff collapses to its summary plus a non-committing `view diff` row (esc returns to the card).

The verdicts:

- **approve** commits that change: an ADD mints the draft (and offers `design tests now`), a MODIFY mints the successor with a redirect from the old version (and offers `evolve the design now`), an ARCHIVE applies the non-destructive retire (reversible any time with [`kane-cli context revert`](./context.md#housekeeping)). Offers are rows you choose — never auto-run — and a child design run surfaces its questions in this same session.
- **reject** drops the staged proposal and leaves **zero residue** — nothing is remembered, so a later reconcile may propose the same change again; that is deliberate.
- **defer** parks the decision as **one durable gap**, visible in [`cover gaps`](./coverage.md) with the reconcile command as its remedy; it clears when a later verdict lands on the same change. One compatibility note: while a deferred change is on the record, the store **no longer passes integrity checks or accepts commits on older kane-cli versions** — machines sharing a store should upgrade to 0.7.2 together.
- **✎ / typing is steering**: your words go to the agent, the remaining changes re-finalize, and revised cards re-present — cards you already resolved never come back (ARCHIVE cards take no steering).

Three properties worth knowing:

- **Every verdict re-validates at commit time.** A target retired mid-review, a source whose head moved again, or new live evidence on an archive target re-presents the card with the reason — an approved change never lands silently different from what you saw.
- **There is no batch approve-all.** Row 1 carries the recommendation, so Enter-through-the-cards is the fast path — but every change gets its own decision. Esc on a card is a deliberate no-op: verdicts are commits, and there is nothing to back out of.
- **Your decisions survive anything.** Verdicts persist beside the proposal as you make them — Ctrl+C keeps every decision, and the review resumes with `--apply` (below) or by resuming the session. The last verdict releases the source for other work.

The review also surfaces pending items from earlier extract sessions *(0.7.1)* — held items awaiting a verdict (including held updates to existing items) and possible duplicates join the same card review, so one pass covers everything waiting on you; a problem in that feeder never blocks the reconcile changes themselves. Held items' citations are re-verified against the source's current text before they commit — a citation that no longer holds is refused with a re-stage hint rather than committing silently.

### `--plan` — a preview that doesn't touch the suite

`--plan` records the source change and **stages everything downstream**: the proposed rows are held in a stored plan (`plan stored: <path>`, under `.context/reconcile/plans/`), and no tests or designs are touched. Two things do land, disclosed in the output: the head move (the change fact is true regardless of what you decide), and a matched use-case whose source content moved is updated as part of the re-extract itself. Every MODIFY and ARCHIVE row in the plan carries its impact line (`impact: approving marks N item(s) stale`), and a `skipped arms` line names every analysis this release does not run.

Walk the plan later with `--apply <path>` — or bare `--apply`. *(0.7.2)* If a live review is holding changes, bare `--apply` resumes it as cards first, **agent-free** — no model, no network; your stored verdicts are the pause state. (A headless run that meets a held review refuses instead of guessing verdicts.) With no held review, it picks the latest stored plan behind an approval prompt (headless modes accept it silently). `--apply --from <file> --source-id <id>` recomputes live instead. `--plan` and `--apply` together is a usage error (exit `2`). A repeated `--plan` re-renders the stored plan; an unchanged source is a truthful no-op (`nothing to reconcile`).

<a name="remote-sources"></a>
### Remote sources — `--from <url>` *(0.7.2)*

`--from` also accepts a **Jira issue or Confluence page URL** — the same URLs [`context ingest`](./context.md#ingest) takes. Remote sources ride the same flow as files: reconcile fetches the latest content through your Atlassian connection, the head moves if anything you'd cite changed, and everything downstream — cards, `--plan`, `--apply` — is identical.

```bash
kane-cli maintain reconcile --from https://<your-site>/browse/PROJ-123 --plan
kane-cli maintain reconcile --from https://<site>/wiki/spaces/<KEY>/pages/<id>/…
```

Remote-specific rules:

- **The id comes from the URL** (`proj-123` for an issue, `page-<id>` for a page), so `--source-id` is optional. Passing one that contradicts the URL's own identity refuses — reconcile never adopts a URL under a different id. A source you ingested under a custom id (`context ingest --as`) is maintained by re-running that ingest with the same `--as`.
- **Kind continuity, both ways.** A URL can't version a file-backed source that happens to share its id, and a file can't version a remote source — each refuses and names the correct `--from`. The same check runs when a stored plan replays, so a stale plan can never overwrite a source whose backing changed hands.
- **Stored plans remember the URL** and recompute by re-fetching it — the same way a file plan re-reads its file.
- **After an upgrade**, the first reconcile of a Jira issue ingested before 0.7.2 may report a head move that isn't a content edit — that's the source's one-time re-version (see [Accepted media](./context.md#accepted-media)), not a change to review.

<a name="running-again"></a>
### Running again — reconcile converges

The same command is safe to repeat; it picks up where things stand:

| State on a re-run | What happens |
|---|---|
| the file's bytes changed again | a fresh reconcile of the new change |
| unchanged, and the stored plan has pending rows | the plan is **resumed** in your chosen mode |
| unchanged, and the plan was fully applied | `already reconciled` — clean exit |
| unchanged, no stored plan | `nothing to reconcile` |
| the graph moved since the plan was stored | `graph moved since this plan — recomputing` (pending work is re-staged, not re-billed) |

A plan stored by an earlier kane-cli version is refused with a hint to recompute — plans don't survive format changes silently.

### Headless modes

`--mode agent|ci|override` is the same ask-policy matrix extract and design use — see [Automation](./automation.md) for the full contract and reconcile's NDJSON stream. Two things are specific to reconcile:

- Headless runs don't stage: the re-extract commits as it goes, and rows apply per mode — `override` and `ci` auto-apply ADD and MODIFY rows; `ci` fail-closes when a run needs human judgement; `agent` streams typed events and pauses. The in-chat review is a terminal surface — headless verdict behavior is unchanged in 0.7.2 (the stream itself tightened; next bullet).
- **Archiving is never automatic.** No headless mode archives anything; ARCHIVE decisions wait for an interactive session.
- *(0.7.2)* The `--mode agent` stream is **pure NDJSON**: it opens with a minimal `run_start`, nothing else prints on either output, and the re-extract child rides the same stream — its extract events interleave with the `reconcile_*` events, each stamped `verb: "reconcile"`. See [Automation](./automation.md) for the event vocabulary.

A bare non-TTY run refuses (exit `2`) and asks for an explicit `--mode` — or `--plan` for a preview.

### The rows

| Kind | Fact behind it | Action on approve |
|---|---|---|
| `ADD` | a use-case newly extracted from the changed source, or an uncovered criterion of a touched use-case | a design run for that use-case (`kane-cli design tests --use-case <id>`) |
| `MODIFY` | matched-but-changed content, or an entity whose pins this change broke | commit the update, or re-design via `kane-cli maintain evolve <id>` when the break is structural |
| `REMOVE` | a use-case now orphaned — no live source evidences it | plan-only — never executed in this release |

<a name="evolve"></a>
## `maintain evolve` — re-design a stale use-case

```bash
kane-cli maintain evolve <ref> [--because "<reason>"]   # any designed entity → its parent use-case
kane-cli maintain evolve --from-stale                   # every use-case with stale designed entities
```

Evolve re-designs the **parent use-case** of whatever you point it at — a test, scenario, criterion, or the use-case itself. It is interactive-only, and the blast radius is always stated before anything runs; declining is a clean exit.

- **Staleness-gated:** a fresh target refuses. `--because "<reason>"` is the sanctioned override — your reason becomes the change context the re-design sees, on the record.
- `--from-stale` collects every use-case with stale designed entities and walks them one confirm at a time.
- After a clean run, evolve reports the diff between the two design generations — what was superseded, what was minted, what was **retained** unchanged, and which criteria's verifying tests moved. A re-design doesn't break what it didn't change.
- Reconcile's MODIFY rows route here automatically — reach for evolve directly when staleness arrived outside a reconcile (an older change, a retired source). [`kane-cli cover gaps`](./coverage.md) lists stale designed entities in its ranked worklist.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Session, plan, or resume complete — or a friendly no-op (unchanged source). |
| `1` | The reconcile chain failed, or another live reconcile holds the lock (a dead run's lock clears itself — never delete it by hand). |
| `2` | Usage or validation failure — nothing was mutated. |
| `3` | Paused — pending work is in the stored plan; the same command (or `--apply`) continues it. |

## Next steps

- [Coverage](./coverage.md) — `cover gaps --stage design` is the standing worklist between reconciles.
- [Designing tests](./design.md) — what an approved ADD row actually runs.
- [Automation](./automation.md) — reconcile in CI, and its NDJSON stream.
