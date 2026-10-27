// `kane-cli context impact`: the PR diff in, the tests it touches out, each split by git into
// "impacted" (the file exists at the PR's base) or "new in this PR".
import { execFile } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { PipelineError, errorOf } from "./kane.mjs";

/** The impact_result event, or a PipelineError carrying kane-cli's own error message. */
export function parseImpact(events) {
  const result = events.find((e) => e.type === "impact_result");
  // contract v2 lists the tests to run under `run`; v1 under `tests`
  if (result) return { ...result, tests: Array.isArray(result.run) ? result.run : Array.isArray(result.tests) ? result.tests : [] };
  const err = errorOf(events);
  throw new PipelineError(err ? `kane couldn't check impact: ${err}` : "kane couldn't check impact: kane-cli gave no impact_result.");
}

/**
 * The engine's reason a test is impacted: the judge's words, else what it matched and how well,
 * by name. impact_result titles use cases (use_cases[]) and tests (tests[]); a criterion or
 * scenario it doesn't title is shown as the test's own use case, and an id stays only when
 * nothing names it. Repeats keep their best score; best first.
 */
export function whyOf(t, result = null) {
  if (typeof t.reason === "string" && t.reason.trim()) return t.reason.trim();
  if (typeof t.judged_reason === "string" && t.judged_reason.trim()) return t.judged_reason.trim();
  const titles = new Map();
  for (const u of result?.use_cases ?? []) if (u?.id && u.title) titles.set(String(u.id).toLowerCase(), u.title);
  for (const x of result?.tests ?? []) if (x?.id && x.title) titles.set(String(x.id).toLowerCase(), x.title);
  if (t.id && t.title) titles.set(String(t.id).toLowerCase(), t.title);
  const own = (t.use_cases ?? []).map((u) => titles.get(String(u).toLowerCase())).find(Boolean);
  const nameOf = (id) => {
    const key = String(id ?? "").toLowerCase();
    if (titles.has(key)) return `“${titles.get(key)}”`;
    if (result && /^(ac|sc)-/.test(key) && own) return `“${own}”`;
    return String(id);
  };
  const best = new Map();
  for (const r of Array.isArray(t.reasons) ? t.reasons : []) {
    const label = `${r.via === "direct" ? "names" : "similar to"} ${nameOf(r.matched)}`;
    const score = typeof r.score === "number" ? r.score : null;
    if (!best.has(label) || (score ?? -1) > (best.get(label) ?? -1)) best.set(label, score);
  }
  return [...best.entries()]
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
    .map(([label, score]) => `${label}${score != null ? ` (${score.toFixed(2)})` : ""}`)
    .join("; ");
}

/** The judge's own sentence for a test (v2 `reason`, v1 `judged_reason`), never a word-match score; else null. */
export function judgeReason(t) {
  const r = typeof t?.reason === "string" ? t.reason : typeof t?.judged_reason === "string" ? t.judged_reason : "";
  return r.trim() || null;
}

/**
 * True when `path` (relative to the repo root) is in `sha` of the repo at `cwd`. Read with
 * `git ls-tree`, so "not there" (empty output) and a git failure (a PipelineError) differ.
 */
export function existsAt(cwd, sha, path) {
  return new Promise((res, rej) =>
    execFile("git", ["ls-tree", "--name-only", sha, "--", path], { cwd }, (err, out) => {
      if (err) rej(new PipelineError(`kane couldn't read the base commit ${String(sha).slice(0, 7)} in the checkout (git ls-tree failed).`));
      else res(String(out).trim() !== "");
    }),
  );
}

