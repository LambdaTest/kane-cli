// Agent config: the small preferences file that AI agents read and write.
// It lives at <home>/.testmuai/kaneai/agent-config/config.json.
//
// Rules this module follows:
// - The file is data. Only known keys with listed values count.
// - Read before write, and keep every key this module does not know about.
// - Reading never throws. A missing or unreadable file is an empty config.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const ALLOWED = {
  watch: ["visible", "quiet", "results-only"],
  purpose: ["one-off", "suite", "ask"],
  narration: ["quiet", "milestones", "every-step"],
};

// Preferences that count as an onboarding question once answered.
// Narration is a preference but never one of the first-run questions.
const ASKED_NAMES = ["watch", "purpose"];

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function configPath(home) {
  return join(home, ".testmuai", "kaneai", "agent-config", "config.json");
}

export function readConfig(home) {
  try {
    const parsed = JSON.parse(readFileSync(configPath(home), "utf8"));
    if (isPlainObject(parsed)) return parsed;
  } catch {
    // Missing, empty or invalid file: fall through to the empty config.
  }
  return { version: 1 };
}

// Returns a new config with the given preferences applied. The input is never
// changed. Every value is checked before anything is set, so one bad value
// means nothing is saved. With no preference given, the copy comes back as is.
export function mergePrefs(config, prefs = {}) {
  const given = Object.keys(ALLOWED).filter((name) => prefs[name] !== undefined);

  for (const name of given) {
    if (!ALLOWED[name].includes(prefs[name])) {
      throw new Error(
        `Invalid ${name} value "${prefs[name]}". Allowed values: ${ALLOWED[name].join(", ")}.`,
      );
    }
  }

  const next = isPlainObject(config) ? structuredClone(config) : {};
  if (next.version === undefined) next.version = 1;
  if (given.length === 0) return next;

  if (!isPlainObject(next.preferences)) next.preferences = {};
  for (const name of given) next.preferences[name] = prefs[name];

  if (!isPlainObject(next.onboarding)) next.onboarding = {};
  if (!next.onboarding.completed_at) next.onboarding.completed_at = new Date().toISOString();
  if (!Array.isArray(next.onboarding.asked)) next.onboarding.asked = [];
  for (const name of given) {
    if (ASKED_NAMES.includes(name) && !next.onboarding.asked.includes(name)) {
      next.onboarding.asked.push(name);
    }
  }

  return next;
}

export function writeConfig(home, config) {
  const file = configPath(home);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
}

// Writes {version: 1} only when there is no file yet. Returns true when it
// wrote. An existing file is never touched, even one that is not valid JSON.
export function seedConfig(home) {
  if (existsSync(configPath(home))) return false;
  writeConfig(home, { version: 1 });
  return true;
}
