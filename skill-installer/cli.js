#!/usr/bin/env node

import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SKILL_NAME = "kane-cli";
const SOURCE_DIR = join(__dirname, "skills");

const TARGETS = [
  { dir: join(homedir(), ".claude", "skills", SKILL_NAME), agent: "Claude Code" },
  { dir: join(homedir(), ".agents", "skills", SKILL_NAME), agent: "Codex CLI" },
  { dir: join(homedir(), ".gemini", "skills", SKILL_NAME), agent: "Gemini CLI" },
];

function install() {
  if (!existsSync(SOURCE_DIR)) {
    console.error("Error: skills directory not found in package.");
    process.exit(1);
  }

  console.log("Installing kane-cli skill...\n");

  let installed = 0;
  for (const { dir, agent } of TARGETS) {
    try {
      mkdirSync(dir, { recursive: true });
      cpSync(SOURCE_DIR, dir, { recursive: true, force: true });
      console.log(`  ✓ ${agent}  →  ${dir}`);
      installed++;
    } catch (err) {
      console.error(`  ✗ ${agent}  →  ${err.message}`);
    }
  }

  console.log();
  if (installed > 0) {
    console.log(`Installed to ${installed}/3 agents.`);
    console.log();
    console.log("Usage:");
    console.log("  Claude Code  →  /kane-cli  or ask any browser task");
    console.log("  Codex CLI    →  $kane-cli  or ask any browser task");
    console.log("  Gemini CLI   →  /skills list  or ask any browser task");
  } else {
    console.error("Failed to install to any agent.");
    process.exit(1);
  }
}

function uninstall() {
  console.log("Removing kane-cli skill...\n");

  for (const { dir, agent } of TARGETS) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`  ✓ Removed from ${agent}  →  ${dir}`);
    } else {
      console.log(`  - ${agent} — not installed`);
    }
  }

  console.log("\nDone.");
}

const command = process.argv[2] || "install";

switch (command) {
  case "install":
    install();
    break;
  case "uninstall":
  case "remove":
    uninstall();
    break;
  case "--help":
  case "-h":
    console.log("Usage: npx @testmuai/kane-cli-skill [install|uninstall]");
    console.log();
    console.log("Commands:");
    console.log("  install      Install kane-cli skill for all AI agents (default)");
    console.log("  uninstall    Remove kane-cli skill from all AI agents");
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log("Usage: npx @testmuai/kane-cli-skill [install|uninstall]");
    process.exit(1);
}
