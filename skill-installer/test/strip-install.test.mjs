import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { enableStrip, disableStrip, stripStatus } from "../lib/strip-install.mjs";
import { configPath, readConfig, writeConfig } from "../lib/agent-config.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
const HOST = "claude-code";
const FAKE_READER = "// stand-in for the strip reader\n";

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kane-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function fakeBinSource(home) {
  const file = path.join(home, "package-src", "kane-strip.mjs");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, FAKE_READER);
  return file;
}

const settingsPath = (home) => path.join(home, ".claude", "settings.json");
const backupPath = (home) => settingsPath(home) + ".kane-backup";
const binTarget = (home) => path.join(home, ".testmuai", "kaneai", "bin", "kane-strip.mjs");

function writeSettings(home, value) {
  fs.mkdirSync(path.dirname(settingsPath(home)), { recursive: true });
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(settingsPath(home), text);
  return text;
}

const readSettings = (home) => JSON.parse(fs.readFileSync(settingsPath(home), "utf8"));
const stripEntry = (home) => readConfig(home).strip[HOST];

function runCli(home, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, KANE_SKILL_HOME: home, HOME: home, USERPROFILE: home },
  });
}

test("enable stores the original status line and writes refreshInterval 2", (t) => {
  const home = tempHome(t);
  const original = { type: "command", command: "sh ./my-status.sh" };
  const before = writeSettings(home, { statusLine: original });

  const result = enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });

  assert.deepEqual(result, { changed: true, backup: backupPath(home) });
  assert.equal(fs.readFileSync(backupPath(home), "utf8"), before);
  assert.equal(fs.readFileSync(binTarget(home), "utf8"), FAKE_READER);
  assert.deepEqual(readSettings(home).statusLine, {
    type: "command",
    command: `node "${binTarget(home)}"`,
    refreshInterval: 2,
  });

  const entry = stripEntry(home);
  assert.deepEqual(entry.original_status_line, original);
  assert.equal(entry.enabled, true);
  assert.equal(new Date(entry.offered_at).toISOString(), entry.offered_at);

  const raw = fs.readFileSync(settingsPath(home), "utf8");
  assert.equal(raw, JSON.stringify(readSettings(home), null, 2) + "\n", "two-space JSON, trailing newline");
});

test("enable carries over padding and keeps a smaller refresh interval", (t) => {
  const home = tempHome(t);
  writeSettings(home, { statusLine: { type: "command", command: "my-status", padding: 0, refreshInterval: 1 } });
  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });
  assert.deepEqual(readSettings(home).statusLine, {
    type: "command",
    command: `node "${binTarget(home)}"`,
    refreshInterval: 1,
    padding: 0,
  });

  const slow = tempHome(t);
  writeSettings(slow, { statusLine: { type: "command", command: "my-status", refreshInterval: 30 } });
  enableStrip({ home: slow, host: HOST, binSource: fakeBinSource(slow) });
  assert.equal(readSettings(slow).statusLine.refreshInterval, 2);
  assert.equal("padding" in readSettings(slow).statusLine, false);
});

test("enable twice keeps the first original", (t) => {
  const home = tempHome(t);
  const original = { type: "command", command: "my-status --fancy", padding: 1 };
  const before = writeSettings(home, { statusLine: original });
  const binSource = fakeBinSource(home);

  enableStrip({ home, host: HOST, binSource });
  const settingsAfterFirst = fs.readFileSync(settingsPath(home), "utf8");
  const offeredAt = stripEntry(home).offered_at;

  const second = enableStrip({ home, host: HOST, binSource });

  assert.deepEqual(second, { changed: false, backup: null });
  assert.deepEqual(stripEntry(home).original_status_line, original);
  assert.equal(stripEntry(home).offered_at, offeredAt);
  assert.equal(fs.readFileSync(settingsPath(home), "utf8"), settingsAfterFirst);
  assert.equal(fs.readFileSync(backupPath(home), "utf8"), before, "the backup still holds the first settings");
});

