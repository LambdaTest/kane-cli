#!/usr/bin/env node
// kane-strip: one status line for a live or just finished kane-cli run.
//
// Reads the active-run pointer and the events.ndjson file that kane-cli 0.8.17+
// writes, and prints: ◆ kane <surface> ▸ <progress> · <now>  <elapsed>
// Node 18+, no dependencies, no network, never spawns kane-cli.
// As a status line command it never throws and never exits non-zero.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_TEXT = 40;
const LINGER_MS = 5 * 60 * 1000;
const STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STATE_WRITE_GAP_MS = 10 * 1000;
const STDIN_WAIT_MS = 1000;
const ORIGINAL_TIMEOUT_MS = 1500;
const HOST = 'claude-code';

const SURFACES = { run: 'run', testmd: 'test', testrun: 'suite' };
const SURFACE_NAMES = new Set(Object.values(SURFACES));
const TYPE_VERBS = new Set(['type', 'type_text', 'fill', 'input', 'enter_text', 'send_keys', 'set_value']);

const BOLD = '\u001b[1m';
const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const RESET = '\u001b[0m';

// ---------------------------------------------------------------------------
// Parsing and text cleaning
// ---------------------------------------------------------------------------

// One object per valid JSON line. Blank lines, plain text lines and a partial
// last line are skipped.
export function parseEvents(text) {
  const out = [];
  if (typeof text !== 'string') return out;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line[0] !== '{') continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object' && !Array.isArray(value)) out.push(value);
    } catch {
      // not a complete JSON line
    }
  }
  return out;
}

