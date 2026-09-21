import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseEvents,
  cleanRemark,
  summarize,
  renderLine,
  findRun,
  main,
} from '../strip/kane-strip.mjs';

const STRIP_PATH = fileURLToPath(new URL('../strip/kane-strip.mjs', import.meta.url));

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const events = (name) => parseEvents(fixture(name));
const at = (iso) => Date.parse(iso);
const pointer = JSON.parse(fixture('pointer.json'));

// Events up to and including the nth one that matches.
function cutAfter(list, matches, nth = 1) {
  let seen = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (matches(list[i], i) && (seen += 1) === nth) return list.slice(0, i + 1);
  }
  throw new Error('cut point not found in fixture');
}

const isStepLine = (e) => e.type === undefined && typeof e.step === 'number';
const ofType = (type) => (e) => e.type === type;

// Only the strip symbols may appear. No emoji, no long dash.
const LONG_DASH = String.fromCharCode(0x2014);
function assertPlainSymbols(line) {
  // The warning sign is a strip symbol, so it is set aside before the emoji check.
  assert.doesNotMatch(line.replace(/⚠/g, ''), /\p{Extended_Pictographic}/u, 'no emoji in the strip');
  assert.ok(!line.includes(LONG_DASH), 'no long dash in the strip');
}

// 1
test('parseEvents drops a truncated last line and a Running on text line', () => {
  const lines = fixture('run.ndjson').split('\n').filter(Boolean);
  const text = [
    'Running on: Desktop · Chrome',
    lines[0],
    '',
    lines[3],
    lines[9].slice(0, 120),
  ].join('\n');
  const parsed = parseEvents(text);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, 'stream_start');
  assert.equal(parsed[1].step, 2);
  assert.deepEqual(parseEvents(''), []);
  assert.equal(events('run.ndjson').length, 10);
});

// 2
test('cleanRemark drops the verb, PRIMARY and everything after the first semicolon', () => {
  assert.equal(
    cleanRemark('click: PRIMARY: dismiss shipping popover button; role=button; text="Dismiss" | HINTS: p'),
    'dismiss shipping popover button',
  );
  assert.equal(
    cleanRemark('analyze: the page heading says Example Domain'),
    'the page heading says Example Domain',
  );
  assert.equal(cleanRemark('navigate: Navigate to https://example.com'), 'navigate to https://example.com');
  const long = cleanRemark('click: PRIMARY: the very long descriptive label of a button that goes on and on; role=button');
  assert.ok(Array.from(long).length <= 40, `capped at 40, got ${Array.from(long).length}`);
  assert.ok(long.startsWith('the very long descriptive label'));
});

// 3
test('cleanRemark never echoes typed text', () => {
  assert.equal(
    cleanRemark('type: Typing Xbox Wireless controller in Amazon search box'),
    'typing in Amazon search box',
  );
  assert.equal(cleanRemark('type: Typing hunter2'), 'typing');
  assert.equal(cleanRemark('type: Typing "made in China"'), 'typing');
  assert.equal(
    cleanRemark('type: PRIMARY: Amazon search box; role=searchbox; text="Xbox Wireless controller"'),
    'typing in Amazon search box',
  );
  for (const remark of [
    'type: Typing Xbox Wireless controller in Amazon search box',
    'type: Typing hunter2',
    'type: Typing "made in China"',
  ]) {
    assert.doesNotMatch(cleanRemark(remark), /Xbox|hunter2|China/);
  }
});

