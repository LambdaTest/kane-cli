// One kane turn on a PR comment, then a sweep of newer unanswered mentions.
// One kane comment per request: a working comment while it runs, then the result.
import { readFile } from "node:fs/promises";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractMention } from "./mention.mjs";
import { parseConfig, ConfigError } from "./config.mjs";
import { readState, addTurns, emptyState, answeredUpto, KANE_LOGIN } from "./state.mjs";
import { renderComment, renderWorking, oneLine } from "./render.mjs";
import { fallbackAnswer, COULDNT_READ } from "./fallback.mjs";
import { decide } from "./decide.mjs";
import { buildRequest } from "./converse-request.mjs";
import { GitHub } from "./github.mjs";
import { converse as postConverse, basicAuth, fallbackWarning } from "./converse-client.mjs";
import { PipelineError } from "./kane.mjs";
import { makePipeline, pipelineTurn, knownNames, writePending, homesOf, PIPELINE_ACTIONS, THROTTLE_MS, BUSY, PENDING, TESTS_CHECK, POLICY_CHECK } from "./pipeline.mjs";
import { policyLine } from "./report.mjs";
import { renderRunReport, hasVerdict } from "./final.mjs";
import { testsConclusion, policyConclusion } from "./testrun.mjs";
import { stopApp } from "./app.mjs";

/**
 * One kane comment per request. GitHub doesn't notify on a mention added by editing, so the
 * result is posted as a new comment opening with @asker and the request's working comment is
 * deleted. False: the result edits the working comment in place, mentioning nobody.
 */
export const NOTIFY_ON_RESULT = true;

export const CONFIG_PATH = ".github/kane-cli.yml";
export const DEFAULT_MENTION = "@kane-cli";
export const MAX_UNDERSTOOD = 120;
export const MAX_SWEEP = 5;

export const NOT_A_PR = "kane works on pull requests.";
/** The result posted when a turn fails after kane picked it up (the error itself stays in the log). */
export const FAILED = "kane hit an error and couldn't finish this. Ask again to retry.";
export const FORK = "kane doesn't answer on pull requests from forks: the workflow carries secrets.";
const askRefusal = (ask) => `Only ${ask.join(", ")} can ask kane here.`;

const isBot = (user) => user?.type === "Bot" || /\[bot\]$/.test(user?.login ?? "");

/** Repo permissions that count as MEMBER when the comment's association isn't listed. */
export const WRITE_PLUS = ["admin", "maintain", "write"];

/** True when `login` has write, maintain or admin on the repo; any lookup failure is false. */
async function hasWriteAccess(ctx, login) {
  if (!login) return false;
  try {
    const { permission, role } = await ctx.github.getPermission(login);
    return WRITE_PLUS.includes(permission) || WRITE_PLUS.includes(role);
  } catch (e) {
    ctx.log(`kane: #${ctx.number} permission check for ${login} failed (${e?.status ?? "error"}); using the association only`);
    return false;
  }
}

/**
 * What the commenter may do: null when they may not ask, else ["ask"] or ["ask", "run"].
 * Their author_association decides first; when it isn't in a list that allows MEMBER, their
 * repo permission (write and above) counts as MEMBER, looked up at most once.
 */
async function accessFor(ctx, comment, config) {
  const association = comment.author_association ?? "NONE";
  let writer = null;
  const allowed = async (list) => {
    if (list.includes(association)) return true;
    if (!list.includes("MEMBER")) return false;
    writer ??= await hasWriteAccess(ctx, comment.user?.login);
    return writer;
  };
  if (!(await allowed(config.access.ask))) return null;
  return (await allowed(config.access.run)) ? ["ask", "run"] : ["ask"];
}

/** The line a review comment sits on. */
const lineOf = (comment) => ({ path: comment.path, line: comment.line ?? comment.original_line ?? null });

function memo(fn) {
  let p = null;
  return () => (p ??= fn());
}

