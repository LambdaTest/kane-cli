import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { kaneRunner } from "../src/kane.mjs";
import { testrunArgs, runTestrun, progressLines, testsConclusion, policyNote, policyConclusion, supportsPolicy, failureReason } from "../src/testrun.mjs";
import { mkdtempSync, writeFileSync, readFileSync as readFile } from "node:fs";
import { tmpdir } from "node:os";
import { FIXTURES } from "./helpers.mjs";
import { prCheckout, kaneScenario, kaneCalls, KANE_CMD } from "./helpers.mjs";
import { splitCommand } from "../src/argv.mjs";

const PATHS = [".testmuai/tests/open-cart-from-home-banner_test.md", ".testmuai/tests/apply-gift-wrap_test.md"];

test("heal default (false) adds --no-adaptive-heal; heal true omits it", () => {
  const off = testrunArgs({ paths: PATHS, heal: false });
  assert.deepEqual(off, ["testrun", "run", ...PATHS, "--headless", "--parallel", "2", "--no-adaptive-heal", "--agent"]);
  assert.ok(!testrunArgs({ paths: PATHS, heal: true }).includes("--no-adaptive-heal"));
});

test("--override-start-url and --policy are passed only when given", () => {
  const a = testrunArgs({ paths: PATHS, heal: false, url: "http://127.0.0.1:3000", policy: "/ws/.github/kane/checkout-policy.yaml" });
  assert.equal(a[a.indexOf("--override-start-url") + 1], "http://127.0.0.1:3000");
  assert.equal(a[a.indexOf("--policy") + 1], "/ws/.github/kane/checkout-policy.yaml");
  const b = testrunArgs({ paths: PATHS, heal: false });
  assert.ok(!b.includes("--override-start-url") && !b.includes("--policy"));
});

test("policy support is read from testrun run --help", async () => {
  for (const policy of [true, false]) {
    const fake = kaneScenario({ policy });
    const kane = kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: fake } });
    assert.equal(await supportsPolicy(kane, process.cwd()), policy);
    assert.deepEqual(kaneCalls(fake)[0].argv, ["testrun", "run", "--help"]);
  }
});

test("runTestrun: onMember on every member start and end, relative paths, the NDJSON on disk, the pack path, the verdict", async () => {
  const pr = prCheckout();
  const fake = kaneScenario();
  const kane = kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: fake } });
  const seen = [];
  const out = join(pr.dir, "..", `run-${Date.now()}.ndjson`);
  const r = await runTestrun({ kane, cwd: pr.dir, args: testrunArgs({ paths: PATHS, heal: false }), outFile: out, onMember: (m, started) => seen.push([[...m.values()].map((x) => x.status), started.size]) });
  // a call on every member start (🔄 running) and end
  assert.deepEqual(seen, [[[], 1], [["passed"], 1], [["passed"], 2], [["passed", "failed"], 2]]);
  assert.deepEqual([...r.members.keys()], PATHS, "absolute member paths are made relative to the checkout");
  const fail = r.members.get(PATHS[1]);
  assert.deepEqual(fail.failure, { message: "discount −$10.00, expected −$9.00", step_index: 6 });
  assert.equal(fail.authored, true);
  assert.equal(r.summary.totals.failed, 1);
  assert.equal(r.done.overall_status, "failed");
  assert.equal(r.verdict.result, "fail");
  assert.equal(r.evidencePath, join(pr.dir, ".testmuai/evidence/exec-123.evidence"));
  assert.ok(existsSync(out));
  assert.equal(r.code, 1);
});

test("the pack path falls back to .testmuai/evidence/<execution_id>.evidence, and is null when no pack exists", async () => {
  const pr = prCheckout();
  const kane = (extra) => kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: kaneScenario({ extra }) } });
  const noCoverage = (await import("node:fs")).readFileSync(join(import.meta.dirname, "fixtures/testrun.ndjson"), "utf8").split("\n").filter((l) => !l.includes('"coverage","status"')).join("\n");
  const r1 = await runTestrun({ kane: kane({ "testrun.ndjson": noCoverage }), cwd: pr.dir, args: testrunArgs({ paths: PATHS, heal: false }) });
  assert.equal(r1.evidencePath, join(pr.dir, ".testmuai/evidence/exec-123.evidence"));
  const pr2 = prCheckout();
  const r2 = await runTestrun({ kane: kane({ "no-pack": "1", "testrun.ndjson": noCoverage }), cwd: pr2.dir, args: testrunArgs({ paths: PATHS, heal: false }) });
  assert.equal(r2.evidencePath, null);
});

test("progress lines: one per test, with status, duration, failing step and message", () => {
  const members = new Map([
    [PATHS[0], { path: PATHS[0], status: "passed", duration_s: 41 }],
    [PATHS[1], { path: PATHS[1], status: "failed", duration_s: 97, failure: { message: "discount −$10.00, expected −$9.00", step_index: 6 } }],
  ]);
  const rows = [
    { test: "t-4", title: "Open cart from home banner", path: PATHS[0] },
    { test: "t-19", title: "Apply gift wrap at checkout", path: PATHS[1] },
    { test: "t-7", title: "Waiting one", path: ".testmuai/tests/w_test.md" },
  ];
  assert.deepEqual(progressLines(rows, members), [
    "✅ t-4 Open cart from home banner · passed · 41 s",
    "❌ t-19 Apply gift wrap at checkout · failed · 97 s · step 6: discount −$10.00, expected −$9.00",
    "⏳ t-7 Waiting one · waiting",
  ]);
});

