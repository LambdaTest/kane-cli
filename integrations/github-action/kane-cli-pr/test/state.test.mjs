import { test } from "node:test";
import assert from "node:assert/strict";
import { readState, writeState, addTurns, emptyState, answeredUpto, MARKER } from "../src/state.mjs";

const BOT = { login: "github-actions[bot]" };

const sample = { run_sha: "a1b2c3d",
  v: 1,
  head_sha: "a1b2c3d",
  turns: [{ who: "OWNER", said: "help" }, { who: "kane", said: "usage — “quotes” ✓" }],
  last_action: "help",
  impacted: [{ test: "promo applies", why: "reads subtotal()" }],
  results: null,
  pending_question: null,
  answered_upto: "2026-10-26T10:00:00.000Z",
};

test("a written state block reads back the same", () => {
  const block = writeState(sample);
  assert.match(block, /^<!-- kane-cli:state [A-Za-z0-9_-]+ -->$/);
  const comment = { id: 7, user: BOT, body: `hello\n${MARKER}\n${block}` };
  const got = readState([comment]);
  assert.equal(got.comment, comment);
  assert.deepEqual(got.state, sample);
});

test("a marker in a comment by anyone else is never read as state", () => {
  const body = `${MARKER}\n${writeState(sample)}`;
  assert.equal(readState([{ user: { login: "mallory" }, body }]), null);
  assert.equal(readState([{ user: { login: "kane-cli[bot]" }, body }]), null);
});

test("the last kane comment wins; a bot comment without the marker is skipped", () => {
  const older = { user: BOT, body: `${MARKER}\n${writeState({ ...sample, head_sha: "old" })}` };
  const newer = { user: BOT, body: `${MARKER}\n${writeState(sample)}` };
  const other = { user: BOT, body: "some other workflow's comment" };
  assert.equal(readState([older, newer, other]).comment, newer);
});

test("a kane comment with a broken state block reads as empty state", () => {
  const c = { user: BOT, body: `${MARKER}\n<!-- kane-cli:state not!json -->` };
  assert.deepEqual(readState([c]), { comment: c, state: emptyState() });
});

test("no comments means no state", () => {
  assert.equal(readState([]), null);
});

test("addTurns keeps the newest 10 and caps each at 600 chars", () => {
  let s = emptyState("abc");
  for (let i = 1; i <= 6; i++) s = addTurns(s, "OWNER", `q${i}`, `a${i}`);
  assert.equal(s.turns.length, 10);
  assert.deepEqual(s.turns[0], { who: "OWNER", said: "q2" });
  assert.deepEqual(s.turns.at(-1), { who: "kane", said: "a6" });
  const long = addTurns(emptyState(), "MEMBER", "x".repeat(900), "y");
  assert.equal(long.turns[0].said.length, 600);
});

test("addTurns does not change the state it is given", () => {
  const s = emptyState();
  addTurns(s, "OWNER", "hi", "hello");
  assert.deepEqual(s.turns, []);
});

test("a bot-written state with wrong-shaped fields reads back normalised", () => {
  const junk = { v: 1, head_sha: 5, turns: [null, { who: "OWNER", said: "hi" }, "x"], impacted: "lots", results: { a: 1 }, last_action: 5, pending_question: [] };
  const c = { user: BOT, body: `${MARKER}\n${writeState(junk)}` };
  assert.deepEqual(readState([c]).state, { ...emptyState(), turns: [{ who: "OWNER", said: "hi" }] });
  const ok = { ...sample, impacted: [null, { test: "a", why: "b" }, { why: "no name" }], results: [{ test: "c", verdict: "failed" }, 3] };
  const got = readState([{ user: BOT, body: `${MARKER}\n${writeState(ok)}` }]).state;
  assert.deepEqual(got.impacted, [{ test: "a", why: "b" }]);
  assert.deepEqual(got.results, [{ test: "c", verdict: "failed" }]);
});

test("readState reads only the given bot login's marker comments", () => {
  const body = `${MARKER}\n${writeState(sample)}`;
  const mine = { id: 1, user: { login: "kane-app[bot]" }, body };
  const actions = { id: 2, user: BOT, body };
  assert.equal(readState([mine, actions], "kane-app[bot]").comment, mine);
  assert.equal(readState([mine, actions]).comment, actions, "default is github-actions[bot]");
  assert.equal(readState([actions], "kane-app[bot]"), null);
});

test("answeredUpto only moves forward; a junk answered_upto reads as null", () => {
  const s0 = emptyState();
  const s1 = answeredUpto(s0, "2026-10-26T10:05:00Z");
  assert.equal(s1.answered_upto, "2026-10-26T10:05:00.000Z");
  assert.equal(answeredUpto(s1, "2026-10-26T10:01:00Z"), s1, "never moves back");
  assert.equal(answeredUpto(s1, "not a time"), s1);
  assert.equal(answeredUpto(s1, "2026-10-26T10:06:00Z").answered_upto, "2026-10-26T10:06:00.000Z");
  assert.equal(s0.answered_upto, null, "the input is not changed");
  const junk = { id: 3, user: BOT, body: `${MARKER}\n${writeState({ ...sample, answered_upto: "yesterday-ish" })}` };
  assert.equal(readState([junk]).state.answered_upto, null);
});
