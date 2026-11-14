<!-- kane-cli skill reference: bug memory and feedback (kane-cli bugs list|show|mark|note|duplicate|retire). Read it after a saved test failed and you are diagnosing it, when the person asks about known bugs, or when a diagnosis needs correcting. Internal parsing reference: never show field names or raw JSON to the person. -->

# Bugs — Agent Surface

**Version.** Needs the kane-cli release that ships `kane-cli bugs`. If `bugs` is an unknown command, the installed build predates it: say so and go on without it.

When a saved test fails, kane-cli's failure diagnosis (the RCA) works out why, and the diagnosis is uploaded with the run's evidence. kane-cli remembers each distinct **application bug** it finds, folds repeat sightings of the same bug together, and gives each one a ref that is unique within the project: `BUG-12`. A bug has a card (title, root cause, page, error signature), a status, and the runs it was seen in.

When a later run fails on the same page, its diagnosis is told about the known bugs there: their status, their votes, and the latest note. It links the run to one of them only when this run's own evidence shows the same defect. **Feedback is how that memory gets sharper**: say what is real, say when a recorded root cause is wrong, and leave a note with what you learned. The next diagnosis reads it.

## 1. Commands

| Command | What it does |
|---|---|
| `kane-cli bugs list <file>_test.md --agent` | The bugs this test has hit (its Test Manager test case) |
| `kane-cli bugs list --testcase <id> --agent` | The bugs a Test Manager test case has hit, without a local file |
| `kane-cli bugs list [--status <list>] [--all-families] [--limit <n>] --agent` | No test and no `--testcase`: the project's bugs |
| `kane-cli bugs show BUG-12 --agent` | The card, status, votes, the runs it was seen in, and every live piece of feedback with its id |
| `kane-cli bugs mark BUG-12 real` \| `not-real` `--agent` | Is this a real product bug? (a vote) |
| `kane-cli bugs mark BUG-12 rca-right` \| `rca-wrong` `--agent` | Is the recorded root cause right? (a vote) |
| `kane-cli bugs mark BUG-12 done` \| `not-a-bug` \| `reopen` `--agent` | A ruling: fixed, a false alarm, or back to open |
| `kane-cli bugs note BUG-12 "<text>" --agent` | Free text; the next diagnosis reads the latest note |
| `kane-cli bugs duplicate BUG-12 --of BUG-9 --agent` | BUG-12 is the same bug as BUG-9: merges 12 into 9. No confirmation |
| `kane-cli bugs retire <feedback-id> --agent` | Take back a vote or note you gave (the id is in the `mark`/`note` output and in `show`) |

- **Refs.** `BUG-12`, `bug-12` and `12` all mean BUG-12.
- **`--status`** takes a comma-separated list of `open`, `confirmed`, `done`, `regressed`, `not_a_bug`, `contested`, `merged` (`not-a-bug` also works). **`--limit`** is 1-200, default 50. **`--all-families`** lists every kind of failure the diagnosis recorded, not only application bugs.
- **Every subcommand** takes `--project <id>`, `--profile <name>`, `--env <prod|stage>`, `--username <user>`, `--access-key <key>` and `--agent`.

**Which project.** `--project`, else the test.md's own project, else the folder's linked project, else the profile's (`kane-cli config project <id>`). With none: `NO_PROJECT`.

**Which test.** `bugs list <file>_test.md` needs the test to have a Test Manager test case, which it gets the first time it runs with an upload. A test that never uploaded refuses with `NO_TESTCASE`: run it once, or pass `--testcase <id>`.

## 2. Who the feedback counts as

- Feedback is the signed-in user's, and it moves the bug's status for the whole project.
- **With `--agent`** it is recorded as the agent's, made under the signed-in user, and it counts the same as a person's. Always pass `--agent` for your own marks, so a person reading the bug can tell yours from theirs. Without `--agent` but with no terminal, the output is still one JSON line, yet the mark is recorded as the person's.
- **One vote per person.** A person and the agent working as them share one `real`/`not-real` vote and one `rca-right`/`rca-wrong` vote; the latest wins. Marking again changes the vote, it does not add one.
- Only the person who gave feedback (or the agent working as them) can retire it. Another person's feedback refuses with `NOT_FOUND`.

**How the status moves.**

| Status | When |
|---|---|
| `open` | New, or the real-bug votes are not net positive. Shown as `open (disputed)` when more people say it is not real |
| `confirmed` | More `real` than `not-real` votes |
| `done` | Ruled fixed with `mark done` |
| `regressed` | Ruled `done`, then seen again in a later run |
| `not_a_bug` | Ruled a false alarm with `mark not-a-bug` |
| `contested` | Ruled `not_a_bug`, then hit again by several different tests |
| `merged` | Merged into another bug with `duplicate` |

The latest ruling wins; `mark reopen` drops back to the votes.

## 3. Output (one JSON line with `--agent`)

