// The PR's own build, served from the PR checkout while its tests run (config `app`).
import { execFile, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { sep } from "node:path";
import { PipelineError } from "./kane.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** The TCP port of an http(s) URL. */
export function portOf(url) {
  const u = new URL(url);
  return Number(u.port || (u.protocol === "https:" ? 443 : 80));
}

/** Pids listening on `port` (lsof), never this process; [] when lsof finds none or isn't there. */
export function listenerPids(port) {
  return new Promise((res) =>
    execFile("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], (err, out) => {
      if (err && !out) return res([]);
      res([...new Set(String(out).split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== process.pid))]);
    }),
  );
}

/** True for the hosts kane may probe and free locally. */
export function isLoopback(url) {
  const h = new URL(url).hostname.replace(/^\[|\]$/g, "");
  return h === "127.0.0.1" || h === "localhost" || h === "::1";
}

/** A process's cwd (lsof -a -p <pid> -d cwd -Fn), or null. */
export function cwdOf(pid) {
  return new Promise((res) =>
    execFile("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], (err, out) => {
      const line = String(out ?? "").split("\n").find((l) => l.startsWith("n"));
      res(line ? line.slice(1) : null);
    }),
  );
}

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
const inside = (path, root) => Boolean(path && root) && (real(path) + sep).startsWith(real(root) + sep);

/**
 * The listeners on `port`, each marked ours when kane started it: its pid is in `kanePids`
 * (a recorded kane pid file) or its cwd is inside `workRoot` (the runner's work root).
 */
export async function listenersOn(port, { workRoot = null, kanePids = [] } = {}) {
  const out = [];
  for (const pid of await listenerPids(port)) {
    const cwd = await cwdOf(pid);
    out.push({ pid, cwd, ours: kanePids.includes(pid) || inside(cwd, workRoot) });
  }
  return out;
}

async function killPids(pids) {
  for (const pid of pids) killGroup(pid, "SIGTERM");
  for (let i = 0; i < 30 && pids.some(alive); i++) await sleep(100);
  for (const pid of pids.filter(alive)) killGroup(pid, "SIGKILL");
}

const foreignError = (port, list) =>
  new PipelineError(`The app's port ${port} is in use by another process (${list.map((l) => `pid ${l.pid}, cwd ${l.cwd ?? "unknown"}`).join("; ")}); free it or change app.url. kane stops only processes its own jobs started.`);

/**
 * Stops kane's listeners on `port`. Never kills a process kane didn't start: with any foreign
 * listener it kills nothing and throws a PipelineError (`strict`) or leaves them (`!strict`).
 */
export async function killListeners(port, { workRoot = null, kanePids = [], strict = true } = {}) {
  const list = await listenersOn(port, { workRoot, kanePids });
  const foreign = list.filter((l) => !l.ours);
  if (foreign.length && strict) throw foreignError(port, foreign);
  const ours = list.filter((l) => l.ours).map((l) => l.pid);
  await killPids(ours);
  return ours;
}

/** True when anything answers HTTP at `target`. */
async function answers(target) {
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(1500) });
    await res.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** The pid file: {pid, port, workRoot, loopback} (a bare pid is read too). */
function readPidFile(pidFile) {
  const text = readFileSync(pidFile, "utf8").trim();
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object") return { pid: Number(v.pid), port: v.port == null ? null : Number(v.port), workRoot: v.workRoot ?? null, loopback: v.loopback !== false };
    return { pid: Number(v), port: null };
  } catch {
    return { pid: Number(text), port: null };
  }
}

/**
 * Stops the app in `pidFile` (its whole process group), then anything still listening on its
 * port (a child that left the group). A missing file is fine.
 */
export async function stopApp(pidFile) {
  if (!existsSync(pidFile)) return;
  const { pid, port, workRoot, loopback } = readPidFile(pidFile);
  rmSync(pidFile, { force: true });
  if (Number.isInteger(pid) && pid > 0 && killGroup(pid, "SIGTERM")) {
    for (let i = 0; i < 30 && alive(pid); i++) await sleep(100);
    if (alive(pid)) killGroup(pid, "SIGKILL");
  }
  // the sweep: kane's own leftovers on the port (an escaped child), never anyone else's
  if (loopback && Number.isInteger(port) && port > 0) await killListeners(port, { workRoot, kanePids: [pid], strict: false });
}

/**
 * Frees `url`'s port of a stale app, runs `start` with bash in `cwd` (its own process group,
 * {pid, port} in `pidFile`), then waits until `url + readyPath` answers below 400. Resolves
 * {stop}; rejects (after stopping it) when the app exits first or isn't ready in `timeoutMs`.
 */
export async function startApp({ start, url, readyPath = "/", cwd, pidFile, timeoutMs = 60_000, log = () => {}, env = process.env, workRoot = null }) {
  const target = new URL(readyPath, url).href;
  const port = portOf(url);
  const loopback = isLoopback(url);
  // a stale app (an earlier kane job's) must not pass our readiness check; only on this machine's
  // loopback, and only processes kane started (a recorded pid, or a cwd under the work root)
  if (loopback && (await answers(target))) {
    const kanePids = existsSync(pidFile) ? [readPidFile(pidFile).pid] : [];
    const killed = await killListeners(port, { workRoot, kanePids });
    rmSync(pidFile, { force: true });
    log(`kane: something already answered at ${target}; stopped kane's own ${killed.length ? killed.join(", ") : "nothing"}`);
    for (let i = 0; i < 20 && (await answers(target)); i++) await sleep(100);
    if (await answers(target)) throw new PipelineError(`The app's port ${port} is in use: something at ${target} still answers and isn't a process kane started; free it or change app.url.`);
  }
  // the app's own output, so a start that never answers can say why
  const appLog = joinPath(dirname(pidFile), "app.log");
  const out = openSync(appLog, "a");
  const tail = () => {
    try {
      const lines = readFileSync(appLog, "utf8").trim().split("\n").filter(Boolean).slice(-5);
      return lines.length ? ` The app said: ${lines.join(" | ").slice(0, 400)}` : " The app printed nothing.";
    } catch {
      return "";
    }
  };
  const child = spawn("bash", ["-c", start], { cwd, env, detached: true, stdio: ["ignore", out, out] });
  let exited = null;
  child.on("exit", (code, signal) => (exited = { code, signal }));
  child.on("error", () => (exited = { code: 127 }));
  child.unref();
  if (child.pid) writeFileSync(pidFile, JSON.stringify({ pid: child.pid, port, workRoot, loopback }));
  const stop = () => stopApp(pidFile);
  log(`kane: started the app (${start}); waiting for ${target}`);
  const deadline = Date.now() + timeoutMs;
  let lastSeen = "no answer";
  while (Date.now() < deadline) {
    if (exited) {
      await stop();
      throw new PipelineError(`The app exited (code ${exited.code ?? exited.signal}) before it was ready at ${target}.${tail()}`);
    }
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(2000) });
      await res.body?.cancel().catch(() => {});
      if (res.status < 400) {
        log(`kane: the app is ready (${res.status})`);
        return { stop };
      }
      lastSeen = `HTTP ${res.status}`;
    } catch (err) {
      lastSeen = err?.cause?.code ?? err?.name ?? "no answer";
    }
    await sleep(250);
  }
  await stop();
  throw new PipelineError(`The app wasn't ready at ${target} after ${Math.round(timeoutMs / 1000)} s (last: ${lastSeen}).${tail()}`);
}
