// The installer's one question: turn on the live strip for Claude Code?
//
// The strip is never on by default. It is a recommended choice, so the person
// is asked, once, and only when they are there to answer: a terminal on both
// ends, not CI, Claude Code present, and never asked before (by this installer
// or by their agent, which records the same field).

import { createInterface } from "node:readline";

import { isPlainObject, readConfig, writeConfig } from "./agent-config.mjs";

const HOST = "claude-code";

export function shouldAskStrip({ stdinTTY, stdoutTTY, env, claudeInstalled, config }) {
  if (!stdinTTY || !stdoutTTY) return false;
  if (env && env.CI) return false;
  if (!claudeInstalled) return false;
  const entry = isPlainObject(config) && isPlainObject(config.strip) ? config.strip[HOST] : null;
  if (isPlainObject(entry) && (entry.enabled === true || entry.offered_at)) return false;
  return true;
}

// Enter takes the recommended answer. Anything that is not a clear yes is a no.
export function parseYesNo(answer) {
  const text = String(answer ?? "").trim().toLowerCase();
  if (text === "") return true;
  return text === "y" || text === "yes";
}

// Notes that the person was asked, so neither the installer nor their agent asks
// again. An earlier note is kept as it is.
export function recordOffer(home, host = HOST, now = new Date().toISOString()) {
  const config = structuredClone(readConfig(home));
  if (!isPlainObject(config.strip)) config.strip = {};
  const stored = isPlainObject(config.strip[host]) ? config.strip[host] : {};
  const entry = { enabled: false, offered_at: null, original_status_line: null, ...stored };
  if (!entry.offered_at) entry.offered_at = now;
  config.strip[host] = entry;
  writeConfig(home, config);
  return config;
}

export const STRIP_QUESTION = [
  "Optional, for Claude Code: watch runs live in your status bar.",
  "One line names the current step while kane-cli works. It keeps your current",
  "status line, shows only in the session that started the run, and turns off",
  "with one command. It edits ~/.claude/settings.json and keeps a backup.",
].join("\n");

// Resolves with the typed line, or null when the input ended with no answer.
// A missing answer is never a yes: only a person pressing Enter takes the default.
export function askLine(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answered = false;
    rl.on("close", () => {
      if (!answered) resolve(null);
    });
    rl.question(prompt, (answer) => {
      answered = true;
      resolve(answer);
      rl.close();
    });
  });
}
