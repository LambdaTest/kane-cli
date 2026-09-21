#!/usr/bin/env node

import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import { ALLOWED, configPath, mergePrefs, readConfig, seedConfig, writeConfig } from "./lib/agent-config.mjs";
import { disableStrip, enableStrip, stripStatus } from "./lib/strip-install.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SKILL_NAME = "kane-cli";
const PACKAGE = "@testmuai/kane-cli-skill";
const SOURCE_DIR = join(__dirname, "skills");
const STRIP_SOURCE = join(__dirname, "strip", "kane-strip.mjs");
const VERSION = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version;

// KANE_SKILL_HOME replaces the home folder for every command. It exists so
// this CLI can be exercised against a temp folder without touching the real
// home directory. It is not a documented option.
const HOME = process.env.KANE_SKILL_HOME || homedir();

const TARGETS = [
  { dir: join(HOME, ".claude", "skills", SKILL_NAME), agent: "Claude Code" },
  { dir: join(HOME, ".agents", "skills", SKILL_NAME), agent: "Codex CLI" },
  { dir: join(HOME, ".gemini", "skills", SKILL_NAME), agent: "Gemini CLI" },
];

const HOST_NAMES = { "claude-code": "Claude Code" };

function install() {
  if (!existsSync(SOURCE_DIR)) {
    console.error("Error: skills directory not found in package.");
    process.exit(1);
  }

  console.log(`Installing kane-cli skill v${VERSION}...\n`);

  let installed = 0;
  for (const { dir, agent } of TARGETS) {
    try {
      // Wipe before copy so files removed in newer skill releases don't
      // linger in the target dir after an upgrade.
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      cpSync(SOURCE_DIR, dir, { recursive: true, force: true });
      writeFileSync(join(dir, "VERSION"), VERSION + "\n");
      console.log(`  ✓ ${agent}  →  ${dir}`);
      installed++;
    } catch (err) {
      console.error(`  ✗ ${agent}  →  ${err.message}`);
    }
  }

  console.log();
  if (installed > 0) {
    console.log(`Installed v${VERSION} to ${installed}/3 agents.`);
    console.log();
    console.log("Usage:");
    console.log("  Claude Code  →  /kane-cli  or ask any browser task");
    console.log("  Codex CLI    →  $kane-cli  or ask any browser task");
    console.log("  Gemini CLI   →  /skills list  or ask any browser task");
  } else {
    console.error("Failed to install to any agent.");
    process.exit(1);
  }

  try {
    seedConfig(HOME);
  } catch {
    // Preferences are optional. A folder that cannot be written never fails an install.
  }

  console.log();
  console.log("Try it: open your agent in a project and say");
  console.log('  "check that the home page loads on my app"');
  console.log("Your agent will check that kane-cli is ready, run it, and show you the result.");
  console.log("Preferences live in ~/.testmuai/kaneai/agent-config/");
}

function uninstall() {
  console.log("Removing kane-cli skill...\n");

  for (const { dir, agent } of TARGETS) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`  ✓ Removed from ${agent}  →  ${dir}`);
    } else {
      console.log(`  - ${agent}: not installed`);
    }
  }

  console.log("\nDone.");
}

// Reads "--name value" and "--name=value" pairs. Anything else is a positional.
// A flag with no value gets "", which the caller reports as a bad value.
function parseArgs(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
    } else if (arg.includes("=")) {
      flags[arg.slice(2, arg.indexOf("="))] = arg.slice(arg.indexOf("=") + 1);
    } else {
      const hasValue = i + 1 < args.length && !args[i + 1].startsWith("--");
      flags[arg.slice(2)] = hasValue ? args[++i] : "";
    }
  }
  return { flags, positionals };
}

function fail(message, usage) {
  console.error(message);
  if (usage) console.error(usage);
  process.exit(1);
}

function rejectUnknownFlags(flags, known, usage) {
  const unknown = Object.keys(flags).find((name) => !known.includes(name));
  if (unknown) fail(`Unknown option: --${unknown}`, usage);
}

const PREFS_USAGE = `Usage: npx ${PACKAGE} prefs --watch <v> --purpose <v> [--narration <v>]`;
const STRIP_USAGE = `Usage: npx ${PACKAGE} strip enable|disable|status [--host claude-code]`;

