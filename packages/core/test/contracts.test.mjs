import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinding, validateReviewReport } from '../dist/contracts.js';

test('validateFinding accepts a verified model finding', () => {
  const finding = validateFinding({
    id: 'finding-1',
    severity: 'high',
    category: 'security',
    title: 'Unsafe output',
    evidence: ["echo $_GET['q'];"],
    location: { file: 'plugin.php', startLine: 10, endLine: 10, verified: true },
    explanation: 'Request data reaches output without escaping.',
    verification: ['Inspect plugin.php:10'],
    confidence: 0.9,
    source: 'model'
  });
  assert.equal(finding.severity, 'high');
});

test('validateFinding rejects confidence outside zero to one', () => {
  assert.throws(() => validateFinding({
    id: 'bad', severity: 'low', category: 'quality', title: 'Bad', evidence: [],
    explanation: 'Bad confidence', confidence: 2, source: 'model'
  }), /confidence/);
});

test('validateReviewReport requires schemaVersion 1 and known recommendation', () => {
  const report = validateReviewReport({
    schemaVersion: '1', repository: { root: '.' }, findings: [],
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    recommendation: 'approve'
  });
  assert.equal(report.schemaVersion, '1');
  assert.throws(() => validateReviewReport({ ...report, recommendation: 'ship-it' }), /recommendation/);
});
