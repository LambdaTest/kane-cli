// Phases 2–3: one turn's real work. Impact in the PR checkout, then (auto_continue or a run
// request) the tests against the PR's build, with progress on the working comment. A run's
// result is posted by the report phase, after the workflow has uploaded the evidence pack.
import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { splitCommand } from "./argv.mjs";
import { kaneRunner, login, PipelineError } from "./kane.mjs";
import { runImpact, splitByBase, headline, prDiff } from "./impact.mjs";
import { runTestrun, testrunArgs, supportsPolicy, progressLines } from "./testrun.mjs";
import { startApp } from "./app.mjs";
import { waitForOtherRuns, psList, WAITING, OVERLAP_POLL_MS, OVERLAP_TIMEOUT_MS } from "./overlap.mjs";
import { resultOf } from "./report.mjs";
import { renderRunReport } from "./final.mjs";

export const TESTS_CHECK = "kane-cli / tests";
export const POLICY_CHECK = "kane-cli / policy";
/** At most one per-member progress edit in this window. */
export const THROTTLE_MS = 5_000;
export const APP_TIMEOUT_MS = 60_000;
export const PIPELINE_ACTIONS = new Set(["impact", "run", "impact_then_run"]);
export const FAILED = new Set(["failed", "broken", "interrupted"]);
export const BUSY = "kane is already running tests for an earlier request on this PR in this job. Ask again once that result is posted.";
export const PENDING = "pending.json";

function memo(fn) {
  let p = null;
  return () => (p ??= fn());
}

const git = (cwd, ...args) => new Promise((res, rej) => execFile("git", args, { cwd }, (e, out) => (e ? rej(new PipelineError(`git ${args[0]} failed in the PR checkout`)) : res(out.trim()))));

const stem = (p) => basename(String(p ?? "")).replace(/_test\.md$/, "");

/** Names never passed to kane-cli or the PR's app (which runs the PR's own code). */
const SECRET = /^(GITHUB_TOKEN|GH_TOKEN|LT_USERNAME|LT_ACCESS_KEY|KANE_CONVERSE_URL|ACTIONS_RUNTIME_TOKEN|ACTIONS_ID_TOKEN_REQUEST_TOKEN|INPUT_.*)$/;

/** `env` without the secrets: kane-cli signs in from login's flags, and reads no LT_* env. */
export function childEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([k, v]) => v !== undefined && !SECRET.test(k)));
}

/**
 * What the PR's app (the PR's own code) must not see beyond the secrets: the runner's files it
 * could write a forged result through (RUNNER_TEMP, GITHUB_OUTPUT/ENV/PATH/STATE/STEP_SUMMARY),
 * every ACTIONS_* token and kane's own KANE_* settings (KANE_STATE_DIR holds pending.json).
 */
const RUNNER_ONLY = /^(RUNNER_TEMP|RUNNER_TOOL_CACHE|GITHUB_OUTPUT|GITHUB_ENV|GITHUB_PATH|GITHUB_STATE|GITHUB_STEP_SUMMARY|GITHUB_EVENT_PATH|ACTIONS_.*|KANE_.*)$/;

/** The app's env: childEnv minus the runner's files and tokens, with its own HOME. */
export function appEnvOf(env, home) {
  return { ...Object.fromEntries(Object.entries(childEnv(env)).filter(([k]) => !RUNNER_ONLY.test(k))), HOME: home };
}

/** Writes this run's pending result: phase "running" when its check starts, "done" when it ran. */
export function writePending(p, pending) {
  writeFileSync(join(p.stateDir, PENDING), JSON.stringify(pending));
}

export function clearPending(p) {
  rmSync(join(p.stateDir, PENDING), { force: true });
}