/** The b/ paths of a unified diff. */
function changedFiles(diff) {
  return [...String(diff ?? "").matchAll(/^diff --git a\/.+? b\/(.+)$/gm)].map((m) => m[1]);
}

/** What a dry run of `decision` would do, or null for actions that don't run anything. */
function wouldText({ action, args: { tests, policy } }, fileCount) {
  const run = tests === "failed" ? "rerun the failed tests" : Array.isArray(tests) ? `run ${tests.join(", ")}` : "run the impacted tests";
  const pol = policy ? ` with the ${policy} policy` : "";
  const check = `check which tests the ${fileCount} changed file${fileCount === 1 ? " affects" : "s affect"}`;
  if (action === "impact") return `I would ${check}`;
  if (action === "run") return `I would ${run}${pol}`;
  if (action === "impact_then_run") return `I would ${check}, then ${run}${pol}`;
  return null;
}

/** Deletes a request's working comment; a failed delete is logged and swallowed (the result is newer, so readState reads it). */
async function dropWorking(ctx, working) {
  try {
    await ctx.github.deleteComment(working.id);
  } catch (e) {
    ctx.log(`kane: #${ctx.number} couldn't delete the working comment ${working.id}: ${e.message}`);
  }
}

/**
 * Posts a request's result. With notify on: a new comment, then the working comment is deleted
 * (created first, so a failed create loses nothing). With notify off: the working comment is
 * edited in place. Earlier requests' comments are never touched.
 */
async function postResult(ctx, working, body) {
  if (working && !ctx.notify) return ctx.github.updateComment(working.id, body);
  const posted = await ctx.github.createComment(ctx.number, body);
  if (working) await dropWorking(ctx, working);
  return posted;
}

/**
 * The progress writer for a request's working comment: forced lines (a phase starting) always
 * edit; per-member lines edit at most once per THROTTLE_MS.
 */
function progressWriter(ctx, working, asked, state) {
  let lastMember = -Infinity;
  let chain = Promise.resolve();
  let timer = null;
  let latest = null;
  // every edit goes through one chain, so they land in order and a slow one never lands last
  const write = (lines) =>
    (chain = chain.then(() =>
      ctx.github.updateComment(working.id, renderWorking({ asked, progress: lines, state, mention: ctx.mention })).then(
        () => {},
        (e) => ctx.log(`kane: #${ctx.number} progress edit failed: ${e.message}`),
      ),
    ));
  const progress = (lines, { force = false } = {}) => {
    if (!working) return chain;
    if (force) {
      clearTimeout(timer);
      timer = null;
      latest = null;
      return write(lines);
    }
    const now = ctx.now();
    if (now - lastMember < THROTTLE_MS) {
      // throttled: the newest lines go out when the window closes (unless a forced edit comes first)
      latest = lines;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (!latest) return;
          const l = latest;
          latest = null;
          lastMember = ctx.now();
          write(l);
        }, Math.max(0, THROTTLE_MS - (now - lastMember)));
        timer.unref?.();
      }
      return chain;
    }
    lastMember = now;
    latest = null;
    return write(lines);
  };
  /** Waits for every queued edit; a throttled one still waiting is dropped (a forced edit follows). */
  progress.flush = () => {
    clearTimeout(timer);
    timer = null;
    return chain;
  };
  return progress;
}

/** "I ran the 2 impacted tests on this PR's build (abc1234): 1 failing." */
export function ranSentence(out, head) {
  const n = (out.results ?? []).filter((r) => r.verdict !== "not_run").length;
  const failing = (out.results ?? []).filter((r) => ["failed", "broken", "interrupted"].includes(r.verdict)).length;
  const impacted = (out.rows ?? []).length > 0 && out.rows === out.impacted;
  const what = `${n === 1 ? "the 1" : `the ${n}`} ${impacted ? "impacted " : ""}test${n === 1 ? "" : "s"}`;
  return `I ran ${what} on this PR's build (${String(head ?? "").slice(0, 7)}): ${failing} failing.`;
}