function prefs(args) {
  const { flags, positionals } = parseArgs(args);
  const names = Object.keys(ALLOWED);
  if (positionals.length > 0) fail(`Unexpected argument: ${positionals[0]}`, PREFS_USAGE);
  rejectUnknownFlags(flags, names, PREFS_USAGE);

  const given = names.filter((name) => flags[name] !== undefined);
  if (given.length === 0) {
    fail("Nothing to save. Pass at least one of --watch, --purpose or --narration.", PREFS_USAGE);
  }

  try {
    writeConfig(HOME, mergePrefs(readConfig(HOME), flags));
  } catch (err) {
    fail(err.message);
  }

  console.log("Saved your preferences:");
  for (const name of given) console.log(`  ${name}: ${flags[name]}`);
  console.log(`File: ${configPath(HOME)}`);
}

function strip(args) {
  const { flags, positionals } = parseArgs(args);
  const action = positionals[0];
  if (!["enable", "disable", "status"].includes(action) || positionals.length > 1) {
    fail("Choose one of: enable, disable, status.", STRIP_USAGE);
  }
  rejectUnknownFlags(flags, ["host"], STRIP_USAGE);

  const host = flags.host === undefined ? "claude-code" : flags.host;
  const agent = HOST_NAMES[host] || host;

  try {
    if (action === "enable") {
      // enableStrip checks the host, the settings file and that STRIP_SOURCE
      // exists before it changes anything, and throws a plain message if not.
      const { changed, backup } = enableStrip({ home: HOME, host, binSource: STRIP_SOURCE, nodePath: process.execPath });
      const { wrapsOriginal } = stripStatus({ home: HOME, host });
      if (!changed) {
        console.log(`The live strip is already on for ${agent}. Nothing changed.`);
      } else if (wrapsOriginal) {
        console.log(`The live strip is on for ${agent}. Your own status line still shows, with kane-cli runs under it.`);
      } else {
        console.log(`The live strip is on for ${agent}. It shows in the status line while kane-cli runs.`);
      }
      if (backup) console.log(`A copy of your settings from before this change is at ${backup}`);
      console.log(`To undo: npx ${PACKAGE} strip disable`);
    } else if (action === "disable") {
      const { changed, restored } = disableStrip({ home: HOME, host });
      if (!changed) {
        console.log(`The live strip is already off for ${agent}. Nothing changed.`);
      } else if (restored) {
        console.log(`The live strip is off for ${agent}. Your own status line is back as it was.`);
      } else {
        console.log(`The live strip is off for ${agent}. Your other settings were left as they are.`);
      }
      console.log(`To turn it on again: npx ${PACKAGE} strip enable`);
    } else {
      const { enabled, installed, wrapsOriginal } = stripStatus({ home: HOME, host });
      console.log(`Live strip for ${agent}: ${enabled ? "on" : "off"}`);
      console.log(`Status line points to the strip: ${installed ? "yes" : "no"}`);
      console.log(`Keeps showing your own status line: ${wrapsOriginal ? "yes" : "no"}`);
    }
  } catch (err) {
    fail(err.message);
  }
}

function help() {
  console.log(`Usage: npx ${PACKAGE} [command]`);
  console.log();
  console.log("Commands:");
  console.log("  install      Install kane-cli skill for all AI agents (default)");
  console.log("  uninstall    Remove kane-cli skill from all AI agents");
  console.log("  prefs --watch <v> --purpose <v> [--narration <v>]");
  console.log("               Save your preferences for how agents run kane-cli");
  console.log("  strip enable|disable|status [--host claude-code]");
  console.log("               Turn the live strip in your status line on or off, or check it");
  console.log("  --help, -h   Show this help");
  console.log();
  console.log("Preference values:");
  for (const [name, values] of Object.entries(ALLOWED)) {
    console.log(`  --${name.padEnd(11)}${values.join(" | ")}`);
  }
}

const command = process.argv[2] || "install";
const rest = process.argv.slice(3);

switch (command) {
  case "install":
    install();
    break;
  case "uninstall":
  case "remove":
    uninstall();
    break;
  case "prefs":
    prefs(rest);
    break;
  case "strip":
    strip(rest);
    break;
  case "--help":
  case "-h":
    help();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log(`Usage: npx ${PACKAGE} [install|uninstall|prefs|strip]`);
    process.exit(1);
}
