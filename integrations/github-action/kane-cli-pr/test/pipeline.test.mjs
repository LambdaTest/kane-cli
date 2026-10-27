// Phases 2–3: real impact, real test runs, evidence, policy, checks, through run() and report()
// with a fake kane-cli (fixture NDJSON) and a fake GitHub. Nothing live runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { run, report, stopPhase } from "../src/main.mjs";
import { FakeGitHub, BOT } from "./fake-github.mjs";
import { readState, MARKER } from "../src/state.mjs";
import { prCheckout, kaneScenario, kaneCalls, KANE_CMD, FIXTURES } from "./helpers.mjs";

const REPO = "octo-org/shop";
const GIFT = ".testmuai/tests/apply-gift-wrap_test.md";
const CART = ".testmuai/tests/open-cart-from-home-banner_test.md";
const DIFF = "diff --git a/src/cart/pricing.js b/src/cart/pricing.js\n--- a/src/cart/pricing.js\n+++ b/src/cart/pricing.js\n@@ -1 +1 @@\n+gift wrap\n";

const ANSWERS = {
  "check this": { understood: "check impact", reply: "Checking which tests this PR affects.", action: "impact", args: { tests: null, policy: null } },
  "go ahead": { understood: "impact then run", reply: "Working out the impacted tests, then running them.", action: "impact_then_run", args: { tests: "impacted", policy: null } },
  "run them": { understood: "run the impacted tests", reply: "Running the impacted tests.", action: "run", args: { tests: "impacted", policy: null } },
  "run t-4": { understood: "run t-4", reply: "Running t-4.", action: "run", args: { tests: ["t-4"], policy: null } },
  "rerun the failed one": { understood: "rerun failed", reply: "Rerunning the failed test.", action: "run", args: { tests: "failed", policy: null } },
  "why did gift wrap fail?": { understood: "why", reply: "It failed at step 6.", action: "answer", args: { tests: null, policy: null } },
};

let nextId = 1;
function human(body, { login = "octocat", association = "OWNER", minute = 0 } = {}) {
  return { id: nextId++, user: { login, type: "User" }, body, author_association: association, created_at: `2026-10-26T11:${String(minute).padStart(2, "0")}:00Z` };
}
const issueEvent = (comment) => ({ action: "created", comment, issue: { number: 1, pull_request: { url: "x" } }, sender: comment.user, repository: { full_name: REPO } });

function config({ auto = true, policy = true, heal, app, judge } = {}) {
  return [
    "version: 1",
    "access:\n  ask: [OWNER, MEMBER]\n  run: [OWNER, MEMBER]",
    "policies:\n  checkout: .github/kane/checkout-policy.yaml",
    policy ? "policy: .github/kane/checkout-policy.yaml" : "",
    `auto_continue: ${auto}`,
    heal !== undefined ? `heal: ${heal}` : "",
    judge !== undefined ? `impact:\n  judge: ${judge}` : "",
    app ? `app:\n  start: ${JSON.stringify(app.start)}\n  url: ${app.url}\n  ready_path: /` : "",
  ].filter(Boolean).join("\n") + "\n";
}

/** One job's world: a PR checkout, a default-branch workspace, a fake kane-cli, a fake GitHub. */
function world({ cfg = config(), kane = {}, comments = [] } = {}) {
  const pr = prCheckout();
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "kane-ws-")));
  mkdirSync(join(ws, ".github", "kane"), { recursive: true });
  writeFileSync(join(ws, ".github", "kane", "checkout-policy.yaml"), "policy: checkout-pr\ngates: []\n");
  const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "kane-rt-")));
  const stateDir = join(runnerTemp, "kane-cli-pr");
  mkdirSync(stateDir);
  const output = join(stateDir, "github-output");
  writeFileSync(output, "");
  const fake = kaneScenario(kane);
  const pull = { number: 1, title: "Gift wrap", body: "", draft: false, head: { sha: pr.headSha, repo: { full_name: REPO } }, base: { sha: pr.baseSha, repo: { full_name: REPO } } };
  const github = new FakeGitHub({ comments, pull, diff: DIFF, config: cfg });
  const requests = [];
  const logs = [];
  const converse = async (url, auth, request) => {
    requests.push(request);
    return ANSWERS[request.text] ?? null;
  };
  const env = {
    GITHUB_EVENT_NAME: "issue_comment",
    KANE_CONVERSE_URL: "https://converse.test",
    LT_USERNAME: "lt-user",
    LT_ACCESS_KEY: "lt-secret-key",
    GITHUB_REPOSITORY: REPO,
    GITHUB_WORKSPACE: ws,
    GITHUB_OUTPUT: output,
    KANE_PIPELINE: "true",
    KANE_CLI_CMD: KANE_CMD,
    KANE_PR_PATH: pr.dir,
    KANE_STATE_DIR: stateDir,
    RUNNER_TEMP: runnerTemp,
  };
  let t = 0;
  // processList: no other kane-cli runs (the real `ps` would see this machine's own sessions)
  const deps = { github, converse, now: () => t, log: (l) => logs.push(l), kaneEnv: { ...process.env, FAKE_KANE_DIR: fake }, processList: async () => [] };
  return { pr, ws, fake, github, requests, logs, env, deps, output, stateDir, runnerTemp, tick: (ms) => (t += ms), setNow: (fn) => (deps.now = fn) };
}

