// Runs preflight.ps1 for real. Windows only: everywhere else these are skipped
// and preflight.test.mjs covers the shell twin.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(here, '..', 'skills', 'scripts', 'preflight.ps1');
const win = process.platform === 'win32' ? test : test.skip;
const BASE_SECTIONS = ['version', 'whoami', 'balance', 'settings', 'agent-config', 'env', 'chrome', 'app', 'tests'];

// A stand-in kane-cli for Windows: a .cmd that answers the calls preflight makes.
const FAKE_CLI = [
  '@echo off',
  'if "%1"=="--version" (echo 9.9.9-fake & exit /b 0)',
  'if "%1"=="whoami" (echo FAKE-WHOAMI Authenticated & exit /b 0)',
  'if "%1"=="balance" (echo Available credits: 123.5 & exit /b 0)',
  'if "%1"=="config" (echo {"project_name":"Fake Project","folder_name":"Fake Folder"} & exit /b 0)',
  'if "%1"=="doctor" (echo FAKE-DOCTOR %3 & exit /b 0)',
  'if "%1"=="plugin" (echo FAKE-PLUGIN-DOCTOR & exit /b 0)',
  'exit /b 2',
].join('\r\n');

function sandbox(t, { withCli = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-ps1-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  for (const dir of [bin, home, cwd]) fs.mkdirSync(dir, { recursive: true });
  if (withCli) fs.writeFileSync(path.join(bin, 'kane-cli.cmd'), FAKE_CLI);
  const system = [process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32'),
    process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0')]
    .filter(Boolean).join(path.delimiter);
  return { root, bin, home, cwd, pathVar: `${bin}${path.delimiter}${system}` };
}

function run(sb, args = []) {
  const res = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, ...args], {
    cwd: sb.cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: sb.pathVar, Path: sb.pathVar, USERPROFILE: sb.home, HOME: sb.home, CI: '' },
    timeout: 60000,
  });
  return { status: res.status, stdout: (res.stdout || '').replace(/\r\n/g, '\n'), stderr: res.stderr || '' };
}

function sections(stdout) {
  return stdout.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
}

function body(stdout, name) {
  const lines = stdout.split('\n');
  const start = lines.indexOf(`## ${name}`);
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

win('preflight.ps1 prints the nine base sections in order and exits 0', (t) => {
  const res = run(sandbox(t));
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(sections(res.stdout), BASE_SECTIONS);
  assert.match(body(res.stdout, 'version'), /9\.9\.9-fake/);
  assert.match(body(res.stdout, 'whoami'), /FAKE-WHOAMI/);
  assert.match(body(res.stdout, 'whoami'), /exit=0/);
  assert.match(body(res.stdout, 'balance'), /Available credits: 123\.5/);
  assert.match(body(res.stdout, 'settings'), /Fake Project/);
  assert.match(body(res.stdout, 'env'), /os=Windows/);
  assert.match(body(res.stdout, 'agent-config'), /^none\s*$/m);
  assert.match(body(res.stdout, 'tests'), /count=0/);
});

win('preflight.ps1 reports a missing kane-cli and still prints every section', (t) => {
  const res = run(sandbox(t, { withCli: false }));
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(sections(res.stdout), BASE_SECTIONS);
  assert.match(body(res.stdout, 'version'), /^missing\s*$/m);
  assert.match(body(res.stdout, 'whoami'), /^missing\s*$/m);
});

win('preflight.ps1 adds the mobile and grid sections when asked', (t) => {
  const sb = sandbox(t);
  const res = run(sb, ['--mobile', 'emulator', '--grid']);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(sections(res.stdout), [...BASE_SECTIONS, 'mobile', 'grid']);
  assert.match(body(res.stdout, 'mobile'), /FAKE-DOCTOR/);
  assert.match(body(res.stdout, 'grid'), /FAKE-PLUGIN-DOCTOR/);
  const bad = run(sb, ['--mobile', 'toaster']);
  assert.match(body(bad.stdout, 'mobile'), /invalid target/);
});

win('preflight.ps1 prints the saved preferences and counts saved tests', (t) => {
  const sb = sandbox(t);
  const cfgDir = path.join(sb.home, '.testmuai', 'kaneai', 'agent-config');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'config.json'), '{"version":1,"preferences":{"watch":"quiet"}}');
  fs.mkdirSync(path.join(sb.cwd, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(sb.cwd, 'node_modules', 'x'), { recursive: true });
  fs.writeFileSync(path.join(sb.cwd, 'login_test.md'), '# t');
  fs.writeFileSync(path.join(sb.cwd, 'tests', 'cart_test.md'), '# t');
  fs.writeFileSync(path.join(sb.cwd, 'node_modules', 'x', 'skip_test.md'), '# t');
  const res = run(sb);
  assert.equal(res.status, 0, res.stderr);
  assert.match(body(res.stdout, 'agent-config'), /"watch":"quiet"/);
  assert.match(body(res.stdout, 'tests'), /count=2/);
});
