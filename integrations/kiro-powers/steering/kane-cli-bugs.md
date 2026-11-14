# Kane CLI — `kane-cli bugs` steering

Load this file when a saved `_test.md` test failed and you are diagnosing it, when the user asks about known bugs (a ref like `BUG-12`), or when a failure's diagnosis is wrong and needs correcting.

**Version.** Needs the Kane CLI release that ships `kane-cli bugs`. If `bugs` is an unknown command, the installed build predates it: say so and go on without it.

# What bug memory is

When a saved test fails, Kane CLI's failure diagnosis (the RCA) works out why, and the diagnosis is uploaded with the run's evidence. Kane CLI remembers each distinct **application bug** it finds, folds repeat sightings of the same bug together, and gives each one a ref that is unique within the project: `BUG-12`. A bug has a card (title, root cause, page, error signature), a status, and the runs it was seen in.

When a later run fails on the same page, its diagnosis is told about the known bugs there: their status, their votes, and the latest note. It links the run to one of them only when this run's own evidence shows the same defect. Feedback from people and agents is how that memory gets sharper, and the next diagnosis reads it.

# Commands

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

- `BUG-12`, `bug-12` and `12` all mean BUG-12.
- `--status` takes a comma-separated list of `open`, `confirmed`, `done`, `regressed`, `not_a_bug`, `contested`, `merged`. `--limit` is 1-200, default 50. `--all-families` lists every kind of failure the diagnosis recorded, not only application bugs.
- Every subcommand takes `--project <id>`, `--profile <name>`, `--env <prod|stage>`, `--username <user>`, `--access-key <key>` and `--agent`.
- **Project:** `--project`, else the test.md's own, else the folder's linked project, else the profile's (`kane-cli config project <id>`).
- **Test:** `bugs list <file>_test.md` needs the test to have a Test Manager test case, which it gets the first time it runs with an upload. Otherwise pass `--testcase <id>`.

# Who the feedback counts as

- Feedback is the signed-in user's, and it moves the bug's status for the whole project.
- With `--agent` it is recorded as the agent's, made under the signed-in user, and it counts the same as a person's. Always pass `--agent` for your own marks.
- One vote per person: the user and the agent working as them share one `real`/`not-real` vote and one `rca-right`/`rca-wrong` vote, and the latest wins.
- Only the person who gave feedback (or the agent working as them) can retire it.

Statuses: `open` (new, or votes not net positive; `disputed` when more say it is not real), `confirmed` (more `real` than `not-real`), `done` (ruled fixed), `regressed` (ruled done, then seen again), `not_a_bug` (ruled a false alarm), `contested` (ruled not a bug, then hit again by several different tests), `merged`. The latest ruling wins; `reopen` drops back to the votes.

# Output

With `--agent` every command prints one JSON line: `{"ok":true,…}` on success, `{"ok":false,"error":"<CODE>","message":"…"}` on a refusal. `list` carries `bugs[]` (`ref`, `status`, `votes`, `rca_votes`, `title`, `root_cause`, `page_pattern`, `occurrences`, `testcases`, `last_seen_at`) and `has_more`; `show` carries `bug`, `occurrences[]` and `feedback[]` (each with `id`, `type`, `value` or `text`, `author_kind` `user` or `agent`); `mark` and `note` carry `ref`, `feedback_id` and the new `status`; `duplicate` adds `merged` and `merged_into` (`"merged":false` means it was recorded as a suggestion only); `retire` carries `feedback_id` and `retired`. Exit `0` done, `1` any refusal. Never show these field names to the user.

| `error` | What to do |
|---|---|
| `NOT_FOUND` | An unknown ref: pick one from the refs the message lists. On `retire`: the id is wrong, or the feedback is not the user's |
| `NO_TESTCASE` | The test has no Test Manager test case yet: run it once with an upload, or pass `--testcase <id>` |
| `NO_PROJECT` | Pass `--project <id>` |
| `NOT_ENABLED` | `the bug store is not enabled on this controller`: bug memory is not available in this environment yet. Tell the user in one line and go on without it |
| `UNAUTHORIZED` | The user signs in with `kane-cli login` (never ask for keys in chat) |
| `NETWORK` / `NOT_READY` / `CONFLICT` | Retry shortly (for `NETWORK`, check `--env`) |
| `CYCLE` | The merge would loop |
| `INVALID` | Fix the call as the message says |

# After a saved test fails

1. Read the failure as usual (the `kane-cli-run` steering file, Failure handling), including the diagnosis in the evidence pack.
2. `kane-cli bugs list <file>_test.md --agent`: what this test has hit before. A known bug that matches is context, not a new finding: name its ref in the failure card.
3. `kane-cli bugs show BUG-n --agent` for the one that matches.
4. Correct the record from **this run's evidence** (screenshot, console, network), never from a guess:
   - A genuine product bug → `mark BUG-n real`; a test or environment problem → `mark BUG-n not-real`.
   - The recorded root cause is wrong → `mark BUG-n rca-wrong`, then `note BUG-n "<what is actually wrong>"`. The next diagnosis then works from its own evidence. It is right → `rca-right`.
   - Narrowed it down → `note`. Two refs are the same bug → `duplicate BUG-12 --of BUG-9`.
5. Tell the user in one line what you marked and why. A wrong mark: `retire <feedback-id>`.

Rulings (`done`, `not-a-bug`, `reopen`) and merges change the bug for everyone in the project: make them when the user says so, or when the evidence is unambiguous.
