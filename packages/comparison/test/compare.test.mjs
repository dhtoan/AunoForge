import assert from 'node:assert/strict';
import test from 'node:test';
import { compareReviewReports, fingerprintFinding } from '../dist/index.js';

const emptySummary = () => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });

function finding(id, severity, category, file, line, evidence = [`${category}:${line}`]) {
  return {
    id,
    severity,
    category,
    title: `${category} finding`,
    evidence,
    location: { file, startLine: line, endLine: line, verified: true },
    explanation: `${category} explanation`,
    confidence: 0.95,
    source: 'deterministic',
  };
}

function report(findings) {
  const summary = emptySummary();
  for (const item of findings) summary[item.severity] += 1;
  return {
    schemaVersion: '1',
    repository: { root: '/repo', owner: 'dhtoan', repo: 'AunoForge' },
    findings,
    summary,
    recommendation: findings.some((item) => item.severity === 'critical' || item.severity === 'high')
      ? 'request-changes'
      : findings.length > 0
        ? 'needs-review'
        : 'approve',
  };
}

test('classifies persistent severity regression resolved and new findings deterministically', () => {
  const aBase = finding('a-base', 'medium', 'rule-a', 'src/a.ts', 10, ['anchor-a']);
  const bBase = finding('b-base', 'medium', 'rule-b', 'src/b.ts', 20, ['anchor-b']);
  const cBase = finding('c-base', 'low', 'rule-c', 'src/c.ts', 30, ['anchor-c']);
  const aCurrent = { ...aBase, id: 'a-current', title: 'rephrased title', explanation: 'rephrased prose' };
  const bCurrent = { ...bBase, id: 'b-current', severity: 'high', explanation: 'severity increased' };
  const dCurrent = finding('d-current', 'medium', 'rule-d', 'src/d.ts', 40, ['anchor-d']);

  const result = compareReviewReports(report([aBase, bBase, cBase]), report([aCurrent, bCurrent, dCurrent]));

  assert.deepEqual(result.summary, { new: 1, persistent: 1, resolved: 1, regressed: 1 });
  assert.deepEqual(result.findings.map((item) => [item.finding.id, item.state, item.regressionReason ?? null]), [
    ['b-current', 'regressed', 'severity-increase'],
    ['d-current', 'new', null],
    ['a-current', 'persistent', null],
  ]);
  assert.equal(result.resolved[0].finding.id, 'c-base');
  assert.equal(result.resolved[0].state, 'resolved');
});

test('a previously resolved fingerprint that returns is regressed', () => {
  const returned = finding('returned-current', 'medium', 'rule-returned', 'src/returned.ts', 8, ['returned-anchor']);
  const fingerprint = fingerprintFinding(returned);
  const baseline = {
    schemaVersion: '1',
    kind: 'incremental-review',
    current: report([]),
    findings: [],
    resolved: [],
    summary: { new: 0, persistent: 0, resolved: 0, regressed: 0 },
    resolvedFingerprints: [fingerprint],
  };

  const result = compareReviewReports(baseline, report([returned]));

  assert.equal(result.findings[0].state, 'regressed');
  assert.equal(result.findings[0].regressionReason, 'returned');
  assert.deepEqual(result.resolvedFingerprints, []);
});

test('resolved fingerprint history carries forward unresolved tombstones and adds newly resolved findings', () => {
  const returnsNow = finding('returns-now', 'medium', 'rule-return', 'src/return.ts', 5, ['return-anchor']);
  const staysResolved = finding('stays-resolved', 'low', 'rule-stays', 'src/stays.ts', 6, ['stays-anchor']);
  const newlyResolved = finding('newly-resolved', 'medium', 'rule-newly-resolved', 'src/old.ts', 7, ['old-anchor']);
  const returnFp = fingerprintFinding(returnsNow);
  const staysFp = fingerprintFinding(staysResolved);
  const newlyResolvedFp = fingerprintFinding(newlyResolved);
  const baseline = {
    schemaVersion: '1',
    kind: 'incremental-review',
    current: report([newlyResolved]),
    findings: [],
    resolved: [],
    summary: { new: 0, persistent: 0, resolved: 0, regressed: 0 },
    resolvedFingerprints: [returnFp, staysFp],
  };

  const result = compareReviewReports(baseline, report([returnsNow]));

  assert.deepEqual(result.resolvedFingerprints, [newlyResolvedFp, staysFp].sort());
  assert.equal(result.findings[0].regressionReason, 'returned');
  assert.equal(result.resolved[0].finding.id, 'newly-resolved');
});

test('comparison collapses fingerprint collisions to the strongest deterministic representative while preserving raw current findings', () => {
  const medium = finding('z-medium', 'medium', 'rule-dup', 'src/dup.ts', 11, ['same-anchor']);
  const highZ = { ...medium, id: 'z-high', severity: 'high' };
  const highA = { ...medium, id: 'a-high', severity: 'high' };
  const current = report([medium, highZ, highA]);

  const result = compareReviewReports(report([]), current);

  assert.equal(result.current.findings.length, 3);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].finding.id, 'a-high');
  assert.equal(result.findings[0].state, 'new');
  assert.deepEqual(result.summary, { new: 1, persistent: 0, resolved: 0, regressed: 0 });
});
