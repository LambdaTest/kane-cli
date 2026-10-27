// Snapshots of the approved final comment (the design reference),
// rendered from run data. SNAPSHOT_UPDATE=1 rewrites them; review the diff before committing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderRunReport, badge, HEADER, MAX_SQUARES } from "../src/final.mjs";
import { renderComment } from "../src/render.mjs";
import { emptyState } from "../src/state.mjs";

const dir = join(import.meta.dirname, "snapshots");
function snapshot(name, text) {
  const file = join(dir, `${name}.md`);
  if (process.env.SNAPSHOT_UPDATE === "1" || !existsSync(file)) writeFileSync(file, text);
  assert.equal(text, readFileSync(file, "utf8"), `${name}.md differs (SNAPSHOT_UPDATE=1 to accept)`);
}

const PROMO = { id: "uc-1", title: "Apply a promo code to a cart" };
const ORDER = { id: "uc-2", title: "Place an order" };
const row = (test, title, uc, extra = {}) => ({ test, title, why: "w", path: `.testmuai/tests/${test}_test.md`, new: false, use_cases: uc ? [uc] : [], ...extra });
const ROWS = [
  row("t-1", "Apply SPRING2026 without changing free shipping", PROMO),
  row("t-2", "Apply SPRING2026 without changing paid shipping", PROMO),
  row("t-3", "Checkout below the threshold keeps $5 shipping", ORDER),
  row("t-4", "Checkout at the $50 threshold keeps free shipping", ORDER),
];
const failed = (test, note) => ({ test, verdict: "failed", note, duration_s: 30 });
const passed = (test, s = 41) => ({ test, verdict: "passed", note: `${s} s`, duration_s: s });
const FAILING = [
  failed("t-1", "discount −$13.00 instead of −$12.00 · total $52.00 instead of $48.00"),
  failed("t-2", "discount −$10.00 instead of −$9.00 · shipping $0.00 instead of $5.00"),
  failed("t-3", "shipping $0.00 instead of $5.00"),
  failed("t-4", "confirmation $50.00, but the cart charged $55.00"),
];
const POLICY = { configured: true, supported: true, missing: false, path: ".github/kane/checkout-policy.yaml" };
const YAML = "policy: checkout-pr\ngates:\n  - { id: all-pass, metric: totals.failed, equals: 0, severity: blocking }\n  - { id: no-heals, metric: metrics.heal.healed_tests, max: 0, severity: warning }\n";
const gates = (allPass) => [
  { id: "all-pass", metric: "totals.failed", op: "equals", expected: 0, actual: allPass ? 0 : 4, severity: "blocking", status: allPass ? "pass" : "fail", message: "All tests pass" },
  { id: "checkout-green", metric: "pass_rate", op: "min", expected: 1, actual: allPass ? 1 : 0, severity: "blocking", status: allPass ? "pass" : "fail", message: "Checkout tests green" },
  { id: "checks-present", metric: "metrics.tests_without_checks", op: "equals", expected: 0, actual: 0, severity: "blocking", status: "pass", message: "Every test has a check" },
  { id: "no-heals", metric: "metrics.heal.healed_tests", op: "max", expected: 0, actual: 0, severity: "warning", status: "pass", message: "No healed tests" },
];
const verdict = (result, failedIds = []) => ({ result, policies: [{ id: "checkout-pr", result, failed_gate_ids: failedIds, errored_gate_ids: [], counts: { total: 4 } }] });
const base = {
  rows: ROWS,
  ran: true,
  files: ["src/cart/pricing.js", "public/cart.html"],
  evidence: { path: "/w/pr/.testmuai/evidence/e.evidence", repo: "octo-org/shop", artifactId: "12704118114" },
  repo: "octo-org/shop",
  defaultBranch: "main",
  sha: "e9e1bf7a0c",
  durationS: 125,
  runUrl: "https://github.com/octo-org/shop/actions/runs/1",
  mention: "@kane-cli",
};

/** The whole comment, as the report step posts it. */
const full = (data, reply = "**Yes — this PR breaks checkout.** Every test that reads the subtotal fails.") =>
  renderComment({ asker: "octocat", latest: { asked: "does this break checkout?", reply }, picture: "p", state: emptyState("e9e1bf7"), report: renderRunReport(data) }).split("\n<!-- kane-cli:pr-chat -->")[0];

