<!-- kane-cli skill reference: exploration on HyperExecute, and the tests it designs into a shared project. Read when the person asks to explore an app, map its flows, or get the tests an exploration made. Requires kane-cli 0.10.0+. -->

# Exploration: map an app on HyperExecute, and get the tests it designs

`kane-cli explore` sends an explorer through the person's app on **HyperExecute**. It builds a map of the app (screens,
flows, findings, with evidence). While its **assurance context** is on (the default), every few minutes while it runs, and when it ends, what it has mapped is turned into
use cases, scenarios and tests in the Test Manager project the exploration belongs to, with a Test Manager case per
scenario. Exploration **designs and saves** those tests; it never runs them.

Explore takes `--agent`, not `--mode agent`.

## 1. Start an exploration

```bash
kane-cli explore run --project <id> --url <app url> --prompt "<what to explore>" --agent    # add --policy read_only if the person said no changes
```

- `--project <id>` is the Test Manager project the exploration saves into: the team's shared project
  (`shared-projects.md` §2 finds the id). One project, one exploration, one URL.
- It queues the run on HyperExecute and exits; it doesn't wait for the exploration to finish.
- It uses the person's sign-in, turned into their username and access key. Only if it says it needs basic credentials,
  ask the person to run `kane-cli login --username <user> --access-key <key>` in their own terminal. It stores the
  sign-in and any secret variables in the person's HyperExecute Secrets, and the non-secret variables in Test Manager.
  Never put values in chat.
- The default policy is `mutating`: the explorer may submit forms and change data on the sites it reaches, and in agent
  mode kane-cli asks nobody. Before `explore run`, tell the person and ask whether it may change data in their app; if
  not, pass `--policy read_only` (it keeps the explorer from changing data). A `mutating` run starts with a `warning`
  (`code: "policy_mutating"`): relay it.
- An exploration spends credits while it runs, and so does each assurance job it starts (its `credits` in
  `explore context status`). Tell the person before `explore run`, and report what the jobs used afterwards.

**The stream:** `stream_start` (`surface: "explore"`), maybe `warning`, `explore_remote_started {exploration_id, run_id,
state, hx_job_id, job_link}`, then `done {state: "queued", exit_code: 0, exploration_id, run_id}`. Three plain lines on
stderr name the run, the job link and how to watch it. Give the person the job link.

| Exit | Means | Do |
|---|---|---|
| 0 | queued | tell the person it runs on HyperExecute and can take a while; offer to check its status later |
| 1 | refused: `RUN_ACTIVE` (this exploration already has a run) or the launch failed | for `RUN_ACTIVE`, wait or ask the person whether to stop it (`kane-cli explore stop …`) |
| 2 | bad input, sign-in, or a secret HyperExecute doesn't list (`SECRETS_MISSING`) | relay the message; fix the input or the secret's name |

Explore's `error` events carry a `message` only: no `code`, no `next`. Read the message.

## 2. Watch it and check what it designed

```bash
kane-cli explore list --agent                 # the running explorations; --all lists every one
kane-cli explore sessions <exploration-id> --agent
kane-cli explore context status <exploration-id> --agent
```

`explore context status` emits `explore_context {exploration_id, action, context}`. Its `context.last_job` is the newest assurance
job: `status` (`ok`, `noop`, `partial`, `failed`), `use_cases.added[]` and `modified[]`, `tests.designed`, `tests.saved`,
`tests.failed[]`, `tests.saved_cases[]` (each test's Test Manager case), `held[]`, `credits`, `error`. A job runs after the
exploration's run ends, and during a long run every few minutes when enough changed.

```bash
kane-cli explore context sync <exploration-id> --agent    # ask for a job now
```

It emits `explore_context_sync {exploration_id, state, …}`: `launched`, `launching`, `pending` (behind a running job),
`running` and `up_to_date` all end exit 0. A refusal's `error` message starts with its code:

| Refusal | Exit | Means | Do |
|---|---|---|---|
| `TOO_SOON` | 1 | the last cut was a few minutes ago | try again when it says |
| `NO_ENDED_RUN` | 1 | no run of this exploration has ended | wait for the run, then sync |
| `CONTEXT_OFF` | 1 | assurance context is off for this exploration | `kane-cli explore context on <exploration-id> --agent`, only with the person's word. If the message names a reason in brackets other than `user_off`, tell the person instead: turning it on won't help |
| `NOT_CONFIGURED` | 1 | assurance jobs aren't set up here yet; context stays on and runs once they are | tell the person; don't retry |
| a `failed` state | 1 | the job couldn't launch | try once more; then tell the person |
| sign-in or access | 2 | the sign-in was refused, or basic credentials are needed | as in §1: sign-in first, then once more |
| not found | 2 | no such exploration, or assurance context isn't available here yet | check the id (`kane-cli explore list --all --agent`); then stop |

To show the map, ask the person to run `kane-cli explore view --exploration-id <exploration-id>` (or `--project <id>`)
in their own terminal: it opens the map in their browser and keeps serving it until they press Ctrl+C. Don't run it
yourself: it doesn't exit on its own.

## 3. Get exploration's tests into a folder, and run them

The use cases and tests are in the project, and their cases are in Test Manager, as soon as a job saves them. Their
**test files** stay on HyperExecute, so nobody's folder has them.

- **After exploration finishes, bring its tests into a folder linked to the project**: `shared-projects.md` §7. Check
  first whether this kane-cli has the pull (`kane-cli context pull --help` lists `--project`). With it, each pulled test
  shows `first_run: true`.
- Without it (kane-cli 0.10.0), exploration's tests can be seen (`kane-cli context list --mode agent` in a linked
  folder; Test Manager) but not run from a folder: no folder holds their files.
- The first run of each pulled test writes its steps in a real browser: minutes, and about 30–85 credits per test. Tell the
  person the count and the likely cost before `kane-cli testrun run`.
- Exploration's use cases are designed without review, so they show as proposed in `context list`. Present them to the
  person as exploration's proposals.
- To tell exploration's work from a document's: in `context list` its source is named `explore-<exploration id>`.
  `kane-cli explore list --all --agent` lists every exploration (without `--all`, only the running ones); a page's
  `next_cursor` goes to `--cursor` for the next.