// 4
test('run cut after the second step line shows step 1 and the elapsed clock', () => {
  const cut = cutAfter(events('run.ndjson'), isStepLine, 2);
  const state = summarize(cut);
  assert.equal(state.surface, 'run');
  assert.equal(state.phase, 'running');
  assert.equal(state.step, 1);
  const line = renderLine(state, {
    nowMs: at('2026-09-21T08:48:00.000Z'),
    startedMs: at(pointer.started),
    alive: true,
    color: false,
  });
  assert.ok(line.includes('◆ kane run ▸ step 1'), line);
  // The clock starts at launch (the first event), not when the pointer appeared 13 s later.
  assert.ok(line.endsWith('  0:33'), line);
  assert.equal(line, '◆ kane run ▸ step 1 · navigate to https://example.com  0:33');

  // Without a pointer the clock starts at the first event.
  const noPointer = renderLine(state, { nowMs: at('2026-09-21T08:48:00.000Z'), alive: true, color: false });
  assert.ok(noPointer.endsWith('  0:33'), noPointer);

  // Before any step line the run is starting.
  const early = summarize(events('run.ndjson').slice(0, 3));
  assert.equal(early.phase, 'starting');
  assert.equal(
    renderLine(early, { nowMs: at('2026-09-21T08:47:42.436Z'), startedMs: at(pointer.started), alive: true, color: false }),
    '◆ kane run ▸ starting  0:15',
  );
});

// 5
test('full run fixture renders passed with steps and whole credits', () => {
  const state = summarize(events('run.ndjson'));
  assert.equal(state.phase, 'done');
  assert.equal(state.terminal.status, 'passed');
  assert.equal(state.terminal.steps, 3);
  assert.equal(state.terminal.credits, 12);
  const line = renderLine(state, { nowMs: at('2026-09-21T08:49:00.000Z'), alive: false, color: false });
  assert.ok(line.includes('run ✓ passed'), line);
  assert.ok(line.includes('3 steps'), line);
  assert.ok(line.includes('12 credits'), line);
  assert.equal(line, '◆ kane run ✓ passed · 3 steps · 0:21 · 12 credits');
  assertPlainSymbols(line);
});

// 6
test('testmd replay cut after the second test_md_step_start shows step 2, the heading and replaying', () => {
  const all = events('testmd-replay.ndjson');
  // The mode is only known once replay_started follows the step start,
  // so the cut runs through that event.
  const startIndex = cutAfter(all, ofType('test_md_step_start'), 2).length - 1;
  const cut = cutAfter(all, (e, i) => i > startIndex && e.type === 'step_event' && e.event === 'replay_started');
  const state = summarize(cut);
  assert.equal(state.surface, 'test');
  assert.equal(state.step, 2);
  assert.equal(state.heading, 'Check the heading');
  assert.equal(state.mode, 'replaying');
  const line = renderLine(state, { nowMs: at('2026-09-21T08:50:04.000Z'), alive: true, color: false });
  assert.ok(line.includes('test ▸ step 2'), line);
  assert.ok(line.includes('Check the heading'), line);
  assert.ok(line.includes('replaying'), line);
  assert.equal(line, '◆ kane test ▸ step 2 "Check the heading" replaying  0:08');

  // Right at the step start the mode is not known yet and is not guessed.
  const atStart = summarize(all.slice(0, startIndex + 1));
  assert.equal(atStart.mode, undefined);
  const early = renderLine(atStart, { nowMs: at('2026-09-21T08:50:04.000Z'), alive: true, color: false });
  assert.ok(early.includes('test ▸ step 2 "Check the heading"'), early);
  assert.ok(!early.includes('replaying') && !early.includes('authoring'), early);

  // The latest inner action is the "now" text. The inner run_end is not terminal.
  const deeper = summarize(cutAfter(all, ofType('run_end'), 2));
  assert.equal(deeper.phase, 'running');
  assert.equal(deeper.terminal, undefined);
  assert.equal(deeper.now, 'reading the page heading');
});

