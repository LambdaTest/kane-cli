# Shared projects: working with your team in Test Manager

A **shared project** is a Test Manager project your team works in together. Link a folder to one, and what you save there goes to the project, where your teammates see it: your documents, use-cases, acceptance criteria, scenarios and tests. Each scenario also gets its own test case in Test Manager. Runs count toward one coverage figure for the whole project, whoever ran them.

> Requires kane-cli **0.10.0 or later** (`kane-cli --version`).

## Two places your work can go

Each folder works one way or the other, and you choose once, the first time you add documents to it.

| | A shared project | A local store |
|---|---|---|
| Where the work lives | in the project, where everyone with access to it sees it | in `.context/` in this folder, on this machine |
| Test cases | one per scenario, in the project's Test Manager | none: your runs go to your profile's Test Manager project |
| Coverage | the project's figure, from everyone's runs | from the runs recorded in this folder's store |
| Sharing with a teammate | they join the project from their own folder | [`context sync`](./sharing.md), through a repository, a bucket or a folder |

If your team keeps its tests in Test Manager, use a shared project. The rest of this page is about shared projects. For a local store, start at [Building the context graph](./context.md).

## Before you start

Sign in, then find the project you'll work in, or make one:

```bash
kane-cli login
kane-cli projects list --search "Checkout"
kane-cli projects create "Checkout revamp"
```

`projects list` prints each project's id beside its name:

```text
ID                          NAME
--------------------------  ----
01HZX3K9QW8T5M2C7V4N6B1R0D  Checkout revamp
```

`projects create` ends by suggesting `kane-cli config project <id>`. That sets your **profile's** project, which `kane-cli run` uploads to. You don't need it for a shared project: linking a folder is a separate step, below.

## Link a folder to the project

Only two commands can link a folder: `kane-cli context ingest` and `kane-cli context extract`.

**At a terminal**, run either one in a folder that isn't set up yet:

```bash
kane-cli context ingest prd.md
```

kane-cli asks where the folder's work goes:

```text
where should this folder's work go?
you choose once; later runs in this folder use it
  work in a shared project — your team sees what you save
  work locally — it stays in this folder, on this machine
```

Pick the shared project, then the project itself from your list (type part of a name to search, or press `Tab` to make a new one). Once the session opens:

```text
✓ Project: "Checkout revamp"
  this folder is now linked to it; what you save goes to the project
```

From then on, each chat session in this folder, and `kane-cli cover`, starts with `using project "Checkout revamp", shared with your team`.

**From a script or an agent**, name the project with `--project`:

```bash
kane-cli context ingest prd.md --project 01HZX3K9QW8T5M2C7V4N6B1R0D --mode agent
```

Without `--project`, a folder that isn't set up yet works **locally**, without asking, whenever there's no terminal to ask in (`--mode agent`, CI, a pipe). So an agent should always pass `--project` the first time.

### The link

The link is one small file, `.testmuai/assurance.json`, in the folder. It names the project.

- It covers this folder only. A subfolder isn't linked: kane-cli treats it as a folder that isn't set up yet.
- To unlink, delete the file. There's no unlink command.
- If the folder is a git repository, you can commit the file. A teammate who clones the repository then works in the same project without being asked.
- Don't confuse it with `.testmuai/variables/assurance.json`, which holds your variables.

A folder can't be both: a folder with its own local store (`.context/`) and a link refuses every assurance command until you remove one of them.

## Sessions: nothing reaches the project until you save

In a shared project, `context extract`, `design tests` and `maintain` each work in a **session**. A session holds its work apart from the project until you save it. Your teammates see it in the project only after the save.

At a terminal, the session ends by asking `save this session to "Checkout revamp"?`, with three choices:

| Choice | What happens |
|---|---|
| `save now` | The work goes to the project, and your team sees it |
| `keep for later` | Nothing is saved yet. You can save it later, from any machine |
| `adjust — tell me what to change` | Back to the chat |

