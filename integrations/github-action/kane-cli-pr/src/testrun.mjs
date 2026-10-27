// `kane-cli testrun run`: the flags, the member stream, the pack, the verdict, the checks.
import { existsSync, realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { errorOf } from "./kane.mjs";

export const PARALLEL = 2;

/** argv after the kane-cli prefix. Heal off (the default) adds --no-adaptive-heal: a PR gate reports what it saw. */
export function testrunArgs({ paths, heal = false, url = null, policy = null, parallel = PARALLEL }) {
  return [
    "testrun",
    "run",
    ...paths,
    "--headless",
    "--parallel",
    String(parallel),
    ...(url ? ["--override-start-url", url] : []),
    ...(heal ? [] : ["--no-adaptive-heal"]),
    ...(policy ? ["--policy", policy] : []),
    "--agent",
  ];
}

/** True when this kane-cli's `testrun run --help` lists `--policy <file>`. */
export async function supportsPolicy(kane, cwd) {
  const { stdout, stderr } = await kane.exec(["testrun", "run", "--help"], { cwd });
  return /--policy\s+</.test(`${stdout}\n${stderr}`);
}

const MEMBER_END = new Set(["testrun_member_end", "testrun_authored_member_end"]);
const MEMBER_START = new Set(["testrun_member_start", "testrun_authored_member_start"]);

/**
 * Runs the testrun in `cwd`; onMember(members) after every member end. Resolves
 * {code, members: Map relPath → {path, test_id, status, duration_s, failure?, authored},
 *  summary, done, verdict, error, evidencePath}.
 */
export async function runTestrun({ kane, cwd, args, outFile, onMember }) {
  const members = new Map();
  const started = new Set();
  // kane-cli reports replay members by absolute path (its realpath'd cwd) and authored ones relative to it
  const real = (p) => (existsSync(p) ? realpathSync(p) : p);
  const base = real(cwd);
  const rel = (p) => relative(base, real(isAbsolute(p) ? p : resolve(base, p)));
  const { code, events } = await kane.exec(args, {
    cwd,
    outFile,
    onEvent: (e) => {
      if (MEMBER_START.has(e.type) && typeof e.path === "string") {
        started.add(rel(e.path));
        onMember?.(members, started);
        return;
      }
      if (!MEMBER_END.has(e.type) || typeof e.path !== "string") return;
      const path = rel(e.path);
      members.set(path, {
        path,
        test_id: e.test_id ?? null,
        status: String(e.status ?? "broken"),
        duration_s: typeof e.duration_s === "number" ? e.duration_s : null,
        ...(e.failure ? { failure: { message: String(e.failure.message ?? ""), ...(typeof e.failure.step_index === "number" ? { step_index: e.failure.step_index } : {}) } } : {}),
        authored: e.type === "testrun_authored_member_end",
        log_path: typeof e.log_path === "string" ? e.log_path : null,
      });
      onMember?.(members, started);
    },
  });
  // the runner's reason is often only "assertion_failed: @ step 7": read the member's own log for what failed
  for (const m of members.values()) {
    if (m.status === "passed" || !m.failure || !GENERIC.test(m.failure.message.trim())) continue;
    const reason = await failureReason(m.log_path);
    if (reason) m.failure = { ...m.failure, message: reason };
  }
  // a heal re-authored part of the test on this run: the comment says so next to its result
  for (const m of members.values()) m.healed = await healedFrom(m.log_path);
  const last = (type) => events.findLast((e) => e.type === type) ?? null;
  const done = last("testrun_done");
  const coverage = last("coverage");
  const candidates = [coverage?.pack, done?.execution_id ? join(cwd, ".testmuai", "evidence", `${done.execution_id}.evidence`) : null, last("testrun_summary")?.execution?.id ? join(cwd, ".testmuai", "evidence", `${last("testrun_summary").execution.id}.evidence`) : null];
  const evidencePath = candidates.find((p) => typeof p === "string" && p && existsSync(p)) ?? null;
  const error = errorOf(events) ?? (done ? null : `kane-cli stopped (exit ${code}) before the run finished`);
  return { code, members, summary: last("testrun_summary"), done, verdict: last("verdict"), error, evidencePath };
}

/** True when a member's own log says adaptive heal ran (`test_md_adaptive_heal`, or the summary's adaptive_heal.triggered). */
export async function healedFrom(logPath) {
  if (!logPath) return false;
  let text;
  try {
    if ((await stat(logPath)).size > 32 * 1024 * 1024) return false;
    text = await readFile(logPath, "utf8");
  } catch {
    return false;
  }
  for (const l of text.split("\n")) {
    if (!l.includes("adaptive_heal")) continue;
    try {
      const e = JSON.parse(l);
      if (e.type === "test_md_adaptive_heal") return true;
      if (e.type === "test_md_summary" && e.adaptive_heal?.triggered === true) return true;
    } catch {}
  }
  return false;
}

/** A runner reason that names no value: "assertion_failed: @ step 7", "step_failed", "". */
export const GENERIC = /^(?:[a-z_]+(?::\s*@?\s*step\s*\d+)?|)$/i;
export const MAX_REASON = 160;

const cap = (s, n = MAX_REASON) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const str = (v) => (v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));

