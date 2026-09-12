import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { scanRepositoryDeterministically } from '../packages/cli/dist/deterministic.js';

function highOrCritical(findings, category) {
  return findings.filter((finding) => finding.category === category && ['high','critical'].includes(finding.severity));
}

test('wordpress known-bad fixture produces verified high-confidence raw-output finding', async () => {
  const findings = await scanRepositoryDeterministically(resolve('fixtures/wordpress-vulnerable'));
  const hits = highOrCritical(findings, 'wordpress-output-escaping');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].source, 'deterministic');
  assert.equal(hits[0].location?.verified, true);
  assert.ok(hits[0].confidence >= 0.95);
});

test('wordpress clean fixture has no high raw-output false positive', async () => {
  const findings = await scanRepositoryDeterministically(resolve('fixtures/wordpress-clean'));
  assert.equal(highOrCritical(findings, 'wordpress-output-escaping').length, 0);
});

test('node known-bad fixture detects eval while clean fixture does not', async () => {
  const bad = await scanRepositoryDeterministically(resolve('fixtures/node-regression'));
  const clean = await scanRepositoryDeterministically(resolve('fixtures/node-clean'));
  assert.equal(highOrCritical(bad, 'javascript-eval').length, 1);
  assert.equal(highOrCritical(clean, 'javascript-eval').length, 0);
});

test('python shell=True known-bad fixture is detected while clean fixture is not', async () => {
  const bad = await scanRepositoryDeterministically(resolve('fixtures/python-vulnerable'));
  const clean = await scanRepositoryDeterministically(resolve('fixtures/python-clean'));
  assert.equal(highOrCritical(bad, 'python-shell-execution').length, 1);
  assert.equal(highOrCritical(clean, 'python-shell-execution').length, 0);
});