Keep it for later, and kane-cli prints the commands to finish it:

```text
save: kane-cli context sessions save <sid>
discard: kane-cli context sessions discard <sid>
```

In agent mode a session ends with a `session_complete` event that saves nothing. Its `next` names the save:

```bash
kane-cli context sessions save <sid> --yes --mode agent
```

| Command | What it does |
|---|---|
| `kane-cli context sessions` | Lists the project's open sessions, yours first, with the command that saves or resumes each of yours |
| `kane-cli context sessions save <sid>` | Saves your session to the project |
| `kane-cli context sessions discard <sid>` | Throws your session away; nothing reaches the project |
| `kane-cli context extract --resume <sid>` | Goes on with a paused extract |
| `kane-cli design tests --resume <sid>` | Goes on with a paused design |

You can save, resume or discard only your own sessions. Anyone else's reads `no session <sid> of yours`.

**One session at a time per use-case.** While a session is designing a use-case's tests, a second design of it can't start, and while an extract runs, no design can start. kane-cli says whether the session in the way is yours or someone else's (`someone else is designing tests for "Add to cart" right now, so this design can't start`), and you run the command again once it finishes. Finish and save a session before you start the next one, and your teammates won't wait on you.

## From documents to coverage

```bash
kane-cli context ingest prd.md --project <id>      # add the document, find its use-cases, save
kane-cli design tests --use-case uc-1              # design the tests for one use-case, save
kane-cli testrun run                               # run the tests
kane-cli cover                                     # the project's coverage
```

1. **Add your documents.** `context ingest` uploads each document and goes straight into the extract chat, where the agent proposes use-cases. Choose `looks good — finish the session`, then `save now`. Finishing that way **approves** the session's proposed use-cases. See [Building the context graph](./context.md#in-a-shared-project).
2. **Design.** `design tests --use-case uc-1` designs one use-case's acceptance criteria, scenarios and tests. Save it, and kane-cli writes the test files into `.testmuai/tests/` and makes a test case in Test Manager for each scenario. See [Designing tests](./design.md#in-a-shared-project).
3. **Run.** `testrun run` runs each designed test on its scenario's test case. The first run of a test writes its steps in a real browser; later runs replay them. See [Batch runs](../testrun.md#designed-tests-in-a-shared-project).
4. **Measure.** `cover` shows the project's coverage, from everyone's runs. See [Coverage](./coverage.md#in-a-shared-project).

To see what's in the project at any point, run `kane-cli context list`.

## Where everything lives

<!-- release: needs context pull -->
| What | Where |
|---|---|
| The folder's link to its project | `.testmuai/assurance.json` in the folder |
| Documents, use-cases, criteria, scenarios and tests | in the shared project. `kane-cli context list` shows them |
| Test files (`*_test.md`) | `.testmuai/tests/` in the folder where you saved the session, or where you ran `kane-cli context pull` |
| A test's recorded steps | `.testmuai/tests/output-<name>/` beside the test, made by its first run in this folder |
| Evidence packs | `.testmuai/evidence/` |
| Test cases | in Test Manager, in the project: one per scenario, made or updated when a session is saved |
| Runs | in Test Manager, on each scenario's test case |
| Coverage | in the shared project. `kane-cli cover` shows it |
| Variable values | `.testmuai/variables/` in your folder. See [Variables in a shared project](../variables-and-context.md#variables-in-a-shared-project) |
| Your sign-in, and your profile's project | `~/.testmuai/` |

<!-- release: needs context pull -->
## Joining a teammate's project

Ask your teammate for the project's name, find its id, then join from a new folder of your own:

```bash
kane-cli projects list --search "Checkout"
mkdir checkout && cd checkout
kane-cli context pull --project 01HZX3K9QW8T5M2C7V4N6B1R0D
```

`context pull --project` links the folder, reads none of the project's documents, and brings the project's tests here:

```text
✓ Project: "Checkout revamp"
  this folder is now linked to it; what you save goes to the project
