<!-- kane-cli skill reference: exploration on HyperExecute, and the tests it designs into a shared project. Read when the person asks to explore an app, map its flows, shape, stop or re-run an exploration, or get and run the tests an exploration made. Requires kane-cli 0.10.0+. -->

# Exploration: map an app on HyperExecute, and get the tests it designs

`kane-cli explore` sends an explorer through the person's app on **HyperExecute**. It builds a map of the app (screens,
flows, findings, with evidence). While its **assurance context** is on (the default), every few minutes while it runs,
and when it ends, what it has mapped is turned into use cases, scenarios and tests in the Test Manager project the
exploration belongs to, with a Test Manager case per scenario. Exploration **designs and saves** those tests; it never
runs them.

**Exploration and assurance.** The tests an exploration designs live in its project, as a document's do in a shared
project (`shared-projects.md`). To run them here, a folder has to hold them: a folder linked to that project gets them
with `kane-cli context pull --mode agent`, and a fresh folder links and gets them in one step with
`kane-cli context pull --project <id> --mode agent` (§5). A project nobody has shared yet becomes a shared project with
the exploration's first design job, as the person who started the run.

Explore takes `--agent`, not `--mode agent`. Its messages can name internal parts: use them to work out what happened,
then tell the person in plain words.

## 1. Start an exploration

```bash
kane-cli explore run --project <id> --url <app url> --prompt "<what to explore>" --agent    # add --policy read_only if the person said no changes
```

- `--project <id>` is the Test Manager project the exploration saves into: the team's shared project
  (`shared-projects.md` §2 finds the id). One project, one exploration, one URL. **Always pass it**: explore doesn't
  read the folder's link, so without `--project` it falls back to the project kane-cli is configured with, and a run
  with none is refused. In a linked folder, pass the folder's project id (the preflight's `## link`).
- It queues the run on HyperExecute and exits; it doesn't wait for the exploration to finish.
- It uses the person's sign-in, turned into their username and access key. Only if it says it needs basic credentials,
  ask the person to run `kane-cli login --username <user> --access-key <key>` in their own terminal. It stores the
  sign-in and any secret variables in the person's HyperExecute Secrets, and the non-secret variables in Test Manager.
  Never put values in chat.
- The default policy is `mutating`: the explorer may submit forms and change data on the sites it reaches, and in agent
  mode kane-cli asks nobody. Before `explore run`, tell the person and ask whether it may change data in their app; if
  not, pass `--policy read_only` (it keeps the explorer from changing data). A `mutating` run starts with a `warning`
  (`code: "policy_mutating"`): relay it.
- Under `read_only`, the setup steps in `--deps` (a sign-in, for example) still run as written, so put in `--deps` only
  what the person allows.
- An exploration spends credits while it runs, and so does each design job it starts (§4). Without `--max-leases` it
  runs until it runs out of work. Tell the person before `explore run`, and offer a limit when credits matter (§2).
- A project that isn't shared yet is shared by the exploration's first design job, as the person who started the run.
  If they may not create test cases in it, no tests are designed: `explore context status` shows `context.enabled: true`
  with `context.off_reason: "mark_refused"`. Tell the person: "Ask a Test Manager admin for permission to create test
  cases, or ask someone who has it to share the project." Once they have permission, turn context off and on (§4), only
  on their word.

**The stream:** `stream_start` (`surface: "explore"`), maybe `warning`, `explore_remote_started {exploration_id, run_id,
state, hx_job_id, job_link}`, then `done {state: "queued", exit_code: 0, exploration_id, run_id}`. Three plain lines on
stderr name the run, the job link and how to watch it. Give the person the job link.

