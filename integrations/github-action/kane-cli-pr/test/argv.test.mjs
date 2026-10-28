import { test } from "node:test";
import assert from "node:assert/strict";
import { splitCommand } from "../src/argv.mjs";

test("splits a command prefix on whitespace", () => {
  assert.deepEqual(splitCommand("kane-cli"), ["kane-cli"]);
  assert.deepEqual(splitCommand("  /a/node_modules/.bin/tsx   /a/src/index.tsx "), ["/a/node_modules/.bin/tsx", "/a/src/index.tsx"]);
});

test("keeps quoted parts together and honours backslash escapes", () => {
  assert.deepEqual(splitCommand(`"/Users/me/My Repo/tsx" '/x y/index.tsx' a\\ b`), ["/Users/me/My Repo/tsx", "/x y/index.tsx", "a b"]);
  assert.deepEqual(splitCommand(`node "a \\"q\\" b"`), ["node", `a "q" b`]);
});

test("never runs a shell: $(), ; and | are plain characters", () => {
  assert.deepEqual(splitCommand("kane-cli; rm -rf / $(id) | cat"), ["kane-cli;", "rm", "-rf", "/", "$(id)", "|", "cat"]);
});

test("refuses an empty command or an unclosed quote", () => {
  assert.throws(() => splitCommand(""), /kane-cli input is empty/);
  assert.throws(() => splitCommand("   "), /kane-cli input is empty/);
  assert.throws(() => splitCommand(`"/a/tsx`), /unclosed quote/);
});