```
bugs list      {"ok":true,"project_id":"<project>","testcase_id":"<testcase>","bugs":[{"ref":"BUG-12","status":"open","votes":1,"rca_votes":-1,"title":"…","root_cause":"…","page_pattern":"/cart","occurrences":3,"testcases":2,"last_seen_at":"…"}],"has_more":false}
bugs show      {"ok":true,"bug":{"ref":"BUG-12","status":"open","card":{"title":"…","root_cause":"…","page_pattern":"/cart","error_signature":"…"},"occurrence_count":3,"testcase_count":2,"votes":1,"rca_votes":-1,…},"occurrences":[{"evidence_id":"…","seen_at":"…",…}],"feedback":[{"id":"<feedback-id>","type":"vote_rca","value":"-1","author_kind":"agent","created_at":"…"},{"id":"<feedback-id>","type":"note","text":"…","author_kind":"user",…}]}
bugs mark      {"ok":true,"ref":"BUG-12","feedback_id":"<feedback-id>","status":"confirmed"}
bugs note      {"ok":true,"ref":"BUG-12","feedback_id":"<feedback-id>","status":"open"}
bugs duplicate {"ok":true,"ref":"BUG-12","feedback_id":"<feedback-id>","status":"merged","of":"BUG-9","merged":true,"merged_into":"BUG-9"}
bugs retire    {"ok":true,"feedback_id":"<feedback-id>","retired":true,"status":"open"}
refusal        {"ok":false,"error":"NOT_FOUND","message":"BUG-99 is not a bug in project <project>. This project's bugs: BUG-12, BUG-14"}
```

- `testcase_id` appears only when the list is for one test. `votes` and `rca_votes` are net counts and appear only when known; `disputed: true` appears only when set.
- A bug's feedback `type` is `vote_real` / `vote_rca` (value `1` or `-1`), `note`, `done`, `not_a_bug`, `reopen` or `duplicate_of`; `author_kind` is `user` or `agent`.
- `duplicate` with `"merged":false` was recorded as a suggestion only; the bugs were not merged.
- On a terminal the same commands print a table (`REF  STATUS  VOTES  TITLE  OCCURRENCES`) or plain lines.

**Exit codes.** `0` done · `1` any refusal.

## 4. Errors and how to recover

| `error` | Meaning → what to do |
|---|---|
| `NOT_FOUND` | An unknown ref: pick one from the refs the message lists. On `retire`: the id is wrong, or the feedback is not yours |
| `NO_TESTCASE` | The test.md has no Test Manager test case yet: run it once with an upload, or pass `--testcase <id>` |
| `NO_PROJECT` | Pass `--project <id>`, run in a linked folder, or bind one with `kane-cli config project <id>` |
| `NOT_ENABLED` | `the bug store is not enabled on this controller`: bug memory is not available in this environment yet. Tell the person in one line and go on without it |
| `UNAUTHORIZED` | Sign-in: the person runs `kane-cli login` (never ask for keys in chat) |
| `NETWORK` | No answer: check the connection or `--env`, then retry |
| `NOT_READY` | Retry in a minute |
| `CYCLE` | The merge would loop (BUG-9 is already merged into BUG-12) |
| `INVALID` | A bad argument (an unknown mark, an empty note, `--limit` out of range, a bug as a duplicate of itself, a test.md that does not exist): fix the call as the message says |
| `CONFLICT` | Someone changed the bug at the same moment: retry |

## 5. In an RCA flow

After a saved test fails (`testmd run`, or a member of `testrun run`):

1. Read the failure as usual (`references/debug.md`), including the diagnosis in the evidence pack.
2. `kane-cli bugs list <file>_test.md --agent`: what this test has hit before. A known bug that matches this failure is context, not a new finding: name its ref in the failure card's 🔍 row.
3. `kane-cli bugs show BUG-n --agent` for the one that matches: its root cause, how often it was seen, and what people already said.
4. Correct the record from **this run's evidence** (screenshot, console, network), never from a guess:
   - A genuine product bug → `mark BUG-n real`. A test or environment problem → `mark BUG-n not-real`.
   - The recorded root cause does not match what you see → `mark BUG-n rca-wrong`, then `note BUG-n "<what is actually wrong, in one line>"`. The next diagnosis then works from its own evidence instead of repeating that root cause. It matches → `mark BUG-n rca-right`.
   - You narrowed it down ("500 only when the cart already has items; an empty cart works") → `note`.
   - Two refs are the same bug → `duplicate BUG-12 --of BUG-9` (keep the older one).
5. Tell the person in one line what you marked and why. A mark you got wrong: `retire <feedback-id>`.

Rulings (`done`, `not-a-bug`, `reopen`) and merges change the bug for everyone in the project: make them when the person says so ("it's fixed", "that's expected behaviour"), or when the evidence is unambiguous, and say so in your summary.
