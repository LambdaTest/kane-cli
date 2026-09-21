// Tests for skills/scripts/preflight.sh. The script is run with a fake
// `kane-cli` first on PATH, a temp HOME, a temp TMPDIR and a temp cwd, so
// nothing here touches the real CLI, the real account or the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// preflight.sh needs a POSIX shell. On Windows its twin, preflight.ps1, is
// covered by preflight-ps1.test.mjs instead.
const posix = process.platform === 'win32' ? test.skip : test;
const SCRIPT = path.resolve(here, '..', 'skills', 'scripts', 'preflight.sh');
const SYSTEM_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';
const BASE_SECTIONS = [
  'version', 'whoami', 'balance', 'settings', 'agent-config',
  'env', 'chrome', 'app', 'tests',
];
const DEV_PORTS = [3000, 3001, 4200, 4321, 5173, 5174, 8000, 8080, 8888];

// whoami, balance and `config show` each sleep one second, so a sequential
// script needs more than three seconds and a parallel one a little over one.
const FAKE_CLI = `#!/bin/sh
case "$1 $2" in
  "--version "*) echo "9.9.9-fake" ;;
  "whoami "*)
    [ -n "$FAKE_RECORD" ] && ls -1 "$TMPDIR" > "$FAKE_RECORD"
    sleep 1
    echo "FAKE-WHOAMI user=tester"
    echo "FAKE-WHOAMI-STDERR" >&2
    exit 3
    ;;
  "balance "*) sleep 1; echo "Available credits: 4242" ;;
  "config show") sleep 1; echo '{"fake":"settings"}' ;;
  "doctor --target") echo "FAKE-DOCTOR target=$3" ;;
  "plugin doctor") echo "FAKE-GRID plugin=$3"; exit 4 ;;
  *) echo "fake kane-cli: unknown: $*" >&2; exit 2 ;;
esac
`;