const kaneComments = (github) => github.comments.filter((c) => c.user.login === BOT.login && c.body.includes(MARKER));
const argvOf = (fake, sub) => kaneCalls(fake).filter((c) => c.argv[0] === sub[0] && c.argv[1] === sub[1] && !c.argv.includes("--help")).map((c) => c.argv);
const outputs = (file) => Object.fromEntries(readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

/** run() then report(), as the two workflow steps would, with an upload in between. */
async function job(w, comment, { artifactId = "4242" } = {}) {
  w.github.comments.push(comment);
  await run(issueEvent(comment), w.env, w.deps);
  const out = outputs(w.output);
  await report({ ...w.env, KANE_ARTIFACT_ID: out["evidence-path"] ? artifactId : "" }, w.deps);
  return out;
}

test("auto_continue true: impact then run in one turn; the final comment comes after the upload, with the link", async () => {
  const w = world();
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);

  // after the run phase: only the working comment, eyes still on, the pack path exposed
  assert.deepEqual(argvOf(w.fake, ["context", "impact"]).length, 1);
  assert.deepEqual(argvOf(w.fake, ["testrun", "run"]).length, 1, "ran straight after impact, same turn");
  const working = kaneComments(w.github);
  assert.equal(working.length, 1);
  assert.match(working[0].body, /\*\*Working on it…\*\*/);
  assert.deepEqual(w.github.contents("issue", c.id), ["eyes"]);
  const out = outputs(w.output);
  assert.equal(out["evidence-path"], join(w.pr.dir, ".testmuai/evidence/exec-123.evidence"));
  assert.ok(existsSync(out["logs-path"]), "the raw NDJSON is kept for the logs artifact");

  await report({ ...w.env, KANE_ARTIFACT_ID: "4242" }, w.deps);
  const all = kaneComments(w.github);
  assert.equal(all.length, 1, "the working comment is replaced by the result");
  const body = all[0].body;
  assert.match(body, /\n@octocat /);
  assert.match(body, /!\[1 impacted\]\(https:\/\/img\.shields\.io\/badge\/impacted-1-0969da\?style=for-the-badge\) !\[1 new\]\(https:\/\/img\.shields\.io\/badge\/new%20in%20PR-1-6e7781\?style=for-the-badge\) !\[1 failing\]/);
  assert.match(body, /<summary>🧪 <b>Tests<\/b> — 2 ran · 1 failed<\/summary>/);
  assert.ok(body.includes("| ❌ | **Apply gift wrap at checkout** | step 6: discount −$10.00, expected −$9.00 |"));
  assert.ok(body.includes("| ✅ | **Open cart from home banner** | passed in 41 s |"));
  assert.doesNotMatch(body, /Not in this folder/, "a fileless match is never a row");
  assert.ok(body.includes("- **🎯 Apply a promo code to a cart** — 🟥 1 of 1 failing\n  - Apply gift wrap at checkout"));
  assert.ok(body.includes("(https://evidence.lambdatest.com/?pack=gh-artifact:octo-org/shop/4242)"));
  assert.doesNotMatch(body, /\(0\.\d\d\)/, "no scores anywhere");
  assert.deepEqual(w.github.contents("issue", c.id), ["rocket"]);
});