/** kane's line after a run: the endpoint's answer to the same words with the real results, else ranSentence. */
async function replyAfterRun(ctx, request, out, head) {
  let answer = null;
  try {
    answer = await ctx.ask(request);
  } catch (e) {
    ctx.log(`kane: #${ctx.number} the after-run converse call failed: ${e.message}`);
  }
  const reply = typeof answer?.reply === "string" ? Array.from(answer.reply.trim()).slice(0, 600).join("") : "";
  return reply && !/^\s*I would\b/i.test(reply) ? reply : ranSentence(out, head);
}

/** The actions that are about the PR itself (a moved head re-runs them). */
const ASKS_ABOUT_PR = new Set(["answer", "impact", "run", "impact_then_run"]);
/** An explicit "check again" / "rerun" (a "rerun the failed one" stays a run of the failed). */
const AGAIN = /\b(?:check(?:\s+(?:it|this|them))?\s+again|re-?check|re-?run|run(?:\s+(?:it|this|them))?\s+again|try\s+again)\b/i;

/** A result body: opens with @asker only when the result notifies. */
const resultBody = (ctx, login, fields) => renderComment({ asker: ctx.notify ? login : null, mention: ctx.mention, ...fields });

/** A gate refusal, before any working comment exists: a final result with the 😕 receipt. */
async function refuse(ctx, target, reply) {
  const { github } = ctx;
  const found = readState(await github.listComments(ctx.number), ctx.botLogin);
  const prev = found?.state ?? emptyState();
  const state = answeredUpto(addTurns(prev, target.comment.author_association ?? "NONE", target.words, reply), target.comment.created_at);
  await postResult(ctx, null, resultBody(ctx, target.comment.user.login, { latest: { asked: target.words, reply }, picture: null, state }));
  await github.addReaction(target.kind, target.comment.id, "confused");
  ctx.log(`kane: #${ctx.number} comment ${target.comment.id} refused`);
  return true;
}

