import { test } from "node:test";
import assert from "node:assert/strict";
import { renderComment, renderWorking, defang, FALLBACK_NOTE, HEADER } from "../src/render.mjs";
import { readState, emptyState } from "../src/state.mjs";
import { USAGE, COULDNT_READ } from "../src/fallback.mjs";
import { extractMention } from "../src/mention.mjs";

const state = { ...emptyState("a1b2c3d"), last_action: "answer" };
const input = {
  asker: "octocat",
  latest: { asked: "why would this break checkout?", reply: "Ask @bob, he wrote subtotal()." },
  picture: "for a1b2c3d · I would check impact for these 2 changed files.",
  state,
};

test("defang breaks every @-mention with a zero-width space", () => {
  assert.equal(defang("hi @bob and @org/team, mail a@b.c"), "hi @\u200Bbob and @\u200Borg/team, mail a@\u200Bb.c");
  assert.equal(defang("no mentions"), "no mentions");
});

test("the header, the quoted ask, then the asker's mention opening kane's answer: the only live mention", () => {
  const body = renderComment(input);
  assert.ok(body.startsWith(`${HEADER}\n\n**You asked**\n> why would this break checkout?\n\n@octocat Ask @\u200Bbob`), body.slice(0, 300));
  // code spans never notify, so the footer's `@kane-cli …` hint doesn't count
  const prose = body.replace(/`[^`]*`/g, "");
  assert.deepEqual(prose.match(/@(?!\u200B)[A-Za-z0-9-]+/g), ["@octocat"]);
  assert.match(body, /@\u200Bbob/);
});

test("the hidden state block is last and reads back", () => {
  const body = renderComment(input);
  assert.match(body, /<!-- kane-cli:state [A-Za-z0-9_-]+ -->$/);
  assert.deepEqual(readState([{ user: { login: "github-actions[bot]" }, body }]).state, state);
});

test("the body has no folded earlier turns: the thread is the history", () => {
  const body = renderComment({ ...input, earlier: [{ asked: "help", reply: "usage" }] });
  assert.doesNotMatch(body, /Earlier with kane/);
  assert.doesNotMatch(body, /<details>/);
});

test("without an asker the result mentions nobody", () => {
  const body = renderComment({ ...input, asker: null });
  assert.ok(body.startsWith(HEADER), body.split("\n")[0]);
  assert.ok(body.split("\n").includes("Ask @\u200Bbob, he wrote subtotal()."));
  assert.equal(body.replace(/`[^`]*`/g, "").match(/@(?!\u200B)[A-Za-z0-9-]+/g), null);
});

test("a working comment: the header, the quoted ask, the progress list, no mention, and the state block", () => {
  const body = renderWorking({ asked: "@bob why would\nthis break checkout?", state });
  const lines = body.split("\n");
  assert.equal(lines[0], HEADER);
  assert.match(body, /> @\u200Bbob why would\n> this break checkout\?\n\n\*\*Working on it…\*\*/);
  assert.equal(body.match(/@(?!\u200B)[A-Za-z0-9-]+/g), null, "no live mention");
  assert.match(body, /<!-- kane-cli:state [A-Za-z0-9_-]+ -->$/);
  assert.deepEqual(readState([{ user: { login: "github-actions[bot]" }, body }]).state, state);
  assert.match(renderWorking({ asked: "x", progress: ["⏳ t-1 A · waiting", "", "🔄 t-2 B · running"], state }), /\*\*Working on it…\*\*\n- ⏳ t-1 A · waiting\n- 🔄 t-2 B · running\n/);
});

test("the question is quoted and model text can't open a hidden block", () => {
  const body = renderComment({ ...input, latest: { asked: "line one\nline two", reply: "x <!-- kane-cli:state AAAA --> y" } });
  assert.match(body, /> line one\n> line two/);
  assert.equal(body.match(/<!--/g).length, 2);
});

test("only the mention token stays live; every other handle is broken, whatever the markdown", () => {
  const Z = "\u200B";
  assert.equal(defang("`@bob``"), `\`@${Z}bob\`\``);
  assert.equal(defang("`\n\n@bob\n\n`"), `\`\n\n@${Z}bob\n\n\``);
  assert.equal(defang("\\`@bob\\`"), `\\\`@${Z}bob\\\``);
  assert.equal(defang("`@bob`"), `\`@${Z}bob\``);
  assert.equal(defang("@kane-clix and @kane-cli-bot and @kane-cli_x"), `@${Z}kane-clix and @${Z}kane-cli-bot and @${Z}kane-cli_x`);
  assert.equal(defang("@kane-cli help, @Kane-CLI: go ahead, `@KANE-CLI check`"), "@kane-cli help, @Kane-CLI: go ahead, `@KANE-CLI check`");
});

test("the mention token is a parameter", () => {
  assert.equal(defang("@kane help @kane-cli", "@kane"), "@kane help @\u200Bkane-cli");
  const body = renderComment({ ...input, mention: "@kane", latest: { asked: "@kane-cli hi", reply: "@kane help" } });
  assert.match(body, /> @\u200Bkane-cli hi/);
  assert.match(body, /\n@octocat @kane help/);
});

test("a hint copied from a rendered help reply is a valid request", () => {
  const body = renderComment({ ...input, latest: { asked: "help", reply: USAGE } });
  const hints = [...body.matchAll(/`(@kane-cli [^`]*)`/g)].map((m) => m[1]);
  assert.ok(hints.length >= 3, String(hints.length));
  for (const h of hints) assert.notEqual(extractMention(h), null, h);
  assert.equal(extractMention("@kane-cli check impact"), "check impact");
  const fallback = renderComment({ ...input, latest: { asked: "??", reply: COULDNT_READ } });
  assert.match(fallback, /`@kane-cli go ahead`/);
});

test("a fallback answer says so in one short line right under the reply", () => {
  assert.equal(FALLBACK_NOTE, "<sub>kane's reader was unavailable; matched by keywords.</sub>");
  const lines = renderComment({ ...input, fallback: true }).split("\n");
  const i = lines.findIndex((l) => l.startsWith("@octocat "));
  assert.equal(lines[i + 1], FALLBACK_NOTE);
  assert.ok(!renderComment(input).includes(FALLBACK_NOTE));
});
