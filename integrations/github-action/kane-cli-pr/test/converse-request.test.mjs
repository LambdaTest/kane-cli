import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, trimDiff } from "../src/converse-request.mjs";
import { emptyState, addTurns } from "../src/state.mjs";

const fileDiff = (path, size) => {
  const head = `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n`;
  return head + ("+" + "x".repeat(99) + "\n").repeat(Math.ceil((size - head.length) / 101));
};
const config = { access: { ask: [], run: [] }, policies: ["checkout"], policyPaths: {}, autoContinue: false };
const base = {
  event: "comment",
  words: "why would this break checkout?",
  author: { login: "octocat", association: "OWNER" },
  may: ["ask", "run"],
  pr: { number: 1, title: "Gift wrap", body: "Adds gift wrap.", draft: false, head_sha: "abc", changed_files: ["src/cart/pricing.js"] },
  diff: fileDiff("src/cart/pricing.js", 500),
  line: null,
  state: null,
  config,
};

test("the request matches the endpoint contract", () => {
  const r = buildRequest(base);
  assert.deepEqual(Object.keys(r), ["version", "event", "text", "author", "pr", "line", "conversation", "state", "config"]);
  assert.equal(r.version, 1);
  assert.equal(r.text, "why would this break checkout?");
  assert.deepEqual(r.author, { login: "octocat", association: "OWNER", may: ["ask", "run"] });
  assert.deepEqual(Object.keys(r.pr), ["number", "title", "body", "draft", "changed_files", "diff"]);
  assert.deepEqual(r.state, { head_sha_matches: true, last_action: null, impacted: [], results: null, pending_question: null });
  assert.deepEqual(r.config, { policies: ["checkout"], auto_continue: false, dry_run: true });
  assert.deepEqual(r.conversation, []);
  assert.equal(r.line, null);
});

test("a 9k description is cut to 8k and says so", () => {
  const r = buildRequest({ ...base, pr: { ...base.pr, body: "d".repeat(9000) } });
  assert.ok(r.pr.body.startsWith("d".repeat(8000)));
  assert.ok(!r.pr.body.startsWith("d".repeat(8001)));
  assert.ok(r.pr.body.endsWith("[description truncated]"));
  assert.equal(buildRequest({ ...base, pr: { ...base.pr, body: null } }).pr.body, "");
});

test("a 30k diff is cut to at most 20k and says so", () => {
  const diff = ["a.js", "b.js", "c.js"].map((p) => fileDiff(p, 10_000)).join("");
  assert.ok(diff.length >= 30_000);
  const r = buildRequest({ ...base, diff });
  assert.ok(r.pr.diff.length <= 20_000, String(r.pr.diff.length));
  assert.ok(r.pr.diff.endsWith("[diff truncated]"));
  assert.match(r.pr.diff, /^diff --git a\/a\.js/);
});

test("one file larger than the cap is cut, not dropped", () => {
  const r = buildRequest({ ...base, diff: fileDiff("big.js", 30_000) });
  assert.ok(r.pr.diff.length <= 20_000);
  assert.match(r.pr.diff, /^diff --git a\/big\.js/);
  assert.ok(r.pr.diff.endsWith("[diff truncated]"));
});

test("lockfiles, build output and binaries are dropped before the cap", () => {
  const binary = "diff --git a/logo.bin b/logo.bin\nBinary files a/logo.bin and b/logo.bin differ\n";
  const diff = fileDiff("package-lock.json", 15_000) + fileDiff("src/app.js", 300) + fileDiff("dist/app.js", 300) + binary + fileDiff("web/yarn.lock", 300);
  const r = buildRequest({ ...base, diff });
  assert.doesNotMatch(r.pr.diff, /package-lock\.json|dist\/app\.js|logo\.bin|yarn\.lock/);
  assert.match(r.pr.diff, /src\/app\.js/);
  assert.doesNotMatch(r.pr.diff, /\[diff truncated\]/);
  assert.deepEqual(trimDiff(diff).omitted, ["package-lock.json", "dist/app.js", "logo.bin", "web/yarn.lock"]);
});

test("conversation and state come from kane's saved state", () => {
  let s = { ...emptyState("old"), last_action: "impact", impacted: [{ test: "t", why: "w" }], pending_question: "which policy?" };
  for (let i = 0; i < 7; i++) s = addTurns(s, "OWNER", `q${i}`, `a${i}`);
  s = { ...s, turns: [...s.turns.slice(1), { who: "OWNER", said: "y".repeat(700) }] };
  const r = buildRequest({ ...base, event: "review_comment", line: { path: "src/cart/pricing.js", line: 12 }, state: s });
  assert.equal(r.event, "review_comment");
  assert.deepEqual(r.line, { path: "src/cart/pricing.js", line: 12 });
  assert.equal(r.conversation.length, 10);
  assert.equal(r.conversation.at(-1).said.length, 600);
  assert.deepEqual(r.state, { head_sha_matches: false, last_action: "impact", impacted: [{ test: "t", why: "w" }], results: null, pending_question: "which policy?" });
});
