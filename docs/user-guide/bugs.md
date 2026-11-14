# Bug memory and feedback

<!-- release: needs kane-cli bugs -->
> Needs the kane-cli release that ships `kane-cli bugs` (`kane-cli bugs --help` prints the command list). On an older build, `bugs` is an unknown command.

When a saved test fails, kane-cli works out why: its **failure diagnosis** (the RCA, root-cause analysis) reads the run's evidence and writes down what went wrong. kane-cli also **remembers the application bugs** those diagnoses find, so the same bug is recognised the next time a test runs into it, and you and your coding agent can correct and enrich what it remembers with `kane-cli bugs`.

- Each distinct bug gets a ref that is unique within your Test Manager project: `BUG-12`.
- Repeat sightings of the same bug are folded into it, so you see one bug seen in five runs, not five bugs.
- Your feedback (is it real, is the root cause right, a note) is read by the next diagnosis.

## How bugs appear

1. A saved test (`kane-cli testmd run`, or a test in a `kane-cli testrun run` suite) fails.
2. The failure is diagnosed, and the diagnosis is uploaded with the run's [evidence](./evidence.md).
3. If the diagnosis found an application bug, kane-cli either files it as a new bug with its own `BUG-<n>` ref, or adds this run to the bug it already knows.

Each bug has a **card**: a title, the root cause, the page it happens on, and the error it shows. It also has a **status**, the **votes** people and agents gave it, and the list of runs it was seen in.

## How the next diagnosis uses it

When a later run fails on the same page, its diagnosis is told about the known bugs there: their status, their votes, and the latest note. It links the run to one of them only when **this run's own evidence** shows the same defect. A known bug is context for the diagnosis, never a shortcut past the evidence.

That is why feedback matters:

- Marking a bug `real` or `not-real` tells the next diagnosis how much weight it deserves.
- Marking its root cause `rca-wrong`, with a note that says what is actually wrong, makes the next diagnosis re-diagnose from its own evidence instead of repeating the recorded root cause.
- A note ("500 only when the cart already has items; an empty cart works") is passed on as it is. The latest note is the one the diagnosis reads.
- Marking a bug `done` and then seeing it again flags it as `regressed`.

## Which test and which project

`kane-cli bugs` works on a Test Manager project:

1. `--project <id>`, if you pass it;
2. else the project of the test file you name;
3. else the project your folder is [linked to](./assurance/shared-projects.md);
4. else your profile's project (`kane-cli config project <id>`, see [Test Manager integration](./test-manager-integration.md)).

To list the bugs of one test, the test needs a **Test Manager test case**. A test.md gets one the first time it runs with an upload. A test that has never uploaded has none: run it once, or pass `--testcase <id>` with the test case id from Test Manager.

## Commands

### List bugs

```bash
kane-cli bugs list checkout_test.md                 # the bugs this test has hit
kane-cli bugs list --testcase <id>                  # the bugs a Test Manager test case has hit
kane-cli bugs list                                  # the project's bugs
kane-cli bugs list --status open,confirmed          # only these statuses
```

On a terminal you get a table:

```
REF     STATUS  VOTES      TITLE                                          OCCURRENCES
BUG-12  open    1, rca -1  Checkout returns 500 when the cart has items   3
BUG-9   done    2          Promo code field accepts expired codes         5

2 bugs for test case … in project ….
Details: kane-cli bugs show <REF>
```

`VOTES` is the net real-bug vote, then the net root-cause vote when it isn't zero (`rca -1` means more people said the root cause is wrong than right).

| Flag | What it does | Default |
|---|---|---|
| `[test]` | A `*_test.md` file: its bugs | the project's bugs |
| `--testcase <id>` | A Test Manager test case id, instead of a test.md | none |
| `--status <list>` | Only these statuses, comma-separated: `open`, `confirmed`, `done`, `regressed`, `not_a_bug`, `contested`, `merged` | every status except `merged` |
| `--all-families` | Every kind of failure the diagnosis recorded, not only application bugs | application bugs |
| `--limit <n>` | At most n bugs (1-200) | 50 |

### Show one bug

```bash
kane-cli bugs show BUG-12
```

Prints the card (title, root cause, kind, severity, page, error signature), how often and when the bug was seen and in how many test cases, its votes, the runs it was seen in, and every piece of feedback still in force, each with its **id** (you need the id to take your own feedback back). `BUG-12`, `bug-12` and `12` all mean the same bug.

### Mark a bug

```bash
kane-cli bugs mark BUG-12 real          # it is a real product bug
kane-cli bugs mark BUG-12 not-real      # it is a test or environment problem
kane-cli bugs mark BUG-12 rca-right     # the recorded root cause is right
kane-cli bugs mark BUG-12 rca-wrong     # the recorded root cause is wrong
kane-cli bugs mark BUG-12 done          # it is fixed
kane-cli bugs mark BUG-12 not-a-bug     # it was a false alarm
kane-cli bugs mark BUG-12 reopen        # take back done / not-a-bug
```

