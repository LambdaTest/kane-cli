import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackAnswer, USAGE } from "../src/fallback.mjs";

test("empty words or help give the usage", () => {
  for (const w of ["", "  ", "help", "Help!"]) {
    const a = fallbackAnswer(w);
    assert.equal(a.action, "help", w);
    assert.equal(a.reply, USAGE);
    assert.deepEqual(a.args, { tests: null, policy: null });
  }
  for (const phrase of ["check impact", "go ahead", "rerun", "ask a question", "help"]) assert.match(USAGE, new RegExp(phrase));
});

test("go ahead / run / rerun / re-run run the impacted tests", () => {
  for (const w of ["go ahead", "please run them", "rerun", "Re-run please"]) {
    const a = fallbackAnswer(w);
    assert.equal(a.action, "run", w);
    assert.deepEqual(a.args, { tests: "impacted", policy: null });
  }
});

test("a run that mentions fail reruns the failed tests", () => {
  const a = fallbackAnswer("rerun the failed ones");
  assert.equal(a.action, "run");
  assert.equal(a.args.tests, "failed");
});

test("check / impact / break / affect check impact", () => {
  for (const w of ["check this", "what's the impact?", "could this break checkout", "does it affect promos"]) {
    assert.equal(fallbackAnswer(w).action, "impact", w);
  }
});

test("thanks is acknowledged with nothing to do", () => {
  for (const w of ["thanks", "Thank you!", "ty"]) assert.equal(fallbackAnswer(w).action, "none", w);
});

test("anything else says kane couldn't read it", () => {
  const a = fallbackAnswer("why does subtotal include the fee?");
  assert.equal(a.action, "answer");
  assert.equal(a.reply, "kane couldn't read that right now. Try `@kane-cli go ahead` or `@kane-cli help`.");
});

test("understood stays within 120 chars", () => {
  assert.ok(fallbackAnswer("x".repeat(500)).understood.length <= 120);
});
