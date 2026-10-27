import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/decide.mjs";
import { emptyState } from "../src/state.mjs";

const state = {
  ...emptyState("abc"),
  impacted: [{ test: "promo applies", why: "reads subtotal()" }],
  results: [{ test: "free shipping", verdict: "failed" }],
};
const opts = { may: ["ask", "run"], policies: ["checkout"], state, dryRun: true };
const answer = (action, args = {}, reply = "ok") => ({ understood: "u", reply, action, args: { tests: null, policy: null, ...args } });

test("a run without run access is refused", () => {
  for (const action of ["run", "impact_then_run"]) {
    const d = decide(answer(action, { tests: "impacted" }), { ...opts, may: ["ask"] });
    assert.equal(d.action, "answer");
    assert.equal(d.reply, "Only OWNER, MEMBER, COLLABORATOR can run tests here.");
    assert.equal(d.refused, d.reply);
  }
  const d = decide(answer("run"), { ...opts, may: ["ask"], runAccess: ["OWNER"] });
  assert.equal(d.reply, "Only OWNER can run tests here.");
});

test("an unknown policy becomes a clarifying question", () => {
  const d = decide(answer("run", { tests: "impacted", policy: "billing" }), opts);
  assert.equal(d.action, "clarify");
  assert.equal(d.reply, "There's no billing policy here. Available: checkout.");
  assert.equal(d.refused, d.reply);
  assert.equal(decide(answer("run", { policy: "x" }), { ...opts, policies: [] }).reply, "There's no x policy here. Available: none.");
});

test("a run naming a test kane hasn't seen runs the impacted set instead", () => {
  const d = decide(answer("run", { tests: ["promo applies", "gift wrap total"] }), opts);
  assert.equal(d.action, "impact_then_run");
  assert.equal(d.args.tests, "impacted");
  assert.equal(d.refused, undefined);
  assert.match(d.reply, /doesn't know gift wrap total on this PR yet/);
  assert.equal(decide(answer("impact_then_run", { tests: ["x"] }), { ...opts, state: null }).action, "impact_then_run");
});

test("an answer naming a test kane hasn't seen is refused", () => {
  const d = decide(answer("answer", { tests: ["gift wrap total"] }), opts);
  assert.equal(d.action, "answer");
  assert.equal(d.reply, "kane doesn't know a test named gift wrap total on this PR yet.");
  assert.equal(d.refused, d.reply);
});

test("an allowed answer passes through, reply capped at 600", () => {
  assert.deepEqual(decide(answer("run", { tests: ["promo applies", "free shipping"], policy: "checkout" }, "I would run 2 tests."), opts), {
    action: "run",
    args: { tests: ["promo applies", "free shipping"], policy: "checkout" },
    reply: "I would run 2 tests.",
  });
  assert.equal(decide(answer("answer", {}, "z".repeat(700)), opts).reply.length, 600);
  assert.equal(decide(answer("impact"), { ...opts, may: ["ask"] }).action, "impact");
});

test("an answer outside the contract is not acted on", () => {
  for (const bad of [null, {}, answer("merge"), { ...answer("run"), args: { tests: 3, policy: null } }]) {
    const d = decide(bad, opts);
    assert.equal(d.action, "answer");
    assert.deepEqual(d.args, { tests: null, policy: null });
    assert.ok(d.refused);
  }
});

test("the reply is cut at 600 code points, never through a surrogate pair", () => {
  const reply = "x".repeat(599) + "😀😀";
  const d = decide(answer("answer", {}, reply), opts);
  assert.equal(Array.from(d.reply).length, 600);
  assert.ok(d.reply.endsWith("😀"), "the 600th code point is a whole emoji");
  assert.doesNotMatch(d.reply, /[\uD800-\uDBFF]$/, "no lone high surrogate at the end");
  const emoji = "😀".repeat(700);
  assert.equal(decide(answer("answer", {}, emoji), opts).reply, "😀".repeat(600));
});
