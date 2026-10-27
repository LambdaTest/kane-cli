#!/usr/bin/env node
// A fake kane-cli: prints fixture NDJSON for the command it's given and records every call.
// FAKE_KANE_DIR holds the scenario: impact.ndjson, testrun.ndjson, help.txt, login.exit,
// testrun.exit; calls.ndjson collects one {argv, cwd} line per call.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const dir = process.env.FAKE_KANE_DIR;
const argv = process.argv.slice(2);
const cwd = process.cwd();
appendFileSync(join(dir, "calls.ndjson"), JSON.stringify({ argv, cwd, home: process.env.HOME, homeExists: existsSync(process.env.HOME ?? "") }) + "\n");
const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : null);
const exitOf = (name, dflt) => Number(read(name)?.trim() ?? dflt);
const print = (text) => process.stdout.write(text.replaceAll("${CWD}", cwd).replaceAll("${FAKE}", dir));

if (argv[0] === "login") {
  process.exit(exitOf("login.exit", 0));
} else if (argv[0] === "testrun" && argv.includes("--help")) {
  print(read("help.txt") ?? "Usage: kane-cli testrun run [options]\n");
} else if (argv[0] === "context" && argv[1] === "impact") {
  const input = argv[argv.indexOf("--input") + 1];
  writeFileSync(join(dir, "impact-input.diff"), readFileSync(input, "utf8"));
  print(read("impact.ndjson") ?? "");
  process.exit(exitOf("impact.exit", 0));
} else if (argv[0] === "testrun" && argv[1] === "run") {
  const text = read("testrun.ndjson") ?? "";
  const done = text.split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.type === "testrun_done");
  if (done?.execution_id && read("no-pack") === null) {
    mkdirSync(join(cwd, ".testmuai", "evidence"), { recursive: true });
    writeFileSync(join(cwd, ".testmuai", "evidence", `${done.execution_id}.evidence`), "PACK");
  }
  // the verdict file the `verdict` event names, as kane-cli writes it beside the pack
  const verdict = text.split("\n").filter(Boolean).map((l) => JSON.parse(l.replaceAll("${CWD}", cwd))).find((e) => e.type === "verdict");
  const vfile = verdict?.policies?.[0]?.file;
  if (vfile && read("verdict.json") !== null) {
    mkdirSync(dirname(vfile), { recursive: true });
    writeFileSync(vfile, read("verdict.json"));
  }
  print(text);
  process.exit(exitOf("testrun.exit", 1));
} else {
  process.stderr.write(`fake kane-cli: unknown command ${argv.join(" ")}\n`);
  process.exit(2);
}
