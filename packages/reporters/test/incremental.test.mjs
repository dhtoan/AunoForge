import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderJson,
  renderMarkdown,
  renderReport,
  renderSarif,
  renderTerminal,
} from '../dist/index.js';

const finding = (id, severity, category, file, line) => ({
  id,
  severity,
  category,
  title: `${category} title`,
  evidence: [`${category} evidence`],
  location: { file, startLine: line, endLine: line, verified: true },
  explanation: `${category} explanation`,
  confidence: 0.95,
  source: 'deterministic',
});

const regressed = finding('regressed', 'high', 'security', 'src/security.ts', 4);
const newlyFound = finding('new', 'medium', 'regression', 'src/new.ts', 8);
const persistent = finding('persistent', 'low', 'maintainability', 'src/old.ts', 12);
const current = {
  schemaVersion: '1',
  repository: { root: '/repo' },
  findings: [persistent, newlyFound, regressed],
  summary: { critical: 0, high: 1, medium: 1, low: 1, info: 0 },
  recommendation: 'request-changes',
};
const resolvedFinding = finding('resolved', 'info', 'style', 'src/resolved.ts', 3);
const fp = (char) => `af1:${char.repeat(64)}`;
const incremental = {
  schemaVersion: '1',
  kind: 'incremental-review',
  current,
  findings: [
    { fingerprint: fp('a'), state: 'regressed', finding: regressed, baselineSeverity: 'medium', regressionReason: 'severity-increase' },
    { fingerprint: fp('b'), state: 'new', finding: newlyFound },
    { fingerprint: fp('c'), state: 'persistent', finding: persistent, baselineSeverity: 'low' },
  ],
  resolved: [{ fingerprint: fp('d'), state: 'resolved', finding: resolvedFinding }],
  summary: { new: 1, persistent: 1, resolved: 1, regressed: 1 },
  resolvedFingerprints: [fp('d')],
};

test('report dispatcher preserves byte-compatible current report output when no incremental comparison is supplied', () => {
  assert.equal(renderReport(current, 'json'), renderJson(current));
  assert.equal(renderReport(current, 'markdown'), renderMarkdown(current));
  assert.equal(renderReport(current, 'terminal'), renderTerminal(current));
  assert.equal(renderReport(current, 'sarif'), renderSarif(current));
});

test('incremental markdown and terminal lead with regressed and new evidence then persistent and resolved summary', () => {
  const markdown = renderReport(current, 'markdown', incremental);
  assert.match(markdown, /Regressed: 1/);
  assert.match(markdown, /New: 1/);
  assert.ok(markdown.indexOf('REGRESSED') < markdown.indexOf('NEW'));
  assert.ok(markdown.indexOf('NEW') < markdown.indexOf('PERSISTENT'));
  assert.match(markdown, /Resolved: 1/);

  const terminal = renderReport(current, 'terminal', incremental);
  assert.match(terminal, /REGRESSED/);
  assert.match(terminal, /NEW/);
  assert.match(terminal, /PERSISTENT/);
  assert.match(terminal, /Resolved: 1/);
  assert.ok(terminal.indexOf('REGRESSED') < terminal.indexOf('NEW'));
});

test('incremental json serializes the complete comparison envelope', () => {
  const parsed = JSON.parse(renderReport(current, 'json', incremental));
  assert.equal(parsed.kind, 'incremental-review');
  assert.deepEqual(parsed.summary, { new: 1, persistent: 1, resolved: 1, regressed: 1 });
  assert.equal(parsed.current.findings.length, 3);
  assert.equal(parsed.resolved[0].state, 'resolved');
});

test('incremental SARIF keeps current verified results and attaches fingerprint state plus run comparison counts', () => {
  const sarif = JSON.parse(renderReport(current, 'sarif', incremental));
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].results.length, 3);
  assert.deepEqual(sarif.runs[0].properties.aunoforgeIncremental, { new: 1, persistent: 1, resolved: 1, regressed: 1 });
  const byId = new Map(sarif.runs[0].results.map((result) => [result.properties.aunoforgeFindingId, result]));
  assert.equal(byId.get('regressed').properties.aunoforgeFingerprint, fp('a'));
  assert.equal(byId.get('regressed').properties.aunoforgeState, 'regressed');
  assert.equal(byId.get('new').properties.aunoforgeState, 'new');
  assert.equal(byId.get('persistent').properties.aunoforgeState, 'persistent');
  assert.equal(sarif.runs[0].results.some((result) => result.properties.aunoforgeFindingId === 'resolved'), false);
});