test("tests conclusion: success when all passed, failure on any other status or an error, neutral when nothing ran", () => {
  const m = (...s) => new Map(s.map((status, i) => [String(i), { status }]));
  assert.equal(testsConclusion({ members: m("passed", "passed") }), "success");
  assert.equal(testsConclusion({ members: m("passed", "failed") }), "failure");
  assert.equal(testsConclusion({ members: m("broken") }), "failure");
  assert.equal(testsConclusion({ members: m() }), "neutral");
  assert.equal(testsConclusion(null), "neutral");
  assert.equal(testsConclusion({ members: m("passed"), error: "boom" }), "failure");
});

test("policy note and conclusion: pass, fail with gates, errored, unsupported, not configured", () => {
  const pass = { result: "pass", policies: [{ id: "checkout-pr", result: "pass", failed_gate_ids: [], errored_gate_ids: [] }] };
  const fail = { result: "fail", policies: [{ id: "checkout-pr", result: "fail", failed_gate_ids: ["all-pass", "no-heals"], errored_gate_ids: [] }] };
  const errored = { result: "errored", policies: [], error: "the pack did not seal" };
  assert.equal(policyNote({ configured: true, supported: true, verdict: pass }), "Policy checkout-pr: ✅ pass");
  assert.equal(policyNote({ configured: true, supported: true, verdict: fail }), "Policy checkout-pr: ❌ fail · failed gates: all-pass, no-heals");
  assert.equal(policyNote({ configured: true, supported: true, verdict: errored }), "Policy: ⚠️ errored · the pack did not seal");
  assert.equal(policyNote({ configured: true, supported: false }), "policy: not available yet");
  assert.equal(policyNote({ configured: false }), null);
  assert.equal(policyNote({ configured: true, supported: true, verdict: null }), "Policy: ⚠️ no verdict came back");
  assert.equal(policyConclusion(pass), "success");
  assert.equal(policyConclusion(fail), "failure");
  assert.equal(policyConclusion(errored), "failure");
  assert.equal(policyConclusion(null), "failure");
});

// --- demo polish: the failing step's human reason from the member's own log ---------------------

function memberLog(runDir) {
  const dir = mkdtempSync(join(tmpdir(), "kane-member-"));
  const file = join(dir, "events.ndjson");
  writeFileSync(file, readFile(join(FIXTURES, "member-fail.ndjson"), "utf8").replaceAll("${RUNDIR}", runDir));
  return file;
}

test("failureReason: a visual assertion gives its claim and what wasn't on the page, capped at 160", async () => {
  const r = await failureReason(memberLog(join(FIXTURES, "member-run")));
  assert.equal(r, "expected: the cart shows a merchandise subtotal, a discount amount, a shipping amount of $5, a total, and a Checkout action. (not on the page: shipping_amount)");
  const long = memberLog(join(FIXTURES, "member-run"));
  writeFileSync(long, readFile(long, "utf8").replace("and a Checkout action.", "and a Checkout action, ".repeat(10)));
  const capped = await failureReason(long);
  assert.equal(capped.length, 160);
  assert.ok(capped.endsWith("…"));
});

test("failureReason: a deterministic check gives expected vs actual", async () => {
  assert.equal(await failureReason(memberLog(join(FIXTURES, "member-run-values"))), "discount amount **-$10.00** instead of -$9.00");
});

test("failureReason: no log or nothing useful → null", async () => {
  assert.equal(await failureReason(null), null);
  assert.equal(await failureReason("/nope/events.ndjson"), null);
});

test("a generic 'assertion_failed: @ step 7' member message is replaced by the log's reason; a human one is kept", async () => {
  const pr = prCheckout();
  const log = memberLog(join(FIXTURES, "member-run-values"));
  const text = readFile(join(FIXTURES, "testrun.ndjson"), "utf8").replace('"log_path":"/tmp/s2/events.ndjson","failure":{"message":"discount −$10.00, expected −$9.00","step_index":6}', `"log_path":${JSON.stringify(log)},"failure":{"message":"assertion_failed: @ step 7","step_index":2}`);
  const fake = kaneScenario({ extra: { "testrun.ndjson": text } });
  const kane = kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: fake } });
  const r = await runTestrun({ kane, cwd: pr.dir, args: testrunArgs({ paths: PATHS, heal: false }) });
  assert.deepEqual(r.members.get(PATHS[1]).failure, { message: "discount amount **-$10.00** instead of -$9.00", step_index: 2 });
  const kept = await runTestrun({ kane: kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: kaneScenario() } }), cwd: prCheckout().dir, args: testrunArgs({ paths: PATHS, heal: false }) });
  assert.equal(kept.members.get(PATHS[1]).failure.message, "discount −$10.00, expected −$9.00");
});

test("healedFrom: a member log with adaptive heal says healed; one without does not", async () => {
  const { healedFrom } = await import("../src/testrun.mjs");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "heal-"));
  const healed = join(dir, "a.ndjson");
  await writeFile(healed, [JSON.stringify({ type: "test_md_adaptive_heal", shrink_count: 1 }), JSON.stringify({ type: "test_md_summary", adaptive_heal: { triggered: true } })].join("\n"));
  const summaryOnly = join(dir, "b.ndjson");
  await writeFile(summaryOnly, JSON.stringify({ type: "test_md_summary", adaptive_heal: { triggered: true } }));
  const plain = join(dir, "c.ndjson");
  await writeFile(plain, JSON.stringify({ type: "test_md_summary", adaptive_heal: { triggered: false } }));
  assert.equal(await healedFrom(healed), true);
  assert.equal(await healedFrom(summaryOnly), true);
  assert.equal(await healedFrom(plain), false);
  assert.equal(await healedFrom(join(dir, "missing.ndjson")), false);
  assert.equal(await healedFrom(null), false);
});
