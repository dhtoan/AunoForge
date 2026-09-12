import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stableRef = 'dhtoan/AunoForge@v0.1.0';
const movingRef = 'dhtoan/AunoForge@main';

test('README leads with a zero-key proof and pins public Action usage to v0.1.0', async () => {
  const readme = await readFile('README.md', 'utf8');
  const proofIndex = readme.indexOf('## ⚡ 60-second proof');
  const whyIndex = readme.indexOf('## Why AunoForge?');

  assert.notEqual(proofIndex, -1, 'README should expose the first-success path near the top');
  assert.notEqual(whyIndex, -1, 'README should retain the deeper product explanation');
  assert.ok(proofIndex < whyIndex, 'the proof should appear before the architecture/product deep dive');
  assert.match(readme, /provider:\s*mock/);
  assert.match(readme, new RegExp(stableRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(readme, new RegExp(movingRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('README shows output verified from the real v0.1.0 stable smoke artifact', async () => {
  const readme = await readFile('README.md', 'utf8');

  assert.match(readme, /### Verified v0\.1\.0 output/);
  assert.match(readme, /Recommendation:\s*\*\*approve\*\*/);
  assert.match(readme, /Critical:\s*0\s*·\s*High:\s*0\s*·\s*Medium:\s*0\s*·\s*Low:\s*0\s*·\s*Info:\s*0/);
  assert.match(readme, /No findings\./);
  assert.match(readme, /stable smoke/i);
});

test('maintained user-facing Action example is compatible with the v0.1.0 interface', async () => {
  const example = await readFile('docs/examples/aunoforge-review.yml', 'utf8');

  assert.match(example, /uses:\s*dhtoan\/AunoForge@v0\.1\.0/);
  assert.match(example, /provider:\s*mock/);
  assert.match(example, /format:\s*markdown/);
  assert.match(example, /comment:\s*['"]false['"]/);
  assert.doesNotMatch(example, /dhtoan\/AunoForge@main/);
  assert.doesNotMatch(example, /^\s*baseline:/m, 'v0.1.0 has no baseline input');
  assert.doesNotMatch(example, /format:\s*sarif/, 'v0.1.0 has no SARIF format');
});

test('stable-tag smoke workflow executes the released v0.1.0 Action in zero-key mode', async () => {
  const workflow = await readFile('.github/workflows/stable-action-smoke.yml', 'utf8');

  assert.match(workflow, /uses:\s*dhtoan\/AunoForge@v0\.1\.0/);
  assert.match(workflow, /provider:\s*mock/);
  assert.match(workflow, /format:\s*markdown/);
  assert.match(workflow, /comment:\s*['"]false['"]/);
  assert.doesNotMatch(workflow, /pull-requests:\s*write/);
  assert.doesNotMatch(workflow, /allow-write:\s*['"]true['"]/);
});