// 7
test('testmd author cut inside step 1 is authoring', () => {
  const all = events('testmd-author.ndjson');
  const cut = cutAfter(all, (e) => e.type === 'step_event' && e.event === 'action');
  const state = summarize(cut);
  assert.equal(state.surface, 'test');
  assert.equal(state.step, 1);
  assert.equal(state.mode, 'authoring');
  assert.equal(state.heading, 'Open the site');
  const line = renderLine(state, { nowMs: at('2026-09-21T08:49:05.000Z'), alive: true, color: false });
  assert.equal(line, '◆ kane test ▸ step 1 "Open the site" authoring · navigate to https://example.com  0:13');

  const done = summarize(all);
  assert.equal(done.phase, 'done');
  const finished = renderLine(done, { nowMs: at('2026-09-21T08:50:00.000Z'), alive: false, color: false });
  assert.equal(finished, '◆ kane test ✓ passed · 2 steps · 0:30 · recorded');
});

// 8
test('testrun cut after testrun_authored_member_start shows 1 of 2 and the running member', () => {
  const cut = cutAfter(events('testrun.ndjson'), ofType('testrun_authored_member_start'));
  const state = summarize(cut);
  assert.equal(state.surface, 'suite');
  assert.equal(state.phase, 'running');
  assert.equal(state.suite.total, 2);
  assert.equal(state.suite.done, 1);
  assert.equal(state.suite.passed, 1);
  assert.equal(state.suite.failed, 0);
  assert.deepEqual(state.suite.running, ['fail_test.md']);
  const line = renderLine(state, { nowMs: at('2026-09-21T08:50:40.000Z'), alive: true, color: false });
  assert.ok(line.includes('1 of 2'), line);
  assert.ok(line.includes('1 ✓'), line);
  assert.ok(line.includes('now: fail_test.md'), line);
  assert.equal(line, '◆ kane suite ▸ 1 of 2 · 1 ✓ 0 ✗ · now: fail_test.md  0:19');
});

// 9
test('full testrun fixture names the failed member and its step', () => {
  const state = summarize(events('testrun.ndjson'));
  assert.equal(state.phase, 'done');
  assert.equal(state.suite.total, 2);
  assert.equal(state.suite.done, 2);
  assert.equal(state.suite.passed, 1);
  assert.equal(state.suite.failed, 1);
  assert.deepEqual(state.suite.running, []);
  assert.equal(state.terminal.status, 'failed');
  assert.equal(state.terminal.failedStep, 2);
  const line = renderLine(state, { nowMs: at('2026-09-21T08:52:00.000Z'), alive: false, color: false });
  assert.ok(line.includes('suite ✗ 1 of 2'), line);
  assert.ok(line.includes('fail_test.md failed at step 2'), line);
  assert.equal(line, '◆ kane suite ✗ 1 of 2 · fail_test.md failed at step 2 · 0:59');
  assertPlainSymbols(line);
});

// 10
test('no terminal event and a dead process renders did not finish', () => {
  const cut = events('run.ndjson').filter((e) => e.type !== 'run_end');
  const state = summarize(cut);
  assert.equal(state.terminal, undefined);
  const line = renderLine(state, { nowMs: at('2026-09-21T08:48:30.000Z'), alive: false, color: false });
  assert.ok(line.includes("⚠ didn't finish"), line);
  assert.ok(line.startsWith('◆ kane run ⚠'), line);
  assertPlainSymbols(line);
  // The warning also leaves after 5 minutes.
  assert.equal(renderLine(state, { nowMs: at('2026-09-21T08:54:00.000Z'), alive: false, color: false }), '');
  // While the process is alive the same events are a running line.
  const live = renderLine(state, { nowMs: at('2026-09-21T08:48:30.000Z'), alive: true, color: false });
  assert.ok(live.includes('▸ step 3'), live);
});

// 11
test('a terminal event older than 5 minutes renders an empty string', () => {
  const state = summarize(events('run.ndjson'));
  const endedMs = at('2026-09-21T08:48:10.211Z');
  assert.notEqual(renderLine(state, { nowMs: endedMs + 299_000, alive: false, color: false }), '');
  assert.equal(renderLine(state, { nowMs: endedMs + 301_000, alive: false, color: false }), '');
  assert.equal(renderLine(state, { nowMs: endedMs + 3_600_000, alive: true, color: false }), '');
});