test("disable restores the original exactly", (t) => {
  const home = tempHome(t);
  const original = { type: "command", command: "my-status", padding: 2, refreshInterval: 10, custom: { nested: [1, 2] } };
  writeSettings(home, { statusLine: original });
  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });

  disableStrip({ home, host: HOST });

  assert.deepEqual(readSettings(home), { statusLine: original });
  const entry = stripEntry(home);
  assert.equal(entry.enabled, false);
  assert.equal(entry.original_status_line, null);
  assert.ok("original_status_line" in entry);
  assert.ok(fs.existsSync(binTarget(home)), "the reader file stays in place");
});

test("disable with no original removes statusLine", (t) => {
  const home = tempHome(t);
  writeSettings(home, { theme: "dark" });
  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });
  assert.ok(readSettings(home).statusLine);

  disableStrip({ home, host: HOST });

  assert.deepEqual(readSettings(home), { theme: "dark" });
  assert.equal(stripEntry(home).enabled, false);
  assert.equal(stripEntry(home).original_status_line, null);
});

test("a settings file with other keys keeps them", (t) => {
  const home = tempHome(t);
  const others = {
    permissions: { allow: ["Bash(npm test)"], deny: [] },
    env: { FOO: "bar" },
    hooks: { Stop: [{ hooks: [{ type: "command", command: "echo done" }] }] },
  };
  writeSettings(home, { ...others, statusLine: { type: "command", command: "my-status" } });

  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });
  const { statusLine: _enabled, ...afterEnable } = readSettings(home);
  assert.deepEqual(afterEnable, others);

  disableStrip({ home, host: HOST });
  const { statusLine: _restored, ...afterDisable } = readSettings(home);
  assert.deepEqual(afterDisable, others);
});

test("an unknown host throws and changes nothing", (t) => {
  const home = tempHome(t);
  const before = writeSettings(home, { statusLine: { type: "command", command: "my-status" } });
  const message = "The live strip is only available for claude-code right now.";

  assert.throws(() => enableStrip({ home, host: "codex", binSource: fakeBinSource(home) }), { message });
  assert.throws(() => disableStrip({ home, host: "codex" }), { message });
  assert.throws(() => stripStatus({ home, host: "codex" }), { message });
  assert.throws(() => enableStrip({ home, binSource: fakeBinSource(home) }), { message });

  assert.equal(fs.readFileSync(settingsPath(home), "utf8"), before);
  assert.equal(fs.existsSync(binTarget(home)), false);
  assert.equal(fs.existsSync(backupPath(home)), false);
  assert.equal(fs.existsSync(configPath(home)), false);
});

test("invalid settings JSON throws a clear error and changes nothing", (t) => {
  const home = tempHome(t);
  const broken = writeSettings(home, '{ "statusLine": ');

  for (const attempt of [
    () => enableStrip({ home, host: HOST, binSource: fakeBinSource(home) }),
    () => disableStrip({ home, host: HOST }),
  ]) {
    assert.throws(attempt, (err) => {
      assert.ok(err.message.includes(settingsPath(home)), err.message);
      assert.match(err.message, /not valid JSON/);
      return true;
    });
  }

  assert.equal(fs.readFileSync(settingsPath(home), "utf8"), broken);
  assert.equal(fs.existsSync(binTarget(home)), false);
  assert.equal(fs.existsSync(backupPath(home)), false);
  assert.equal(fs.existsSync(configPath(home)), false);

  writeSettings(home, "[1, 2, 3]\n");
  assert.throws(() => enableStrip({ home, host: HOST, binSource: fakeBinSource(home) }), /settings/);
});

test("enable with no settings file creates one and makes no backup", (t) => {
  const home = tempHome(t);

  const result = enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });

  assert.deepEqual(result, { changed: true, backup: null });
  assert.equal(fs.existsSync(backupPath(home)), false);
  assert.deepEqual(Object.keys(readSettings(home)), ["statusLine"]);
  assert.equal(stripEntry(home).original_status_line, null);
});

test("enable never overwrites an existing backup", (t) => {
  const home = tempHome(t);
  writeSettings(home, { statusLine: { type: "command", command: "my-status" } });
  fs.writeFileSync(backupPath(home), "earlier backup\n");

  const result = enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });

  assert.equal(result.backup, null);
  assert.equal(fs.readFileSync(backupPath(home), "utf8"), "earlier backup\n");
});

