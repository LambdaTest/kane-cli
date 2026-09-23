import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  configPath,
  readConfig,
  mergePrefs,
  writeConfig,
  seedConfig,
} from "../lib/agent-config.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli.js");

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kane-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

// Runs the CLI with every notion of "home" pointed at the temp folder, so a
// bug can never reach the real home directory.
function runCli(home, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, KANE_SKILL_HOME: home, HOME: home, USERPROFILE: home },
  });
}

test("configPath points inside the agent-config folder", (t) => {
  const home = tempHome(t);
  assert.equal(
    configPath(home),
    path.join(home, ".testmuai", "kaneai", "agent-config", "config.json"),
  );
});

test("readConfig gives {version: 1} for a missing, empty or invalid file", (t) => {
  const home = tempHome(t);
  assert.deepEqual(readConfig(home), { version: 1 });

  fs.mkdirSync(path.dirname(configPath(home)), { recursive: true });
  for (const content of ["", "   \n", "{not json", "[1, 2]", '"text"', "null"]) {
    fs.writeFileSync(configPath(home), content);
    assert.deepEqual(readConfig(home), { version: 1 }, `content: ${JSON.stringify(content)}`);
  }
});

test("readConfig returns the stored object", (t) => {
  const home = tempHome(t);
  writeConfig(home, { version: 1, preferences: { watch: "quiet" } });
  assert.deepEqual(readConfig(home), { version: 1, preferences: { watch: "quiet" } });
});

test("mergePrefs keeps unknown keys at every level", () => {
  const before = {
    version: 1,
    extra_top: { keep: true },
    onboarding: { first_run_explained: true, extra_onboarding: "x" },
    preferences: { watch: "visible", extra_pref: 7 },
    strip: { "claude-code": { enabled: true, extra_strip: [1] }, "other-host": { a: 1 } },
  };
  const after = mergePrefs(before, { watch: "quiet", purpose: "suite", narration: "every-step" });

  assert.deepEqual(after.extra_top, { keep: true });
  assert.equal(after.onboarding.first_run_explained, true);
  assert.equal(after.onboarding.extra_onboarding, "x");
  assert.equal(after.preferences.extra_pref, 7);
  assert.deepEqual(after.strip, before.strip);
  assert.deepEqual(
    { watch: after.preferences.watch, purpose: after.preferences.purpose, narration: after.preferences.narration },
    { watch: "quiet", purpose: "suite", narration: "every-step" },
  );
});

test("mergePrefs only changes the preferences it was given", () => {
  const after = mergePrefs(
    { version: 1, preferences: { watch: "visible", purpose: "ask", narration: "quiet" } },
    { purpose: "one-off" },
  );
  assert.deepEqual(after.preferences, { watch: "visible", purpose: "one-off", narration: "quiet" });
});

test("mergePrefs throws on a bad value and lists the allowed values", () => {
  assert.throws(
    () => mergePrefs({ version: 1 }, { watch: "loud" }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /watch/);
      assert.match(err.message, /loud/);
      for (const allowed of ["visible", "quiet", "results-only"]) assert.ok(err.message.includes(allowed));
      return true;
    },
  );
  assert.throws(
    () => mergePrefs({ version: 1 }, { purpose: "forever" }),
    (err) => {
      assert.match(err.message, /purpose/);
      for (const allowed of ["one-off", "suite", "ask"]) assert.ok(err.message.includes(allowed));
      return true;
    },
  );
  assert.throws(
    () => mergePrefs({ version: 1 }, { narration: "loud" }),
    (err) => {
      assert.match(err.message, /narration/);
      for (const allowed of ["quiet", "milestones", "every-step"]) assert.ok(err.message.includes(allowed));
      return true;
    },
  );
});

test("mergePrefs with one bad value saves nothing and leaves the input alone", () => {
  const before = { version: 1, preferences: { watch: "visible" } };
  const snapshot = structuredClone(before);
  assert.throws(() => mergePrefs(before, { watch: "quiet", purpose: "nope" }));
  assert.deepEqual(before, snapshot);

  mergePrefs(before, { watch: "quiet" });
  assert.deepEqual(before, snapshot, "mergePrefs returns a new object");
});

