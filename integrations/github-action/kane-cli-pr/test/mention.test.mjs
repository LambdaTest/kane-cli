import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMention } from "../src/mention.mjs";

test("a line-leading mention returns the words after it", () => {
  assert.equal(extractMention("@kane-cli why would this break checkout?"), "why would this break checkout?");
  assert.equal(extractMention("thanks!\n  @KANE-CLI go ahead\nwith the checkout policy"), "go ahead\nwith the checkout policy");
});

test("a : or , right after the mention is dropped", () => {
  assert.equal(extractMention("@kane-cli: help"), "help");
  assert.equal(extractMention("@kane-cli, check impact"), "check impact");
  assert.equal(extractMention("@kane-cli"), "");
});

test("a longer name is not the mention", () => {
  assert.equal(extractMention("@kane-clix help"), null);
  assert.equal(extractMention("@kane-cli-bot help"), null);
  assert.equal(extractMention("@kane-cli_x help"), null);
});

test("fenced code and quoted lines are skipped", () => {
  assert.equal(extractMention("```\n@kane-cli help\n```"), null);
  assert.equal(extractMention("~~~md\n@kane-cli help\n~~~\n@kane-cli check"), "check");
  assert.equal(extractMention("> @kane-cli help"), null);
});

test("a mid-line mention is not a request", () => {
  assert.equal(extractMention("ask @kane-cli to check this"), null);
});

test("the mention word can be changed", () => {
  assert.equal(extractMention("@kane help", "@kane"), "help");
  assert.equal(extractMention("@kane.cli help"), null);
});