// 12
test('findRun matches a child cwd, ignores a dead pid and falls back to the state file', () => {
  const activeDir = '/home/dev/.testmuai/kaneai/sessions/active';
  const stateFile = '/home/dev/.testmuai/kaneai/agent-config/strip-state.json';
  const sessions = '/home/dev/.testmuai/kaneai/sessions';
  const nowMs = at('2026-09-21T08:48:00.000Z');
  const files = {
    [`${activeDir}/16664.json`]: JSON.stringify({ ...pointer, cwd: '/home/dev/acme-web/apps/store' }),
    [`${activeDir}/999.json`]: JSON.stringify({
      ...pointer, pid: 999, session_dir: `${sessions}/dead`, started: '2026-09-21T08:47:59.000Z',
    }),
    [`${activeDir}/777.json`]: JSON.stringify({
      ...pointer, pid: 777, cwd: '/home/dev/acme-web-two', session_dir: `${sessions}/other`,
      started: '2026-09-21T08:47:58.000Z',
    }),
    [`${activeDir}/notes.txt`]: 'not a pointer',
    [`${activeDir}/555.json`]: '{"pid": 555, "cwd": ',
    [stateFile]: JSON.stringify({
      '/home/dev/acme-web': {
        session_dir: `${sessions}/last`, surface: 'run',
        started: '2026-09-21T08:40:00.000Z', seen: '2026-09-21T08:46:00.000Z',
      },
    }),
  };
  const io = (alivePids, extra = {}) => ({
    activeDir,
    stateFile,
    projectDir: '/home/dev/acme-web',
    nowMs,
    isAlive: (pid) => alivePids.includes(pid),
    readFile: (p) => {
      if (!(p in files)) throw new Error(`ENOENT ${p}`);
      return files[p];
    },
    listDir: (dir) => Object.keys(files)
      .filter((p) => p.startsWith(`${dir}/`))
      .map((p) => p.slice(dir.length + 1)),
    ...extra,
  });

  // A pointer whose cwd is a child of the project matches. Dead and unrelated ones do not.
  const live = findRun(io([16664, 777]));
  assert.equal(live.alive, true);
  assert.equal(live.pointer.pid, 16664);
  assert.equal(live.sessionDir, pointer.session_dir);

  // A pointer whose cwd contains the project matches too.
  const parent = findRun(io([16664], { projectDir: '/home/dev/acme-web/apps/store/src' }));
  assert.equal(parent.pointer.pid, 16664);

  // The most recently started live pointer wins.
  const newest = findRun(io([16664, 999]));
  assert.equal(newest.pointer.pid, 999);

  // Every pid dead: the last session seen for this project.
  const gone = findRun(io([]));
  assert.equal(gone.alive, false);
  assert.equal(gone.pointer, undefined);
  assert.equal(gone.sessionDir, `${sessions}/last`);

  // Nothing live and nothing remembered.
  assert.equal(findRun(io([], { projectDir: '/home/dev/elsewhere' })), null);
  assert.equal(findRun(io([], { stateFile: '/home/dev/missing.json' })), null);
  assert.equal(
    findRun(io([], { listDir: () => { throw new Error('ENOENT'); }, stateFile: '/home/dev/missing.json' })),
    null,
  );
});