/** The pipeline's job-wide context, or null when KANE_PIPELINE isn't "true" (a dry run). */
export function makePipeline(env, deps = {}) {
  if (env.KANE_PIPELINE !== "true") return null;
  const workspace = resolve(env.GITHUB_WORKSPACE ?? process.cwd());
  const cwd = resolve(workspace, env.KANE_PR_PATH || "pr");
  const stateDir = resolve(env.KANE_STATE_DIR || join(env.RUNNER_TEMP || tmpdir(), "kane-cli-pr"));
  mkdirSync(stateDir, { recursive: true });
  // kane-cli's login is saved under its HOME: a per-job dir the always-step removes, never the
  // HOME the PR's app gets
  const homes = homesOf(env, stateDir);
  let kane = null;
  const kaneOf = () => {
    if (kane) return kane;
    let cmd;
    try {
      cmd = splitCommand(env.KANE_CLI_CMD || "kane-cli");
    } catch (e) {
      throw new PipelineError(`kane can't run kane-cli: ${e.message}.`);
    }
    mkdirSync(homes.kane, { recursive: true, mode: 0o700 });
    return (kane = kaneRunner({ cmd, env: { ...childEnv(deps.kaneEnv ?? process.env), HOME: homes.kane } }));
  };
  const p = {
    workspace,
    cwd,
    stateDir,
    homes,
    // the runner's work root (_work/<repo>): a listener whose cwd is under it was started by a kane job
    workRoot: resolve(env.RUNNER_WORKSPACE || dirname(workspace)),
    appEnv: () => {
      mkdirSync(homes.app, { recursive: true, mode: 0o700 });
      return appEnvOf(deps.kaneEnv ?? process.env, homes.app);
    },
    repo: env.GITHUB_REPOSITORY ?? "",
    deferred: null,
    get kane() {
      return kaneOf();
    },
    ready: memo(() => login(kaneOf(), { username: env.LT_USERNAME, accessKey: env.LT_ACCESS_KEY, env: env.KANE_ENV || "prod" })),
    policySupported: memo(() => supportsPolicy(kaneOf(), cwd)),
    headTested: memo(async () => {
      if (!existsSync(cwd)) throw new PipelineError(`kane found no PR checkout at ${cwd}; the workflow checks out refs/pull/<n>/head there.`);
      return git(cwd, "rev-parse", "HEAD");
    }),
    output(name, value) {
      if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${String(value).replace(/\r?\n/g, " ")}\n`);
    },
  };
  return p;
}

/** $RUNNER_TEMP/kane-home (kane-cli's) and $RUNNER_TEMP/app-home (the PR app's). */
export function homesOf(env, stateDir) {
  const root = resolve(env.RUNNER_TEMP || stateDir);
  return { kane: join(root, "kane-home"), app: join(root, "app-home") };
}

/** The checkout's designed tests: [{test (assurance id, else stem), id, stem, title, path}]. */
export function scanTests(cwd) {
  const dir = join(cwd, ".testmuai", "tests");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith("_test.md"))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
      const id = /^assurance:\s*\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+id:\s*["']?([^\s"'#]+)/m.exec(front + "\n")?.[1] ?? null;
      const title = /^#\s+(.+)$/m.exec(text.slice(front.length))?.[1]?.trim() ?? null;
      const path = `.testmuai/tests/${f}`;
      return { test: id ?? stem(f), id, stem: stem(f), title, path };
    });
}

/** Every name a reviewer may give a test: the state's names and stems, and the checkout's ids and stems. */
export function knownNames(cwd, state) {
  const saved = [...(state?.impacted ?? []), ...(state?.results ?? [])].flatMap((t) => [t.test, t.path ? stem(t.path) : null]);
  return [...new Set([...saved, ...scanTests(cwd).flatMap((t) => [t.id, t.stem])].filter(Boolean))];
}

const same = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

/** Named tests → rows, from kane's state first (keeping its why), else the checkout. */
function resolveNames(names, prev, cwd) {
  const saved = [...(prev.impacted ?? []), ...(prev.results ?? [])];
  const files = scanTests(cwd);
  return names.map((n) => {
    const s = saved.find((t) => t.path && (same(t.test, n) || same(stem(t.path), n)));
    const f = files.find((t) => same(t.id, n) || same(t.stem, n) || (s && t.path === s.path));
    if (!s && !f) throw new PipelineError(`kane doesn't know a test named ${n} on this PR.`);
    const imp = (prev.impacted ?? []).find((t) => t.path === (s?.path ?? f.path));
    return { test: s?.test ?? f.test, title: imp?.title ?? f?.title ?? null, why: imp?.why || "named in the request", path: s?.path ?? f.path };
  });
}

/** The b/ paths a unified diff changes. */
export const filesOf = (diff) => [...new Set([...String(diff ?? "").matchAll(/^diff --git a\/.+? b\/(.+)$/gm)].map((m) => m[1]))];

/**
 * What the final comment shows of the applied policy: its id, its YAML (the default branch's
 * file) and its gates as judged (the verdict file the `verdict` event names). Null without one.
 */
