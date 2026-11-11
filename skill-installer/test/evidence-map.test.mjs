// Tests for skills/scripts/evidence-map.mjs. Every pack here is built by hand
// in a temp folder, so nothing comes from a real run or a real account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(here, '..', 'skills', 'scripts', 'evidence-map.mjs');

const RESULT_YAML = `evidence: '0.1'
test: checkout
status: broken
steps:
  - id: 0-1
    ordinal: 1
    status: passed
    kind: navigate
    action_id: act-1
  - id: 0-2
    ordinal: 2
    status: passed
    kind: click
    action_id: act-2
  - id: 0-3
    ordinal: 3
    status: broken
    kind: click
    action_id: act-3
  - id: later-1
    ordinal: 4
    status: skipped
    kind: click
    action_id: act-5
  - id: later-2
    ordinal: 5
    status: skipped
    kind: type
    action_id: act-6
environment:
  browser: Chrome
`;

const STEP_FAILURE_YAML = `step: 0-3
status: broken
error:
  message: 'action_failed: click @ step 3'
triage:
  status: triaged
  rca:
    root_cause: A dialog covers the button.
  verification:
    status: not_verified
`;

const EXECUTION = {
  instructions: [
    { instruction: 'Open the shop', reasoning: 'Start at the home page', status: 'success',
      operations: [{ operation_id: 'act-1', intent: 'Navigate to the shop' }] },
    { instruction: 'Click Shop', status: 'success',
      operations: [{ operation_id: 'act-2', intent: 'Open the Shop link' }] },
    { content_type: 'if_block', condition: 'a banner is shown', condition_met: true,
      children: [
        { instruction: 'Click Pay', reasoning: 'Finish the order', status: 'success',
          operations: [{ operation_id: 'act-3', intent: 'Press the Pay button' }] },
      ] },
    { instruction: 'Click Confirm', status: 'success',
      operations: [{ operation_id: 'act-5', intent: 'Confirm the order' }] },
    { instruction: 'Type a note', status: 'success',
      operations: [{ operation_id: 'act-6', intent: 'Leave a note' }] },
  ],
};

const ACTIONS = [
  { action_id: 'act-1', step: '1', action_type: 'navigate', action_instruction: 'Navigate to the shop',
    action_params: { url: 'http://shop.test/' }, status: 'success', timestamp: 'T1', rationale: 'Begin the flow' },
  { action_id: 'act-2', step: '2', action_type: 'click', action_instruction: 'Open the Shop link',
    action_params: {}, status: 'success', timestamp: 'T2' },
  { action_id: 'act-3', step: '3', action_type: 'click', action_instruction: 'Press the Pay button',
    action_params: {}, status: 'error', timestamp: 'T3', error: 'Timeout 5000ms exceeded.' },
  { action_id: 'act-4', step: '4', action_type: 'wait', action_instruction: 'Wait for the page',
    action_params: {}, status: 'success', timestamp: 'T4' },
];

function packFiles(testId = 'checkout') {
  const base = `tests/${testId}`;
  return {
    'run.yaml': "evidence: '0.1'\nrun_kind: replay\n",
    'failure.yaml': `failures:\n  - test: ${testId}\n    step: 0-3\n`,
    [`${base}/result.yaml`]: RESULT_YAML,
    [`${base}/test.md`]: 'Buy a plant\n',
    [`${base}/auteur/execution.json`]: JSON.stringify(EXECUTION),
    [`${base}/logs/0-actions.ndjson`]: ACTIONS.map((row) => JSON.stringify(row)).join('\n') + '\n',
    [`${base}/logs/0-run.log`]: 'starting\nall good\n[STEP 3 FAIL] Timeout 5000ms exceeded.\ndone\n',
    [`${base}/logs/tui.log`]: 'session started\nUPLOAD_FAILED could not publish\n',
    [`${base}/steps/1-0-1/step.json`]: JSON.stringify(
      { id: '0-1', kind: 'navigate', status: 'passed', summary: 'navigate: shop', action_id: 'act-1' }),
    [`${base}/steps/1-0-1/screenshot.jpg`]: 'image-1',
    [`${base}/steps/2-0-2/step.json`]: JSON.stringify(
      { id: '0-2', kind: 'click', status: 'passed', summary: 'click: Shop', action_id: 'act-2' }),
    [`${base}/steps/3-0-3/step.json`]: JSON.stringify(
      { id: '0-3', kind: 'click', status: 'broken', summary: 'click: Pay', action_id: 'act-3' }),
    [`${base}/steps/3-0-3/screenshot.png`]: 'image-3',
    [`${base}/steps/3-0-3/annotated.png`]: 'image-3-marked',
    [`${base}/steps/3-0-3/failure.yaml`]: STEP_FAILURE_YAML,
  };
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-map-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeTree(root, files) {
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// A real zip: the first entry is stored, the rest are deflated.
function writeZip(file, files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content], index) => {
    const data = Buffer.from(content);
    const method = index === 0 ? 0 : 8;
    const body = method === 0 ? data : zlib.deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  });
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.writeFileSync(file, Buffer.concat([...locals, directory, end]));
  return file;
}