test("auto_continue false: impact lists impacted and new and asks; `run them` runs the saved set; `run t-4` runs one", async () => {
  const w = world({ cfg: config({ auto: false }) });
  await job(w, human("@kane-cli check this", { minute: 0 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 0, "nothing ran");
  let body = kaneComments(w.github).at(-1).body;
  assert.match(body, /impacted-1-0969da.*new%20in%20PR-1-6e7781/);
  assert.doesNotMatch(body, /failing/);
  assert.match(body, /Reply `@kane-cli run them` to run them\./);
  assert.ok(body.includes("- **🎯 Apply a promo code to a cart** — 1 test\n  - Apply gift wrap at checkout"), body);
  let { state } = readState(w.github.comments);
  assert.deepEqual(state.impacted.map((t) => [t.test, t.new]), [["t-4", false], ["t-19", true]], "a fileless match (t-9) is not kept");
  assert.equal(state.impacted[1].why, "pricing.js now adds the wrap fee inside subtotal(), which this test totals");
  assert.equal(w.github.check("kane-cli / tests"), undefined, "no tests check when nothing will run");

  await job(w, human("@kane-cli run them", { minute: 1 }));
  assert.equal(argvOf(w.fake, ["context", "impact"]).length, 1, "the saved impact is used, not recomputed");
  const [runArgs] = argvOf(w.fake, ["testrun", "run"]);
  assert.deepEqual(runArgs.slice(2, 4), [CART, GIFT], "the saved runnable set");
  body = kaneComments(w.github).at(-1).body;
  assert.match(body, /!\[1 failing\]\(https:\/\/img\.shields\.io\/badge\/failing-1-cf222e\?style=for-the-badge\)/);

  await job(w, human("@kane-cli run t-4", { minute: 2 }));
  const one = argvOf(w.fake, ["testrun", "run"])[1];
  assert.deepEqual(one.filter((a) => a.endsWith("_test.md")), [CART]);
});

test("a named test kane hasn't seen in state is found by its file stem or assurance id in the checkout", async () => {
  const w = world({ cfg: config({ auto: false }) });
  w.deps.converse = async (u, a, request) => ({ understood: "run", reply: "Running it.", action: "run", args: { tests: ["apply-gift-wrap"], policy: null } });
  await job(w, human("@kane-cli run apply-gift-wrap"));
  const [args] = argvOf(w.fake, ["testrun", "run"]);
  assert.deepEqual(args.filter((a) => a.endsWith("_test.md")), [GIFT]);
});

test("rerun the failed one runs only the results that failed", async () => {
  const w = world();
  await job(w, human("@kane-cli check this", { minute: 0 }));
  await job(w, human("@kane-cli rerun the failed one", { minute: 1 }));
  const second = argvOf(w.fake, ["testrun", "run"])[1];
  assert.deepEqual(second.filter((a) => a.endsWith("_test.md")), [GIFT]);
});

test("progress: the working comment is edited per member, at most once per 5 s", async () => {
  const w = world();
  let t = 0;
  w.setNow(() => (t += 6000));
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  const edits = w.github.writes.filter((x) => x.op === "update").map((x) => x.body);
  const perMember = edits.filter((b) => /✅ t-4/.test(b));
  assert.ok(perMember.length >= 2, `an edit per member end (${edits.length} edits)`);
  assert.ok(edits.some((b) => b.includes("❌ t-19 Apply gift wrap at checkout · failed · 97 s · step 6: discount −$10.00, expected −$9.00")));
  assert.ok(edits.every((b) => b.includes("**Working on it…**") && b.includes(MARKER)));

  const w2 = world();
  const c2 = human("@kane-cli check this");
  w2.github.comments.push(c2);
  await run(issueEvent(c2), w2.env, w2.deps); // the clock never moves
  const memberEdits = w2.github.writes.filter((x) => x.op === "update" && /⏳|✅|❌/.test(x.body) && !/finished/.test(x.body));
  assert.equal(memberEdits.length, 1, "throttled: one member edit inside 5 s");
});

test("heal: the default adds --no-adaptive-heal; heal: true omits it; impact.judge false adds --no-judge, true drops it", async () => {
  const off = world({ cfg: config({ judge: false }) });
  await job(off, human("@kane-cli check this"));
  assert.ok(argvOf(off.fake, ["testrun", "run"])[0].includes("--no-adaptive-heal"));
  assert.ok(argvOf(off.fake, ["context", "impact"])[0].includes("--no-judge"));
  const on = world({ cfg: config({ heal: true, judge: true }) });
  await job(on, human("@kane-cli check this"));
  assert.ok(!argvOf(on.fake, ["testrun", "run"])[0].includes("--no-adaptive-heal"));
  assert.ok(!argvOf(on.fake, ["context", "impact"])[0].includes("--no-judge"));
});

test("login runs first with the env flag, and the access key never reaches the log or a comment", async () => {
  const w = world();
  await job(w, human("@kane-cli check this"));
  const calls = kaneCalls(w.fake);
  assert.deepEqual(calls[0].argv, ["login", "--username", "lt-user", "--access-key", "lt-secret-key", "--env", "prod"]);
  assert.equal(calls.filter((c) => c.argv[0] === "login").length, 1);
  assert.ok(!w.logs.join("\n").includes("lt-secret-key"));
  assert.ok(!w.github.writes.some((x) => (x.body ?? "").includes("lt-secret-key")));

  const stage = world();
  stage.env.KANE_ENV = "stage";
  await job(stage, human("@kane-cli check this"));
  assert.deepEqual(kaneCalls(stage.fake)[0].argv.slice(-2), ["--env", "stage"]);
});

const freePort = () => new Promise((res) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const up = async (url) => { try { await fetch(url); return true; } catch { return false; } };

test("app: started from the PR checkout, ready before the run, --override-start-url passed, stopped after", async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const w = world({ cfg: config({ app: { start: `node server.mjs`, url } }) });
  writeFileSync(join(w.pr.dir, "server.mjs"), `import http from "node:http";\nimport { writeFileSync } from "node:fs";\nwriteFileSync("started-here", process.cwd());\nhttp.createServer((q, r) => r.end("ok")).listen(${port}, "127.0.0.1");\n`);
  w.env.PATH = `${join(process.execPath, "..")}:${process.env.PATH}`;
  w.deps.kaneEnv.PATH = w.env.PATH;
  let upDuringRun = null;
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  w.deps.onTestrunStart = async () => (upDuringRun = await up(url));
  await run(issueEvent(c), w.env, w.deps);
  assert.equal(upDuringRun, true, "the app answered while the tests ran");
  assert.equal(readFileSync(join(w.pr.dir, "started-here"), "utf8"), w.pr.dir, "started in the PR checkout");
  const [args] = argvOf(w.fake, ["testrun", "run"]);
  assert.equal(args[args.indexOf("--override-start-url") + 1], url);
  assert.equal(await up(url), false, "stopped after the run");

  const plain = world();
  await job(plain, human("@kane-cli check this"));
  assert.ok(!argvOf(plain.fake, ["testrun", "run"])[0].includes("--override-start-url"), "no app, tests run as they are");
});

test("an app that never gets ready: no tests run, the result says so, the tests check fails", async () => {
  const port = await freePort();
  const w = world({ cfg: config({ app: { start: "sleep 30", url: `http://127.0.0.1:${port}` } }) });
  w.deps.appTimeoutMs = 600;
  await job(w, human("@kane-cli check this"));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 0);
  assert.match(kaneComments(w.github).at(-1).body, /The app wasn't ready at http:\/\/127\.0\.0\.1:\d+\/ after 1 s \(last: /);
  assert.equal(w.github.check("kane-cli / tests").conclusion, "failure");
});

test("evidence: no artifact id → the comment says the pack wasn't uploaded; no pack → no evidence-path output", async () => {
  const w = world();
  await job(w, human("@kane-cli check this"), { artifactId: "" });
  assert.match(kaneComments(w.github).at(-1).body, /The evidence pack wasn't uploaded/);
  const n = world({ kane: { extra: { "no-pack": "1" } } });
  const out = await job(n, human("@kane-cli check this"));
  assert.ok(!out["evidence-path"]);
  assert.match(kaneComments(n.github).at(-1).body, /No evidence pack was produced for this run\./);
});

test("policy supported: --policy is the default branch's file; a fail lists its gates; the policy check fails; nothing throws", async () => {
  const w = world();
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  const [args] = argvOf(w.fake, ["testrun", "run"]);
  assert.equal(args[args.indexOf("--policy") + 1], join(w.ws, ".github/kane/checkout-policy.yaml"), "read from the default branch's checkout");
  const before = process.exitCode;
  await report({ ...w.env, KANE_ARTIFACT_ID: "1" }, w.deps);
  assert.equal(process.exitCode, before, "a failing policy doesn't fail the job");
  assert.match(kaneComments(w.github).at(-1).body, /### 🛡️ Policy · `checkout-pr` — ❌ failed\n\*\*2 of 3 blocking gates failed\*\* → merge is blocked by the `kane-cli \/ policy` check/);
  assert.ok(kaneComments(w.github).at(-1).body.includes("| ❌ | All tests pass | 0 failed | 1 failed |"));
  const policy = w.github.check("kane-cli / policy");
  assert.equal(policy.status, "completed");
  assert.equal(policy.conclusion, "failure");
  assert.equal(policy.head_sha, w.pr.headSha);
});

test("policy pass → the policy check succeeds", async () => {
  const pass = readFileSync(join(FIXTURES, "testrun.ndjson"), "utf8").replace(/"result":"fail","exit_code":1/g, '"result":"pass","exit_code":0').replace('"failed_gate_ids":["all-pass"]', '"failed_gate_ids":[]');
  const passVerdict = readFileSync(join(FIXTURES, "verdict-fail.json"), "utf8").replaceAll('"status":"fail"', '"status":"pass"').replace('"result":"fail"', '"result":"pass"');
  const w = world({ kane: { extra: { "testrun.ndjson": pass, "verdict.json": passVerdict } } });
  await job(w, human("@kane-cli check this"));
  assert.match(kaneComments(w.github).at(-1).body, /### 🛡️ Policy · `checkout-pr` — ✅ passed\n\*\*All blocking gates passed\*\*/);
  assert.equal(w.github.check("kane-cli / policy").conclusion, "success");
});

test("policy unsupported → no section and no badge, no --policy, no policy check; not configured → the same", async () => {
  const w = world({ kane: { policy: false } });
  await job(w, human("@kane-cli check this"));
  assert.ok(!argvOf(w.fake, ["testrun", "run"])[0].includes("--policy"));
  assert.doesNotMatch(kaneComments(w.github).at(-1).body, /### 🛡️ Policy|badge\/policy-|[Nn]ot available yet/);
  assert.equal(w.github.check("kane-cli / policy"), undefined);

  const n = world({ cfg: config({ policy: false }) });
  await job(n, human("@kane-cli check this"));
  assert.doesNotMatch(kaneComments(n.github).at(-1).body, /### 🛡️ Policy|badge\/policy-/);
  assert.equal(n.github.check("kane-cli / policy"), undefined);
  assert.ok(!kaneCalls(n.fake).some((c) => c.argv.includes("--help")), "support isn't probed without a policy");
});

test("a named policy picks its path from policies:", async () => {
  const w = world({ cfg: config({ policy: false }) });
  w.deps.converse = async () => ({ understood: "run with checkout", reply: "Running with checkout.", action: "impact_then_run", args: { tests: "impacted", policy: "checkout" } });
  await job(w, human("@kane-cli go ahead with the checkout policy"));
  const [args] = argvOf(w.fake, ["testrun", "run"]);
  assert.equal(args[args.indexOf("--policy") + 1], join(w.ws, ".github/kane/checkout-policy.yaml"));
});

test("checks: kane-cli / tests is in_progress on the PR head at the start, then failure; success when all pass; neutral when nothing ran", async () => {
  const w = world();
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  const t = w.github.check("kane-cli / tests");
  assert.equal(t.head_sha, w.pr.headSha);
  assert.equal(w.github.calls.find(([m]) => m === "createCheckRun")[1].status, "in_progress");
  assert.equal(t.status, "in_progress", "still running until the report");
  await report({ ...w.env, KANE_ARTIFACT_ID: "9" }, w.deps);
  assert.equal(t.status, "completed");
  assert.equal(t.conclusion, "failure");
  assert.match(t.output.title, /1 impacted · 1 new in this PR · 1 failing/);
  assert.ok(t.output.summary.includes("gh-artifact:octo-org/shop/9"));

  const passing = readFileSync(join(FIXTURES, "testrun.ndjson"), "utf8").replace('"status":"failed","duration_s":97', '"status":"passed","duration_s":97').replace(/,"failure":\{[^}]*\}/, "");
  const g = world({ kane: { extra: { "testrun.ndjson": passing } } });
  await job(g, human("@kane-cli check this"));
  assert.equal(g.github.check("kane-cli / tests").conclusion, "success");

  const empty = '{"type":"impact_result","v":1,"verb":"impact","project_id":"p","units":1,"truncated":false,"tests":[],"use_cases":[],"unmatched":[],"judge":null,"rationale":null,"dropped":[],"next":[]}\n';
  const n = world({ kane: { extra: { "impact.ndjson": empty } } });
  await job(n, human("@kane-cli check this"));
  assert.equal(argvOf(n.fake, ["testrun", "run"]).length, 0);
  assert.equal(n.github.check("kane-cli / tests").conclusion, "neutral");
  assert.match(kaneComments(n.github).at(-1).body, /impacted-0-0969da.*new%20in%20PR-0-6e7781[\s\S]*The engine named no tests for this change, so nothing ran\./);
});

test("state carries real impacted and results, and the next request sends them with dry_run false", async () => {
  const w = world();
  await job(w, human("@kane-cli check this", { minute: 0 }));
  assert.equal(w.requests[0].config.dry_run, false);
  const { state } = readState(w.github.comments);
  assert.deepEqual(state.results.map((r) => [r.test, r.verdict]), [["t-4", "passed"], ["t-19", "failed"]]);
  assert.equal(state.results[1].note, "step 6: discount −$10.00, expected −$9.00");
  assert.equal(state.last_action, "impact");

  await job(w, human("@kane-cli why did gift wrap fail?", { minute: 1 }));
  const sent = w.requests[1].state;
  assert.deepEqual(sent.impacted[1], { test: "t-19", why: "pricing.js now adds the wrap fee inside subtotal(), which this test totals" });
  assert.deepEqual(sent.results[1], { test: "t-19", verdict: "failed", note: "step 6: discount −$10.00, expected −$9.00" });
  assert.equal(w.requests[1].config.dry_run, false);
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1, "an answer runs nothing");
});

test("without KANE_PIPELINE the turn stays a dry run", async () => {
  const w = world();
  delete w.env.KANE_PIPELINE;
  await job(w, human("@kane-cli check this"));
  assert.equal(w.requests[0].config.dry_run, true);
  assert.equal(kaneCalls(w.fake).length, 0);
  assert.match(kaneComments(w.github).at(-1).body, /dry run: nothing ran/);
});

test("one test run per job: a second run request in the same job's sweep is told to ask again", async () => {
  const w = world();
  const first = human("@kane-cli check this", { minute: 0 });
  const second = human("@kane-cli go ahead", { minute: 1 });
  w.github.comments.push(first, second);
  await run(issueEvent(first), w.env, w.deps);
  await report({ ...w.env, KANE_ARTIFACT_ID: "5" }, w.deps);
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1);
  const bodies = kaneComments(w.github).map((k) => k.body);
  assert.equal(bodies.length, 2);
  assert.ok(bodies.some((b) => /already running tests for an earlier request/.test(b)));
  assert.ok(bodies.some((b) => /!\[1 failing\]\(https:\/\/img\.shields\.io\/badge\/failing-1-cf222e\?style=for-the-badge\)/.test(b)));
  const { state } = readState(w.github.comments);
  assert.equal(state.results.length, 2, "the deferred result's state wins and keeps the sweep's turns");
  assert.ok(state.turns.some((t) => t.said === "go ahead"));
});

test("a kane-cli error during impact is the turn's result, and the tests check fails", async () => {
  const err = '{"type":"error","v":1,"verb":"impact","code":"IMPACT_LINKED_ONLY","message":"context impact works in a folder linked to a shared project"}\n{"type":"done","v":1,"verb":"impact","exit":2}\n';
  const w = world({ kane: { extra: { "impact.ndjson": err, "impact.exit": "2" } } });
  await job(w, human("@kane-cli check this"));
  assert.match(kaneComments(w.github).at(-1).body, /kane couldn't check impact: context impact works in a folder linked to a shared project/);
  assert.equal(w.github.check("kane-cli / tests").conclusion, "failure");
  assert.deepEqual(w.github.contents("issue", w.github.comments.find((x) => x.body === "@kane-cli check this").id), ["confused"]);
});

test("report with no pending run does nothing", async () => {
  const w = world();
  await report({ ...w.env, KANE_ARTIFACT_ID: "" }, w.deps);
  assert.deepEqual(w.github.writeCalls, []);
});

test("auto_continue never runs tests for someone who may only ask: their check stops at impact", async () => {
  const w = world({ cfg: config().replace("run: [OWNER, MEMBER]", "run: [OWNER]") });
  await job(w, human("@kane-cli check this", { login: "maria", association: "MEMBER" }));
  assert.equal(argvOf(w.fake, ["context", "impact"]).length, 1);
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 0);
  assert.match(kaneComments(w.github).at(-1).body, /Reply `@kane-cli run them` to run them\./);
  assert.equal(w.github.check("kane-cli / tests"), undefined);
});

test("no PR checkout: the result says where kane looked", async () => {
  const w = world();
  w.env.KANE_PR_PATH = join(w.ws, "nope");
  await job(w, human("@kane-cli check this"));
  assert.match(kaneComments(w.github).at(-1).body, /kane found no PR checkout at .*nope/);
});

test("kane-cli and the PR's app never inherit the GitHub token or the LT keys", async () => {
  const { childEnv } = await import("../src/pipeline.mjs");
  const env = childEnv({ PATH: "/bin", HOME: "/h", GITHUB_TOKEN: "ghs_x", LT_USERNAME: "u", LT_ACCESS_KEY: "k", INPUT_ACCESS_KEY: "k", KANE_CONVERSE_URL: "https://c", ACTIONS_RUNTIME_TOKEN: "r" });
  assert.deepEqual(env, { PATH: "/bin", HOME: "/h" });
});

// --- review fix round 1 ------------------------------------------------------------------

test("fix 1: kane-cli runs with HOME=$RUNNER_TEMP/kane-home, created before login; the always-step removes it", async () => {
  const w = world();
  await job(w, human("@kane-cli check this"));
  const calls = kaneCalls(w.fake);
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.equal(c.home, join(w.runnerTemp, "kane-home"), c.argv.join(" "));
    assert.equal(c.homeExists, true);
  }
  await stopPhase(w.env);
  assert.ok(!existsSync(join(w.runnerTemp, "kane-home")), "the saved login is gone after the job");
});

test("fix 1+2: the app gets its own HOME and none of the runner's files, tokens or ACTIONS_* env", async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const w = world({ cfg: config({ app: { start: "node server.mjs", url } }) });
  Object.assign(w.deps.kaneEnv, { RUNNER_TEMP: w.runnerTemp, GITHUB_OUTPUT: w.output, GITHUB_ENV: "/e", GITHUB_STEP_SUMMARY: "/s", GITHUB_PATH: "/p", ACTIONS_RUNTIME_TOKEN: "r", ACTIONS_CACHE_URL: "c", GITHUB_TOKEN: "ghs", LT_ACCESS_KEY: "k", INPUT_ACCESS_KEY: "k" });
  writeFileSync(join(w.pr.dir, "server.mjs"), `import http from "node:http";\nimport { writeFileSync } from "node:fs";\nwriteFileSync("env.json", JSON.stringify(process.env));\nhttp.createServer((q, r) => r.end("ok")).listen(${port}, "127.0.0.1");\n`);
  await job(w, human("@kane-cli check this"));
  const env = JSON.parse(readFileSync(join(w.pr.dir, "env.json"), "utf8"));
  assert.equal(env.HOME, join(w.runnerTemp, "app-home"));
  for (const k of ["RUNNER_TEMP", "GITHUB_OUTPUT", "GITHUB_ENV", "GITHUB_STEP_SUMMARY", "GITHUB_PATH", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_CACHE_URL", "GITHUB_TOKEN", "LT_ACCESS_KEY", "INPUT_ACCESS_KEY", "KANE_STATE_DIR"]) {
    assert.equal(env[k], undefined, k);
  }
});

test("fix 4: the policy must be a default-branch file, never one under the PR checkout or outside the workspace", async () => {
  for (const path of ["pr/.github/kane/checkout-policy.yaml", "../elsewhere.yaml", "/etc/passwd"]) {
    const w = world({ cfg: config({ policy: false }) + `policy: ${path}\n` });
    w.env.KANE_PR_PATH = join(w.ws, "pr");
    copyFileSync(join(w.pr.dir, ".testmuai/tests/open-cart-from-home-banner_test.md"), join(w.ws, "x"));
    // the PR checkout lives at <workspace>/pr, as in kane.yml
    const { execFileSync } = await import("node:child_process");
    execFileSync("git", ["clone", "-q", w.pr.dir, join(w.ws, "pr")]);
    await job(w, human("@kane-cli check this"));
    assert.ok(!argvOf(w.fake, ["testrun", "run"])[0].includes("--policy"), path);
    assert.doesNotMatch(kaneComments(w.github).at(-1).body, /### 🛡️ Policy|badge\/policy-/, path);
    assert.equal(w.github.check("kane-cli / policy"), undefined, path);
  }
});

test("fix 5: impact reads git diff <base>...HEAD from the checkout, so a 406 from the API doesn't matter", async () => {
  const w = world();
  w.github.getDiff = async () => {
    throw Object.assign(new Error("406"), { status: 406 });
  };
  await job(w, human("@kane-cli check this"));
  const input = readFileSync(join(w.fake, "impact-input.diff"), "utf8");
  assert.match(input, /^diff --git a\/\.testmuai\/tests\/apply-gift-wrap_test\.md/m);
  assert.doesNotMatch(input, /open-cart/, "only the PR's change");
});

test("fix 5: no base commit for the diff → the asker sees why, and nothing ran", async () => {
  const w = world();
  w.github.pull.base.sha = "0123456789abcdef0123456789abcdef01234567";
  await job(w, human("@kane-cli check this"));
  assert.equal(argvOf(w.fake, ["context", "impact"]).length, 0);
  assert.match(kaneComments(w.github).at(-1).body, /kane couldn't build the PR's diff from the checkout \(git diff 0123456\.\.\.HEAD\)/);
  assert.equal(w.github.check("kane-cli / tests").conclusion, "failure");
});

test("fix 6: a run stopped mid-way (cancel, timeout) → the report step cancels the check and tells the asker", async () => {
  const w = world();
  let early = null;
  w.deps.onTestrunStart = async () => {
    early = JSON.parse(readFileSync(join(w.stateDir, "pending.json"), "utf8"));
    copyFileSync(join(w.stateDir, "pending.json"), join(w.runnerTemp, "early.json"));
  };
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  assert.equal(early.phase, "running");
  assert.ok(early.checkId && early.workingId && early.commentId, JSON.stringify(early));
  // the job died here: only the early file is left
  copyFileSync(join(w.runnerTemp, "early.json"), join(w.stateDir, "pending.json"));
  await report({ ...w.env, KANE_ARTIFACT_ID: "" }, w.deps);
  const check = w.github.check("kane-cli / tests");
  assert.equal(check.status, "completed");
  assert.equal(check.conclusion, "cancelled");
  const all = kaneComments(w.github);
  assert.equal(all.length, 1, "the working comment is replaced");
  assert.match(all[0].body, /\n@octocat /);
  assert.match(all[0].body, /the run was stopped before it finished/);
  assert.deepEqual(w.github.contents("issue", c.id), ["confused"]);
  assert.ok(!existsSync(join(w.stateDir, "pending.json")));
});

test("fix 6: a result posted in the run step leaves no pending file behind", async () => {
  const empty = '{"type":"impact_result","v":1,"verb":"impact","project_id":"p","units":1,"truncated":false,"tests":[],"use_cases":[],"unmatched":[],"judge":null,"rationale":null,"dropped":[],"next":[]}\n';
  const w = world({ kane: { extra: { "impact.ndjson": empty } } });
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  assert.ok(!existsSync(join(w.stateDir, "pending.json")));
  const e = world({ kane: { extra: { "impact.ndjson": '{"type":"error","message":"nope"}\n' } } });
  const c2 = human("@kane-cli check this");
  e.github.comments.push(c2);
  await run(issueEvent(c2), e.env, e.deps);
  assert.ok(!existsSync(join(e.stateDir, "pending.json")));
});

test("fix 7: progress edits are serialised, so a slow edit never lands after the closing line", async () => {
  const w = world();
  let t = 0;
  w.setNow(() => (t += 6000));
  const update = w.github.updateComment.bind(w.github);
  let n = 0;
  w.github.updateComment = async (id, body) => {
    const delay = n++ === 2 ? 150 : 0; // the first member edit is slow
    await new Promise((r) => setTimeout(r, delay));
    return update(id, body);
  };
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps);
  const edits = w.github.writes.filter((x) => x.op === "update").map((x) => x.body);
  assert.match(edits.at(-1), /All tests finished/);
  assert.match(edits.at(-1), /❌ t-19/, "the second member's line is in the last edit");
});

test("fix 7: a throttled member line is flushed later (trailing edit) before the closing line", async () => {
  const w = world();
  const c = human("@kane-cli check this");
  w.github.comments.push(c);
  await run(issueEvent(c), w.env, w.deps); // frozen clock
  const edits = w.github.writes.filter((x) => x.op === "update").map((x) => x.body);
  assert.match(edits.at(-1), /All tests finished/);
  assert.match(edits.at(-1), /❌ t-19 Apply gift wrap at checkout · failed · 97 s/);
});

test("fix 9: rerun the failed one with nothing failed → 'Nothing failed in the last run.', nothing runs", async () => {
  const passing = readFileSync(join(FIXTURES, "testrun.ndjson"), "utf8").replace('"status":"failed","duration_s":97', '"status":"passed","duration_s":97').replace(/,"failure":\{[^}]*\}/, "");
  const w = world({ kane: { extra: { "testrun.ndjson": passing } } });
  await job(w, human("@kane-cli check this", { minute: 0 }));
  await job(w, human("@kane-cli rerun the failed one", { minute: 1 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1);
  assert.match(kaneComments(w.github).at(-1).body, /Nothing failed in the last run\./);
  const checks = w.github.checks.filter((k) => k.name === "kane-cli / tests");
  assert.equal(checks.length, 1, "no new check: a neutral one could turn a required check green");
  assert.equal(checks[0].conclusion, "success", "the last run's check is left as it was");
});

// --- demo polish: kane's line after a real run ---------------------------------------------------

test("after tests ran, kane asks the endpoint again with the real results and leads with that reply", async () => {
  const w = world();
  w.deps.converse = async (u, a, request) => {
    w.requests.push(request);
    if (request.state.results) return { understood: "explain", reply: "t-19 failed at step 6: the discount came out −$10.00 instead of −$9.00.", action: "answer", args: { tests: null, policy: null } };
    return { understood: "check", reply: "I would check which end-to-end tests this PR affects.", action: "impact", args: { tests: null, policy: null } };
  };
  await job(w, human("@kane-cli check this"));
  assert.equal(w.requests.length, 2);
  const second = w.requests[1];
  assert.equal(second.text, "check this");
  assert.equal(second.config.dry_run, false);
  assert.deepEqual(second.state.results.map((r) => [r.test, r.verdict]), [["t-4", "passed"], ["t-19", "failed"]]);
  const body = kaneComments(w.github).at(-1).body;
  assert.match(body, /\n@octocat t-19 failed at step 6: the discount came out −\$10\.00 instead of −\$9\.00\./);
  assert.doesNotMatch(body, /I would/);
  assert.equal(readState(w.github.comments).state.turns.at(-1).said, "t-19 failed at step 6: the discount came out −$10.00 instead of −$9.00.");
});

test("after tests ran, a failed second call or an 'I would …' reply gives the computed sentence", async () => {
  for (const second of [null, { understood: "x", reply: "I would run the impacted tests.", action: "run", args: { tests: "impacted", policy: null } }]) {
    const w = world();
    let n = 0;
    w.deps.converse = async () => (n++ === 0 ? { understood: "check", reply: "I would check which tests this PR affects.", action: "impact", args: { tests: null, policy: null } } : second);
    await job(w, human("@kane-cli check this"));
    const body = kaneComments(w.github).at(-1).body;
    assert.match(body, new RegExp(`\\n@octocat I ran the 2 impacted tests on this PR's build \\(${w.pr.headSha.slice(0, 7)}\\): 1 failing\\.`));
    assert.doesNotMatch(body, /I would/);
  }
});

// --- batch 3: a moved head re-runs; run id; no overlapping kane-cli runs ----------------------

test("no verdict file → no policy check either (a required check never turns red on a missing verdict)", async () => {
  const w = world();
  (await import("node:fs")).rmSync(join(w.fake, "verdict.json"));
  await job(w, human("@kane-cli check this"));
  assert.equal(w.github.check("kane-cli / policy"), undefined);
  assert.doesNotMatch(kaneComments(w.github).at(-1).body, /### 🛡️ Policy|badge\/policy-/);
});

const WHY = { understood: "why", reply: "It failed at step 6.", action: "answer", args: { tests: null, policy: null } };

test("a moved head re-runs impact and tests for any PR question, and answers from the new run", async () => {
  const w = world();
  await job(w, human("@kane-cli check this", { minute: 0 }));
  assert.equal(readState(w.github.comments).state.run_sha, w.pr.headSha, "the state records the sha it ran on");
  w.github.pull.head.sha = "f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1"; // a push since
  w.deps.converse = async (u, a, request) => (w.requests.push(request), request.state.results && request.state.head_sha_matches ? { ...WHY, reply: "Re-checked on the new head: still failing." } : WHY);
  await job(w, human("@kane-cli the fix is pushed — check again", { minute: 1 }));
  assert.equal(argvOf(w.fake, ["context", "impact"]).length, 2);
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 2);
  assert.equal(readState(w.github.comments).state.last_action, "impact_then_run");

  const w2 = world();
  await job(w2, human("@kane-cli check this", { minute: 0 }));
  w2.github.pull.head.sha = "f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2";
  w2.deps.converse = async () => WHY;
  await job(w2, human("@kane-cli why did gift wrap fail?", { minute: 1 }));
  assert.equal(argvOf(w2.fake, ["testrun", "run"]).length, 2, "even a plain question re-runs on a moved head");
});

test("same head with results: a question answers from them; an explicit 'check again' or 'rerun' re-runs", async () => {
  const w = world();
  await job(w, human("@kane-cli check this", { minute: 0 }));
  w.deps.converse = async () => WHY;
  await job(w, human("@kane-cli why did gift wrap fail?", { minute: 1 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1, "answered from the results");
  await job(w, human("@kane-cli check again", { minute: 2 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 2);
  await job(w, human("@kane-cli rerun", { minute: 3 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 3);
  assert.equal(argvOf(w.fake, ["context", "impact"]).length, 3, "impact_then_run: impact again too");
});

test("help, clarify and refusals never re-run on a moved head", async () => {
  const w = world();
  await job(w, human("@kane-cli check this", { minute: 0 }));
  w.github.pull.head.sha = "f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3";
  w.deps.converse = async () => ({ understood: "help", reply: "I can check impact.", action: "help", args: { tests: null, policy: null } });
  await job(w, human("@kane-cli help", { minute: 1 }));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1);
});

test("another kane-cli run on this machine: kane waits (showing it), then runs", async () => {
  const w = world();
  let polls = 0;
  w.deps.processList = async () => (polls++ < 2 ? [{ pid: 4242, ppid: 1, command: "node /x/kane-cli/src/index.tsx testrun run a_test.md --agent" }] : []);
  w.deps.overlapPollMs = 5;
  await job(w, human("@kane-cli check this"));
  assert.equal(polls, 3);
  assert.ok(w.github.writes.some((x) => x.op === "update" && x.body.includes("⏳ waiting for another kane-cli run on this machine to finish")));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 1);
});

test("another kane-cli run that doesn't finish in time: a clear failure, nothing run", async () => {
  const w = world();
  w.deps.processList = async () => [{ pid: 4242, ppid: 1, command: "/usr/bin/python3 -m v16_runner.cli session" }];
  w.deps.overlapPollMs = 5;
  w.deps.overlapTimeoutMs = 30;
  await job(w, human("@kane-cli check this"));
  assert.equal(argvOf(w.fake, ["testrun", "run"]).length, 0);
  assert.match(kaneComments(w.github).at(-1).body, /Another kane-cli run on this machine \(pid 4242\) didn't finish within/);
  assert.equal(w.github.check("kane-cli / tests").conclusion, "failure");
});

// --- fileless matches (tests from earlier takes, still in the project, with no file here) -------

test("a fileless match is left out of the table, the counts, the badges and the run, with one note in Why", async () => {
  const w = world();
  await job(w, human("@kane-cli check this"));
  const [args] = argvOf(w.fake, ["testrun", "run"]);
  assert.deepEqual(args.filter((a) => a.endsWith("_test.md")), [CART, GIFT]);
  const body = kaneComments(w.github).at(-1).body;
  assert.doesNotMatch(body, /Not in this folder|no file in this PR|t-9/);
  assert.match(body, /badge\/impacted-1-0969da.*badge\/new%20in%20PR-1-6e7781/);
  assert.match(body, /<summary>🧪 <b>Tests<\/b> — 2 ran · 1 failed<\/summary>/);
  const why = body.slice(body.indexOf("🔎 <b>Why these tests</b>"), body.indexOf("### 🧾 Evidence"));
  assert.match(why, /the change touches 2 requirements/, "the fileless test's requirement isn't counted");
  assert.match(why, /<sub>1 more matched test isn't in this repository, so it wasn't run\.<\/sub>\n<\/details>/);
  const { state } = readState(w.github.comments);
  assert.deepEqual(state.impacted.map((t) => t.test), ["t-4", "t-19"], "nor in state");
});

test("with no fileless matches the note is absent; impact-only answers drop them too", async () => {
  const lines = readFileSync(join(FIXTURES, "impact.ndjson"), "utf8").split("\n");
  const r = JSON.parse(lines[0]);
  r.tests = r.tests.filter((t) => t.path);
  const w = world({ kane: { extra: { "impact.ndjson": [JSON.stringify(r), lines[1], ""].join("\n") } } });
  await job(w, human("@kane-cli check this"));
  assert.doesNotMatch(kaneComments(w.github).at(-1).body, /aren't in this repository|isn't in this repository/);

  const a = world({ cfg: config({ auto: false }) });
  await job(a, human("@kane-cli check this"));
  const body = kaneComments(a.github).at(-1).body;
  assert.doesNotMatch(body, /Not in this folder/);
  assert.match(body, /<sub>1 more matched test isn't in this repository, so it wasn't run\.<\/sub>/);
});