const gitOut = (cwd, args) => new Promise((res, rej) => execFile("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, out) => (err ? rej(err) : res(String(out)))));

/** The PR's diff from the checkout: `git diff <base>...HEAD` (fetch-depth 0 brings the base). */
export async function prDiff(cwd, baseSha) {
  try {
    if (!baseSha) throw new Error("no base sha");
    return await gitOut(cwd, ["diff", `${baseSha}...HEAD`]);
  } catch {
    throw new PipelineError(`kane couldn't build the PR's diff from the checkout (git diff ${String(baseSha ?? "?").slice(0, 7)}...HEAD), so it can't tell which tests this PR touches.`);
  }
}

/** Throws unless `sha` is a commit in the checkout (fetch-depth 0 brings the base in). */
export function hasCommit(cwd, sha) {
  return new Promise((resolve) => execFile("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd }, (err) => resolve(!err)));
}

/** `rows` with `new` set: false when the file is on the base commit, true when not, null without a file. */
export async function splitByBase(rows, { cwd, baseSha }) {
  if (!baseSha || !(await hasCommit(cwd, baseSha))) throw new PipelineError("kane couldn't find the PR's base commit in the checkout (check out with fetch-depth: 0).");
  const real = realpathSync(cwd);
  const root = (await gitOut(cwd, ["rev-parse", "--show-toplevel"]).catch(() => real)).trim();
  return Promise.all(
    rows.map(async (r) => {
      if (!r.path) return { ...r, path: null, new: null };
      // the engine's path is relative to kane-cli's cwd (or absolute); git wants it from the repo root
      const abs = resolve(real, r.path);
      const fromRoot = relative(root, abs);
      const fromCwd = relative(real, abs);
      if (fromRoot.startsWith("..") || isAbsolute(fromRoot) || fromCwd.startsWith("..")) return { ...r, path: null, new: null };
      return { ...r, path: fromCwd, new: !(await existsAt(cwd, baseSha, fromRoot)) };
    }),
  );
}

/** Runs impact in the PR checkout `cwd` and returns [{test, title, why, path, new}] in the engine's order. */
/**
 * `baseUrl` (optional) points only this impact call at another controller (TESTMUAI_BASE_URL),
 * e.g. one that serves the impact@1 template; runs and evidence keep the env's own controller.
 */
export async function runImpact({ kane, cwd, baseSha, diff, judge = true, tmp, baseUrl = null }) {
  const dir = tmp ?? mkdtempSync(join(tmpdir(), "kane-impact-"));
  const input = join(dir, `pr-${Date.now()}.diff`);
  writeFileSync(input, String(diff ?? ""));
  // v2 always judges and refuses --no-judge; it's passed only when the config turns the judge off
  const { events } = await kane.exec(["context", "impact", "--input", input, "--mode", "agent", ...(judge === false ? ["--no-judge"] : [])], { cwd, ...(baseUrl ? { env: { TESTMUAI_BASE_URL: baseUrl } } : {}) });
  const result = parseImpact(events);
  const ucTitle = new Map((result.use_cases ?? []).map((u) => [String(u.id).toLowerCase(), u.title ?? null]));
  // the requirements each test verifies, by title (the final comment groups tests under them)
  const useCasesOf = (t) =>
    t.use_case && typeof t.use_case === "object"
      ? [{ id: String(t.use_case.id), title: t.use_case.title ?? ucTitle.get(String(t.use_case.id).toLowerCase()) ?? null }]
      : (t.use_cases ?? []).map((id) => ({ id: String(id), title: ucTitle.get(String(id).toLowerCase()) ?? null }));
  const rows = result.tests.map((t) => ({ test: String(t.id), title: t.title ?? null, why: whyOf(t, result), reason: judgeReason(t), path: t.path ?? null, use_cases: useCasesOf(t) }));
  return splitByBase(rows, { cwd, baseSha });
}

export const FAILING = new Set(["failed", "broken", "interrupted"]);

/**
 * `N impacted · M new in this PR` plus `· F failing` once results exist (failed, broken or
 * interrupted) and `· K not run` when some got no result; counted, never typed.
 */
export function headline({ impacted = [], results = null }) {
  const n = impacted.filter((r) => r.new === false).length;
  const m = impacted.filter((r) => r.new === true).length;
  const parts = [`${n} impacted`, `${m} new in this PR`];
  if (Array.isArray(results)) {
    parts.push(`${results.filter((r) => FAILING.has(r.verdict)).length} failing`);
    const notRun = results.filter((r) => r.verdict === "not_run").length;
    if (notRun) parts.push(`${notRun} not run`);
  }
  return parts.join(" · ");
}
