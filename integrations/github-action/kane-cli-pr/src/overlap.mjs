// One kane-cli test run at a time on this machine: on a self-hosted runner, other kane-cli sessions
// (local or from another job) may be driving Chrome too.
import { execFile } from "node:child_process";
import { PipelineError } from "./kane.mjs";

export const OVERLAP_TIMEOUT_MS = 10 * 60_000;
export const OVERLAP_POLL_MS = 10_000;
export const WAITING = "⏳ waiting for another kane-cli run on this machine to finish";

const KANE_RUN = /(?:kane-cli|index\.tsx)\b.*\b(?:testrun|testmd)\s+run\b/;
const RUNNER = /\bv16[-_]runner\b/;

/** This machine's processes: [{pid, ppid, command}]. */
export function psList() {
  return new Promise((res) =>
    execFile("ps", ["-axo", "pid=,ppid=,command="], { maxBuffer: 16 * 1024 * 1024 }, (err, out) => {
      if (err) return res([]);
      res(
        String(out)
          .split("\n")
          .map((l) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l))
          .filter(Boolean)
          .map(([, pid, ppid, command]) => ({ pid: Number(pid), ppid: Number(ppid), command })),
      );
    }),
  );
}

/** kane-cli `testrun|testmd run` and v16-runner processes that aren't `selfPid` or its descendants. */
export function otherRuns(list, selfPid = process.pid) {
  const mine = new Set([selfPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of list) if (!mine.has(p.pid) && mine.has(p.ppid)) (mine.add(p.pid), (grew = true));
  }
  return list.filter((p) => !mine.has(p.pid) && (KANE_RUN.test(p.command) || RUNNER.test(p.command)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const span = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

/**
 * Waits while another kane-cli run is live (polling), calling onWait once when it starts
 * waiting; a PipelineError after timeoutMs.
 */
export async function waitForOtherRuns({ list = psList, selfPid = process.pid, timeoutMs = OVERLAP_TIMEOUT_MS, pollMs = OVERLAP_POLL_MS, onWait = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs;
  let waited = false;
  for (;;) {
    const others = otherRuns(await list(), selfPid);
    if (others.length === 0) return;
    if (!waited) {
      waited = true;
      await onWait(others);
    }
    if (Date.now() >= deadline) {
      throw new PipelineError(`Another kane-cli run on this machine (pid ${others.map((p) => p.pid).join(", ")}) didn't finish within ${span(timeoutMs)}, so kane didn't start this one. Ask again once it's done.`);
    }
    await sleep(pollMs);
  }
}