test("mergePrefs sets completed_at once and records what was asked without duplicates", () => {
  const first = mergePrefs({ version: 1 }, { watch: "quiet" });
  assert.equal(first.version, 1);
  assert.deepEqual(first.onboarding.asked, ["watch"]);
  assert.equal(new Date(first.onboarding.completed_at).toISOString(), first.onboarding.completed_at);

  const fixed = { ...first, onboarding: { ...first.onboarding, completed_at: "2026-01-02T03:04:05.000Z" } };
  const second = mergePrefs(fixed, { watch: "visible", purpose: "suite" });
  assert.equal(second.onboarding.completed_at, "2026-01-02T03:04:05.000Z");
  assert.deepEqual(second.onboarding.asked, ["watch", "purpose"]);

  const third = mergePrefs({ version: 1, onboarding: { asked: ["results"] } }, { narration: "quiet" });
  assert.deepEqual(third.onboarding.asked, ["results"], "narration adds nothing to asked");
  assert.equal(third.preferences.narration, "quiet");
});

test("writeConfig creates the folder and writes two-space JSON with a trailing newline", (t) => {
  const home = tempHome(t);
  const config = { version: 1, preferences: { watch: "quiet" } };
  writeConfig(home, config);
  assert.equal(fs.readFileSync(configPath(home), "utf8"), JSON.stringify(config, null, 2) + "\n");
});

test("seedConfig writes {version: 1} once and never overwrites", (t) => {
  const home = tempHome(t);
  assert.equal(seedConfig(home), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath(home), "utf8")), { version: 1 });

  const mine = { version: 1, preferences: { watch: "results-only" }, custom: "stay" };
  writeConfig(home, mine);
  assert.equal(seedConfig(home), false);
  assert.deepEqual(readConfig(home), mine);

  // Even a file that is not valid JSON belongs to the person: leave it.
  fs.writeFileSync(configPath(home), "{broken");
  assert.equal(seedConfig(home), false);
  assert.equal(fs.readFileSync(configPath(home), "utf8"), "{broken");
});

test("cli prefs saves the values and prints the file path", (t) => {
  const home = tempHome(t);
  const result = runCli(home, ["prefs", "--watch", "quiet", "--purpose=suite"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(configPath(home)));
  assert.match(result.stdout, /watch: quiet/);
  assert.match(result.stdout, /purpose: suite/);

  const saved = readConfig(home);
  assert.deepEqual(saved.preferences, { watch: "quiet", purpose: "suite" });
  assert.deepEqual(saved.onboarding.asked, ["watch", "purpose"]);
});

test("cli prefs rejects a bad value, a missing option and an unknown option", (t) => {
  const home = tempHome(t);

  const bad = runCli(home, ["prefs", "--watch", "loud"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /visible, quiet, results-only/);

  const none = runCli(home, ["prefs"]);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /--watch/);

  const unknown = runCli(home, ["prefs", "--volume", "11"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /--volume/);

  assert.equal(fs.existsSync(configPath(home)), false, "nothing is written on an error");
});

test("cli --help lists every command and an unknown command exits 1", (t) => {
  const home = tempHome(t);
  for (const flag of ["--help", "-h"]) {
    const help = runCli(home, [flag]);
    assert.equal(help.status, 0);
    for (const word of ["install", "uninstall", "prefs", "--watch", "--purpose", "--narration", "strip enable|disable|status", "--host", "--help"]) {
      assert.ok(help.stdout.includes(word), `${flag} output mentions ${word}`);
    }
    assert.ok(!help.stdout.includes(String.fromCharCode(0x2014)), "no long dash in help");
  }

  const unknown = runCli(home, ["frobnicate"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown command: frobnicate/);
  assert.match(unknown.stdout, /Usage:/);
});