test("enable with a missing reader file throws before touching settings", (t) => {
  const home = tempHome(t);
  const before = writeSettings(home, { statusLine: { type: "command", command: "my-status" } });

  assert.throws(
    () => enableStrip({ home, host: HOST, binSource: path.join(home, "nowhere", "kane-strip.mjs") }),
    /kane-strip\.mjs/,
  );
  assert.equal(fs.readFileSync(settingsPath(home), "utf8"), before);
  assert.equal(fs.existsSync(backupPath(home)), false);
  assert.equal(fs.existsSync(configPath(home)), false);
});

test("enable keeps unknown config keys and an existing offered_at", (t) => {
  const home = tempHome(t);
  writeConfig(home, {
    version: 1,
    preferences: { watch: "quiet" },
    future_key: { a: 1 },
    strip: {
      "claude-code": { enabled: false, offered_at: "2026-01-02T03:04:05.000Z", original_status_line: null, note: "keep" },
      "other-host": { enabled: true },
    },
  });

  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });

  const config = readConfig(home);
  assert.deepEqual(config.preferences, { watch: "quiet" });
  assert.deepEqual(config.future_key, { a: 1 });
  assert.deepEqual(config.strip["other-host"], { enabled: true });
  assert.deepEqual(config.strip[HOST], {
    enabled: true,
    offered_at: "2026-01-02T03:04:05.000Z",
    original_status_line: null,
    note: "keep",
  });
});

test("disable leaves a status line the person changed after enabling", (t) => {
  const home = tempHome(t);
  writeSettings(home, { statusLine: { type: "command", command: "old-status" } });
  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });
  const newer = { type: "command", command: "newer-status" };
  writeSettings(home, { statusLine: newer });

  disableStrip({ home, host: HOST });

  assert.deepEqual(readSettings(home), { statusLine: newer });
  assert.equal(stripEntry(home).enabled, false);
  assert.equal(stripEntry(home).original_status_line, null);
});

test("disable on a fresh home writes nothing", (t) => {
  const home = tempHome(t);
  disableStrip({ home, host: HOST });
  assert.equal(fs.existsSync(settingsPath(home)), false);
  assert.equal(fs.existsSync(configPath(home)), false);
});

test("stripStatus follows enable and disable", (t) => {
  const home = tempHome(t);
  assert.deepEqual(stripStatus({ home, host: HOST }), { enabled: false, installed: false, wrapsOriginal: false });

  writeSettings(home, { statusLine: { type: "command", command: "my-status" } });
  enableStrip({ home, host: HOST, binSource: fakeBinSource(home) });
  assert.deepEqual(stripStatus({ home, host: HOST }), { enabled: true, installed: true, wrapsOriginal: true });

  disableStrip({ home, host: HOST });
  assert.deepEqual(stripStatus({ home, host: HOST }), { enabled: false, installed: false, wrapsOriginal: false });

  const bare = tempHome(t);
  enableStrip({ home: bare, host: HOST, binSource: fakeBinSource(bare) });
  assert.deepEqual(stripStatus({ home: bare, host: HOST }), { enabled: true, installed: true, wrapsOriginal: false });
});

test("cli strip status works in a fresh home and an unknown host exits 1", (t) => {
  const home = tempHome(t);

  const status = runCli(home, ["strip", "status"]);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /off/);
  assert.ok(!status.stdout.includes(String.fromCharCode(0x2014)), "no long dash in status");

  const otherHost = runCli(home, ["strip", "enable", "--host", "codex"]);
  assert.equal(otherHost.status, 1);
  assert.match(otherHost.stderr, /only available for claude-code/);

  const noAction = runCli(home, ["strip"]);
  assert.equal(noAction.status, 1);
  assert.match(noAction.stderr, /enable\|disable\|status/);

  assert.equal(fs.existsSync(settingsPath(home)), false);
  assert.equal(fs.existsSync(binTarget(home)), false);
});