test('renderLine color wraps the symbols and the brand, and nothing else changes', () => {
  const passed = summarize(events('run.ndjson'));
  const opts = { nowMs: at('2026-09-21T08:49:00.000Z'), alive: false };
  const plain = renderLine(passed, { ...opts, color: false });
  const colored = renderLine(passed, { ...opts, color: true });
  assert.ok(colored.includes('\u001b[1m◆ kane\u001b[0m'), JSON.stringify(colored));
  assert.ok(colored.includes('\u001b[32m✓\u001b[0m'), JSON.stringify(colored));
  assert.equal(colored.replace(/\u001b\[[0-9;]*m/g, ''), plain);

  const failed = renderLine(summarize(events('testrun.ndjson')), {
    nowMs: at('2026-09-21T08:52:00.000Z'), alive: false, color: true,
  });
  assert.ok(failed.includes('\u001b[31m✗\u001b[0m'), JSON.stringify(failed));

  const unfinished = renderLine(summarize(events('run.ndjson').slice(0, 5)), {
    nowMs: at('2026-09-21T08:48:30.000Z'), alive: false, color: true,
  });
  assert.ok(unfinished.includes('\u001b[33m⚠\u001b[0m'), JSON.stringify(unfinished));
});

test('a failed run renders the failing step, and typed text in a test step stays hidden', () => {
  const failedRun = [
    { type: 'stream_start', surface: 'run', pid: 1, v: 1, ts: '2026-09-21T08:00:00.000Z' },
    { step: 2, status: 'running', remark: 'Step 1', v: 1, ts: '2026-09-21T08:00:10.000Z' },
    { step: 2, status: 'done', remark: 'navigate: Navigate to https://example.com', v: 1, ts: '2026-09-21T08:00:11.000Z' },
    { step: 3, status: 'running', remark: 'Step 2', v: 1, ts: '2026-09-21T08:00:12.000Z' },
    { step: 3, status: 'failed', remark: 'click: PRIMARY: Add to Cart button; role=button', v: 1, ts: '2026-09-21T08:00:40.000Z' },
    { type: 'run_end', status: 'failed', one_liner: 'could not find the Add to Cart button', duration: 72.2, credits_consumed: 30.6, v: 1, ts: '2026-09-21T08:01:12.000Z' },
  ];
  const state = summarize(failedRun);
  assert.equal(state.terminal.failedStep, 2);
  assert.equal(state.terminal.steps, 2);
  assert.equal(
    renderLine(state, { nowMs: at('2026-09-21T08:02:00.000Z'), alive: false, color: false }),
    '◆ kane run ✗ failed at step 2 · could not find the Add to Cart button · 1:12',
  );

  const typing = [
    { type: 'stream_start', surface: 'testmd', pid: 1, v: 1, ts: '2026-09-21T08:00:00.000Z' },
    { type: 'test_md_step_start', step_index: 1, heading: 'Search for a controller', ref: null, v: 1, ts: '2026-09-21T08:00:05.000Z' },
    { type: 'bifurcation', flows: ['Search'], count: 1, v: 1, ts: '2026-09-21T08:00:06.000Z' },
    { type: 'step_event', index: 1, event: 'action', detail: 'Typing Xbox Wireless controller in Amazon search box', action_type: 'type', success: true, v: 1, ts: '2026-09-21T08:00:09.000Z' },
  ];
  const line = renderLine(summarize(typing), { nowMs: at('2026-09-21T08:00:10.000Z'), alive: true, color: false });
  assert.equal(line, '◆ kane test ▸ step 1 "Search for a controller" authoring · typing in Amazon search box  0:10');
  assert.ok(!line.includes('Xbox'), line);
});

test('a suite follows the single running member through readLog', () => {
  const cut = cutAfter(events('testrun.ndjson'), ofType('testrun_authored_member_start'));
  const memberLog = cut[cut.length - 1].log_path;
  const asked = [];
  const state = summarize(cut, {
    readLog: (p) => {
      asked.push(p);
      return fixture('testmd-author.ndjson').split('\n').slice(0, 7).join('\n');
    },
  });
  assert.deepEqual(asked, [memberLog]);
  const line = renderLine(state, { nowMs: at('2026-09-21T08:50:40.000Z'), alive: true, color: false });
  assert.equal(
    line,
    '◆ kane suite ▸ 1 of 2 · 1 ✓ 0 ✗ · now: fail_test.md · step 1 · navigate to https://example.com  0:19',
  );

  // A log that cannot be read changes nothing.
  const quiet = summarize(cut, { readLog: () => { throw new Error('ENOENT'); } });
  assert.ok(renderLine(quiet, { nowMs: at('2026-09-21T08:50:40.000Z'), alive: true, color: false })
    .includes('now: fail_test.md  0:19'));
});

test('main is exported and importing the module prints nothing', () => {
  assert.equal(typeof main, 'function');
});

test('main never fails: empty stdin, invalid stdin and a missing home all exit 0 with no output', () => {
  const home = '/home/dev/kane-strip-no-such-home';
  for (const input of ['', 'not json', '{"workspace":{"project_dir":"/home/dev/acme-web"}}']) {
    const result = spawnSync(process.execPath, [STRIP_PATH], {
      input,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('main prints the original status line first, then the strip line, and remembers the run', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kane-strip-home-'));
  try {
    const base = path.join(home, '.testmuai', 'kaneai');
    const projectDir = path.join(home, 'acme-web');
    const sessionDir = path.join(base, 'sessions', 'session-one');
    const activeDir = path.join(base, 'sessions', 'active');
    for (const dir of [projectDir, sessionDir, activeDir, path.join(base, 'agent-config')]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(base, 'agent-config', 'config.json'), JSON.stringify({
      version: 1,
      strip: { 'claude-code': { enabled: true, original_status_line: { type: 'command', command: 'echo original-line' } } },
    }));
    // Stamp the fixture's events with the current time, as a live run would be.
    const stamp = new Date().toISOString();
    const lines = fixture('run.ndjson').split('\n').filter(Boolean)
      .map((l) => JSON.stringify({ ...JSON.parse(l), ts: stamp }));
    fs.writeFileSync(path.join(sessionDir, 'events.ndjson'), `${lines.slice(0, 5).join('\n')}\n{"type":"run_e`);
    const pointerPath = path.join(activeDir, `${process.pid}.json`);
    fs.writeFileSync(pointerPath, JSON.stringify({
      ...pointer, pid: process.pid, cwd: projectDir, session_dir: sessionDir, started: new Date().toISOString(),
    }));

    const run = () => spawnSync(process.execPath, [STRIP_PATH], {
      input: JSON.stringify({ workspace: { project_dir: projectDir, current_dir: projectDir } }),
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' },
    });

    const live = run();
    assert.equal(live.status, 0, live.stderr);
    const [first, second, ...rest] = live.stdout.split('\n');
    assert.equal(first, 'original-line');
    assert.ok(second.startsWith('◆ kane run ▸ step 1 · navigate to https://example.com  0:0'), second);
    assert.deepEqual(rest, ['']);

    const stateFile = path.join(base, 'agent-config', 'strip-state.json');
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const entry = Object.values(saved)[0];
    assert.equal(entry.session_dir, sessionDir);
    assert.equal(entry.surface, 'run');
    assert.ok(entry.started && entry.seen);

    // The pointer is gone and there is no terminal event: the run did not finish.
    fs.unlinkSync(pointerPath);
    const gone = run();
    assert.equal(gone.status, 0, gone.stderr);
    assert.equal(gone.stdout, "original-line\n◆ kane run ⚠ didn't finish · step 1\n");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a passed saved test says whether it replayed or was recorded', () => {
  const at = (file) => {
    const events = parseEvents(fixture(file));
    const nowMs = Date.parse(events[events.length - 1].ts) + 1000;
    return renderLine(summarize(events), { nowMs, alive: false, color: false });
  };
  assert.match(at('testmd-replay.ndjson'), /test ✓ passed · 2 steps · 0:03 · replayed$/);
  assert.match(at('testmd-author.ndjson'), /test ✓ passed · 2 steps · 0:30 · recorded$/);
});

test('while a step is in flight the line keeps the last finished action, labelled as such', () => {
  const lines = events('run.ndjson');
  // Cut right after the "running" line of the second step.
  const cut = cutAfter(lines, isStepLine, 3);
  const state = summarize(cut);
  assert.equal(state.step, 2);
  assert.equal(state.now, 'last: navigate to https://example.com');
});
