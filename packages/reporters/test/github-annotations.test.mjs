import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChangedLineScope, selectGitHubAnnotations } from '../dist/index.js';

const diff = [
  'diff --git a/src/a.js b/src/a.js',
  '--- a/src/a.js',
  '+++ b/src/a.js',
  '@@ -2,2 +2,3 @@',
  ' keep',
  '+changed',
  ' keep',
  '+changed-again',
  '',
].join('\n');

function finding({ id, severity, line, verified = true, file = 'src/a.js' }) {
  return {
    id,
    severity,
    category: `rule-${id}`,
    title: `Finding ${id}`,
    evidence: [`Evidence ${id}`],
    location: { file, startLine: line, endLine: line, verified },
    explanation: `Explanation ${id}`,
    confidence: verified ? 0.99 : 0.4,
    source: verified ? 'deterministic' : 'model',
  };
}

function report(findings) {
  return {
    schemaVersion: '1',
    repository: { root: '.' },
    findings,
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    recommendation: 'needs-review',
  };
}

test('changed-line scope tracks added lines in the new file', () => {
  const scope = parseChangedLineScope(diff);
  assert.deepEqual([...scope.get('src/a.js')].sort((a, b) => a - b), [3, 5]);
});

test('GitHub annotations include only verified medium-or-higher findings on changed lines', () => {
  const result = selectGitHubAnnotations(report([
    finding({ id: 'critical', severity: 'critical', line: 3 }),
    finding({ id: 'high', severity: 'high', line: 5 }),
    finding({ id: 'medium', severity: 'medium', line: 3 }),
    finding({ id: 'outside', severity: 'high', line: 7 }),
    finding({ id: 'unverified', severity: 'high', line: 3, verified: false }),
    finding({ id: 'low', severity: 'low', line: 3 }),
  ]), diff);

  assert.equal(result.annotations.length, 3);
  assert.equal(result.eligible, 3);
  assert.equal(result.overflow, 0);
  assert.deepEqual(result.annotations.map((item) => item.level), ['error', 'error', 'warning']);
  assert.deepEqual(result.annotations.map((item) => item.findingId), ['critical', 'high', 'medium']);
  assert.deepEqual(result.annotations.map((item) => item.line), [3, 5, 3]);
});

test('GitHub annotation cap emits 25 and reports overflow deterministically', () => {
  const added = Array.from({ length: 30 }, (_, index) => `+line-${index + 1}`);
  const largeDiff = [
    'diff --git a/src/cap.js b/src/cap.js',
    '--- /dev/null',
    '+++ b/src/cap.js',
    '@@ -0,0 +1,30 @@',
    ...added,
    '',
  ].join('\n');
  const findings = Array.from({ length: 30 }, (_, index) => finding({
    id: `cap-${String(index + 1).padStart(2, '0')}`,
    severity: 'medium',
    line: index + 1,
    file: 'src/cap.js',
  }));

  const result = selectGitHubAnnotations(report(findings), largeDiff);
  assert.equal(result.annotations.length, 25);
  assert.equal(result.eligible, 30);
  assert.equal(result.overflow, 5);
  assert.equal(result.annotations[0].findingId, 'cap-01');
  assert.equal(result.annotations[24].findingId, 'cap-25');
});