test("snapshot: a failing run, policy failed (the reference)", () => {
  const md = full({ ...base, results: FAILING, policy: POLICY, verdict: verdict("fail", ["all-pass", "checkout-green"]), policyDoc: { id: "checkout-pr", yaml: YAML, gates: gates(false) } });
  snapshot("failing-policy-failed", md);
  assert.ok(md.startsWith(`${HEADER}\n\n**You asked**\n> does this break checkout?\n\n@octocat **Yes`));
  assert.ok(md.includes("![4 failing](https://img.shields.io/badge/failing-4-cf222e?style=for-the-badge) ![policy failed](https://img.shields.io/badge/policy-failed-cf222e?style=for-the-badge)"));
  assert.ok(md.includes("- **🎯 Apply a promo code to a cart** — 🟥🟥 2 of 2 failing"));
  assert.ok(md.includes("**2 of 3 blocking gates failed** → merge is blocked by the `kane-cli / policy` check"));
  assert.ok(md.includes("| ✅ | No healed tests *(warning)* | 0 | 0 |"));
  assert.ok(md.includes("| ❌ | Checkout tests green | 100 % | 0 % |"));
  assert.ok(md.includes("next: `@kane-cli rerun the failed ones` or `@kane-cli why did “Apply SPRING2026 without changing free…” fail?`"));
  assert.doesNotMatch(md, /\(0\.\d+\)/, "no scores");
});

test("snapshot: a passing run, policy passed", () => {
  const md = full({ ...base, results: ROWS.map((r) => passed(r.test)), policy: POLICY, verdict: verdict("pass"), policyDoc: { id: "checkout-pr", yaml: YAML, gates: gates(true) } }, "No — checkout still works: all 4 impacted tests pass.");
  snapshot("passing-policy-passed", md);
  assert.ok(md.includes("![4 passing](https://img.shields.io/badge/passing-4-1a7f37?style=for-the-badge) ![policy passed](https://img.shields.io/badge/policy-passed-1a7f37?style=for-the-badge)"));
  assert.ok(md.includes("### 🛡️ Policy · `checkout-pr` — ✅ passed\n**All blocking gates passed**"));
  assert.ok(md.includes("| ✅ | **Checkout below the threshold keeps $5 shipping** | passed in 41 s |"));
  assert.doesNotMatch(md, /next:/, "nothing to rerun");
});