✓ "Checkout revamp": 3 tests here — 3 new
  new      .testmuai/tests/add_one_item_to_the_cart_test.md
  new      .testmuai/tests/remove_the_last_item_test.md
  new      .testmuai/tests/cart_total_with_a_discount_test.md
3 of these tests haven't run in this folder yet: the first run of each writes its steps in a real browser, which takes a few minutes and uses more credits; later runs replay them
next: to run them, run:
  kane-cli testrun run
```

From then on the folder works like your teammate's: `kane-cli context list` shows the project's work, `kane-cli context sessions` its open sessions, and `kane-cli cover` its coverage. To add documents of your own, run `kane-cli context ingest <files>`.

`kane-cli context extract --project <id>` also joins. But if the project has a document nobody has extracted yet, it starts extracting it, which uses credits and holds that document until the session ends. To join without reading anything, use `context pull --project`.

<!-- release: needs context pull -->
## Bringing the project's tests into your folder

In a linked folder, `kane-cli context pull` writes the project's tests as `*_test.md` files in `.testmuai/tests/`. They're the same files a save writes, including the tests your teammates designed and the ones an exploration designed.

```bash
kane-cli context pull
```

```text
✓ "Checkout revamp": 5 tests here — 2 new, 1 updated, 2 already up to date
  new      .testmuai/tests/apply_an_expired_coupon_test.md
  new      .testmuai/tests/checkout_as_a_guest_test.md
  updated  .testmuai/tests/add_one_item_to_the_cart_test.md
2 of these tests haven't run in this folder yet: the first run of each writes its steps in a real browser, which takes a few minutes and uses more credits; later runs replay them
next: to run them, run:
  kane-cli testrun run
```

| Option | What it does |
|---|---|
| `--use-case <id>` | Only this use-case's tests, with the tests they use |
| `--overwrite` | Replace the test files you changed here with the project's |
| `--project <id>` | In a folder that isn't set up yet: join this shared project, reading no documents, then bring its tests |

- **A file you changed is kept.** The pull lists it as `kept     <file> — you changed it here` and names `kane-cli context pull --overwrite` to replace it. `--overwrite` lists what it replaced.
- **A file kane-cli wrote earlier and you haven't touched** is brought up to date (`updated`).
- **Tests archived in the project** aren't pulled.
- **Variables.** If the tests need variables your folder has no value for, the pull names them and the file to add them to. See [Variables in a shared project](../variables-and-context.md#variables-in-a-shared-project).
- **Nothing in the project changes.** A pull only reads.

**The first run of a pulled test costs more.** A test's recorded steps stay with the folder that ran it, in `output-<name>/`, so they don't come with the pull. Each pulled test's first run in your folder writes its steps in a real browser, which uses more credits, and later runs replay them for far fewer.

In agent mode, `kane-cli context pull --mode agent` prints one `pull_test` event per test, with its `file` and `outcome` (`new`, `updated`, `unchanged`, `kept`, `replaced` or `not_written`), then `done` with a `next` that runs them.

### What an exploration built

An exploration of your app (`kane-cli explore run --project <id> --url <app>`) designs tests and saves them into the project as it goes. Their test cases are in Test Manager, and `kane-cli context list` shows their use-cases, scenarios and tests, but their files stay where the exploration ran. To get them, run `kane-cli context pull` in a folder linked to that project, or `kane-cli context pull --project <id>` in a new folder, which links it and gets them in one step. They arrive as `new`, and none has run yet, so each one's first run writes its steps.

Pass the project with `--project` on every `kane-cli explore run`: explore doesn't read a folder's link. If nobody has shared the project yet, the exploration's first design job shares it, as you; if you can't create test cases in that project, it designs no tests until someone who can shares it. [Exploration](../exploration.md) covers starting, shaping and watching an exploration.

## What a linked folder doesn't do

Some commands work only on a local store. In a linked folder they stop with `isn't available yet in a folder linked to a shared project`, and nothing changes:

<!-- release: needs context pull -->
| Refused in a linked folder | Use instead |
|---|---|
| `kane-cli context review`, `kane-cli context explain`, `kane-cli context view` | `kane-cli context list` |
| `kane-cli cover gaps` | `kane-cli cover` |
| `kane-cli context sessions show`, `kane-cli context sessions clean` | `kane-cli context sessions` |
| `kane-cli context sync`, `push`, `clone`, and `pull` with a location name | a shared project is already shared: your teammates join it |
| `kane-cli context fsck`, `rebuild`, `retire`, `revert`, `name`, `kane-cli design explain` | none: these work on a local store only |
| `--mode ci` on `context extract` and `design tests` | `--mode agent` |
| `kane-cli context ingest --plan`, `--mode override` | `kane-cli context ingest <files>` |
| `kane-cli maintain reconcile --plan`, `--apply`, `--mode ci` | `kane-cli maintain reconcile --from <file> --source-id <id>` |
| `kane-cli testrun run --from-context <ids>` | `kane-cli testrun run <files>`: the refusal names the files |

Everything that isn't an assurance command runs as usual in a linked folder: `kane-cli run`, `testmd run`, `testrun run`, `login`, `config`, `projects`, `explore` and the rest.

## `kane-cli run` in a linked folder

`kane-cli run "<objective>"` uploads to your **profile's** project (the one `kane-cli config project` sets), not to the folder's shared project, and it saves its test in `.testmuai/tests/` like any other. The next `kane-cli testrun run` over the whole folder then finds tests from two projects, and stops:

```text
error: these tests are in different Test Manager projects, and a run counts for one project only
  this folder's project, "Checkout revamp":
    .testmuai/tests/add_one_item_to_the_cart_test.md
  "KaneAI Generated":
    .testmuai/tests/search_for_headphones_test.md
next: to run the tests of "Checkout revamp", this folder's project, run:
  kane-cli testrun run .testmuai/tests/add_one_item_to_the_cart_test.md
```

Run the command it names, or keep `kane-cli run` experiments in a different folder.

## For agents and scripts

The same journey with no terminal. Each step's last event carries a `next` with the command to run after it.

```bash
kane-cli projects list --search "Checkout" --agent
kane-cli context ingest prd.md --project <id> --mode agent
kane-cli context sessions save <sid> --yes --mode agent
kane-cli context list --mode agent
kane-cli design tests --use-case uc-1 --allow-unreviewed --mode agent
kane-cli context sessions save <sid> --yes --mode agent
kane-cli testrun run .testmuai/tests/<file>_test.md --agent
kane-cli cover --mode agent
```

- `projects`, `run`, `testmd` and `testrun` take `--agent`. `context`, `design`, `maintain` and `cover` take `--mode agent`.
- An agent-mode extract leaves its use-cases **proposed**, and a linked folder has no review command. So `design tests` refuses them with `isn't approved yet`, and its `next` adds `--allow-unreviewed`. Show the person the proposed use-cases (`kane-cli context list --mode agent`) and get their go-ahead before you design with it.
- Every code these commands can stop with, and what to do about it, is in [Troubleshooting: shared projects](../troubleshooting.md#shared-projects).

## Next steps

- [Building the context graph](./context.md#in-a-shared-project): ingest and extract in a linked folder.
- [Designing tests](./design.md#in-a-shared-project): design and save.
- [Batch runs](../testrun.md#designed-tests-in-a-shared-project): first runs, replays and test cases.
- [Coverage](./coverage.md#in-a-shared-project): the project's figure.
- [Troubleshooting: shared projects](../troubleshooting.md#shared-projects): every refusal and what to do.
