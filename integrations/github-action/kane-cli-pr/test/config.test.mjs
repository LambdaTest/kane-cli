import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConfig, ConfigError } from "../src/config.mjs";

const DEFAULT = ["OWNER", "MEMBER", "COLLABORATOR"];

test("no file gives the defaults", () => {
  assert.deepEqual(parseConfig(null), {
    access: { ask: DEFAULT, run: DEFAULT },
    policies: [],
    policyPaths: {},
    autoContinue: true,
    policy: null,
    heal: false,
    parallel: 1,
    impact: { judge: true },
    app: null,
  });
  assert.deepEqual(parseConfig(""), parseConfig(null));
});

test("a full file is read", () => {
  const c = parseConfig(
    "version: 1\naccess:\n  ask: [OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR]\n  run: [OWNER]\npolicies:\n  checkout: .github/kane/checkout-policy.yaml\nauto_continue: true\n",
  );
  assert.deepEqual(c, {
    access: { ask: ["OWNER", "MEMBER", "COLLABORATOR", "CONTRIBUTOR"], run: ["OWNER"] },
    policies: ["checkout"],
    policyPaths: { checkout: ".github/kane/checkout-policy.yaml" },
    autoContinue: true,
    policy: null,
    heal: false,
    parallel: 1,
    impact: { judge: true },
    app: null,
  });
});

test("auto_continue defaults to true and can be turned off", () => {
  assert.equal(parseConfig(null).autoContinue, true);
  assert.equal(parseConfig("auto_continue: false\n").autoContinue, false);
});

test("the run keys: policy, heal, impact.judge and app", () => {
  const c = parseConfig("policy: .github/kane/checkout-policy.yaml\nheal: true\nimpact:\n  judge: true\napp:\n  start: npm start\n  url: http://127.0.0.1:3000\n  ready_path: /health\n");
  assert.equal(c.policy, ".github/kane/checkout-policy.yaml");
  assert.equal(c.heal, true);
  assert.deepEqual(c.impact, { judge: true });
  assert.deepEqual(c.app, { start: "npm start", url: "http://127.0.0.1:3000", readyPath: "/health", timeoutMs: 60_000 });
  assert.deepEqual(parseConfig("app:\n  start: npm start\n").app, { start: "npm start", url: "http://127.0.0.1:3000", readyPath: "/", timeoutMs: 60_000 }, "url, ready_path and timeout default");
  assert.equal(parseConfig("app:\n  start: npm run build && npm start\n  timeout_seconds: 180\n").app.timeoutMs, 180_000, "timeout_seconds for a build");
});

test("a missing access list falls back to its default", () => {
  assert.deepEqual(parseConfig("access:\n  run: [OWNER]\n").access, { ask: DEFAULT, run: ["OWNER"] });
});

test("an unknown association is a ConfigError", () => {
  assert.throws(() => parseConfig("access:\n  run: [OWNER, ADMIN]\n"), (e) => e instanceof ConfigError && /ADMIN/.test(e.message));
});

test("bad shapes are ConfigErrors", () => {
  for (const text of [
    "access: [OWNER]",
    "access:\n  ask: OWNER\n",
    "policies: [checkout]",
    "policies:\n  checkout: 3\n",
    "auto_continue: yes please",
    "version: 2",
    "policy: 3",
    "heal: maybe",
    "impact: true",
    "impact:\n  judge: 1\n",
    "app: npm start",
    "app:\n  url: http://x\n",
    "app:\n  start: npm start\n  url: not a url\n",
    "app:\n  start: npm start\n  timeout_seconds: 0\n",
    "app:\n  start: npm start\n  timeout_seconds: 1.5\n",
    "app:\n  start: npm start\n  timeout_seconds: 901\n",
    "- a list",
    "key: [unclosed",
  ]) {
    assert.throws(() => parseConfig(text), ConfigError, text);
  }
});
