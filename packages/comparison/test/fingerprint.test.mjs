import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintFinding, normalizeEvidenceAnchor, normalizeFindingPath } from '../dist/index.js';

const base = {
  id: 'provider-id-1',
  severity: 'medium',
  category: 'javascript-eval',
  title: 'Avoid eval',
  evidence: ['  eval( userInput )\r\n'],
  location: { file: '.\\src\\app.js', startLine: 12, endLine: 12, verified: true },
  explanation: 'Original prose',
  confidence: 0.9,
  source: 'deterministic',
};

test('fingerprint normalizes path and evidence while ignoring prose severity and provider id', () => {
  assert.equal(normalizeFindingPath('.\\src\\app.js'), 'src/app.js');
  assert.equal(normalizeEvidenceAnchor(base), 'evidence:eval( userInput )');
  const original = fingerprintFinding(base);
  const rephrased = fingerprintFinding({
    ...base,
    id: 'another-id',
    severity: 'high',
    title: 'Different title',
    explanation: 'Different prose',
  });
  assert.equal(original, rephrased);
  assert.match(original, /^af1:[a-f0-9]{64}$/);
});

test('fingerprint is stable when evidence order or whitespace changes', () => {
  const a = fingerprintFinding({ ...base, evidence: ['foo  bar', ' baz '] });
  const b = fingerprintFinding({ ...base, evidence: ['baz', 'foo bar'] });
  assert.equal(a, b);
});

test('fingerprint falls back to a verified line anchor when evidence is empty', () => {
  assert.equal(normalizeEvidenceAnchor({ ...base, evidence: [] }), 'line:12-12');
});

test('unlocated evidence-free findings use a deterministic repository anchor', () => {
  const fingerprint = fingerprintFinding({ ...base, evidence: [], location: undefined });
  assert.match(fingerprint, /^af1:[a-f0-9]{64}$/);
});