// Single line, no escape sequences, no control characters.
function tidy(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cap(text, max = MAX_TEXT) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

function describe(text) {
  return text
    .replace(/\bPRIMARY:\s*/g, '')
    .split(';')[0]
    .split(/\s*\|\s*HINTS\b/)[0]
    .trim();
}

// Mid-line, a sentence-case remark reads better without its capital. Only the
// leading word of a described action changes ("Clicking the link"). Typing
// targets keep their case, since they are names ("Amazon search box").
function midLine(text) {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

// The part after the last " in " or " into ", with quoted text removed first
// so a typed value can never be mistaken for the target.
function typingTarget(text) {
  const bare = tidy(text.replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’/g, ' '));
  const match = /^.*\s(?:in|into)\s+(.+)$/i.exec(bare);
  return match ? match[1].trim() : '';
}

function typingRemark(text) {
  let target = '';
  if (/\bPRIMARY:/.test(text)) {
    const desc = describe(text.slice(text.indexOf('PRIMARY:')));
    target = /^typ(?:e|es|ed|ing)\b/i.test(desc) ? typingTarget(desc) : tidy(desc.replace(/"[^"]*"/g, ' '));
  } else {
    target = typingTarget(describe(text));
  }
  return target ? `typing in ${target}` : 'typing';
}

// Verb prefix dropped, cut at the first ";", "PRIMARY:" removed, 40 characters
// at most. Typed text is never echoed.
export function cleanRemark(remark) {
  let text = tidy(remark);
  let verb = '';
  const match = /^([A-Za-z_]+):(?:\s+|$)/.exec(text);
  if (match) {
    verb = match[1].toLowerCase();
    text = text.slice(match[0].length);
  }
  const typing = TYPE_VERBS.has(verb) || /^typ(?:e|es|ed|ing)\b/i.test(text);
  return cap(typing ? typingRemark(text) : midLine(describe(text)));
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compact(object) {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) delete object[key];
  }
  return object;
}

function baseName(p) {
  return typeof p === 'string' ? tidy(p.split(/[\\/]/).pop()) : '';
}

// ---------------------------------------------------------------------------
// Events to state
// ---------------------------------------------------------------------------

function detectSurface(events, hint) {
  const start = events.find((e) => e.type === 'stream_start');
  if (start && SURFACES[start.surface]) return SURFACES[start.surface];
  if (SURFACES[hint]) return SURFACES[hint];
  if (SURFACE_NAMES.has(hint)) return hint;
  const types = events.map((e) => (typeof e.type === 'string' ? e.type : ''));
  if (types.some((t) => t.startsWith('testrun_'))) return 'suite';
  if (types.some((t) => t.startsWith('test_md_'))) return 'test';
  return 'run';
}

function summarizeRun(events, state) {
  let lastDone = '';
  let completed = 0;
  let failedStep;
  for (const e of events) {
    if (e.type === 'bifurcation') {
      const flows = num(e.count) ?? (Array.isArray(e.flows) ? e.flows.length : undefined);
      if (flows !== undefined) state.flows = flows;
    } else if ((e.type === undefined || e.type === null) && num(e.step) !== undefined && typeof e.status === 'string') {
      // The step field is one ahead of the number people see.
      const human = Math.max(1, e.step - 1);
      state.step = human;
      if (e.status === 'running') {
        // A running line only carries "Step N". Until this step reports what
        // it did, keep the last finished action and say that is what it is.
        const text = cleanRemark(e.remark);
        if (text && !/^step \d+$/i.test(text)) state.now = text;
        else if (lastDone) state.now = `last: ${lastDone}`;
        else delete state.now;
      } else {
        completed += 1;
        const text = cleanRemark(e.remark);
        if (text) {
          state.now = text;
          lastDone = text;
        } else {
          delete state.now;
        }
        if (e.status === 'failed') failedStep = human;
      }
    } else if (e.type === 'run_end') {
      const status = tidy(e.status) || 'unknown';
      const passed = status === 'passed';
      state.terminal = compact({
        status,
        steps: completed,
        durationS: num(e.duration),
        credits: num(e.credits_consumed) === undefined ? undefined : Math.round(e.credits_consumed),
        failedStep: status === 'failed' ? failedStep ?? state.step : undefined,
        message: passed ? undefined : cap(tidy(e.one_liner) || tidy(e.reason)) || undefined,
        ts: typeof e.ts === 'string' ? e.ts : undefined,
      });
    }
  }
  if (state.terminal) state.phase = 'done';
  else if (state.step !== undefined || (state.flows ?? 0) > 1) state.phase = 'running';
}

function actionRemark(e) {
  const detail = tidy(e.detail);
  if (!detail) return '';
  const kind = typeof e.action_type === 'string' ? e.action_type.toLowerCase() : '';
  return cleanRemark(TYPE_VERBS.has(kind) ? `type: ${detail}` : detail);
}

function summarizeTest(events, state) {
  let how;
  let open = false;
  let ended = 0;
  let total;
  let duration;
  let failedStep;
  let failedHeading;
  for (const e of events) {
    if (e.type === 'test_md_step_start') {
      open = true;
      state.step = num(e.step_index) ?? (state.step ?? 0) + 1;
      state.heading = cap(tidy(e.heading)) || undefined;
      if (state.heading === undefined) delete state.heading;
      delete state.mode;
      delete state.now;
    } else if (e.type === 'bifurcation') {
      if (open) state.mode = 'authoring';
    } else if (e.type === 'step_event') {
      if (!open) continue;
      if (e.event === 'replay_started') state.mode = 'replaying';
      else if (e.event === 'action') {
        const text = actionRemark(e);
        if (text) state.now = text;
      }
    } else if (e.type === 'test_md_step_end') {
      open = false;
      ended += 1;
      if (e.status === 'failed' && failedStep === undefined) {
        failedStep = num(e.step_index) ?? state.step;
        failedHeading = state.heading;
      }
    } else if (e.type === 'test_md_summary') {
      total = num(e.steps && e.steps.total) ?? total;
      duration = num(e.duration_s) ?? duration;
      // Say how the test ran only when every step ran the same way.
      const replays = num(e.steps && e.steps.replay_decisions) ?? 0;
      const authors = num(e.steps && e.steps.author_decisions) ?? 0;
      if (replays > 0 && authors === 0) how = 'replayed';
      else if (authors > 0 && replays === 0) how = 'recorded';
    } else if (e.type === 'test_md_done') {
      const status = tidy(e.overall_status) || 'unknown';
      state.terminal = compact({
        status,
        steps: total ?? ended,
        durationS: num(e.duration_s) ?? duration,
        how: status === 'passed' ? how : undefined,
        failedStep: status === 'failed' ? failedStep : undefined,
        message: status === 'failed' ? failedHeading : undefined,
        ts: typeof e.ts === 'string' ? e.ts : undefined,
      });
    }
    // The inner run_end of a step is not the end of the test.
  }
  if (state.terminal) state.phase = 'done';
  else if (state.step !== undefined) state.phase = 'running';
}

// What a running member is doing, from its own log.
function memberNow(inner) {
  if (!inner || inner.step === undefined) return '';
  return inner.now ? `step ${inner.step} · ${inner.now}` : `step ${inner.step}`;
}

function summarizeSuite(events, state, opts) {
  let planned;
  let duration;
  let totals;
  const running = new Map(); // basename -> log path
  const ended = new Map(); // basename -> { status, failure }
  for (const e of events) {
    if (e.type === 'testrun_plan') {
      // The plan is the only full count. Progress events leave authored members out.
      if (Array.isArray(e.members)) planned = e.members.length;
    } else if (e.type === 'testrun_member_start' || e.type === 'testrun_authored_member_start') {
      // Paths are absolute on some events and relative on others.
      const name = baseName(e.path);
      if (!name) continue;
      ended.delete(name);
      running.set(name, typeof e.log_path === 'string' ? e.log_path : '');
    } else if (e.type === 'testrun_member_end' || e.type === 'testrun_authored_member_end') {
      const name = baseName(e.path);
      if (!name) continue;
      running.delete(name);
      const failure = e.failure && typeof e.failure === 'object' ? e.failure : {};
      ended.set(name, {
        status: tidy(e.status) || 'unknown',
        step: num(failure.step_index),
        message: cap(tidy(failure.message)) || undefined,
      });
    } else if (e.type === 'testrun_summary') {
      duration = num(e.duration_s) ?? duration;
      if (e.totals && typeof e.totals === 'object') totals = e.totals;
    } else if (e.type === 'testrun_done') {
      state.terminal = { status: tidy(e.overall_status) || 'unknown', ts: typeof e.ts === 'string' ? e.ts : undefined };
    }
  }

  const results = [...ended.entries()];
  const failures = results
    .filter(([, r]) => r.status !== 'passed' && r.status !== 'skipped')
    .map(([name, r]) => compact({ name, step: r.step, message: r.message }));
  const suite = {
    total: Math.max(planned ?? 0, ended.size + running.size),
    done: ended.size,
    passed: results.filter(([, r]) => r.status === 'passed').length,
    failed: failures.length,
    running: [...running.keys()],
    failures,
  };

  if (state.terminal) {
    state.phase = 'done';
    if (totals) {
      suite.total = num(totals.tests) ?? suite.total;
      suite.passed = num(totals.passed) ?? suite.passed;
    }
    state.terminal = compact({
      ...state.terminal,
      durationS: duration,
      failedStep: failures[0] && failures[0].step,
      message: failures[0] && failures[0].message,
    });
  } else if (ended.size || running.size) {
    state.phase = 'running';
    if (running.size === 1 && typeof opts.readLog === 'function') {
      const [logPath] = [...running.values()];
      if (logPath) {
        try {
          const now = memberNow(summarize(parseEvents(opts.readLog(logPath)), { surface: 'testmd' }));
          if (now) state.now = now;
        } catch {
          // the member log is optional
        }
      }
    }
  }
  state.suite = suite;
}

export function summarize(events, opts = {}) {
  const list = Array.isArray(events) ? events.filter((e) => e && typeof e === 'object') : [];
  const options = opts && typeof opts === 'object' ? opts : {};
  const state = { surface: detectSurface(list, options.surface), phase: 'starting' };
  const stamps = list.map((e) => e.ts).filter((ts) => typeof ts === 'string');
  if (stamps.length) {
    state.firstTs = stamps[0];
    state.lastTs = stamps[stamps.length - 1];
  }
  if (state.surface === 'run') summarizeRun(list, state);
  else if (state.surface === 'test') summarizeTest(list, state);
  else summarizeSuite(list, state, options);
  return state;
}

// ---------------------------------------------------------------------------
// State to line
// ---------------------------------------------------------------------------

function clock(seconds) {
  const total = Math.max(0, seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function count(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function progressText(state) {
  if (state.surface === 'suite') {
    const suite = state.suite;
    if (!suite || state.phase === 'starting') return 'starting';
    return `${suite.done} of ${suite.total} · ${suite.passed} ✓ ${suite.failed} ✗`;
  }
  if (state.surface === 'test') {
    if (state.step === undefined) return 'starting';
    const heading = state.heading ? ` "${state.heading}"` : '';
    const mode = state.mode ? ` ${state.mode}` : '';
    return `step ${state.step}${heading}${mode}`;
  }
  if ((state.flows ?? 0) > 1) return `${state.flows} flows`;
  if (state.step === undefined) return 'starting';
  return `step ${state.step}`;
}

function nowText(state) {
  if (state.surface !== 'suite') return state.now || '';
  const names = (state.suite && state.suite.running) || [];
  if (!names.length) return '';
  const shown = names.slice(0, 2).join(', ');
  const more = names.length > 2 ? ` +${names.length - 2}` : '';
  return `now: ${shown}${more}${state.now ? ` · ${state.now}` : ''}`;
}

function liveLine(state, nowMs, opts) {
  const body = [progressText(state), nowText(state)].filter(Boolean).join(' · ');
  // The first event is stamped at launch. The pointer's start is later (it is
  // written once the session exists), so prefer whichever is earlier.
  const candidates = [num(opts.startedMs), Date.parse(state.firstTs)].filter((ms) => Number.isFinite(ms));
  const started = candidates.length ? Math.min(...candidates) : NaN;
  const elapsed = Number.isFinite(started) ? `  ${clock(Math.floor((nowMs - started) / 1000))}` : '';
  return `◆ kane ${state.surface} ▸ ${body}${elapsed}`;
}

function verdict(status) {
  if (status === 'passed') return '✓';
  if (status === 'failed') return '✗';
  return '⚠';
}

function doneLine(state, nowMs) {
  const t = state.terminal;
  const endedMs = Date.parse(t.ts ?? state.lastTs);
  if (!Number.isFinite(endedMs) || nowMs - endedMs > LINGER_MS) return '';
  const symbol = verdict(t.status);
  const took = t.durationS === undefined ? '' : clock(Math.round(t.durationS));
  const other = cap(t.status.replace(/_/g, ' '), 20);
  let parts;
  if (state.surface === 'suite') {
    const suite = state.suite || { total: 0, passed: 0, failures: [] };
    const tally = `${suite.passed} of ${suite.total}`;
    const first = suite.failures && suite.failures[0];
    let failure = '';
    if (first) {
      failure = first.step === undefined ? `${first.name} failed` : `${first.name} failed at step ${first.step}`;
      if (suite.failures.length > 1) failure += ` +${suite.failures.length - 1} more`;
    }
    parts = symbol === '⚠' ? [`⚠ ${other}`, tally, failure, took] : [`${symbol} ${tally}`, failure, took];
  } else if (symbol === '✓') {
    parts = [
      '✓ passed',
      t.steps === undefined ? '' : count(t.steps, 'step'),
      took,
      t.credits === undefined ? '' : count(t.credits, 'credit'),
      t.how,
    ];
  } else if (symbol === '✗') {
    parts = [t.failedStep === undefined ? '✗ failed' : `✗ failed at step ${t.failedStep}`, t.message, took];
  } else {
    parts = [`⚠ ${other}`, t.message, took];
  }
  return `◆ kane ${state.surface} ${parts.filter(Boolean).join(' · ')}`;
}

// The process is gone and nothing said how it ended.
function goneLine(state, nowMs, opts) {
  const marks = [Date.parse(state.lastTs), opts.seenMs, Date.parse(state.firstTs), opts.startedMs]
    .filter((ms) => typeof ms === 'number' && Number.isFinite(ms));
  if (!marks.length || nowMs - Math.max(...marks) > LINGER_MS) return '';
  const progress = progressText(state);
  const where = progress === 'starting' ? '' : ` · ${progress}`;
  return `◆ kane ${state.surface} ⚠ didn't finish${where}`;
}

function paint(line) {
  return line
    .replace(/^◆ kane/, `${BOLD}◆ kane${RESET}`)
    .replace(/✓/g, `${GREEN}✓${RESET}`)
    .replace(/✗/g, `${RED}✗${RESET}`)
    .replace(/⚠/g, `${YELLOW}⚠${RESET}`);
}

// '' when there is nothing to show: no state, or a run that ended (or was last
// seen) more than 5 minutes ago.
export function renderLine(state, opts = {}) {
  if (!state || typeof state !== 'object') return '';
  const options = opts && typeof opts === 'object' ? opts : {};
  const nowMs = num(options.nowMs) ?? Date.now();
  let line;
  if (state.terminal) line = doneLine(state, nowMs);
  else if (options.alive) line = liveLine(state, nowMs, options);
  else line = goneLine(state, nowMs, options);
  return line && options.color ? paint(line) : line;
}

// ---------------------------------------------------------------------------
// Finding the run for a project
// ---------------------------------------------------------------------------

function normalizeDir(dir) {
  if (typeof dir !== 'string' || !dir) return '';
  const unified = dir.replace(/\\/g, '/');
  const trimmed = unified.length > 1 ? unified.replace(/\/+$/, '') : unified;
  const value = trimmed || '/';
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function inside(child, parent) {
  return child.startsWith(parent.endsWith('/') ? parent : `${parent}/`);
}

// Equal, the pointer inside the project, or the project inside the pointer.
function sameTree(a, b) {
  return Boolean(a && b) && (a === b || inside(a, b) || inside(b, a));
}

function joinPath(dir, name) {
  return `${String(dir).replace(/[\\/]+$/, '')}/${name}`;
}

function validPointer(p) {
  return Boolean(p) && typeof p === 'object'
    && Number.isInteger(p.pid) && p.pid > 0
    && typeof p.cwd === 'string' && p.cwd !== ''
    && typeof p.session_dir === 'string' && p.session_dir !== '';
}

// The most recently started live pointer for this project, or else the last
// session this project was seen running (kept in the state file).
export function findRun(opts) {
  const { activeDir, projectDir, stateFile, isAlive, nowMs, readFile, listDir } = opts || {};
  const project = normalizeDir(projectDir);
  if (!project) return null;

  let names = [];
  try {
    names = listDir(activeDir) || [];
  } catch {
    names = [];
  }
  let best = null;
  for (const name of names) {
    if (typeof name !== 'string' || !name.endsWith('.json')) continue;
    let pointer;
    try {
      pointer = JSON.parse(readFile(joinPath(activeDir, name)));
    } catch {
      continue;
    }
    if (!validPointer(pointer) || !sameTree(normalizeDir(pointer.cwd), project)) continue;
    let alive = false;
    try {
      alive = Boolean(isAlive(pointer.pid));
    } catch {
      alive = false;
    }
    if (!alive) continue;
    const started = Date.parse(pointer.started);
    const rank = Number.isFinite(started) ? started : 0;
    if (!best || rank > best.rank) best = { pointer, rank };
  }
  if (best) return { pointer: best.pointer, sessionDir: best.pointer.session_dir, alive: true };

  try {
    const saved = JSON.parse(readFile(stateFile));
    const entry = saved && typeof saved === 'object' ? saved[project] : null;
    if (!entry || typeof entry !== 'object' || typeof entry.session_dir !== 'string' || !entry.session_dir) return null;
    const seenMs = Date.parse(entry.seen);
    if (Number.isFinite(seenMs) && num(nowMs) !== undefined && nowMs - seenMs > STATE_MAX_AGE_MS) return null;
    return compact({
      pointer: undefined,
      sessionDir: entry.session_dir,
      alive: false,
      surface: typeof entry.surface === 'string' ? entry.surface : undefined,
      started: typeof entry.started === 'string' ? entry.started : undefined,
      seen: typeof entry.seen === 'string' ? entry.seen : undefined,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Command line entry
// ---------------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin || stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(data);
    };
    const timer = setTimeout(finish, STDIN_WAIT_MS);
    try {
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => { data += chunk; });
      stdin.on('end', finish);
      stdin.on('error', finish);
    } catch {
      finish();
    }
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === 'EPERM');
  }
}

function readJson(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(tmp, file);
  } catch {
    // a status line never fails over its own bookkeeping
  }
}

function rememberRun(stateFile, projectDir, pointer, nowMs) {
  const key = normalizeDir(projectDir);
  const saved = readJson(stateFile);
  const entry = saved[key];
  const seenMs = entry && typeof entry === 'object' ? Date.parse(entry.seen) : NaN;
  const fresh = Number.isFinite(seenMs) && nowMs - seenMs < STATE_WRITE_GAP_MS;
  if (entry && entry.session_dir === pointer.session_dir && fresh) return;
  for (const [dir, old] of Object.entries(saved)) {
    const oldMs = old && typeof old === 'object' ? Date.parse(old.seen) : NaN;
    if (!Number.isFinite(oldMs) || nowMs - oldMs > STATE_MAX_AGE_MS) delete saved[dir];
  }
  saved[key] = {
    session_dir: pointer.session_dir,
    surface: pointer.surface,
    started: pointer.started,
    seen: new Date(nowMs).toISOString(),
  };
  writeJson(stateFile, saved);
}

function forgetRun(stateFile, projectDir) {
  const saved = readJson(stateFile);
  const key = normalizeDir(projectDir);
  if (!(key in saved)) return;
  delete saved[key];
  writeJson(stateFile, saved);
}

function originalStatusLine(base, raw) {
  const config = readJson(path.join(base, 'agent-config', 'config.json'));
  const host = config.strip && typeof config.strip === 'object' ? config.strip[HOST] : null;
  const original = host && typeof host === 'object' ? host.original_status_line : null;
  const command = original && typeof original === 'object' ? original.command : null;
  if (typeof command !== 'string' || !command.trim()) return '';
  // Never wrap ourselves: that would spawn without end.
  if (command.includes('kane-strip')) return '';
  const result = spawnSync(command, {
    shell: true,
    input: raw,
    timeout: ORIGINAL_TIMEOUT_MS,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || typeof result.stdout !== 'string') return '';
  return result.stdout.replace(/[\r\n]+$/, '');
}

function stripLine(base, raw) {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }
  if (!input || typeof input !== 'object') input = {};
  const workspace = input.workspace && typeof input.workspace === 'object' ? input.workspace : {};
  const projectDir = [workspace.project_dir, workspace.current_dir, input.cwd]
    .find((dir) => typeof dir === 'string' && dir !== '') || process.cwd();

  const stateFile = path.join(base, 'agent-config', 'strip-state.json');
  const nowMs = Date.now();
  const found = findRun({
    activeDir: path.join(base, 'sessions', 'active'),
    projectDir,
    stateFile,
    isAlive: pidAlive,
    nowMs,
    readFile: (file) => fs.readFileSync(file, 'utf8'),
    listDir: (dir) => fs.readdirSync(dir),
  });
  if (!found || !found.sessionDir) return '';
  if (found.alive) rememberRun(stateFile, projectDir, found.pointer, nowMs);

  let text = '';
  try {
    text = fs.readFileSync(path.join(found.sessionDir, 'events.ndjson'), 'utf8');
  } catch {
    text = '';
  }
  const source = found.alive ? found.pointer : found;
  const state = summarize(parseEvents(text), {
    surface: source.surface,
    readLog: (file) => (path.basename(file) === 'events.ndjson' ? fs.readFileSync(file, 'utf8') : ''),
  });
  const line = renderLine(state, {
    nowMs,
    startedMs: Date.parse(source.started),
    seenMs: Date.parse(found.seen),
    alive: found.alive,
    color: !process.env.NO_COLOR,
  });
  if (!line && !found.alive) forgetRun(stateFile, projectDir);
  return line;
}

// Prints the person's original status line first, then the strip line.
export async function main() {
  try {
    const raw = await readStdin();
    const base = path.join(os.homedir(), '.testmuai', 'kaneai');
    const out = [];
    try {
      const original = originalStatusLine(base, raw);
      if (original) out.push(original);
    } catch {
      // the original status line is best effort
    }
    try {
      const line = stripLine(base, raw);
      if (line) out.push(line);
    } catch {
      // no strip line is always acceptable
    }
    if (out.length) {
      await new Promise((resolve) => {
        process.stdout.write(`${out.join('\n')}\n`, () => resolve());
      });
    }
  } catch {
    // never throw
  }
}

function isDirectRun() {
  try {
    if (!process.argv[1]) return false;
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.on('uncaughtException', () => process.exit(0));
  process.on('unhandledRejection', () => process.exit(0));
  main().then(() => process.exit(0), () => process.exit(0));
}
