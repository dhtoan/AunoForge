import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSarif } from '../dist/index.js';

const report = {
  schemaVersion: '1',
  repository: { root: '.' },
  findings: [
    {
      id: 'verified-high',
      severity: 'high',
      category: 'javascript-eval',
      title: 'Dynamic JavaScript evaluation detected',
      evidence: ['Matched direct eval call.'],
      location: { file: 'src/a.js', startLine: 4, endLine: 4, verified: true },
      explanation: 'Dynamic evaluation creates a code execution boundary.',
      confidence: 0.99,
      source: 'deterministic',
    },
    {
      id: 'verified-medium',
      severity: 'medium',
      category: 'regression',
      title: 'Behavior regression',
      evidence: ['Changed return value.'],
      location: { file: 'src/b.js', startLine: 8, verified: true },
      explanation: 'Behavior changed.',
      confidence: 0.9,
      source: 'model',
    },
    {
      id: 'unverified-claim',
      severity: 'high',
      category: 'security',
      title: 'Unverified claim',
      evidence: ['Model claim only.'],
      location: { file: 'src/c.js', startLine: 2, verified: false },
      explanation: 'Needs evidence verification.',
      confidence: 0.4,
      source: 'model',
    },
  ],
  summary: { critical: 0, high: 2, medium: 1, low: 0, info: 0 },
  recommendation: 'request-changes',
};

test('SARIF 2.1.0 includes only verified locations with stable rules and evidence-backed messages', () => {
  const output = renderSarif(report);
  const sarif = JSON.parse(output);

  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'AunoForge');
  assert.deepEqual(
    sarif.runs[0].tool.driver.rules.map((rule) => rule.id),
    ['javascript-eval', 'regression'],
  );
  assert.equal(sarif.runs[0].results.length, 2);
  assert.equal(sarif.runs[0].results[0].level, 'error');
  assert.equal(sarif.runs[0].results[0].ruleId, 'javascript-eval');
  assert.match(sarif.runs[0].results[0].message.text, /Matched direct eval call\./);
  assert.equal(
    sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri,
    'src/a.js',
  );
  assert.equal(
    sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine,
    4,
  );
  assert.ok(!output.includes('unverified-claim'));
  assert.equal(output.endsWith('\n'), true);
  assert.equal(renderSarif(report), output);
});
