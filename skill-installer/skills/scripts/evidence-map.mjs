#!/usr/bin/env node
// Prints the step sheet of a kane-cli evidence pack.
//
// Joins every step folder to the actions log, the authored execution tree and
// result.yaml by action_id, and lists the error lines of the run logs.
//
//   node evidence-map.mjs <pack.evidence> --out <new empty dir>
//   node evidence-map.mjs <extracted pack dir> [--test <test id>]
//
// No dependencies. Works on Node 18 and later, on macOS, Linux and Windows.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const USAGE = `Usage:
  node evidence-map.mjs <pack.evidence> --out <new empty dir>
  node evidence-map.mjs <extracted pack dir> [--test <test id>]`;

const RUN_SIGNAL = /✗|Traceback|\bERROR\b|\bCRITICAL\b|API error|FAIL\]|Agent failed|\bstuck\b/i;
const PIPELINE_SIGNAL = /\b[A-Z][A-Z_]+_(FAILED|DENIED|INVALID|CONFLICT)\b|\bERROR\b/;
// [file name pattern, line pattern, lines shown per file]
const SIGNAL_SOURCES = [
  [/^\d+-run\.log$/, RUN_SIGNAL, 40],
  [/^runner-stderr\.log$/, RUN_SIGNAL, 20],
  [/^tui\.log$/, PIPELINE_SIGNAL, 12],
];
const CLIP = 220;

class UsageError extends Error {}

function clip(value, width = CLIP) {
  const text = String(value ?? "").split(/\s+/).filter(Boolean).join(" ");
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch {
    return null;
  }
}

function lines(text) {
  return text.split(/\r?\n/);
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function isDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

// The entries of a zip, read from its central directory.
function zipEntries(buffer) {
  const END = 0x06054b50;
  const CENTRAL = 0x02014b50;
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new UsageError("not a zip file: no end-of-archive record found");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) {
    throw new UsageError("this pack uses zip64, which this script does not read: unzip it yourself and pass the directory");
  }
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL) throw new UsageError("damaged zip: bad central directory entry");
    const nameLength = buffer.readUInt16LE(offset + 28);
    entries.push({
      name: buffer.toString("utf8", offset + 46, offset + 46 + nameLength),
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return entries;
}

function zipEntryData(buffer, entry) {
  const start = entry.localOffset + 30
    + buffer.readUInt16LE(entry.localOffset + 26) + buffer.readUInt16LE(entry.localOffset + 28);
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new UsageError(`unsupported compression in pack entry: ${entry.name}`);
}

// Unzips a pack into an empty directory, refusing entries that escape it.
function extract(pack, out) {
  fs.mkdirSync(out, { recursive: true });
  if (fs.readdirSync(out).length > 0) throw new UsageError(`--out must be an empty directory: ${out}`);
  const root = fs.realpathSync(out);
  const buffer = fs.readFileSync(pack);
  const entries = zipEntries(buffer);
  for (const entry of entries) {
    const target = path.resolve(root, entry.name);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new UsageError(`refusing pack entry outside the output directory: ${entry.name}`);
    }
  }
  for (const entry of entries) {
    const target = path.resolve(root, entry.name);
    if (entry.name.endsWith("/")) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, zipEntryData(buffer, entry));
    }
  }
  return root;
}

// The flat `steps:` list of result.yaml, one object per row.
function resultSteps(file) {
  const rows = [];
  let current = null;
  let inside = false;
  const unquote = (value) => value.trim().replace(/^['"]|['"]$/g, "");
  for (const line of lines(readText(file))) {
    if (line.startsWith("steps:")) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (line && !line.startsWith(" ")) break;
    const item = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const field = line.match(/^\s+(\w+):\s*(.*)$/);
    if (item) {
      current = { [item[1]]: unquote(item[2]) };
      rows.push(current);
    } else if (field && current) {
      current[field[1]] = unquote(field[2]);
    }
  }
  return rows;
}

// operation_id -> the authored instruction node that owns it.
function executionLeaves(node, found, container = null) {
  if (Array.isArray(node)) {
    for (const value of node) executionLeaves(value, found, container);
  } else if (node && typeof node === "object") {
    if (node.condition && String(node.content_type ?? "").endsWith("_block")) {
      container = `${node.content_type} condition=${JSON.stringify(node.condition)} condition_met=${node.condition_met}`;
    }
    for (const op of Array.isArray(node.operations) ? node.operations : []) {
      if (op && typeof op === "object" && op.operation_id) {
        found.set(op.operation_id, {
          instruction: node.instruction,
          reasoning: node.reasoning,
          intent: op.intent,
          status: node.status,
          error: node.error_message || op.error_message,
          container,
        });
      }
    }
    for (const value of Object.values(node)) executionLeaves(value, found, container);
  }
  return found;
}

function actionsById(logsDir) {
  const found = new Map();
  for (const name of listDir(logsDir).filter((file) => /-actions\.ndjson$/.test(file))) {
    lines(readText(path.join(logsDir, name))).forEach((line, index) => {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        return;
      }
      if (row && typeof row === "object" && row.action_id) {
        row._where = `${name}:${index + 1}`;
        found.set(row.action_id, row);
      }
    });
  }
  return found;
}

function stepFolders(stepsDir) {
  const folders = [];
  for (const name of listDir(stepsDir)) {
    const dir = path.join(stepsDir, name);
    if (!isDir(dir)) continue;
    const files = listDir(dir);
    const lead = name.match(/^\d+/);
    folders.push({
      name,
      ordinal: lead ? Number(lead[0]) : 0,
      step: readJson(path.join(dir, "step.json")) || {},
      screenshot: files.find((file) => file.startsWith("screenshot.")) || null,
      annotated: files.find((file) => file.startsWith("annotated.")) || null,
      failure: files.includes("failure.yaml"),
    });
  }
  return folders.sort((a, b) => a.ordinal - b.ordinal);
}

function printSignals(logsDir, print) {
  print("\nLOG SIGNALS (pattern matches only; open the log around each, and search it yourself for more)");
  const names = listDir(logsDir);
  for (const [filePattern, signal, limit] of SIGNAL_SOURCES) {
    for (const name of names.filter((file) => filePattern.test(file))) {
      const hits = [];
      lines(readText(path.join(logsDir, name))).forEach((line, index) => {
        if (signal.test(line)) hits.push([index + 1, line]);
      });
      print(`  ${name}: ${hits.length} matching line(s)`);
      for (const [number, line] of hits.slice(0, limit)) print(`    ${number}: ${clip(line)}`);
      if (hits.length > limit) print(`    … ${hits.length - limit} more, last at line ${hits[hits.length - 1][0]}`);
    }
  }
}

function printTest(testDir, print) {
  print("\n" + "=".repeat(78));
  print(`TEST ${path.basename(testDir)}`);
  const logsDir = path.join(testDir, "logs");
  const folders = stepFolders(path.join(testDir, "steps"));
  const actions = actionsById(logsDir);
  const leaves = executionLeaves(readJson(path.join(testDir, "auteur", "execution.json")), new Map());
  const rows = resultSteps(path.join(testDir, "result.yaml"));
  const rowByAction = new Map(rows.filter((row) => row.action_id).map((row) => [row.action_id, row]));
  const rowById = new Map(rows.filter((row) => row.id).map((row) => [row.id, row]));
  print(`  step folders=${folders.length} action rows=${actions.size}`
    + ` authored operations=${leaves.size} result.yaml rows=${rows.length}`);

  print("\nSTEP SHEET (screenshot = the screen BEFORE this step's action ran)");
  let carried = null;
  const seenActions = new Set();
  for (const folder of folders) {
    const step = folder.step;
    const actionId = step.action_id;
    const ids = actionId ? [actionId] : [];
    for (const id of Array.isArray(step.analyze_action_ids) ? step.analyze_action_ids : []) {
      if (!ids.includes(id)) ids.push(id);
    }
    for (const id of ids) seenActions.add(id);
    const row = rowById.get(step.id) || rowByAction.get(actionId) || {};
    let shotNote;
    if (folder.screenshot) {
      carried = `steps/${folder.name}/${folder.screenshot}`;
      shotNote = carried;
    } else {
      shotNote = `NONE — latest earlier image: ${carried || "none"}`;
    }
    const joined = [["A", actions], ["E", leaves], ["R", rowByAction]]
      .filter(([, source]) => source.has(actionId))
      .map(([mark]) => mark)
      .join("");
    print(`\n[${folder.name}] id=${step.id} kind=${step.kind}`
      + ` step.json=${step.status} result.yaml=${row.status ?? "-"}`
      + ` duration_ms=${step.duration_ms}${folder.failure ? "  <-- FAILURE RECORD" : ""}`);
    print(`    action_id=${actionId || "NONE (join by id/ordinal only)"} joined=${joined || "-"}`
      + "   (A=actions log E=execution.json R=result.yaml)");
    print(`    screenshot: ${shotNote}${folder.annotated ? `   annotated: ${folder.annotated}` : ""}`);
    print(`    summary: ${clip(step.summary)}`);
    for (const id of ids) {
      const leaf = leaves.get(id);
      const action = actions.get(id);
      if (leaf) {
        print(`    authored[${id}]: intent=${clip(leaf.intent, 120)} | instruction=${clip(leaf.instruction, 160)}`
          + ` | status=${leaf.status}`);
        if (leaf.container) print(`      inside: ${clip(leaf.container, 200)}`);
        if (leaf.reasoning) print(`      reasoning: ${clip(leaf.reasoning, 400)}`);
        if (leaf.error) print(`      error: ${clip(leaf.error, 300)}`);
      }
      if (action) {
        print(`    action[${action._where}]: ${action.action_type} status=${action.status}`
          + ` at=${action.timestamp} | ${clip(action.action_instruction, 160)}`);
        if (action.action_params && Object.keys(action.action_params).length > 0) {
          print(`      params: ${clip(JSON.stringify(action.action_params), 300)}`);
        }
        if (action.rationale) print(`      rationale: ${clip(action.rationale, 400)}`);
        if (action.error) print(`      error: ${clip(action.error, 300)}`);
      }
    }
  }

  print("\nUNMAPPED");
  let unmapped = 0;
  for (const [id, action] of actions) {
    if (seenActions.has(id)) continue;
    unmapped++;
    print(`  action with no step folder: ${action._where} ${action.action_type}`
      + ` status=${action.status} | ${clip(action.action_instruction, 140)}`);
  }
  const folderIds = new Set(folders.map((folder) => folder.step.id));
  const skipped = [];
  for (const row of rows) {
    if (folderIds.has(row.id) || seenActions.has(row.action_id)) continue;
    unmapped++;
    if (row.status === "skipped") {
      skipped.push(row);
      continue;
    }
    const leaf = leaves.get(row.action_id) || {};
    print(`  result.yaml row with no step folder: ordinal=${row.ordinal} id=${row.id}`
      + ` status=${row.status} | authored: ${clip(leaf.instruction || leaf.intent, 140)}`);
  }
  if (skipped.length > 0) {
    print(`  ${skipped.length} skipped result.yaml row(s) with no step folder,`
      + ` ordinals ${skipped[0].ordinal}-${skipped[skipped.length - 1].ordinal}: the run never reached them`);
  }
  if (unmapped === 0) print("  none");

  for (const folder of folders.filter((one) => one.failure)) {
    const text = readText(path.join(testDir, "steps", folder.name, "failure.yaml"));
    if (!/^triage:/m.test(text)) continue;
    const verified = text.match(/verification:\s*\r?\n\s*status:\s*(\S+)/);
    print(`\nEMBEDDED TRIAGE in steps/${folder.name}/failure.yaml`
      + ` (verification=${verified ? verified[1] : "unknown"}): a claim to check, not a finding`);
  }
  printSignals(logsDir, print);
}

function parseArgs(argv) {
  const args = { target: null, out: null, test: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "--test") {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
      args[arg.slice(2)] = argv[++i];
    } else if (arg.startsWith("--")) {
      throw new UsageError(`unknown option: ${arg}`);
    } else if (args.target === null) {
      args.target = arg;
    } else {
      throw new UsageError(`unexpected argument: ${arg}`);
    }
  }
  if (args.target === null) throw new UsageError("pass a .evidence pack or an extracted pack directory");
  return args;
}

export function main(argv, print = console.log) {
  const args = parseArgs(argv);
  let root = args.target;
  if (!fs.existsSync(root)) throw new UsageError(`not found: ${root}`);
  if (!isDir(root)) {
    if (!args.out) throw new UsageError("--out <new empty dir> is required for a .evidence file");
    root = extract(root, args.out);
  }
  print(`PACK ${root}`);
  for (const name of ["run.yaml", "failure.yaml"]) {
    print(`\n--- ${name}\n${readText(path.join(root, name)).trimEnd()}`);
  }
  const tests = listDir(path.join(root, "tests"))
    .filter((name) => !args.test || name === args.test)
    .map((name) => path.join(root, "tests", name))
    .filter(isDir);
  if (tests.length === 0) {
    throw new UsageError(args.test ? `no test named ${args.test} under tests/` : "no tests found under tests/");
  }
  for (const testDir of tests) printTest(testDir, print);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    console.error(USAGE);
    process.exit(2);
  }
}
