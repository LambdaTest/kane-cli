import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { startApp, stopApp } from "../src/app.mjs";

const freePort = () => new Promise((res) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const up = async (url) => { try { await fetch(url); return true; } catch { return false; } };

function appDir(port, { delayMs = 300 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kane-app-"));
  writeFileSync(join(dir, "server.mjs"), `import http from "node:http";\nsetTimeout(() => http.createServer((q, r) => r.end(q.url)).listen(${port}, "127.0.0.1"), ${delayMs});\n`);
  return dir;
}

test("app start → ready → stop: the start command runs in the PR checkout, ready polls url+ready_path, stop kills it", async () => {
  const port = await freePort();
  const dir = appDir(port);
  const pidFile = join(dir, "app.pid");
  const url = `http://127.0.0.1:${port}`;
  const app = await startApp({ start: `${JSON.stringify(process.execPath)} server.mjs`, url, readyPath: "/health", cwd: dir, pidFile, timeoutMs: 10_000 });
  assert.ok(existsSync(pidFile), "the pid file lets an always-step stop it");
  assert.equal(await (await fetch(`${url}/health`)).text(), "/health");
  await app.stop();
  assert.equal(await up(url), false, "stopped");
  assert.ok(!existsSync(pidFile));
});

test("an app that never gets ready fails after the timeout and is stopped", async () => {
  const port = await freePort();
  const dir = appDir(port, { delayMs: 60_000 });
  const pidFile = join(dir, "app.pid");
  await assert.rejects(startApp({ start: `${JSON.stringify(process.execPath)} server.mjs`, url: `http://127.0.0.1:${port}`, readyPath: "/", cwd: dir, pidFile, timeoutMs: 800 }), /wasn't ready at http:\/\/127\.0\.0\.1:\d+\/ after 1 s/);
  assert.ok(!existsSync(pidFile));
});

test("an app that exits before it's ready fails at once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kane-app-"));
  await assert.rejects(startApp({ start: "exit 3", url: "http://127.0.0.1:9", readyPath: "/", cwd: dir, pidFile: join(dir, "app.pid"), timeoutMs: 10_000 }), /app exited \(code 3\) before it was ready/);
});

test("stopApp with the pid file stops a running app (the always-step); a missing file is fine", async () => {
  const port = await freePort();
  const dir = appDir(port, { delayMs: 0 });
  const pidFile = join(dir, "app.pid");
  const url = `http://127.0.0.1:${port}`;
  await startApp({ start: `${JSON.stringify(process.execPath)} server.mjs`, url, readyPath: "/", cwd: dir, pidFile, timeoutMs: 10_000 });
  await stopApp(pidFile);
  assert.equal(await up(url), false);
  await stopApp(pidFile);
});

test("fix 2: after stop, anything still listening on the app port is killed (an escaped grandchild)", async () => {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "kane-app-"));
  // the start command forks a detached child (its own process group) that holds the port
  writeFileSync(join(dir, "child.mjs"), `import http from "node:http";\nhttp.createServer((q, r) => r.end("child")).listen(${port}, "127.0.0.1");\n`);
  writeFileSync(join(dir, "server.mjs"), `import { spawn } from "node:child_process";\nspawn(process.execPath, ["child.mjs"], { detached: true, stdio: "ignore" }).unref();\nsetInterval(() => {}, 1000);\n`);
  const url = `http://127.0.0.1:${port}`;
  const app = await startApp({ start: `${JSON.stringify(process.execPath)} server.mjs`, url, readyPath: "/", cwd: dir, pidFile: join(dir, "app.pid"), timeoutMs: 10_000, workRoot: dir });
  await app.stop();
  assert.equal(await up(url), false, "the escaped listener (cwd under the work root) is gone too");
});

test("fix 3: a stale app (cwd under the work root) already on the port is killed before ours starts", async () => {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "kane-app-"));
  writeFileSync(join(dir, "stale.mjs"), `import http from "node:http";\nhttp.createServer((q, r) => r.end("stale")).listen(${port}, "127.0.0.1");\n`);
  const { spawn } = await import("node:child_process");
  spawn(process.execPath, ["stale.mjs"], { cwd: dir, detached: true, stdio: "ignore" }).unref();
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50 && !(await up(url)); i++) await new Promise((r) => setTimeout(r, 50));
  writeFileSync(join(dir, "server.mjs"), `import http from "node:http";\nhttp.createServer((q, r) => r.end("ours")).listen(${port}, "127.0.0.1");\n`);
  const app = await startApp({ start: `${JSON.stringify(process.execPath)} server.mjs`, url, readyPath: "/", cwd: dir, pidFile: join(dir, "app.pid"), timeoutMs: 10_000, workRoot: dir });
  assert.equal(await (await fetch(url)).text(), "ours");
  await app.stop();
});