function sandbox(t, { withCli = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kpf-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sb = { root, record: path.join(root, 'record.txt') };
  for (const name of ['bin', 'home', 'tmp', 'cwd']) {
    sb[name] = path.join(root, name);
    fs.mkdirSync(sb[name]);
  }
  if (withCli) {
    fs.writeFileSync(path.join(sb.bin, 'kane-cli'), FAKE_CLI, { mode: 0o755 });
  }
  sb.path = withCli ? `${sb.bin}:${SYSTEM_PATH}` : SYSTEM_PATH;
  return sb;
}

function run(sb, args = [], { env = {}, shell = '/bin/sh' } = {}) {
  const started = Date.now();
  const res = spawnSync(shell, [SCRIPT, ...args], {
    cwd: sb.cwd,
    env: { PATH: sb.path, HOME: sb.home, TMPDIR: sb.tmp, FAKE_RECORD: sb.record, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });
  return { ...res, ms: Date.now() - started };
}

function parse(stdout) {
  const order = [];
  const body = {};
  let current = null;
  for (const line of stdout.split('\n')) {
    const m = /^## (.+)$/.exec(line);
    if (m) {
      current = m[1];
      order.push(current);
      body[current] = [];
    } else if (current) {
      body[current].push(line);
    }
  }
  for (const name of order) {
    while (body[name].length && body[name][body[name].length - 1] === '') body[name].pop();
  }
  return { order, body };
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

posix('prints the nine base sections in order, with raw output and exit codes', (t) => {
  const sb = sandbox(t);
  const res = run(sb);
  assert.equal(res.status, 0, res.stderr);
  const { order, body } = parse(res.stdout);
  assert.deepEqual(order, BASE_SECTIONS);
  assert.deepEqual(body.version, ['9.9.9-fake']);
  assert.ok(body.whoami.includes('FAKE-WHOAMI user=tester'));
  assert.ok(body.whoami.includes('FAKE-WHOAMI-STDERR'), 'stderr is merged into the block');
  assert.equal(body.whoami.at(-1), 'exit=3');
  assert.deepEqual(body.balance, ['Available credits: 4242', 'exit=0']);
  assert.deepEqual(body.settings, ['{"fake":"settings"}', 'exit=0']);
});

posix('runs clean under dash when it is installed', (t) => {
  if (!fs.existsSync('/bin/dash')) return t.skip('no /bin/dash');
  const sb = sandbox(t);
  const res = run(sb, ['--mobile', 'simulator', '--grid'], { shell: '/bin/dash' });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stderr, '');
  assert.deepEqual(parse(res.stdout).order, [...BASE_SECTIONS, 'mobile', 'grid']);
});

posix('a missing kane-cli prints missing, keeps every section and exits 0', (t) => {
  const sb = sandbox(t, { withCli: false });
  const probe = spawnSync('/bin/sh', ['-c', 'command -v kane-cli'], { env: { PATH: sb.path } });
  if (probe.status === 0) return t.skip('a real kane-cli lives on the system PATH');
  const res = run(sb, ['--mobile', 'emulator', '--grid']);
  assert.equal(res.status, 0, res.stderr);
  const { order, body } = parse(res.stdout);
  assert.deepEqual(order, [...BASE_SECTIONS, 'mobile', 'grid']);
  for (const name of ['version', 'whoami', 'balance', 'settings', 'mobile', 'grid']) {
    assert.deepEqual(body[name], ['missing'], name);
  }
  assert.deepEqual(body['agent-config'], ['none']);
  assert.ok(body.tests.includes('count=0'));
});

posix('--mobile emulator adds the mobile section with the doctor output', (t) => {
  const sb = sandbox(t);
  const res = run(sb, ['--mobile', 'emulator']);
  assert.equal(res.status, 0, res.stderr);
  const { order, body } = parse(res.stdout);
  assert.deepEqual(order, [...BASE_SECTIONS, 'mobile']);
  assert.deepEqual(body.mobile, ['FAKE-DOCTOR target=emulator', 'exit=0']);
});

posix('--mobile with an unknown target prints invalid target', (t) => {
  const sb = sandbox(t);
  const { order, body } = parse(run(sb, ['--mobile', 'tablet']).stdout);
  assert.deepEqual(order, [...BASE_SECTIONS, 'mobile']);
  assert.deepEqual(body.mobile, ['invalid target']);
  const bare = parse(run(sb, ['--mobile', '--grid']).stdout);
  assert.deepEqual(bare.order, [...BASE_SECTIONS, 'mobile', 'grid']);
  assert.deepEqual(bare.body.mobile, ['invalid target']);
});

posix('--grid adds the grid section with the plugin doctor output', (t) => {
  const sb = sandbox(t);
  const res = run(sb, ['--grid']);
  assert.equal(res.status, 0, res.stderr);
  const { order, body } = parse(res.stdout);
  assert.deepEqual(order, [...BASE_SECTIONS, 'grid']);
  assert.deepEqual(body.grid, ['FAKE-GRID plugin=remote-execution', 'exit=4']);
});

posix('unknown flags are ignored', (t) => {
  const sb = sandbox(t);
  const res = run(sb, ['--bogus', 'value', '-x']);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(parse(res.stdout).order, BASE_SECTIONS);
});

posix('agent-config prints none when absent and the file content when present', (t) => {
  const sb = sandbox(t);
  assert.deepEqual(parse(run(sb).stdout).body['agent-config'], ['none']);

  const dir = path.join(sb.home, '.testmuai', 'kaneai', 'agent-config');
  fs.mkdirSync(dir, { recursive: true });
  const config = { version: 1, preferences: { watch: 'quiet', purpose: 'suite' } };
  fs.writeFileSync(path.join(dir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  const { order, body } = parse(run(sb).stdout);
  assert.deepEqual(order, BASE_SECTIONS);
  assert.deepEqual(JSON.parse(body['agent-config'].join('\n')), config);
});

posix('whoami, balance and settings run in parallel', (t) => {
  const sb = sandbox(t);
  const res = run(sb);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.ms >= 1000, `the fake CLI sleeps, got ${res.ms} ms`);
  assert.ok(res.ms < 3000, `expected under 3000 ms, got ${res.ms} ms`);
});

posix('tests section counts *_test.md files and skips node_modules and .git', (t) => {
  const sb = sandbox(t);
  const files = [
    'login_test.md',
    'flows/checkout/cart_test.md',
    'node_modules/pkg/ignored_test.md',
    '.git/ignored_test.md',
    'd1/d2/d3/d4/d5/too_deep_test.md',
    'notes.md',
  ];
  for (const rel of files) {
    const full = path.join(sb.cwd, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '# test\n');
  }
  assert.deepEqual(parse(run(sb).stdout).body.tests, ['count=2']);
});

posix('the temp work dir lives under TMPDIR and is removed afterwards', (t) => {
  const sb = sandbox(t);
  const res = run(sb);
  assert.equal(res.status, 0, res.stderr);
  const during = fs.readFileSync(sb.record, 'utf8');
  assert.match(during, /^kane-preflight\./m, 'work dir existed while the CLI ran');
  const after = fs.readdirSync(sb.tmp).filter((name) => name.startsWith('kane-preflight.'));
  assert.deepEqual(after, []);
});

posix('env section reports ci, ssh, display, os, arch and node', (t) => {
  const sb = sandbox(t);
  const plain = parse(run(sb).stdout).body.env;
  assert.deepEqual(plain.map((line) => line.split('=')[0]), ['ci', 'ssh', 'display', 'os', 'arch', 'node']);
  assert.ok(plain.includes('ci='));
  assert.ok(plain.includes('ssh=no'));
  assert.ok(plain.includes(`os=${os.type()}`));

  const remote = parse(run(sb, [], { env: { CI: 'true', SSH_TTY: '/dev/ttys001' } }).stdout).body.env;
  assert.ok(remote.includes('ci=true'));
  assert.ok(remote.includes('ssh=yes'));
  assert.ok(remote.includes('display=no'));

  if (os.platform() !== 'darwin') {
    const x11 = parse(run(sb, [], { env: { DISPLAY: ':0' } }).stdout).body.env;
    assert.ok(x11.includes('display=yes'));
  }
});

posix('chrome section prefers KANE_CLI_CHROME_PATH and echoes the override', (t) => {
  const sb = sandbox(t);
  const none = parse(run(sb).stdout).body.chrome;
  assert.equal(none.length, 2);
  assert.match(none[0], /^found=/);
  assert.equal(none[1], 'override=');

  const chrome = path.join(sb.root, 'My Chrome');
  fs.writeFileSync(chrome, '', { mode: 0o755 });
  const set = parse(run(sb, [], { env: { KANE_CLI_CHROME_PATH: chrome } }).stdout).body.chrome;
  assert.deepEqual(set, [`found=${chrome}`, `override=${chrome}`]);

  const gone = path.join(sb.root, 'nope');
  const stale = parse(run(sb, [], { env: { KANE_CLI_CHROME_PATH: gone } }).stdout).body.chrome;
  assert.notEqual(stale[0], `found=${gone}`);
  assert.equal(stale[1], `override=${gone}`);
});

test('preflight.ps1 declares the same sections and keys, in the same order', () => {
  const ps1 = fs.readFileSync(SCRIPT.replace(/\.sh$/, '.ps1'), 'utf8');
  const headers = [...ps1.matchAll(/^\s*Write-Output '## ([a-z-]+)'/gm)].map((m) => m[1]);
  assert.deepEqual(headers, [...BASE_SECTIONS, 'mobile', 'grid']);
  const keys = [...ps1.matchAll(/Write-Output "([a-z]+)=/g)].map((m) => m[1]);
  assert.deepEqual(keys, [
    'exit', 'ci', 'ssh', 'display', 'os', 'arch', 'node', 'found', 'override', 'port', 'count',
  ]);
  // Windows PowerShell 5.1 reads a file without a BOM as ANSI: stay ASCII.
  assert.ok(!/[^\x00-\x7f]/.test(ps1), 'preflight.ps1 must be plain ASCII');
});

posix('app section lists a listening dev port', async (t) => {
  const sb = sandbox(t);
  const probe = spawnSync('/bin/sh', ['-c', 'command -v lsof || command -v ss || command -v netstat'], {
    env: { PATH: sb.path },
  });
  if (probe.status !== 0) return t.skip('no lsof, ss or netstat here');
  let server;
  let port;
  for (const candidate of DEV_PORTS) {
    try {
      server = await listen(candidate);
      port = candidate;
      break;
    } catch {
      // Busy. Try the next one.
    }
  }
  if (!server) return t.skip('every dev port is already taken');
  t.after(() => server.close());
  const app = parse(run(sb).stdout).body.app;
  assert.ok(app.includes(`port=${port}`), `expected port=${port} in ${JSON.stringify(app)}`);
  for (const line of app) assert.match(line, /^port=\d+$/);
  assert.deepEqual(app, [...app].sort((a, b) => DEV_PORTS.indexOf(+a.slice(5)) - DEV_PORTS.indexOf(+b.slice(5))));
});