test("snapshot: policy unavailable (this kane-cli can't evaluate policies)", () => {
  const md = full({ ...base, results: FAILING, policy: { ...POLICY, supported: false }, verdict: null, policyDoc: null });
  snapshot("policy-unavailable", md);
  assert.doesNotMatch(md, /policy-|### 🛡️ Policy|[Nn]ot available yet/, "no badge and no section without a real verdict");
});

test("snapshot: policy not configured → no Policy section, badge n/a", () => {
  const md = full({ ...base, results: FAILING, policy: { configured: false } });
  snapshot("policy-not-configured", md);
  assert.doesNotMatch(md, /### 🛡️ Policy|img\.shields\.io\/badge\/policy-/);
});

test("no verdict file (gates unknown) or an errored verdict → no Policy section and no policy badge", () => {
  for (const [verdictIn, doc] of [[verdict("fail", ["all-pass"]), { id: "checkout-pr", yaml: YAML, gates: [] }], [{ result: "errored", policies: [], error: "the pack did not seal" }, null]]) {
    const md = full({ ...base, results: FAILING, policy: POLICY, verdict: verdictIn, policyDoc: doc });
    assert.doesNotMatch(md, /img\.shields\.io\/badge\/policy-|### 🛡️ Policy/);
  }
});

test("the footer names this workflow run's id, and the evidence line names the artifact", () => {
  const md = full({ ...base, results: FAILING, policy: { configured: false }, runId: "1234567890", evidence: { ...base.evidence, artifactName: "kane-evidence-1234567890-1" } });
  assert.match(md, /<sub>kane-cli · ran on `e9e1bf7` in 2 m 05 s · run 1234567890 · \[run log\]/);
  assert.ok(md.includes("Screenshots, network and console for every step of all 4 tests · kept 30 days · artifact `kane-evidence-1234567890-1`"));
});

test("snapshot: no evidence pack", () => {
  const md = full({ ...base, results: FAILING, evidence: { path: null, repo: base.repo, artifactId: null }, policy: { configured: false } });
  snapshot("no-evidence", md);
  assert.ok(md.includes("### 🧾 Evidence\nNo evidence pack was produced for this run."));
});

test("snapshot: 50 tests under 8 requirements, squares capped at 10 then +n, and new tests counted", () => {
  const ucs = Array.from({ length: 8 }, (_, i) => ({ id: `uc-${i + 1}`, title: `Requirement ${i + 1}` }));
  const rows = Array.from({ length: 50 }, (_, i) => row(`t-${i + 1}`, `Test ${i + 1}`, i < 22 ? ucs[0] : ucs[1 + (i % 7)], { new: i % 10 === 0 }));
  rows.push(row("t-99", "Unfiled test", null));
  const results = rows.map((r, i) => (i % 3 === 0 ? failed(r.test, `value ${i}`) : i % 7 === 0 ? { test: r.test, verdict: "not_run", note: "no result came back", duration_s: null } : passed(r.test, 10)));
  const md = full({ ...base, rows, results, files: ["a.js", "b.js", "c.js", "d.js", "e.js", "f.js"], policy: { configured: false } }, "Mixed results.");
  snapshot("fifty-tests-eight-requirements", md);
  const first = md.split("\n").find((l) => l.startsWith("- **🎯 Requirement 1**"));
  assert.equal([...first.matchAll(/🟥|🟩|⬜/g)].length, MAX_SQUARES);
  assert.match(first, / \+12 \d+ of 22 failing$/);
  assert.match(md, /the change touches 8 requirements/);
  assert.ok(md.includes("This PR changes `a.js`, `b.js`, `c.js`, `d.js` +2 more."));
  assert.ok(md.includes("- **Other matches**"));
  assert.match(md, /46 tests already exist on `main`, so they count as impacted; 5 are new in this PR\./);
});

test("a non-run answer keeps the header, You asked and @asker + reply, without badges or sections", () => {
  const md = renderComment({ asker: "octocat", latest: { asked: "help", reply: "I can check impact." }, picture: null, state: emptyState() });
  assert.ok(md.startsWith(`${HEADER}\n\n**You asked**\n> help\n\n@octocat I can check impact.`));
  assert.doesNotMatch(md, /img\.shields\.io|<details>|### /);
});

test("badge labels and values are URL-encoded, with shields' dashes and underscores doubled", () => {
  assert.equal(badge("new in PR", "a-b_c", "6e7781", "x"), "![x](https://img.shields.io/badge/new%20in%20PR-a--b__c-6e7781?style=for-the-badge)");
});

test("the fileless note: plural, singular, and absent at zero", () => {
  const md = (fileless) => renderRunReport({ ...base, results: FAILING, policy: { configured: false }, fileless });
  assert.ok(md(3).includes("<sub>3 more matched tests aren't in this repository, so they weren't run.</sub>\n</details>"));
  assert.ok(md(1).includes("<sub>1 more matched test isn't in this repository, so it wasn't run.</sub>"));
  assert.doesNotMatch(md(0), /in this repository/);
});

test("a healed test shows a healed badge and says so on its row", async () => {
  const { badges, testsSection } = await import("../src/final.mjs");
  const rows = [{ test: "t-1", path: "a_test.md", new: false }, { test: "t-2", path: "b_test.md", new: false }];
  const results = [{ test: "t-1", verdict: "passed", duration_s: 60, healed: true }, { test: "t-2", verdict: "failed", note: "step 6: discount", healed: true }];
  const b = badges({ rows, results, ran: true });
  assert.match(b, /healed-2-bc4c00/);
  const s = testsSection(rows, results);
  assert.match(s, /passed in .*🩹 healed/);
  assert.match(s, /heal tried, still failing/);
  const none = badges({ rows, results: results.map((r) => ({ ...r, healed: false })), ran: true });
  assert.doesNotMatch(none, /healed/);
});

test("Why these tests shows the judge's reason under a test, and nothing for a test without one", async () => {
  const { whySection } = await import("../src/final.mjs");
  const rows = [
    { test: "t-1", title: "Checkout at $50", path: "a_test.md", new: false, use_cases: [{ id: "uc-3", title: "Place an order" }], reason: "At $50 with a $10 promo, shipping becomes $5 instead of $0." },
    { test: "t-2", title: "Below threshold", path: "b_test.md", new: false, use_cases: [{ id: "uc-3", title: "Place an order" }] },
  ];
  const s = whySection({ rows, results: [], ran: false, files: [] });
  assert.match(s, /Checkout at \$50.* — <i>At \$50 with a \$10 promo, shipping becomes \$5 instead of \$0\.<\/i>/);
  assert.doesNotMatch(s, /Below threshold.*<i>/);
});
