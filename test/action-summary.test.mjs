import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFindingVerificationCounts,
  renderActionStepSummary,
} from '../scripts/action-summary.mjs';

const report = {
  schemaVersion: '1',
  repository: { root: '/repo' },
  findings: [
    {
      id: 'deterministic-1',
      severity: 'high',
      category: 'javascript-eval',
      title: 'Dynamic eval',
      evidence: ['dynamic evaluation fixture'],
      explanation: 'Avoid eval.',
      confidence: 1,
      source: 'deterministic',
      location: { file: 'src/app.js', startLine: 7 },
    },
    {
      id: 'model-verified',
      severity: 'medium',
      category: 'regression',
      title: 'Verified regression',
      evidence: ['return false'],
      explanation: 'Behavior changed.',
      confidence: 0.9,
      source: 'model',
      location: { file: 'src/check.js', startLine: 3, verified: true },
    },
    {
      id: 'model-unverified',
      severity: 'low',
      category: 'maintainability',
      title: 'Unverified claim',
      evidence: [],
      explanation: 'Needs inspection.',
      confidence: 0.4,
      source: 'model',
    },
  ],
  summary: { critical: 0, high: 1, medium: 1, low: 1, info: 0 },
  recommendation: 'needs-review',
};

test('finding verification counts treat deterministic and evidence-verified findings as verified', () => {
  assert.deepEqual(getFindingVerificationCounts(report), {
    verified: 2,
    unverified: 1,
  });
});

test('Step Summary is concise, structured, and explicit about write mode', () => {
  const output = renderActionStepSummary({
    report,
    provider: 'mock',
    format: 'markdown',
    reportPath: '/repo/aunoforge-review.md',
    commentEnabled: false,
    allowWrite: false,
  });

  assert.match(output, /^## AunoForge Review/m);
  assert.match(output, /Recommendation \| `needs-review`/);
  assert.match(output, /Provider \| `mock`/);
  assert.match(output, /Mode \| `read-only`/);
  assert.match(output, /Findings \| 2 verified · 1 unverified/);
  assert.match(output, /Critical 0 · High 1 · Medium 1 · Low 1 · Info 0/);
  assert.match(output, /Report \| `aunoforge-review\.md`/);
  assert.match(output, /Repository writes are disabled by default/);
  assert.equal(output.endsWith('\n'), true);
});

test('Step Summary reports explicit PR comment write mode only when both gates are enabled', () => {
  const output = renderActionStepSummary({
    report,
    provider: 'mock',
    format: 'json',
    reportPath: '/repo/aunoforge-review.json',
    commentEnabled: true,
    allowWrite: true,
  });

  assert.match(output, /Mode \| `PR comment write enabled`/);
});