function run(...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

// The lines of one step's block in the sheet, from its header to the next blank line.
function stepBlock(out, folder) {
  const all = out.split('\n');
  const start = all.findIndex((line) => line.startsWith(`[${folder}]`));
  assert.notEqual(start, -1, `no block for ${folder}`);
  const end = all.findIndex((line, index) => index > start && line === '');
  return all.slice(start, end === -1 ? undefined : end).join('\n');
}

test('step sheet', async (t) => {
  const pack = writeTree(tempDir(t), packFiles());
  const { code, out } = run(pack);
  assert.equal(code, 0);

  const cases = [
    { name: 'prints run.yaml and the failure index first',
      check: () => {
        assert.match(out, /--- run\.yaml\nevidence: '0\.1'\nrun_kind: replay/);
        assert.match(out, /--- failure\.yaml\nfailures:/);
      } },
    { name: 'counts what it found',
      check: () => assert.match(out, /step folders=3 action rows=4 authored operations=5 result\.yaml rows=5/) },
    { name: 'joins a folder to the actions log, the authored tree and result.yaml',
      check: () => {
        const block = stepBlock(out, '1-0-1');
        assert.match(block, /id=0-1 kind=navigate step\.json=passed result\.yaml=passed/);
        assert.match(block, /action_id=act-1 joined=AER/);
        assert.match(block, /authored\[act-1\]: intent=Navigate to the shop \| instruction=Open the shop \| status=success/);
        assert.match(block, /reasoning: Start at the home page/);
        assert.match(block, /action\[0-actions\.ndjson:1\]: navigate status=success at=T1/);
        assert.match(block, /params: \{"url":"http:\/\/shop\.test\/"\}/);
        assert.match(block, /rationale: Begin the flow/);
      } },
    { name: 'names the screenshot of a step',
      check: () => assert.match(stepBlock(out, '1-0-1'), /screenshot: steps\/1-0-1\/screenshot\.jpg/) },
    { name: 'a folder with no image points at the latest earlier one',
      check: () => assert.match(stepBlock(out, '2-0-2'), /screenshot: NONE — latest earlier image: steps\/1-0-1\/screenshot\.jpg/) },
    { name: 'leaves out empty params',
      check: () => assert.doesNotMatch(stepBlock(out, '2-0-2'), /params:/) },
    { name: 'marks the step that carries the failure record',
      check: () => {
        const block = stepBlock(out, '3-0-3');
        assert.match(block, /result\.yaml=broken .*<-- FAILURE RECORD/);
        assert.match(block, /annotated: annotated\.png/);
        assert.match(block, /error: Timeout 5000ms exceeded\./);
      } },
    { name: 'shows the block an authored step sits inside',
      check: () => assert.match(stepBlock(out, '3-0-3'), /inside: if_block condition="a banner is shown" condition_met=true/) },
    { name: 'only the failing step is marked',
      check: () => assert.equal(out.match(/<-- FAILURE RECORD/g).length, 1) },
    { name: 'lists an action that has no step folder',
      check: () => assert.match(out, /action with no step folder: 0-actions\.ndjson:4 wait status=success \| Wait for the page/) },
    { name: 'sums up the steps the run never reached',
      check: () => assert.match(out, /2 skipped result\.yaml row\(s\) with no step folder, ordinals 4-5/) },
    { name: 'flags the triage inside the pack as a claim',
      check: () => assert.match(out, /EMBEDDED TRIAGE in steps\/3-0-3\/failure\.yaml \(verification=not_verified\): a claim to check/) },
    { name: 'lists matching log lines with their line numbers',
      check: () => {
        assert.match(out, /0-run\.log: 1 matching line\(s\)\n {4}3: \[STEP 3 FAIL\] Timeout 5000ms exceeded\./);
        assert.match(out, /tui\.log: 1 matching line\(s\)\n {4}2: UPLOAD_FAILED could not publish/);
      } },
  ];
  for (const { name, check } of cases) await t.test(name, check);
});

test('a pack where every step has a folder', (t) => {
  const files = packFiles();
  files['tests/checkout/result.yaml'] = RESULT_YAML.replace(/ {2}- id: later-1[\s\S]*?(?=environment:)/, '');
  files['tests/checkout/logs/0-actions.ndjson'] = ACTIONS.slice(0, 3).map((row) => JSON.stringify(row)).join('\n');
  const { code, out } = run(writeTree(tempDir(t), files));
  assert.equal(code, 0);
  assert.match(out, /UNMAPPED\n {2}none/);
});

test('test selection', async (t) => {
  const pack = writeTree(tempDir(t), { ...packFiles('alpha'), ...packFiles('beta') });
  const cases = [
    { name: 'prints every test by default', args: [pack], code: 0, has: ['TEST alpha', 'TEST beta'], lacks: [] },
    { name: 'prints one test with --test', args: [pack, '--test', 'beta'], code: 0, has: ['TEST beta'], lacks: ['TEST alpha'] },
    { name: 'an unknown test is a usage error', args: [pack, '--test', 'gamma'], code: 2, err: /no test named gamma/ },
  ];
  for (const one of cases) {
    await t.test(one.name, () => {
      const { code, out, err } = run(...one.args);
      assert.equal(code, one.code);
      for (const text of one.has || []) assert.ok(out.includes(text), `missing ${text}`);
      for (const text of one.lacks || []) assert.ok(!out.includes(text), `unexpected ${text}`);
      if (one.err) assert.match(err, one.err);
    });
  }
});

test('reading a .evidence file', async (t) => {
  const dir = tempDir(t);
  const pack = writeZip(path.join(dir, 'run.evidence'), packFiles());

  await t.test('unzips into an empty folder and prints the sheet', () => {
    const out = path.join(dir, 'out');
    const result = run(pack, '--out', out);
    assert.equal(result.code, 0);
    assert.match(result.out, /action_id=act-3 joined=AER/);
    assert.equal(fs.readFileSync(path.join(out, 'tests/checkout/steps/3-0-3/screenshot.png'), 'utf8'), 'image-3');
    assert.equal(fs.readFileSync(path.join(out, 'run.yaml'), 'utf8'), packFiles()['run.yaml']);
  });

  const full = path.join(dir, 'full');
  writeTree(full, { 'keep.txt': 'mine' });
  const escaping = writeZip(path.join(dir, 'escape.evidence'), { 'run.yaml': 'x', '../outside.txt': 'bad' });
  const notZip = path.join(dir, 'broken.evidence');
  fs.writeFileSync(notZip, 'this is not a zip');

  const cases = [
    { name: 'needs --out for a file', args: [pack], err: /--out <new empty dir> is required/ },
    { name: 'refuses a folder that already holds files', args: [pack, '--out', full], err: /--out must be an empty directory/ },
    { name: 'refuses an entry that would land outside the folder',
      args: [escaping, '--out', path.join(dir, 'escape-out')], err: /refusing pack entry outside the output directory/ },
    { name: 'says so when the file is not a zip', args: [notZip, '--out', path.join(dir, 'broken-out')], err: /not a zip file/ },
    { name: 'says so when the pack is missing', args: [path.join(dir, 'missing.evidence')], err: /not found/ },
    { name: 'needs a pack', args: [], err: /pass a \.evidence pack/ },
    { name: 'rejects an unknown option', args: [pack, '--verbose'], err: /unknown option: --verbose/ },
  ];
  for (const one of cases) {
    await t.test(one.name, () => {
      const { code, err } = run(...one.args);
      assert.equal(code, 2);
      assert.match(err, one.err);
      assert.match(err, /Usage:/);
    });
  }

  await t.test('leaves a refused folder untouched', () => {
    assert.deepEqual(fs.readdirSync(full), ['keep.txt']);
    assert.ok(!fs.existsSync(path.join(dir, 'outside.txt')));
    assert.deepEqual(fs.readdirSync(path.join(dir, 'escape-out')), []);
  });
});