/**
 * The failing step's human reason from a member's own event log (its `log_path`): a
 * deterministic check's "expected X, got Y" from the run's step_NNN.json, else the failed
 * assertion's claim and any stored value that wasn't on the page. Null when the log says nothing.
 */
export async function failureReason(logPath) {
  if (!logPath) return null;
  let text;
  try {
    if ((await stat(logPath)).size > 32 * 1024 * 1024) return null;
    text = await readFile(logPath, "utf8");
  } catch {
    return null;
  }
  const events = text.split("\n").map((l) => {
    try {
      return l.trim().startsWith("{") ? JSON.parse(l) : null;
    } catch {
      return null;
    }
  }).filter(Boolean);
  const runEnd = events.findLast((e) => e.type === "run_end" && e.status !== "passed") ?? null;
  const assertion = events.findLast((e) => e.type === "step_event" && e.event === "assertion" && e.passed === false) ?? null;
  const step = Number(/step\s*(\d+)/i.exec(runEnd?.reason ?? "")?.[1] ?? assertion?.index ?? NaN);
  if (runEnd?.run_dir && Number.isInteger(step)) {
    try {
      const doc = JSON.parse(await readFile(join(runEnd.run_dir, `step_${String(step).padStart(3, "0")}.json`), "utf8"));
      const a = doc?.assertion ?? {};
      const bad = (a.sub_results ?? []).find((r) => r && r.deterministic_passed === false && r.expected != null && r.actual != null);
      // the reference's form: "discount **−$10.00** instead of −$9.00" (what the run saw, bold)
      if (bad) return cap(`${bad.description || a.claim || "check"} **${str(bad.actual)}** instead of ${str(bad.expected)}`);
    } catch {}
  }
  if (runEnd?.reason && !GENERIC.test(String(runEnd.reason).trim())) return cap(String(runEnd.reason).trim());
  const claim = String(assertion?.detail ?? "").trim();
  if (!claim) return null;
  const vars = runEnd?.context?.variables ?? {};
  const missing = Object.entries(vars).filter(([, v]) => v?.value === "__not_visible__").map(([k]) => k);
  return cap(`expected: ${claim}${missing.length ? ` (not on the page: ${missing.join(", ")})` : ""}`);
}

const ICON = { passed: "✅", failed: "❌", broken: "💥", interrupted: "⏹️" };
export const iconOf = (status) => ICON[status] ?? "❔";

/** "step 6: message" for a member that didn't pass, else null. */
export function failureText(m) {
  if (!m?.failure) return null;
  const step = typeof m.failure.step_index === "number" ? `step ${m.failure.step_index}: ` : "";
  return `${step}${m.failure.message}`.trim() || null;
}

const label = (r) => [r.test, r.title].filter(Boolean).join(" ");

/** One progress line per selected test: done members with their result, started ones running, the rest waiting. */
export function progressLines(rows, members, started = new Set()) {
  return rows.map((r) => {
    const m = members.get(r.path);
    if (!m) return started.has(r.path) ? `🔄 ${label(r)} · running` : `⏳ ${label(r)} · waiting`;
    const dur = m.duration_s != null ? ` · ${Math.round(m.duration_s)} s` : "";
    const fail = failureText(m);
    return `${iconOf(m.status)} ${label(r)} · ${m.status}${dur}${fail ? ` · ${fail}` : ""}`;
  });
}

/** The `kane-cli / tests` conclusion: neutral when nothing ran, failure on any non-pass or a run error. */
export function testsConclusion(run) {
  if (!run) return "neutral";
  if (run.error) return "failure";
  const all = [...(run.members?.values() ?? [])];
  if (all.length === 0) return "neutral";
  return all.every((m) => m.status === "passed") ? "success" : "failure";
}

/** The `kane-cli / policy` conclusion: only pass is success. */
export const policyConclusion = (verdict) => (verdict?.result === "pass" ? "success" : "failure");

/** The comment's policy line; null when no policy is configured. */
export function policyNote({ configured, supported, verdict }) {
  if (!configured) return null;
  if (!supported) return "policy: not available yet";
  if (!verdict) return "Policy: ⚠️ no verdict came back";
  if (verdict.error || !Array.isArray(verdict.policies) || verdict.policies.length === 0) return `Policy: ⚠️ ${verdict.result ?? "errored"}${verdict.error ? ` · ${verdict.error}` : ""}`;
  return verdict.policies
    .map((p) => {
      if (p.result === "pass") return `Policy ${p.id}: ✅ pass`;
      if (p.result === "fail") return `Policy ${p.id}: ❌ fail · failed gates: ${(p.failed_gate_ids ?? []).join(", ") || "none named"}`;
      const why = p.error?.message ?? (p.errored_gate_ids?.length ? `errored gates: ${p.errored_gate_ids.join(", ")}` : "");
      return `Policy ${p.id}: ⚠️ errored${why ? ` · ${why}` : ""}`;
    })
    .join(" · ");
}
