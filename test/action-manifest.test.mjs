import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

function isQuotedScalar(value) {
  return (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'));
}

test('action manifest quotes description scalars that contain mapping colons', async () => {
  const source = await readFile(new URL('../action.yml', import.meta.url), 'utf8');
  const violations = source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /^\s*description:\s+/.test(line))
    .map(({ line, number }) => ({
      number,
      value: line.replace(/^\s*description:\s+/, ''),
    }))
    .filter(({ value }) => value.includes(': ') && !isQuotedScalar(value));

  assert.deepEqual(violations, []);
});
