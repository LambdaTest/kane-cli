// Turns the live strip on and off for Claude Code.
//
// The strip is a status line command. Turning it on points the statusLine
// setting in <home>/.claude/settings.json at the strip reader and remembers the
// person's own status line in agent config, so the reader can still show it and
// turning the strip off can put it back.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { isPlainObject, readConfig, writeConfig } from "./agent-config.mjs";

const SUPPORTED_HOST = "claude-code";
const READER_NAME = "kane-strip.mjs";
const REFRESH_SECONDS = 2;

export function stripBinPath(home) {
  return join(home, ".testmuai", "kaneai", "bin", READER_NAME);
}

function settingsPath(home) {
  return join(home, ".claude", "settings.json");
}

function assertHost(host) {
  if (host !== SUPPORTED_HOST) {
    throw new Error("The live strip is only available for claude-code right now.");
  }
}

// Returns {existed, settings}. A missing file means empty settings. A file that
// is not a JSON object throws, so a broken settings file is never overwritten.
function readSettings(home) {
  const file = settingsPath(home);
  if (!existsSync(file)) return { existed: false, settings: {} };

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Your Claude Code settings file is not valid JSON, so nothing was changed. Fix it and try again: ${file}`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`Your Claude Code settings file does not hold a JSON object, so nothing was changed. Fix it and try again: ${file}`);
  }
  return { existed: true, settings: parsed };
}

function writeSettings(home, settings) {
  const file = settingsPath(home);
  mkdirSync(dirname(file), { recursive: true });
  // A plain write follows a symlinked settings file instead of replacing it.
  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

function isStripStatusLine(statusLine) {
  return isPlainObject(statusLine) && String(statusLine.command ?? "").includes(READER_NAME);
}

// Returns a copy of the config plus the strip entry for the host inside it,
// with the three known fields filled in and every other key kept.
function openStripEntry(home, host) {
  const config = structuredClone(readConfig(home));
  if (!isPlainObject(config.strip)) config.strip = {};
  const stored = isPlainObject(config.strip[host]) ? config.strip[host] : {};
  config.strip[host] = { enabled: false, offered_at: null, original_status_line: null, ...stored };
  return { config, entry: config.strip[host] };
}

// `nodePath` is the Node binary to run the reader with. The CLI passes the one
// it is running under, because a status line command does not always inherit a
// PATH that has `node` on it (version managers set it up per shell).
function buildStatusLine(home, original, nodePath) {
  const runner = nodePath && nodePath !== "node" ? `"${nodePath}"` : "node";
  const statusLine = {
    type: "command",
    command: `${runner} "${stripBinPath(home)}"`,
    refreshInterval: REFRESH_SECONDS,
  };
  if (isPlainObject(original)) {
    const theirs = original.refreshInterval;
    if (typeof theirs === "number" && theirs >= 1 && theirs < REFRESH_SECONDS) {
      statusLine.refreshInterval = theirs;
    }
    if (original.padding !== undefined) statusLine.padding = original.padding;
  }
  return statusLine;
}

// Returns {changed, backup}. `backup` is the path of the settings copy made by
// this call, or null when none was made. Safe to run twice: the second run
// finds the strip's own status line and leaves the stored original alone.
export function enableStrip({ home, host, binSource, nodePath = "node" }) {
  assertHost(host);
  const { existed, settings } = readSettings(home);
  if (!existsSync(binSource)) {
    throw new Error(`The live strip file is missing from this package, so nothing was changed: ${binSource}`);
  }

  const { config, entry } = openStripEntry(home, host);
  const wasEnabled = entry.enabled === true;

  if (settings.statusLine !== undefined && !isStripStatusLine(settings.statusLine)) {
    entry.original_status_line = settings.statusLine;
  } else if (isStripStatusLine(entry.original_status_line)) {
    // The strip must never wrap itself, whatever an older config says.
    entry.original_status_line = null;
  }
  entry.enabled = true;
  if (entry.offered_at === null) entry.offered_at = new Date().toISOString();

  const statusLine = buildStatusLine(home, entry.original_status_line, nodePath);
  const settingsChanged = !isDeepStrictEqual(settings.statusLine, statusLine);

  // Order matters. The reader is in place before anything points at it, and
  // the original is saved before the settings that held it are rewritten.
  const binTarget = stripBinPath(home);
  mkdirSync(dirname(binTarget), { recursive: true });
  copyFileSync(binSource, binTarget);

  let backup = null;
  if (existed && settingsChanged) {
    const backupFile = settingsPath(home) + ".kane-backup";
    if (!existsSync(backupFile)) {
      copyFileSync(settingsPath(home), backupFile);
      backup = backupFile;
    }
  }

  writeConfig(home, config);
  if (settingsChanged) writeSettings(home, { ...settings, statusLine });

  return { changed: settingsChanged || !wasEnabled, backup };
}

// Returns {changed, restored}. `restored` is true when the person's own status
// line was put back. Only the strip's own status line is ever replaced: if the
// person changed the setting after turning the strip on, it is left as it is.
export function disableStrip({ home, host }) {
  assertHost(host);
  const { settings } = readSettings(home);
  const { config, entry } = openStripEntry(home, host);
  const original = entry.original_status_line;

  let settingsChanged = false;
  let restored = false;
  if (isStripStatusLine(settings.statusLine)) {
    const next = { ...settings };
    if (isPlainObject(original)) {
      next.statusLine = original;
      restored = true;
    } else {
      delete next.statusLine;
    }
    // Settings first: if this write fails, the original is still in config.
    writeSettings(home, next);
    settingsChanged = true;
  }

  const wasEnabled = entry.enabled === true;
  entry.enabled = false;
  entry.original_status_line = null;
  // Nothing to record when the strip was never on: leave the config untouched.
  if (wasEnabled || original !== null || settingsChanged) writeConfig(home, config);

  return { changed: settingsChanged || wasEnabled, restored };
}

// Never throws for a broken settings file: it only reports.
export function stripStatus({ home, host }) {
  assertHost(host);
  const entry = readConfig(home).strip?.[host];

  let pointsAtReader = false;
  try {
    const command = readSettings(home).settings.statusLine?.command;
    pointsAtReader = String(command ?? "").includes(stripBinPath(home));
  } catch {
    // Unreadable settings cannot point at the reader.
  }

  return {
    enabled: isPlainObject(entry) && entry.enabled === true,
    installed: pointsAtReader && existsSync(stripBinPath(home)),
    wrapsOriginal: isPlainObject(entry) && isPlainObject(entry.original_status_line),
  };
}
