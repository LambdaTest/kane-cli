# Maintaining the suite as sources change

Products change; tests shouldn't rot. `kane-cli maintain` closes the [lifecycle loop](./overview.md): when a requirement document changes, `maintain reconcile` turns that one changed source into an honest, row-by-row update plan for your suite. Everything works over the same `.context/` store — maintain adds no new knowledge kinds, it moves the existing ones.

```bash
kane-cli maintain reconcile --from <file> --source-id <id>          # the interactive session (TTY default)
kane-cli maintain reconcile --from <file> --source-id <id> --plan   # preview: stage + store the plan
kane-cli maintain reconcile --apply [path]                          # continue a stored plan
kane-cli maintain reconcile --from <file> --source-id <id> --mode agent   # headless — see Automation
```

<a name="reconcile"></a>
## `maintain reconcile` — one changed source, one triage

Reconcile is the on-change front door: a requirement document changed — what should the suite do about it? It re-ingests the source, re-extracts use-cases over the new snapshot, leads with a changeset (what the change did to your knowledge), and then triages the resulting rows with you.

It takes **two explicit inputs** — reconcile never guesses which source a file belongs to:

- `--from <file>` — the **new** version of the document (a file path).
- `--source-id <id>` — the **existing** source this file succeeds; its head moves. Find ids with `kane-cli context list --type source`.

Both are required on a fresh run. `--apply <path>` alone is enough to continue a stored plan — the plan remembers its source.

> Hand reconcile the changed file directly — don't `context ingest` the new version first. Reconcile does the re-ingest itself, and [re-running the same command](#running-again) is always safe.

### Fail-fast validations

Before anything runs — no questions asked, nothing written, identical in every mode — reconcile validates its inputs, in order:

1. both `--from` and `--source-id` are present;
2. the file exists and is a regular file;
3. it is an ingestable document type;
4. the source id names a known source;
5. that source isn't retired (restore it first with [`kane-cli context revert`](./context.md#housekeeping));
6. the file doesn't already back a **different** live source — the fork guard: the error suggests the `--source-id` you probably meant, so one document's history never silently forks into another's.

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

### The session (the default in a terminal)

Interactive reconcile is a chat session on the same shell [extract](./context.md#the-interactive-chat) and [design](./design.md) use. Each ADD / MODIFY / ARCHIVE card comes with its why — ARCHIVE cards carry the full evidence-decay reasoning — and for every card you can:

- **approve** — an ADD runs a design session for the new use-case right there in the session; a MODIFY commits the update, or re-designs the affected use-case when the break is structural (blast radius stated first).
- **steer** — say what you want changed in plain words; your words become the change context the re-design sees, on the record.
- **edit** — adjust the proposed fields before approving.
- **skip** — dismiss the row, on the record.
- **defer** — park the row; the stored plan keeps it and a later run re-offers it.
- **archive** (ARCHIVE cards only) — behind an explicit confirm. Restore is always possible with [`kane-cli context revert`](./context.md#housekeeping); nothing is ever deleted.

**Nothing lands unapproved.** Beyond recording the source change itself, everything a reconcile proposes is staged until you decide. Ctrl+C pauses cleanly — pending work lives in the stored plan, and the same reconcile command picks it back up. The session ends with an honest summary of what was applied, skipped, deferred, and archived.

### `--plan` — a preview that doesn't edit anything

`--plan` records the source change (the head move — that fact is true regardless of what you decide) and **stages everything else**: the proposed rows are held in a stored plan (`plan stored: <path>`, under `.context/reconcile/plans/`), no use-case updates land, no tests are touched. Walk it later with `--apply <path>`, or just re-run reconcile — a repeated `--plan` re-renders the stored plan. An unchanged source is a truthful no-op (`nothing to reconcile`).

<a name="running-again"></a>
### Running again — reconcile converges

The same command is safe to repeat; it picks up where things stand:

| State on a re-run | What happens |
|---|---|
| the file's bytes changed again | a fresh reconcile of the new change |
| unchanged, and the stored plan has pending rows | the plan is **resumed** in your chosen mode |
| unchanged, and the plan was fully applied | `already reconciled` — clean exit |
| unchanged, no stored plan | `nothing to reconcile` |
| the graph moved since the plan was stored | `plan superseded — recomputing` (pending work is re-staged, not re-billed) |

A plan stored by an earlier kane-cli version is refused with a hint to recompute — plans don't survive format changes silently.

### Headless modes

`--mode agent|ci|override` is the same ask-policy matrix extract and design use — see [Automation](./automation.md) for the full contract and reconcile's NDJSON stream. Two things are specific to reconcile:

- Headless runs don't stage: the re-extract commits as it goes, and rows apply per mode — `override` and `ci` auto-apply ADD and MODIFY rows; `ci` fail-closes when a run needs human judgement; `agent` streams typed events and pauses.
- **Archiving is never automatic.** No headless mode archives anything; ARCHIVE decisions wait for an interactive session.

A bare non-TTY run refuses (exit `2`) and asks for an explicit `--mode` — or `--plan` for a preview.

### The rows

| Kind | Fact behind it | Action on approve |
|---|---|---|
| `ADD` | a use-case newly extracted from the changed source, or an uncovered criterion of a touched use-case | a design run for that use-case |
| `MODIFY` | matched-but-changed content, or an entity whose pins this change broke | commit the update / re-design the affected use-case |
| `REMOVE` | a use-case now orphaned — no live source evidences it | plan-only — never executed in this release |

## Staleness outside a reconcile

A design can also go stale without a fresh reconcile — an older change, a retired source. `kane-cli design tests` is staleness-aware: a re-run against a moved use-case tells you (`was designed @ v1 — the use-case is now @ v2 (STALE)`), and [`--force`](./design.md#re-runs-and---force) re-designs it. [`kane-cli cover gaps`](./coverage.md) lists stale designed entities in its ranked worklist.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Session, plan, or resume complete — or a friendly no-op (unchanged source). |
| `1` | The reconcile chain failed, or another reconcile holds the lock. |
| `2` | Usage or validation failure — nothing was mutated. |
| `3` | Paused — pending work is in the stored plan; the same command (or `--apply`) continues it. |

## Next steps

- [Coverage](./coverage.md) — `cover gaps --stage design` is the standing worklist between reconciles.
- [Designing tests](./design.md) — what an approved ADD row actually runs.
- [Automation](./automation.md) — reconcile in CI, and its NDJSON stream.