test("fix 3: a port that still answers after the kill is 'port in use'", async () => {
  const http = await import("node:http");
  const port = await freePort();
  const server = http.createServer((q, r) => r.end("me")).listen(port, "127.0.0.1"); // this process: never killed
  await new Promise((r) => server.on("listening", r));
  const dir = mkdtempSync(join(tmpdir(), "kane-app-"));
  try {
    await assert.rejects(startApp({ start: "sleep 5", url: `http://127.0.0.1:${port}`, readyPath: "/", cwd: dir, pidFile: join(dir, "app.pid"), timeoutMs: 2000 }), (e) => e.name === "PipelineError" && /port \d+ is in use/.test(e.message));
    assert.ok(!existsSync(join(dir, "app.pid")), "nothing was started");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

// --- fix round 2: never kill what this job (or an earlier kane job) didn't start -----------------

async function listener(port, cwd, text = "theirs") {
  writeFileSync(join(cwd, "l.mjs"), `import http from "node:http";\nhttp.createServer((q, r) => r.end(${JSON.stringify(text)})).listen(${port}, "127.0.0.1");\n`);
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["l.mjs"], { cwd, detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 50 && !(await up(`http://127.0.0.1:${port}`)); i++) await new Promise((r) => setTimeout(r, 50));
  return child.pid;
}
const kill = (pid) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch {}
};

test("round 2: a foreign listener (cwd outside the work root, no kane pid file) is left alone and is a PipelineError", async () => {
  const port = await freePort();
  const foreign = mkdtempSync(join(tmpdir(), "other-dev-"));
  const work = mkdtempSync(join(tmpdir(), "kane-work-"));
  const pid = await listener(port, foreign, "another dev server");
  try {
    await assert.rejects(
      startApp({ start: "sleep 5", url: `http://127.0.0.1:${port}`, readyPath: "/", cwd: work, pidFile: join(work, "app.pid"), timeoutMs: 2000, workRoot: work }),
      (e) => e.name === "PipelineError" && new RegExp(`port ${port} is in use by another process \\(pid ${pid}, cwd [^)]*other-dev-`).test(e.message) && /free it or change app\.url/.test(e.message),
    );
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "another dev server", "not killed");
    assert.ok(!existsSync(join(work, "app.pid")), "nothing started");
  } finally {
    kill(pid);
  }
});

test("round 2: stopApp's sweep leaves a foreign listener on the port alone", async () => {
  const port = await freePort();
  const foreign = mkdtempSync(join(tmpdir(), "other-dev-"));
  const work = mkdtempSync(join(tmpdir(), "kane-work-"));
  const pidFile = join(work, "app.pid");
  writeFileSync(pidFile, JSON.stringify({ pid: 999999, port, workRoot: work }));
  const pid = await listener(port, foreign);
  try {
    await stopApp(pidFile);
    assert.equal(await up(`http://127.0.0.1:${port}`), true, "the other process still answers");
  } finally {
    kill(pid);
  }
});

test("round 2: a listener whose pid is in a recorded kane pid file is killed even outside the work root", async () => {
  const port = await freePort();
  const elsewhere = mkdtempSync(join(tmpdir(), "elsewhere-"));
  const work = mkdtempSync(join(tmpdir(), "kane-work-"));
  const pidFile = join(work, "app.pid");
  const pid = await listener(port, elsewhere);
  writeFileSync(pidFile, JSON.stringify({ pid, port, workRoot: work })); // an earlier kane job's app
  try {
    await stopApp(pidFile);
    assert.equal(await up(`http://127.0.0.1:${port}`), false);
  } finally {
    kill(pid);
  }
});

test("round 2: a non-loopback app.url is never probed-and-killed locally", async () => {
  const port = await freePort();
  const work = mkdtempSync(join(tmpdir(), "kane-work-"));
  const pid = await listener(port, work); // cwd under the work root: would be killed on loopback
  try {
    const app = await startApp({ start: "sleep 30", url: `http://0.0.0.0:${port}`, readyPath: "/", cwd: work, pidFile: join(work, "app.pid"), timeoutMs: 5000, workRoot: work });
    await app.stop();
    assert.equal(await up(`http://127.0.0.1:${port}`), true, "left running");
  } finally {
    kill(pid);
  }
});
