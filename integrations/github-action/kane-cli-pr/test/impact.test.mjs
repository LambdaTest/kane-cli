import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kaneRunner } from "../src/kane.mjs";
import { runImpact, parseImpact, whyOf, headline, splitByBase, existsAt } from "../src/impact.mjs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { prCheckout, kaneScenario, kaneCalls, KANE_CMD, FIXTURES } from "./helpers.mjs";
import { splitCommand } from "../src/argv.mjs";

const events = (name) => readFileSync(join(FIXTURES, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

test("parseImpact reads impact_result.tests; an error event becomes the error's message", () => {
  const r = parseImpact(events("impact.ndjson"));
  assert.deepEqual(r.tests.map((t) => t.id), ["t-4", "t-19", "t-9"]);
  assert.throws(() => parseImpact([{ type: "error", code: "IMPACT_LINKED_ONLY", message: "context impact works in a folder linked to a shared project" }, { type: "done", exit: 2 }]), /context impact works in a folder linked/);
  assert.throws(() => parseImpact([]), /no impact_result/);
});

test("why is the engine's own reason: the judge's words, else its matches", () => {
  const [t4, t19] = parseImpact(events("impact.ndjson")).tests;
  assert.equal(whyOf(t19), "pricing.js now adds the wrap fee inside subtotal(), which this test totals");
  assert.equal(whyOf(t4), "similar to uc-1 (0.54)", "without the result, ids stay");
  assert.equal(whyOf(t4, parseImpact(events("impact.ndjson"))), "similar to “Cart” (0.54)");
});

test("impact split: a test on the base commit is impacted, one added by the PR is new; headline counts", async () => {
  const pr = prCheckout();
  const fake = kaneScenario();
  const kane = kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: fake } });
  const rows = await runImpact({ kane, cwd: pr.dir, baseSha: pr.baseSha, diff: "diff --git a/x b/x\n+gift\n", judge: false });
  assert.deepEqual(
    rows.map((r) => [r.test, r.new, r.path]),
    [
      ["t-4", false, ".testmuai/tests/open-cart-from-home-banner_test.md"],
      ["t-19", true, ".testmuai/tests/apply-gift-wrap_test.md"],
      ["t-9", null, null],
    ],
  );
  assert.equal(headline({ impacted: rows }), "1 impacted · 1 new in this PR");
  assert.equal(headline({ impacted: rows, results: [{ test: "t-4", verdict: "passed" }, { test: "t-19", verdict: "failed" }] }), "1 impacted · 1 new in this PR · 1 failing");

  const [call] = kaneCalls(fake);
  assert.deepEqual(call.argv.slice(0, 2), ["context", "impact"]);
  assert.equal(call.argv[call.argv.indexOf("--mode") + 1], "agent");
  assert.ok(call.argv.includes("--no-judge"), "judge off → --no-judge");
  assert.equal(call.cwd, pr.dir);
  assert.equal(readFileSync(join(fake, "impact-input.diff"), "utf8"), "diff --git a/x b/x\n+gift\n", "the diff file is the PR's diff");
});

test("impact.judge true drops --no-judge", async () => {
  const pr = prCheckout();
  const fake = kaneScenario();
  const kane = kaneRunner({ cmd: splitCommand(KANE_CMD), env: { ...process.env, FAKE_KANE_DIR: fake } });
  await runImpact({ kane, cwd: pr.dir, baseSha: pr.baseSha, diff: "d", judge: true });
  assert.ok(!kaneCalls(fake)[0].argv.includes("--no-judge"));
});

test("fix 8: only failed, broken and interrupted count as failing; not_run is shown on its own", () => {
  const rows = [{ new: false }, { new: true }];
  assert.equal(headline({ impacted: rows, results: [{ verdict: "passed" }, { verdict: "not_run" }] }), "1 impacted · 1 new in this PR · 0 failing · 1 not run");
  assert.equal(headline({ impacted: rows, results: [{ verdict: "broken" }, { verdict: "interrupted" }, { verdict: "failed" }] }), "1 impacted · 1 new in this PR · 3 failing");
});

test("fix 10: impact paths are normalised to the checkout root before git; an absolute or ./ path still splits", async () => {
  const pr = prCheckout();
  const rows = await splitByBase(
    [
      { test: "a", path: "./.testmuai/tests/open-cart-from-home-banner_test.md" },
      { test: "b", path: join(pr.dir, ".testmuai/tests/apply-gift-wrap_test.md") },
      { test: "c", path: "../outside_test.md" },
    ],
    { cwd: pr.dir, baseSha: pr.baseSha },
  );
  assert.deepEqual(rows.map((r) => [r.path, r.new]), [
    [".testmuai/tests/open-cart-from-home-banner_test.md", false],
    [".testmuai/tests/apply-gift-wrap_test.md", true],
    [null, null],
  ]);
});

test("fix 10: a git error other than 'not found' is a PipelineError, never 'new'", async () => {
  const notRepo = mkdtempSync(join(tmpdir(), "kane-norepo-"));
  await assert.rejects(existsAt(notRepo, "HEAD", "x_test.md"), (e) => e.name === "PipelineError" && /couldn't read the base commit/.test(e.message));
});

// --- demo polish: names, not ids, in Why --------------------------------------------------------

test("why names the use case (or test) a reason matched, deduped to its best score", () => {
  const result = {
    use_cases: [{ id: "uc-2", title: "Promo applies to merchandise only", score: 0.33, units: ["u1"] }],
    tests: [{ id: "t-7", title: "Checkout total", use_cases: ["uc-2"], reasons: [] }],
  };
  const t = { id: "t-7", title: "Checkout total", use_cases: ["uc-2"], judged_reason: null, reasons: [
    { unit: "u1", via: "similar", matched: "uc-2", score: 0.33 },
    { unit: "u2", via: "similar", matched: "ac-9", score: 0.2 },
    { unit: "u3", via: "similar", matched: "ac-9", score: 0.17 },
    { unit: "u4", via: "direct", matched: "t-7", score: 1 },
  ] };
  assert.equal(whyOf(t, result), "names “Checkout total” (1.00); similar to “Promo applies to merchandise only” (0.33)");
});

test("an unnamed criterion falls back to its test's use case title, and an id stays only when nothing is named", () => {
  const result = { use_cases: [{ id: "uc-1", title: "Cart", score: 0.5, units: [] }], tests: [] };
  assert.equal(whyOf({ id: "t-1", use_cases: ["uc-1"], reasons: [{ via: "similar", matched: "ac-9", score: 0.2 }, { via: "similar", matched: "ac-9", score: 0.17 }] }, result), "similar to “Cart” (0.20)");
  assert.equal(whyOf({ id: "t-1", use_cases: [], reasons: [{ via: "similar", matched: "sc-3", score: 0.2 }] }, result), "similar to sc-3 (0.20)");
});

test("contract v2: tests come from run[], the reason is t.reason, the use case is one object, and the base url reaches only impact", async () => {
  const { parseImpact, whyOf } = await import("../src/impact.mjs");
  const v2 = { type: "impact_result", v: 2, run: [{ id: "t-1", title: "Checkout", path: null, reason: "the diff moves shipping onto the discounted amount", confidence: "high", test_case: "TC-1", use_case: { id: "uc-3", title: "Place an order" } }], not_affected: [] };
  const r = parseImpact([v2]);
  assert.equal(r.tests.length, 1);
  assert.equal(whyOf(r.tests[0], r), "the diff moves shipping onto the discounted amount");
  assert.equal(parseImpact([{ type: "impact_result", tests: [{ id: "t-2" }] }]).tests.length, 1, "v1 still reads");
});