/** Answers one mention comment. False when kane had already reacted to it (answered before). */
async function answerComment(ctx, target) {
  const { github, mention } = ctx;
  const { comment, kind, words } = target;
  const started = ctx.now();

  const reactions = await github.listReactions(kind, comment.id);
  if (reactions.some((r) => r?.user?.login === ctx.botLogin)) return false;

  if (!ctx.isPR) return refuse(ctx, target, NOT_A_PR);
  const { pull, config, configError } = await ctx.prContext();
  if (!pull.head?.repo || pull.head.repo.full_name !== pull.base?.repo?.full_name) return refuse(ctx, target, FORK);
  if (configError) return refuse(ctx, target, configError);
  const association = comment.author_association ?? "NONE";
  const may = await accessFor(ctx, comment, config);
  if (may === null) return refuse(ctx, target, askRefusal(config.access.ask));

  const eyes = await github.addReaction(kind, comment.id, "eyes");
  const receipt = async (content) => {
    await github.addReaction(kind, comment.id, content);
    await github.deleteReaction(kind, comment.id, eyes);
  };
  const head = pull.head.sha ?? null;
  let prev = emptyState(head);
  // An error result carries `prev` forward, so it is only posted once the real state was read.
  let stateRead = false;
  const thanks = fallbackAnswer(words).action === "none";
  let working = null;
  // "posting" once the result itself is being written: if that fails, the working comment stays.
  let phase = "working";
  try {
    const found = readState(await github.listComments(ctx.number), ctx.botLogin);
    const state = found?.state ?? null;
    prev = state ?? emptyState(head);
    stateRead = true;

    // An obvious thanks gets only 👍, so it never gets a comment. Anything else gets this
    // request's own working comment, carrying the newest state forward.
    if (!thanks) {
      working = await github.createComment(ctx.number, renderWorking({ asked: words, state: prev, mention }));
    }

    const diff = await ctx.diff();
    const files = changedFiles(diff);
    const requestFor = (s) =>
      buildRequest({
        event: target.event,
        words,
        author: { login: comment.user.login, association },
        may,
        pr: { number: pull.number ?? ctx.number, title: pull.title ?? "", body: pull.body ?? "", draft: pull.draft, head_sha: head, changed_files: files },
        diff,
        line: target.line,
        state: s,
        config,
        dryRun: !ctx.pipeline,
      });
    const request = requestFor(state);
    const asked = await ctx.ask(request);
    const fallback = asked == null;
    const answer = asked ?? fallbackAnswer(words);
    const known = ctx.pipeline ? knownNames(ctx.pipeline.cwd, state) : [];
    let decision = decide(answer, { may, policies: config.policies, state, dryRun: !ctx.pipeline, runAccess: config.access.run, known });
    // a moved head (or an explicit "check again") re-runs: kane never answers about the PR from an older run
    if (ctx.pipeline && !decision.refused && may.includes("run") && ASKS_ABOUT_PR.has(decision.action)) {
      const moved = Boolean(prev.run_sha) && prev.run_sha !== head;
      const again = AGAIN.test(words) && !/fail/i.test(words);
      if (moved || again) {
        ctx.log(`kane: #${ctx.number} ${moved ? `the head moved since kane's last run (${prev.run_sha.slice(0, 7)})` : "asked to check again"}: impact and tests run again`);
        decision = { ...decision, action: "impact_then_run", args: { tests: "impacted", policy: decision.args.policy ?? null } };
      }
    }

    if (decision.action === "none") {
      phase = "posting";
      if (working) await dropWorking(ctx, working);
      await receipt("+1");
      ctx.log(`kane: #${ctx.number} comment ${comment.id} → none (+1) in ${ctx.now() - started} ms`);
      return true;
    }

    if (ctx.pipeline && !decision.refused && PIPELINE_ACTIONS.has(decision.action)) {
      const progress = progressWriter(ctx, working, words, prev);
      // who and what this result is for: the early pending file (a cancelled run) and the full one
      const identity = {
        number: ctx.number, botLogin: ctx.botLogin, notify: ctx.notify, mention: ctx.mention,
        kind, commentId: comment.id, eyes, workingId: working?.id ?? null, asker: comment.user.login,
        association, asked: words, reply: decision.reply, fallback, createdAt: comment.created_at, head,
      };
      let out;
      try {
        out = await pipelineTurn(ctx, { decision, prev, head, pull, config, mayRun: may.includes("run"), pending: identity, progress, files, defaultBranch: pull.base?.repo?.default_branch ?? null });
      } finally {
        await progress.flush();
      }
      const reply = out.busy ? BUSY : decision.reply;
      const next = {
        ...answeredUpto(addTurns(prev, association, words, reply), comment.created_at),
        head_sha: head,
        last_action: out.busy ? prev.last_action : decision.action,
        pending_question: null,
        ...(out.busy ? {} : { picture: out.picture, impacted: out.impacted, results: out.results }),
      };
      if (out.deferred) {
        // the pre-run reply says what kane was about to do; after a real run kane asks again with
        // the results, so its line is about what happened (never "I would …")
        const afterReply = await replyAfterRun(ctx, requestFor({ ...next, turns: prev.turns }), out, head);
        // the result needs the evidence link, so the report step posts it after the upload
        writePending(ctx.pipeline, {
          ...identity, phase: "done", reply: afterReply, lastAction: decision.action, picture: out.picture, impacted: out.impacted, results: out.results,
          rows: out.rows, policy: out.policy, verdict: out.verdict ?? null, runError: out.runError ?? null,
          evidencePath: out.evidencePath, logsPath: out.logsPath, checkId: out.checkId, headTested: out.headTested,
          files: out.files, fileless: out.fileless ?? 0, durationS: out.durationS, policyDoc: out.policyDoc, defaultBranch: pull.base?.repo?.default_branch ?? null,
        });
        ctx.pipeline.output("evidence-path", out.evidencePath ?? "");
        ctx.pipeline.output("logs-path", out.logsPath ?? "");
        ctx.log(`kane: #${ctx.number} comment ${comment.id} → ${decision.action}: tests ran; the report step posts the result`);
        return true;
      }
      phase = "posting";
      await postResult(ctx, working, resultBody(ctx, comment.user.login, { latest: { asked: words, reply }, picture: next.picture, state: next, fallback, report: out.busy ? null : out.report }));
      await receipt(out.busy ? "confused" : "rocket");
      ctx.log(`kane: #${ctx.number} comment ${comment.id} → ${decision.action}${out.busy ? " (busy)" : ""} in ${ctx.now() - started} ms`);
      return true;
    }

    const would = decision.refused ? null : wouldText(decision, files.length);
    const understood = oneLine(answer.understood ?? "", MAX_UNDERSTOOD, mention);
    const sha = head ? `for ${head.slice(0, 7)}` : "for this PR";
    const picture = would
      ? `${sha} · ${understood ? `Understood: “${understood}” · ` : ""}${would} (dry run: nothing ran).`
      : prev.head_sha === head
        ? (typeof prev.picture === "string" ? prev.picture : null)
        : null;
    const next = {
      ...answeredUpto(addTurns(prev, association, words, decision.reply), comment.created_at),
      head_sha: head,
      last_action: decision.action,
      pending_question: decision.action === "clarify" ? decision.reply : null,
      picture,
    };
    phase = "posting";
    await postResult(ctx, working, resultBody(ctx, comment.user.login, { latest: { asked: words, reply: decision.reply }, picture, state: next, fallback }));
    const content = decision.refused || decision.reply === COULDNT_READ ? "confused" : "rocket";
    await receipt(content);
    ctx.log(`kane: #${ctx.number} comment ${comment.id} → ${decision.action} (${content}) in ${ctx.now() - started} ms`);
    return true;
  } catch (e) {
    // An error is a final result too, unless writing the result is what failed, the state
    // wasn't read (posting would replace it with an empty one) or it was a word-rules thanks.
    if (phase === "working" && stateRead && !thanks) {
      try {
        // FAILED is not a turn: the model never sees it, and it pushes no real turn out of the cap.
        const state = answeredUpto(prev, comment.created_at);
        // kane's own words for what stopped it (a PipelineError) are shown; anything else stays in the log
        const reply = e instanceof PipelineError ? e.message : FAILED;
        await postResult(ctx, working, resultBody(ctx, comment.user.login, { latest: { asked: words, reply }, picture: null, state }));
      } catch (e2) {
        ctx.log(`kane: #${ctx.number} couldn't post the error result for comment ${comment.id}: ${e2.message}`);
      }
    }
    try {
      await receipt("confused");
    } catch {}
    // a PipelineError is a handled outcome: its words are the posted result and the tests check
    // carries the failure, so the job itself stays green
    if (e instanceof PipelineError && phase === "working" && stateRead && !thanks) {
      ctx.log(`kane: #${ctx.number} comment ${comment.id} → ${e.message}`);
      return true;
    }
    throw e;
  }
}

/**
 * The sweep's lower bound: kane's answered_upto (the newest comment it has handled), read
 * before this run answers anything, else the trigger's time. NaN when neither parses.
 */
async function sweepBound(ctx, trigger) {
  const found = readState(await ctx.github.listComments(ctx.number), ctx.botLogin);
  return Date.parse(found?.state.answered_upto ?? trigger.created_at);
}

/**
 * Mention comments (conversation and review-line) at or after `bound` that no run has
 * answered: GitHub keeps one waiting run per PR, so the runs for some comments never start.
 * At most MAX_SWEEP, oldest first; one comment's failure is logged and the rest still go.
 */
async function sweep(ctx, trigger, triggerKind, bound) {
  if (Number.isNaN(bound)) return;
  const issue = await ctx.github.listComments(ctx.number);
  let review = [];
  try {
    review = await ctx.github.listReviewComments(ctx.number);
  } catch (e) {
    ctx.log(`kane: #${ctx.number} sweep couldn't list review comments: ${e.message}`);
  }
  const items = [...issue.map((c) => ({ c, kind: "issue" })), ...review.map((c) => ({ c, kind: "review" }))]
    .filter(({ c, kind }) => !(kind === triggerKind && c.id === trigger.id) && !ctx.isKane(c.user) && Date.parse(c.created_at) >= bound)
    .map((x) => ({ ...x, words: extractMention(x.c.body, ctx.mention) }))
    .filter(({ words }) => words !== null)
    .sort((a, b) => Date.parse(a.c.created_at) - Date.parse(b.c.created_at));
  let handled = 0;
  for (const { c, kind, words } of items) {
    if (handled >= MAX_SWEEP) break;
    const target = kind === "review" ? { comment: c, kind, event: "review_comment", line: lineOf(c), words } : { comment: c, kind, event: "comment", line: null, words };
    try {
      if (await answerComment(ctx, target)) handled++;
    } catch (e) {
      handled++;
      ctx.log(`kane: #${ctx.number} sweep of ${kind} comment ${c.id} failed: ${e.message}`);
    }
  }
}

/**
 * Handles one issue_comment / pull_request_review_comment event.
 * env: GITHUB_EVENT_NAME, KANE_CONVERSE_URL, LT_USERNAME, LT_ACCESS_KEY, KANE_MENTION, KANE_BOT_LOGIN.
 * deps: {github, converse, now, log, notifyOnResult (default NOTIFY_ON_RESULT)}.
 */
export async function run(event, env, deps) {
  const { github, converse = postConverse, now = Date.now, log = () => {}, notifyOnResult = NOTIFY_ON_RESULT } = deps;
  const comment = event?.comment;
  const botLogin = env.KANE_BOT_LOGIN?.trim() || KANE_LOGIN;
  const isKane = (user) => isBot(user) || user?.login === botLogin;
  if (!comment || isKane(comment.user) || isKane(event.sender)) return;

  const review = env.GITHUB_EVENT_NAME === "pull_request_review_comment";
  const number = review ? event.pull_request?.number : event.issue?.number;
  if (number == null) return;
  const mention = /^@[A-Za-z0-9_-]+$/.test(env.KANE_MENTION ?? "") ? env.KANE_MENTION : DEFAULT_MENTION;
  const url = env.KANE_CONVERSE_URL;
  const auth = env.LT_USERNAME && env.LT_ACCESS_KEY ? basicAuth(env.LT_USERNAME, env.LT_ACCESS_KEY) : null;

  let warnedNoConfig = false;
  const ctx = {
    github,
    pipeline: makePipeline(env, deps),
    appTimeoutMs: deps.appTimeoutMs,
    processList: deps.processList,
    overlapPollMs: deps.overlapPollMs,
    overlapTimeoutMs: deps.overlapTimeoutMs,
    onTestrunStart: deps.onTestrunStart,
    now,
    log,
    mention,
    number,
    botLogin,
    notify: notifyOnResult,
    isKane,
    isPR: review || Boolean(event.issue?.pull_request),
    ask: (request) => {
      if (url && auth) return converse(url, auth, request, { log });
      log("converse: fallback (no-config)");
      if (!warnedNoConfig) log(fallbackWarning("no-config"));
      warnedNoConfig = true;
      return null;
    },
    // Best effort: GitHub refuses big diffs (406), and the turn can still answer without one.
    diff: memo(() => github.getDiff(number).catch((e) => `[diff unavailable: ${e?.status ?? "error"}]`)),
    prContext: memo(async () => {
      const pull = await github.getPull(number);
      try {
        return { pull, config: parseConfig(await github.getDefaultBranchFile(CONFIG_PATH)), configError: null };
      } catch (e) {
        if (!(e instanceof ConfigError)) throw e;
        return { pull, config: null, configError: e.message };
      }
    }),
  };

  const kind = review ? "review" : "issue";
  // Read before this run answers anything, so answering the trigger can't raise the bound past older misses.
  const bound = ctx.isPR ? await sweepBound(ctx, comment) : NaN;
  const words = extractMention(comment.body, mention);
  if (words !== null) {
    await answerComment(ctx, {
      comment,
      kind,
      event: review ? "review_comment" : "comment",
      line: review ? lineOf(comment) : null,
      words,
    });
  }
  if (ctx.isPR) await sweep(ctx, comment, kind, bound);
}

/** Where the run step leaves a deferred result for the report step. */
const pendingFile = (stateDir) => join(stateDir, PENDING);

/** Said when the report step finds a run that never finished (the job was cancelled or timed out). */
export const STOPPED = "the run was stopped before it finished (the job was cancelled or timed out), so there's no result. Ask again to rerun it.";

/**
 * The always-step after the run step: stops the PR's app (and whatever holds its port) and
 * removes kane-cli's per-job HOME (its saved login) and the app's HOME.
 */
export async function stopPhase(env, deps = {}) {
  const p = makePipeline({ ...env, KANE_PIPELINE: "true" }, deps);
  await stopApp(join(p.stateDir, "app.pid"));
  const homes = homesOf(env, p.stateDir);
  rmSync(homes.kane, { recursive: true, force: true });
  rmSync(homes.app, { recursive: true, force: true });
}

/** The final state for a deferred result: the newest state on the PR (a sweep may have added turns) plus this run. */
function finalState(newest, pend) {
  return {
    ...answeredUpto(addTurns(newest, pend.association, pend.asked, pend.reply), pend.createdAt),
    head_sha: pend.head,
    run_sha: pend.head,
    last_action: pend.lastAction,
    pending_question: null,
    picture: pend.picture,
    impacted: pend.impacted,
    results: pend.results,
  };
}

/**
 * The report step (after the workflow uploaded the pack): posts the deferred result with the
 * evidence link, then completes `kane-cli / tests` and, when a policy was applied, creates
 * `kane-cli / policy`. A failing policy fails only that check, never this step.
 * env: KANE_STATE_DIR, KANE_ARTIFACT_ID, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY.
 */
export async function report(env, deps) {
  const { github, log = () => {} } = deps;
  const p = makePipeline({ ...env, KANE_PIPELINE: "true" }, deps);
  const file = pendingFile(p.stateDir);
  if (!existsSync(file)) {
    log("kane: report: no test run to report");
    return;
  }
  const pend = JSON.parse(readFileSync(file, "utf8"));
  rmSync(file, { force: true });
  const ctx = { github, log, number: pend.number, botLogin: pend.botLogin, notify: pend.notify, mention: pend.mention };
  if (pend.phase === "running") return reportStopped(ctx, pend);
  // the name kane.yml gives the upload: kane-evidence-<run id>-<attempt>
  const artifactName = env.KANE_ARTIFACT_NAME || (env.GITHUB_RUN_ID ? `kane-evidence-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT || 1}` : null);
  const evidence = { path: pend.evidencePath, repo: env.GITHUB_REPOSITORY ?? "", artifactId: env.KANE_ARTIFACT_ID || null, artifactName };
  const repo = env.GITHUB_REPOSITORY ?? "";
  const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL || "https://github.com"}/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : repo ? `https://github.com/${repo}/actions` : null;
  const md = renderRunReport({
    rows: pend.rows, results: pend.results, ran: true, mention: pend.mention, evidence, policy: pend.policy, verdict: pend.verdict,
    policyDoc: pend.policyDoc, runError: pend.runError, files: pend.files ?? [], fileless: pend.fileless ?? 0, sha: pend.headTested ?? pend.head,
    durationS: pend.durationS, runUrl, repo, defaultBranch: pend.defaultBranch || "main", runId: env.GITHUB_RUN_ID || null,
  });
  const members = new Map((pend.results ?? []).map((r) => [r.test, { status: r.verdict }]));
  const title = String(pend.picture ?? "").replace(/^for \S+ · /, "");

  let failure = null;
  try {
    const found = readState(await github.listComments(pend.number), pend.botLogin);
    const state = finalState(found?.state ?? emptyState(pend.head), pend);
    const working = pend.workingId ? { id: pend.workingId } : null;
    await postResult(ctx, working, resultBody(ctx, pend.asker, { latest: { asked: pend.asked, reply: pend.reply }, picture: pend.picture, state, fallback: pend.fallback, report: md }));
    await github.addReaction(pend.kind, pend.commentId, pend.runError ? "confused" : "rocket");
    if (pend.eyes != null) await github.deleteReaction(pend.kind, pend.commentId, pend.eyes).catch(() => {});
  } catch (e) {
    failure = e;
  }
  // the checks are completed even when the comment couldn't be posted
  if (pend.checkId) {
    await github.updateCheckRun(pend.checkId, { status: "completed", conclusion: testsConclusion({ members, error: pend.runError }), output: { title: title || "kane-cli tests", summary: md } });
  }
  // only a real verdict gets a check: a missing one must never turn the required check red or green
  const applied = hasVerdict(pend.policy, pend.verdict, pend.policyDoc);
  if (applied) {
    await github.createCheckRun({ name: POLICY_CHECK, head_sha: pend.headTested, status: "completed", conclusion: policyConclusion(pend.verdict), output: { title: policyLine(pend.policy, pend.verdict), summary: md } });
  }
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, `## kane-cli · PR #${pend.number}\n\n${pend.picture ?? ""}\n\n${md}\n`);
    } catch {}
  }
  log(`kane: #${pend.number} reported the run (${TESTS_CHECK}${applied ? `, ${POLICY_CHECK}` : ""})`);
  if (failure) throw failure;
}

