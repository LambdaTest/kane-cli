#!/usr/bin/env node
// Reads a kane-cli NDJSON stream and turns it into results-table rows plus a
// key=value summary for the action's shell step.
//
//   node parse-stream.js --stream <file> --rc <exit code> --label <label> --results <results.md>
//
// Handles three stream shapes:
//   kane-cli run          -> terminal run_end
//   kane-cli testmd run   -> one run_end per step, terminal test_md_done
//   kane-cli testrun run  -> testrun_plan, testrun_member_end / testrun_authored_member_end,
//                            testrun_summary, testrun_done
//
// Appends one row per test to the results file and prints to stdout:
//   status=, total=, failed=, duration=, link=, summary=, detail=
"use strict";
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) { out[a.slice(2)] = argv[i + 1]; i += 1; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const rc = Number(args.rc || 0);
const label = args.label || "test";
const events = [];
let raw = "";
try { raw = fs.readFileSync(args.stream, "utf8"); } catch (e) { raw = ""; }
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  try { const o = JSON.parse(line); if (o && typeof o === "object") events.push(o); } catch (e) { /* not JSON */ }
}

const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const num = (v) => (v == null || v === "" || isNaN(Number(v))) ? "" : Number(v).toFixed(1);
const last = (type) => { for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].type === type) return events[i]; return null; };
const icon = (ok) => (ok ? ":white_check_mark:" : ":x:");
const row = (name, ok, status, duration, details) =>
  `| \`${clean(name)}\` | ${icon(ok)} ${clean(status)} | ${duration ? duration + "s" : "?s"} | ${details || "-"} |`;
const cwdPrefix = process.cwd() + path.sep;
const display = (p) => {
  const s = String(p || "");
  return s.startsWith(cwdPrefix) ? s.slice(cwdPrefix.length) : s;
};
const samePath = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith("/" + b) || b.endsWith("/" + a);
};

const rows = [];
let status = "";
let total = 0;
let passed = 0;
let duration = "";
let link = "";
let detail = "";

const isTestrun = events.some((e) => typeof e.type === "string" && e.type.startsWith("testrun_"));

if (isTestrun) {
  const plan = last("testrun_plan");
  const done = last("testrun_done");
  const sum = last("testrun_summary");
  const ends = events.filter((e) => e.type === "testrun_member_end" || e.type === "testrun_authored_member_end");
  const members = plan && Array.isArray(plan.members) ? plan.members : [];

  if (plan && plan.valid === false) {
    for (const m of members) {
      const why = m.failure ? `rejected (${clean(m.failure)})` : "not run";
      rows.push(row(display(m.path), false, why, "", "-"));
    }
    status = "invalid plan";
    total = members.length;
    detail = "the suite plan is invalid, nothing ran";
  } else {
    const cancelled = !!(sum && sum.cancelled) || (done && done.overall_status === "cancelled");
    const used = new Set();
    for (const m of members) {
      const end = ends.find((e) => samePath(e.path, m.path));
      const st = end ? end.status : (cancelled ? "cancelled" : "not run");
      const ok = !!end && end.status === "passed";
      rows.push(row(display(m.path), ok, st, end ? num(end.duration_s) : "", "-"));
      if (end) used.add(end);
      if (ok) passed += 1;
    }
    for (const end of ends) {
      if (used.has(end)) continue;
      const ok = end.status === "passed";
      rows.push(row(display(end.path), ok, end.status, num(end.duration_s), "-"));
      if (ok) passed += 1;
    }
    total = rows.length;
    const notes = [];
    if (sum) {
      if (sum.totals) {
        if (Number.isFinite(Number(sum.totals.tests))) total = Number(sum.totals.tests);
        if (Number.isFinite(Number(sum.totals.passed))) passed = Number(sum.totals.passed);
        if (Number(sum.totals.broken)) notes.push(`${sum.totals.broken} broken`);
        if (Number(sum.totals.skipped)) notes.push(`${sum.totals.skipped} skipped`);
        if (Number(sum.totals.authored)) notes.push(`${sum.totals.authored} authored on this run`);
      }
      duration = num(sum.duration_s);
      if (sum.upload && sum.upload !== "ok") notes.push(`evidence upload ${sum.upload}`);
      if (sum.execution && sum.execution.id) notes.push(`execution ${sum.execution.id}`);
    }
    if (cancelled) notes.push("cancelled before every member finished");
    status = done ? done.overall_status : (sum && sum.execution ? sum.execution.status : "");
    detail = notes.join(", ");
  }
} else {
  const done = last("test_md_done");
  const end = last("run_end");
  if (done) {
    status = done.overall_status;
    duration = num(done.duration_s);
    link = done.share_url || "";
  } else if (end) {
    status = end.status;
    duration = num(end.duration);
    link = end.test_url || "";
  }
  detail = end && end.summary ? clean(end.summary) : "";
  total = 1;
}

// Fold the process exit code in. It wins over anything the stream said.
switch (rc) {
  case 0: status = status || "unknown"; break;
  case 1: status = status || "failed"; break;
  case 2: status = status === "invalid plan" ? status : "error"; break;
  case 3: status = isTestrun ? "cancelled" : "timeout"; break;
  default: status = `exit ${rc}`;
}
const ok = rc === 0 && status === "passed";
if (!isTestrun) passed = ok ? 1 : 0;
if (total === 0) total = 1;
const failed = isTestrun ? Math.max(total - passed, 0) : (ok ? 0 : 1);
if (!isTestrun) {
  rows.length = 0;
  rows.push(row(label, ok, status, duration, link ? `[open](${link})` : "-"));
} else if (rows.length === 0) {
  rows.push(row(label, ok, status, duration, "-"));
}
const summary = `${passed}/${total} tests passed`;

if (args.results) fs.appendFileSync(args.results, rows.join("\n") + "\n");
process.stdout.write([
  `status=${clean(status)}`,
  `total=${total}`,
  `failed=${failed}`,
  `duration=${duration}`,
  `link=${clean(link)}`,
  `summary=${clean(summary)}`,
  `detail=${clean(detail)}`,
].join("\n") + "\n");
