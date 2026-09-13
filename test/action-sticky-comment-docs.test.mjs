import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('getting started documents opt-in sticky PR comments and least-privilege gates', async () => {
  const docs = await readFile('docs/getting-started.md', 'utf8');
  assert.match(docs, /sticky PR comments/i);
  assert.match(docs, /comment:\s*['"]?true['"]?/i);
  assert.match(docs, /allow-write:\s*['"]?true['"]?/i);
  assert.match(docs, /pull-requests:\s*write/i);
  assert.match(docs, /disabled by default/i);
  assert.match(docs, /hidden marker|marked comment/i);
  assert.match(docs, /fork/i);
});
