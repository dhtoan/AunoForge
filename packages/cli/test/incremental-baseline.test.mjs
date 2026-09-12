import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli } from '../dist/app.js';
import { fingerprintFinding } from '../../comparison/dist/index.js';

async function capture(argv) {
  const lines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  try {
    return { code: await runCli(argv), output: lines.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function currentReport(root) {
  const result = await capture([
    'review',
    '--root', root,
    '--diff', resolve('test/fixtures/sample.diff'),
    '--provider', 'mock',
    '--format', 'json',
  ]);
  assert.equal(result.code, 0);
  return JSON.parse(result.output);
}

function emptyCurrent(report) {
  return {
    ...report,
    findings: [],
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    recommendation: 'approve',
  };
}

test('review --baseline compares two local JSON reports fully offline and keeps no-baseline JSON compatible', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-cli-baseline-'));
  const baseline = await currentReport(root);
  assert.equal(baseline.kind, undefined);
  assert.equal(Array.isArray(baseline.findings), true);

  const baselinePath = join(root, 'baseline.json');
  await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');
  const result = await capture([
    'review',
    '--root', root,
    '--diff', resolve('test/fixtures/sample.diff'),
    '--baseline', baselinePath,
    '--provider', 'mock',
    '--format', 'json',
  ]);

  assert.equal(result.code, 0);
  const incremental = JSON.parse(result.output);
  assert.equal(incremental.kind, 'incremental-review');
  assert.deepEqual(incremental.summary, {
    new: 0,
    persistent: baseline.findings.length,
    resolved: 0,
    regressed: 0,
  });
  assert.equal(incremental.current.findings.length, baseline.findings.length);
});

test('review rejects a malformed baseline with a clear validation error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-cli-invalid-baseline-'));
  const baselinePath = join(root, 'invalid-baseline.json');
  await writeFile(baselinePath, JSON.stringify({ schemaVersion: '2' }), 'utf8');

  await assert.rejects(
    () => capture([
      'review',
      '--root', root,
      '--diff', resolve('test/fixtures/sample.diff'),
      '--baseline', baselinePath,
      '--provider', 'mock',
      '--format', 'json',
    ]),
    /schemaVersion must be 1/,
  );
});

test('--baseline is consumed only by review and does not change triage or reproduce format handling', async () => {
  const fixture = resolve('test/fixtures/github-issue.json');
  const unusedBaseline = resolve('test/fixtures/sample.diff');

  const triage = await capture([
    'triage', '1',
    '--owner', 'fixture',
    '--repo', 'fixture',
    '--fixture', fixture,
    '--baseline', unusedBaseline,
    '--provider', 'mock',
    '--format', 'json',
  ]);
  assert.equal(triage.code, 0);
  assert.equal(JSON.parse(triage.output).severity, 'info');

  const reproduce = await capture([
    'reproduce', '1',
    '--owner', 'fixture',
    '--repo', 'fixture',
    '--fixture', fixture,
    '--baseline', unusedBaseline,
    '--provider', 'mock',
    '--format', 'json',
  ]);
  assert.equal(reproduce.code, 0);
  assert.equal(Array.isArray(JSON.parse(reproduce.output).steps), true);
});

test('a prior incremental JSON report can be reused and a resolved fingerprint returning becomes regressed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-cli-returned-baseline-'));
  const current = await currentReport(root);
  const target = current.findings.find((finding) => finding.category === 'javascript-eval');
  assert.ok(target);
  const targetFingerprint = fingerprintFinding(target);
  const baseline = {
    schemaVersion: '1',
    kind: 'incremental-review',
    current: emptyCurrent(current),
    findings: [],
    resolved: [],
    summary: { new: 0, persistent: 0, resolved: 0, regressed: 0 },
    resolvedFingerprints: [targetFingerprint],
  };
  const baselinePath = join(root, 'prior-incremental.json');
  await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

  const result = await capture([
    'review',
    '--root', root,
    '--diff', resolve('test/fixtures/sample.diff'),
    '--baseline', baselinePath,
    '--provider', 'mock',
    '--format', 'json',
  ]);
  assert.equal(result.code, 0);
  const next = JSON.parse(result.output);
  const returned = next.findings.find((item) => item.fingerprint === targetFingerprint);
  assert.equal(returned.state, 'regressed');
  assert.equal(returned.regressionReason, 'returned');
});