```
BUG-12: marked root cause wrong. Status: open.
Feedback … (take it back: kane-cli bugs retire …)
```

`real`, `not-real`, `rca-right` and `rca-wrong` are **votes**. `done`, `not-a-bug` and `reopen` are **rulings**.

### Add a note

```bash
kane-cli bugs note BUG-12 "500 only when the cart already has items; an empty cart works"
```

Quote the text. The next diagnosis reads the latest note on the bug.

### Merge a duplicate

```bash
kane-cli bugs duplicate BUG-12 --of BUG-9
```

Says BUG-12 is the same bug as BUG-9 and merges 12 into 9. There is no confirmation prompt. The output says whether the bugs were merged, or the duplicate was recorded only as a suggestion. A merge is undone with a split in Test Manager.

### Take your feedback back

```bash
kane-cli bugs retire <feedback-id>
```

The id is printed by `mark` and `note`, and listed by `bugs show`. You can take back only your own feedback.

### Flags every subcommand takes

| Flag | What it does |
|---|---|
| `--project <id>` | The Test Manager project (see [Which test and which project](#which-test-and-which-project)) |
| `--profile <name>` | Profile name (default: the active one) |
| `--env <name>` | Environment |
| `--username <user>` / `--access-key <key>` | Basic auth, skipping the stored sign-in |
| `--agent` | One JSON line on stdout; feedback is recorded as the agent's (see below) |

## Statuses

| Status | Meaning |
|---|---|
| `open` | New, or the real-bug votes are not net positive. Shown as `open (disputed)` when more people say it is not real |
| `confirmed` | More people say it is real than not |
| `done` | Ruled fixed |
| `regressed` | Ruled fixed, then seen again in a later run |
| `not_a_bug` | Ruled a false alarm |
| `contested` | Ruled a false alarm, then hit again by several different tests |
| `merged` | Merged into another bug as a duplicate |

The latest ruling wins. `reopen` drops a bug back to what its votes say.

## Votes, people and agents

- Feedback is recorded under the signed-in user, and it changes the bug for everyone in the project.
- **One vote per person.** You have one real/not-real vote and one root-cause vote on each bug. Voting again replaces your vote; it does not add a second one.
- **Agents.** When your coding agent runs `kane-cli bugs … --agent`, its feedback is recorded as the agent's, made under your sign-in, and it counts the same as yours. `bugs show` labels each piece of feedback `user` or `agent`, so you can tell them apart. Your vote and your agent's vote are the same vote: the latest one counts.

## For agents

With `--agent`, or when stdout or stdin is not a terminal, every subcommand prints one JSON line:

```json
{"ok":true,"ref":"BUG-12","feedback_id":"…","status":"open"}
```

and a refusal prints:

```json
{"ok":false,"error":"NOT_FOUND","message":"BUG-99 is not a bug in project …. This project's bugs: BUG-12, BUG-14"}
```

Exit codes: `0` done, `1` any refusal. A typical agent flow after a saved test fails: read the failure from its evidence pack, `kane-cli bugs list <file>_test.md --agent` to see what the test has hit before, `kane-cli bugs show BUG-n --agent` for the bug that matches, then `mark` and `note` from what this run's evidence shows. The kane-cli agent skill carries this flow; see [Using kane-cli from an AI coding agent](./agents.md).

## Troubleshooting

| Message | What to do |
|---|---|
| `the bug store is not enabled on this controller` | Bug memory isn't available in this environment yet. Nothing to fix on your side; runs and diagnoses work as before |
| `this test.md has no Test Manager test case yet: run it once with an upload, or pass --testcase` | The test has never uploaded. Run it once, or pass `--testcase <id>` |
| `no project: pass --project <id>, run in a folder linked to a project, or bind one with …` | Pass `--project <id>`, run in a linked folder, or bind one with `kane-cli config project <id>` |
| `BUG-99 is not a bug in project …. This project's bugs: …` | A ref from another project, or a typo. Pick one from the list, or pass the right `--project` |
| `feedback … was not found, or is not yours` | The id is wrong, or the feedback is someone else's. `kane-cli bugs show <REF>` lists the ids |
| `"…" is not a mark: use real, not-real, rca-right, rca-wrong, done, not-a-bug, reopen` | Use one of those words |
| `--status takes open, confirmed, done, regressed, not_a_bug, contested, merged (comma-separated)` | Fix the status list |
| `--limit must be an integer in [1, 200]` | Pass a number from 1 to 200 |
| `… cannot be a duplicate of itself` / the merge would loop | Pick another bug for `--of` |
| `the controller refused the sign-in: run …` | Sign in again with `kane-cli login` ([Authentication](./authentication.md)) |
| No answer (a network error) | Check your connection, or the environment you passed with `--env` |

## Next steps

- [Evidence packs](./evidence.md): where a failed run's diagnosis and logs live.
- [Running test.md files](./testmd/running.md): replay, healing, and what happens when a replay fails.
- [Batch runs (testrun)](./testrun.md): many tests, one execution.
- [Troubleshooting](./troubleshooting.md): the debugging flow.
