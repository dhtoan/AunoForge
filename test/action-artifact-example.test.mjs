import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const exampleUrl = new URL('../docs/examples/aunoforge-review.yml', import.meta.url);
const workflowUrl = new URL('../.github/workflows/aunoforge-review.yml', import.meta.url);

test('workflow example keeps artifact upload optional and independent from PR comments', async () => {
  const source = await readFile(exampleUrl, 'utf8');
  assert.match(source, /id:\s+aunoforge/);
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
  assert.match(source, /steps\.aunoforge\.outputs\.report-path/);
  assert.match(source, /optional/i);
});

test('repository smoke workflow uses the stable artifact name without enabling comments', async () => {
  const source = await readFile(workflowUrl, 'utf8');
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
});