| Exit | Means | Do |
|---|---|---|
| 0 | queued | tell the person it runs on HyperExecute and can take a while; offer to check its status later |
| 1 | refused: `RUN_ACTIVE` (this exploration already has a run), or the launch failed | `RUN_ACTIVE`: wait, or ask the person whether to stop it (§3). A failed launch: try again in a minute; then tell the person |
| 2 | bad input (a different `--url` for the project's exploration, a `{{name}}` with no value, `--deps` with no `--allow-domain`), sign-in, a secret HyperExecute doesn't list (`SECRETS_MISSING`), or a message starting "could not push" or "could not read" | fix the input or the secret's name. If `done` names a run (`state: "stopped"`, `remark` `failed:secrets_missing`), report that run, fix the value, then start a new one. "Could not push / read": try again in a minute; then tell the person |

Explore's `error` events carry a `message` only: no `code`, no `next`. Read the message.

**On this machine** (`--local-orchestration`, below) the command streams the run and ends with it: `done` carries
`state` and `remark`. Exit 0 completed or reached its limit, 1 failed, 3 stopped or timed out, 2 couldn't start.

## 2. Shape the run

Add these to `explore run` only when the person's request needs them:

| The person wants | Pass |
|---|---|
| An app behind a login | `--deps "Logged in as {{user}} / {{pass}}"`, with the values in a variables file (`.testmuai/variables/*.json`, or `--variables-file <path>`; a secret has `"secret": true`). `--deps` always needs `--allow-domain`: the app's own host, and every other host it signs in on (`--allow-domain app.example.com --allow-domain login.example.com`). Only the names the prompt and `--deps` use travel: secrets go to the person's HyperExecute Secrets, the rest to the organisation's Test Manager variables, where they replace a variable of the same name (tell the person). Names are letters, digits and `_`; `LT_USERNAME` and `LT_ACCESS_KEY` are taken. Check the values are real first: an empty secret stops the run `failed:secrets_missing`, and a sign-in that fails stops it `failed:setup_failed` |
| Only some sites | `--allow-domain <host>`, repeatable (the URL's host is always in, subdomains included) |
| A control it must never press | `--deny "<control name>"`, repeatable, under either policy |
| A `read_only` run of an app that reads its data through POST | `--allow-post <host/path>`, repeatable, only for an endpoint the person confirms only reads; its host must be the URL's or one passed with `--allow-domain` |
| Start from one screen of the map it already has | `--focus "<screen>"` (a later run; the screen's name or words from it). On this machine it also needs `--exploration-id <exploration-id>` |
| A limit on the explorer's work | `--max-leases <n>`: it stops after n pieces of work (leases), and the run ends `budget`. Every run also stops at built-in limits (an hour, 400 actions or 800 model calls), also `budget`. Neither limits the design jobs' credits: for a map with no new tests, see the next rows |
| More browsers at once | `--max-parallel <n>` (default 1; up to 20 cloud browsers, 4 with Chrome on this machine). Each may sign in once: keep 1 for an app that allows one login |
| A map, no tests | `--no-context`, on the project's first exploration only; for an existing one, `explore context off` (§4) |
| How deep it goes, what counts as slow, whether findings are checked again | `--depth-caps`, `--slow-budget`, `--no-recheck`: `kane-cli explore run --help` gives their values |
| An app on `localhost` or a private network | `--tunnel-name <name>`, through a LambdaTest tunnel on the person's machine (below) |
| To explore from this machine | `--local-orchestration` (Chrome here, `--headless` for no window; or `--browser remote` for cloud browsers). The command then waits for the run to end (§1), and Ctrl+C stops it |

### An app on `localhost` or a private network

The cloud's browsers can't reach it on their own: they reach it through a LambdaTest tunnel (LT) running on the person's
machine. kane-cli never starts or stops the tunnel; the person does, in their own terminal, so their key never comes
into chat.

1. If `LT --version` doesn't run there, they download LT for their machine and put it on their PATH:
   - Apple silicon Mac: `https://downloads.lambdatest.com/tunnel/v3/mac/arm64/LT_Mac.zip`
   - Intel Mac: `https://downloads.lambdatest.com/tunnel/v3/mac/64bit/LT_Mac.zip`
   - Linux: `https://downloads.lambdatest.com/tunnel/v3/linux/64bit/LT_Linux.zip` (`linux/arm64/LT_Linux.zip` on ARM)
   - Windows: `https://downloads.lambdatest.com/tunnel/v3/windows/64bit/LT_Windows.zip`, then run `LT.exe`

   If a Mac blocks it from opening: `xattr -d com.apple.quarantine <path to LT>`.
2. They start it as the same LambdaTest user kane-cli is signed in as, and leave it running:

   ```bash
   LT --user "$LT_USERNAME" --key "$LT_ACCESS_KEY" --env ht-prod --tunnelName <name>
   ```

   (`$LT_USERNAME` and `$LT_ACCESS_KEY` are their LambdaTest username and access key.) `--env ht-prod` is required.
   Wait until LT says the tunnel is connected.
3. Run the exploration through it:

   ```bash
   kane-cli explore run --project <id> --url http://localhost:3000 --prompt "<what to explore>" --tunnel-name <name> --agent
   ```

   `--tunnel-name` must match `--tunnelName` from step 2, and it turns `--tunnel` on; with only one tunnel running,
   `--tunnel` alone is enough. A re-run keeps the exploration's URL but not its tunnel, so pass the tunnel flag again:
   `kane-cli explore run --project <id> --tunnel-name <name> --agent`.

- The tunnel **and that machine** must stay up until the run ends; the run warns about it when it starts. If the tunnel
  drops mid-run, pages stop loading.
- A tunnel needs cloud browsers: with `--local-orchestration` and local Chrome, `--tunnel` is refused (local Chrome
  already reaches the machine).

## 3. Watch it, stop it, run it again

```bash
kane-cli explore list --agent                                       # the running explorations; --all lists every one
kane-cli explore sessions <exploration-id> --agent                  # its runs, newest first: state, remark, leases, findings, credits
kane-cli explore sessions <exploration-id> --run <run-id> --agent   # one run in full
```

The person can watch a run live with `kane-cli explore view --exploration-id <exploration-id>` in their own terminal
(§4).

A run is `queued` (waiting for its machine), `running` or `stopped`. A stopped run's `remark.code` says why:
`completed` (it ran out of work), `budget` (`--max-leases` or a built-in limit reached), `user_stop`, `stopped_before_start` (stopped while
queued), `heartbeat_lost` (it stopped reporting), `timeout`, or `failed:<reason>` (for example `failed:secrets_missing`,
`failed:setup_failed`: the sign-in in `--deps` didn't work, or `failed:vm_never_started`: HyperExecute never started it,
so run it again). Say it to the person in plain words.

- **Stop it:** `kane-cli explore stop <exploration-id> --agent` stops a queued run at once, and asks a running one to
  stop cleanly (its work in hand finishes and is kept). It waits for that, unless you pass `--no-wait`. It emits
  `explore_stop {run_id, state, remark, stopping}`. When `stopping` is `true` the run hasn't stopped yet: check
  `explore sessions` until it is `stopped` before you run it again or delete it. With nothing running it refuses
  (`RUN_NOT_ACTIVE`, exit 1).
- **Run it again:** `kane-cli explore run --project <id> … --agent` once more. It goes on the same exploration, on its
  URL, and adds to its map; a different `--url` is refused (exit 2). A run keeps only the URL: pass every option again
  (`--policy read_only` above all, since the default is `mutating`, and the prompt, `--deps`, domains, variables,
  limits and tunnel).
- **Explore another site:** use another project, so its tests don't mix with this site's. Or, only on the person's
  word, `kane-cli explore delete <exploration-id> --yes --agent` (refused with `RUN_ACTIVE`, exit 1, while a run is
  queued or running): no command shows that map again and the project can start a new exploration of any URL, but the
  use cases and tests designed for the first site stay in the project; a pull brings them along with the new site's.
- `list`, `sessions`, `stop` and `delete` exit 0 when done, 1 when refused (`RUN_ACTIVE`, `RUN_NOT_ACTIVE`) or when the
  service failed (read the message), and 2 for bad input, a missing `--yes`, an unknown exploration, or no sign-in.

## 4. Check what it designed

```bash
kane-cli explore context status <exploration-id> --agent
```

`explore context status` emits `explore_context {exploration_id, action, context}`. Read `context.enabled`,
`context.off_reason`, `context.running_job` and `context.pending_cut` (work waiting for the next job) as well as
`context.last_job`, the newest design job that has **ended**: `status` (`ok`, `noop`, `partial`, `failed`),
`use_cases.added[]` and `modified[]`, `tests.designed`, `tests.saved`, `tests.failed[]`, `tests.saved_cases[]` (each
test's Test Manager case), `held[]` (changes, such as an archive, the job left for a person to review), `credits` (that
job's own), `error`. A job runs after the exploration's run ends, and during a long run every few minutes when enough
changed. Before you call the designs ready, check that no job is still running or waiting. An entry of `saved_cases[]`
can have no case and a refusal even when the job says `ok`: tell the person which tests are saved but can't run yet,
and follow that refusal's remedy.

```bash
kane-cli explore context sync <exploration-id> --agent    # ask for a job now
```

It emits `explore_context_sync {exploration_id, state, …}`: `launched`, `launching`, `pending` (behind a running job),
`running` and `up_to_date` all end exit 0. A known refusal's `error` message starts with its code (other failures are
plain words: read the message and the exit code):

| Refusal | Exit | Means | Do |
|---|---|---|---|
| `TOO_SOON` | 1 | the last design job started a few minutes ago | try again when it says |
| `NO_ENDED_RUN` | 1 | no run of this exploration has ended | wait for the run, then sync |
| `CONTEXT_OFF` | 1 | assurance context is off for this exploration | `kane-cli explore context on <exploration-id> --agent`, only with the person's word. If the message names a reason in brackets other than `user_off`, tell the person instead: turning it on helps only for `mark_refused`, once they have permission (§1) |
| `NOT_CONFIGURED` | 1 | design jobs aren't set up here yet; context stays on and runs once they are | tell the person; don't retry |
| a `failed` state | 1 | the job couldn't launch | try once more; then tell the person |
| sign-in or access | 2 | the sign-in was refused, or basic credentials are needed | as in §1: sign-in first, then once more |
| not found | 2 | no such exploration, or assurance context isn't available here yet | check the id (`kane-cli explore list --all --agent`); then stop |

`kane-cli explore context off <exploration-id> --agent` stops new design jobs and drops the work waiting for one;
nothing already saved is deleted, and a job already running finishes (it may still save tests and use credits): check
the status and tell the person. `on` catches up from the newest ended run. Both only on the person's word.

To show the map, ask the person to run `kane-cli explore view --exploration-id <exploration-id>` (or `--project <id>`)
in their own terminal: it opens the map in their browser and keeps serving it until they press Ctrl+C. There they can
look at the evidence, correct findings, leave notes, and mark screens or controls not to touch. Don't run it yourself:
it doesn't exit on its own.

## 5. Get exploration's tests into a folder, and run them

The use cases and tests are in the project, and their cases are in Test Manager, as soon as a job saves them. No
folder holds their files until it pulls them.

- Read `shared-projects.md` §7a before the pull, and check first whether this kane-cli has it (`kane-cli context pull
  --help` lists `--project`). With it:
  - **a folder linked to the project:** `kane-cli context pull --mode agent`;
  - **a fresh folder:** `kane-cli context pull --project <id> --mode agent` links it and brings the tests in one step.
- Read each `pull_test`'s `outcome`, and count the first runs from its `first_run: true` (a fresh folder's tests all
  have it; a folder that ran them before may not). Fill the values `variables_needed` names: an app behind a login
  needs its sign-in values in this folder too. A pull with no tests yet ends `done` exit 0: check
  `explore context status <id>`.
- Without the pull (kane-cli 0.10.0), exploration's tests can be seen (`kane-cli context list --mode agent` in a linked
  folder; Test Manager) but not run from a folder: no folder holds their files.
- The first run of each pulled test writes its steps in a real browser: minutes, and about 30–85 credits per test. Tell
  the person the count and the likely cost, then run the files they choose:
  `kane-cli testrun run <files> --agent < /dev/null`.
- Exploration's use cases are designed without review: in agent mode `context list` shows them as `trust: "derived"`.
  Present them to the person as exploration's proposals. The source row's `id` is `explore-<exploration id>`.
  `kane-cli explore list --all --agent` lists every exploration (without `--all`, only the running ones); a page's
  `next_cursor` goes to `--cursor` for the next.
- After the first runs, `kane-cli cover --mode agent` in the linked folder shows the project's coverage, exploration's
  use cases included.