/** The report for a run that never finished: the check is cancelled and the asker is told, through the normal result path. */
async function reportStopped(ctx, pend) {
  const { github } = ctx;
  let failure = null;
  try {
    const found = readState(await github.listComments(pend.number), pend.botLogin);
    const newest = found?.state ?? emptyState(pend.head);
    const state = { ...answeredUpto(addTurns(newest, pend.association, pend.asked, STOPPED), pend.createdAt), head_sha: pend.head, pending_question: null };
    const working = pend.workingId ? { id: pend.workingId } : null;
    await postResult(ctx, working, resultBody(ctx, pend.asker, { latest: { asked: pend.asked, reply: STOPPED }, picture: null, state, fallback: pend.fallback }));
    await github.addReaction(pend.kind, pend.commentId, "confused");
    if (pend.eyes != null) await github.deleteReaction(pend.kind, pend.commentId, pend.eyes).catch(() => {});
  } catch (e) {
    failure = e;
  }
  if (pend.checkId) await github.updateCheckRun(pend.checkId, { status: "completed", conclusion: "cancelled", output: { title: "the run was stopped before it finished", summary: STOPPED } });
  ctx.log(`kane: #${pend.number} the run was stopped before it finished; check cancelled`);
  if (failure) throw failure;
}

async function main() {
  const env = process.env;
  const github = new GitHub(env.GITHUB_TOKEN, env.GITHUB_REPOSITORY, env.GITHUB_API_URL || undefined);
  const deps = { github, converse: postConverse, now: Date.now, log: (m) => console.log(m) };
  if (env.KANE_PHASE === "report") return report(env, deps);
  // the always-step's safety net: stop the PR's app if a crash left it running
  if (env.KANE_PHASE === "stop-app") return stopPhase(env, deps);
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  await run(event, env, deps);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exitCode = 1;
  });
}