export function policyDocOf(policy, verdict) {
  if (!policy?.configured || !policy.supported || policy.missing) return null;
  let yaml = null;
  try {
    yaml = readFileSync(policy.abs, "utf8").slice(0, 6000);
  } catch {}
  const v = verdict?.policies?.[0] ?? null;
  let gates = [];
  if (v?.file) {
    try {
      const doc = JSON.parse(readFileSync(v.file, "utf8"));
      gates = (doc.gates ?? []).map((g) => ({ id: g.id, metric: g.metric ?? null, op: g.op ?? null, expected: g.expected ?? null, actual: g.actual ?? null, severity: g.severity ?? "blocking", status: g.status ?? null, message: g.message ?? null }));
    } catch {}
  }
  const id = v?.id ?? /^policy:\s*["']?([^\s"'#]+)/m.exec(yaml ?? "")?.[1] ?? null;
  return { id, yaml, gates };
}

/** The policy a turn applies: the turn's named one, else config `policy`. */
async function policyFor(p, config, name) {
  const path = name ? config.policyPaths[name] ?? null : config.policy;
  if (!path) return { configured: false };
  const supported = await p.policySupported();
  const abs = resolve(p.workspace, path);
  // only the default branch's checkout counts: never the PR's own copy under pr/, never outside
  const inside = abs.startsWith(p.workspace + sep) && !(abs + sep).startsWith(p.cwd + sep);
  return { configured: true, supported, path, abs, missing: supported && (!inside || !existsSync(abs)) };
}

const sha7 = (s) => (s ? String(s).slice(0, 7) : "this PR");

/**
 * One turn's work for an impact / run / impact_then_run decision. t: {decision, prev, head,
 * pull, config, mayRun, pending (the result's identity, for the early pending file),
 * progress(lines, {force})}. Resolves one of:
 *   {busy: true}                       a second run in this job
 *   {deferred: false, ...}             posted now (impact only, or nothing to run)
 *   {deferred: true, ...}              tests ran; the report phase posts it
 * with impacted, results, rows, report (markdown), picture, and for runs the pending fields.
 */
export async function pipelineTurn(ctx, t) {
  const p = ctx.pipeline;
  const { decision, prev, head, config } = t;
  const sameHead = prev.head_sha === head;
  const tests = decision.args?.tests ?? "impacted";
  // a match with no file here (a test an earlier take designed, which a linked folder can't archive) never runs or counts
  const savedImpacted = sameHead ? (prev.impacted ?? []).filter((r) => r.path) : [];
  const doImpact = decision.action !== "run" || (tests === "impacted" && !savedImpacted.some((r) => r.path));
  // auto_continue runs straight on only for someone who may run (decide already gates run requests)
  const wantsRun = decision.action !== "impact" || (config.autoContinue && t.mayRun !== false);
  if (wantsRun && p.deferred) return { busy: true };
  // nothing to rerun: say so and leave the checks alone (a new neutral one could turn a required check green)
  if (decision.action === "run" && tests === "failed" && !(prev.results ?? []).some((r) => FAILED.has(r.verdict) && r.path)) {
    return { impacted: savedImpacted, rows: [], checkId: null, deferred: false, results: prev.results, picture: typeof prev.picture === "string" ? prev.picture : null, report: "Nothing failed in the last run." };
  }

  const headTested = await p.headTested();
  let checkId = null;
  try {
    if (wantsRun) {
      checkId = await ctx.github.createCheckRun({ name: TESTS_CHECK, head_sha: headTested, status: "in_progress", output: { title: "kane is running this PR's tests", summary: `Asked on PR #${ctx.number}.` } });
      // if the job is cancelled or times out from here, the report step finds this and closes up
      writePending(p, { ...t.pending, phase: "running", checkId, headTested });
    }
    await p.ready();

    let impacted = savedImpacted;
    let rows;
    let files = t.files ?? [];
    let fileless = 0;
    if (doImpact) {
      await t.progress(["Checking which tests this PR affects…"], { force: true });
      // the checkout's own diff: the API refuses big ones (406), and an empty diff would read as "nothing ran"
      const diff = await prDiff(p.cwd, t.pull.base?.sha);
      files = filesOf(diff);
      const matched = await runImpact({ kane: p.kane, cwd: p.cwd, baseSha: t.pull.base?.sha, diff, judge: config.impact.judge, tmp: p.stateDir, baseUrl: process.env.KANE_IMPACT_BASE_URL || null });
      // fileless matches are only counted, in one note under "Why these tests": never rows, badges or runs
      impacted = matched.filter((r) => r.path);
      fileless = matched.length - impacted.length;
      rows = impacted;
    } else if (tests === "impacted") {
      rows = savedImpacted;
    } else if (tests === "failed") {
      const failed = (prev.results ?? []).filter((r) => FAILED.has(r.verdict) && r.path);
      rows = await splitByBase(
        failed.map((r) => {
          const imp = (prev.impacted ?? []).find((x) => x.test === r.test);
          return { test: r.test, title: imp?.title ?? null, why: imp?.why || "failed last time", path: r.path };
        }),
        { cwd: p.cwd, baseSha: t.pull.base?.sha },
      );
    } else {
      rows = await splitByBase(resolveNames(tests, prev, p.cwd), { cwd: p.cwd, baseSha: t.pull.base?.sha });
    }
    const selection = rows.filter((r) => r.path);
    const base = { impacted, rows, checkId, headTested };

    if (!wantsRun) {
      const results = sameHead ? prev.results : null;
      return { ...base, deferred: false, results, picture: `for ${sha7(head)} · ${headline({ impacted: rows })}`, report: renderRunReport({ rows, ran: false, files, fileless, mention: ctx.mention, defaultBranch: t.defaultBranch }) };
    }
    if (selection.length === 0) {
      const summary = renderRunReport({ rows, ran: false, files, fileless, mention: ctx.mention, defaultBranch: t.defaultBranch, empty: "The engine named no tests for this change, so nothing ran." });
      await ctx.github.updateCheckRun(checkId, { status: "completed", conclusion: "neutral", output: { title: `${headline({ impacted: rows })} · nothing ran`, summary } });
      clearPending(p);
      return { ...base, deferred: false, results: [], picture: `for ${sha7(head)} · ${headline({ impacted: rows, results: [] })}`, report: summary };
    }

    const policy = await policyFor(p, config, decision.args?.policy ?? null);
    const logsPath = join(p.stateDir, `testrun-${ctx.number}-${Date.now()}.ndjson`);
    // one kane-cli test run at a time on this machine (a self-hosted runner may run other kane-cli sessions)
    await waitForOtherRuns({
      list: ctx.processList ?? psList,
      pollMs: ctx.overlapPollMs ?? OVERLAP_POLL_MS,
      timeoutMs: ctx.overlapTimeoutMs ?? OVERLAP_TIMEOUT_MS,
      onWait: () => t.progress([WAITING], { force: true }),
    });
    let app = null;
    if (config.app) {
      await t.progress([`Starting the PR's app (${config.app.start})…`], { force: true });
      app = await startApp({ ...config.app, cwd: p.cwd, pidFile: join(p.stateDir, "app.pid"), timeoutMs: ctx.appTimeoutMs ?? config.app.timeoutMs ?? APP_TIMEOUT_MS, log: ctx.log, env: p.appEnv(), workRoot: p.workRoot });
    }
    let run;
    try {
      await t.progress([`Running ${selection.length} test${selection.length === 1 ? "" : "s"}…`], { force: true });
      await ctx.onTestrunStart?.();
      const args = testrunArgs({ paths: selection.map((r) => r.path), heal: config.heal, parallel: config.parallel, url: config.app?.url ?? null, policy: policy.configured && policy.supported && !policy.missing ? policy.abs : null });
      run = await runTestrun({ kane: p.kane, cwd: p.cwd, args, outFile: logsPath, onMember: (members, started) => t.progress(progressLines(selection, members, started)) });
    } finally {
      await app?.stop();
    }
    const results = selection.map((r) => resultOf(r, run.members.get(r.path)));
    await t.progress([...progressLines(selection, run.members), "", "All tests finished; posting the result once the evidence is uploaded."], { force: true });
    p.deferred = true;
    return {
      ...base,
      deferred: true,
      results,
      picture: `for ${sha7(head)} · ${headline({ impacted: rows, results })}`,
      policy,
      verdict: run.verdict,
      runError: run.error,
      evidencePath: run.evidencePath,
      logsPath,
      files,
      fileless,
      durationS: typeof run.summary?.duration_s === "number" ? run.summary.duration_s : null,
      policyDoc: policyDocOf(policy, run.verdict),
    };
  } catch (e) {
    if (checkId) {
      const msg = e instanceof PipelineError ? e.message : "kane hit an error before the tests finished.";
      await ctx.github.updateCheckRun(checkId, { status: "completed", conclusion: "failure", output: { title: "kane couldn't run the tests", summary: msg } }).catch(() => {});
      clearPending(p);
    }
    throw e;
  }
}
