import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parseYesNo, recordOffer, shouldAskStrip } from "../lib/strip-prompt.mjs";
import { readConfig, writeConfig } from "../lib/agent-config.mjs";

const CLI = fileURLToPath(new URL("../cli.js", import.meta.url));
const tempHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "kane-"));
const ready = { stdinTTY: true, stdoutTTY: true, env: {}, claudeInstalled: true, config: { version: 1 } };

test("the installer asks only a person at a terminal who has Claude Code and was never asked", () => {
  assert.equal(shouldAskStrip(ready), true);
  assert.equal(shouldAskStrip({ ...ready, stdinTTY: false }), false);
  assert.equal(shouldAskStrip({ ...ready, stdoutTTY: false }), false);
  assert.equal(shouldAskStrip({ ...ready, env: { CI: "true" } }), false);
  assert.equal(shouldAskStrip({ ...ready, claudeInstalled: false }), false);
  const asked = { version: 1, strip: { "claude-code": { enabled: false, offered_at: "2026-09-21T10:00:00Z" } } };
  assert.equal(shouldAskStrip({ ...ready, config: asked }), false);
  const on = { version: 1, strip: { "claude-code": { enabled: true, offered_at: null } } };
  assert.equal(shouldAskStrip({ ...ready, config: on }), false);
});

test("an empty answer takes the recommended yes, and only a clear yes or no counts", () => {
  assert.equal(parseYesNo(""), true);
  assert.equal(parseYesNo("  \n"), true);
  assert.equal(parseYesNo("y"), true);
  assert.equal(parseYesNo("YES"), true);
  assert.equal(parseYesNo("n"), false);
  assert.equal(parseYesNo("No"), false);
  assert.equal(parseYesNo("maybe"), false);
});

test("recordOffer notes that the person was asked, once, and keeps everything else", () => {
  const home = tempHome();
  try {
    writeConfig(home, { version: 1, preferences: { watch: "quiet" }, custom: { keep: true } });
    recordOffer(home, "claude-code", "2026-09-21T10:00:00.000Z");
    let config = readConfig(home);
    assert.equal(config.strip["claude-code"].offered_at, "2026-09-21T10:00:00.000Z");
    assert.equal(config.strip["claude-code"].enabled, false);
    assert.deepEqual(config.preferences, { watch: "quiet" });
    assert.deepEqual(config.custom, { keep: true });
    recordOffer(home, "claude-code", "2030-01-01T00:00:00.000Z");
    config = readConfig(home);
    assert.equal(config.strip["claude-code"].offered_at, "2026-09-21T10:00:00.000Z");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("an unattended install never asks and never turns the strip on", () => {
  const home = tempHome();
  try {
    fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(home, ".claude", "settings.json"), JSON.stringify({ theme: "dark" }));
    const run = spawnSync(process.execPath, [CLI, "install"], {
      encoding: "utf8",
      env: { ...process.env, KANE_SKILL_HOME: home },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(!/Turn it on\?/.test(run.stdout), run.stdout);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")), { theme: "dark" });
    const config = readConfig(home);
    assert.equal(config.strip, undefined);
    assert.ok(!fs.existsSync(path.join(home, ".testmuai", "kaneai", "bin", "kane-strip.mjs")));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
