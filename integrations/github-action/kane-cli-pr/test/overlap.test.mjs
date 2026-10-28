import { test } from "node:test";
import assert from "node:assert/strict";
import { otherRuns } from "../src/overlap.mjs";

const PS = [
  { pid: 10, ppid: 1, command: "node /a/kane-cli/src/index.tsx testrun run x_test.md --agent" },
  { pid: 11, ppid: 1, command: "kane-cli testmd run y_test.md" },
  { pid: 12, ppid: 1, command: "/opt/py/bin/python -m v16_runner.cli serve" },
  { pid: 13, ppid: 1, command: "/a/v16-runner/bin/runner" },
  { pid: 14, ppid: 1, command: "kane-cli context impact --input x" },
  { pid: 15, ppid: 1, command: "vim testrun run notes" },
  { pid: 20, ppid: 1, command: "node main.mjs" },
  { pid: 21, ppid: 20, command: "kane-cli testrun run mine_test.md" },
];

test("other runs: testrun/testmd run and v16-runner processes, never this job's own descendants or other kane-cli verbs", () => {
  assert.deepEqual(otherRuns(PS, 20).map((p) => p.pid), [10, 11, 12, 13]);
});
