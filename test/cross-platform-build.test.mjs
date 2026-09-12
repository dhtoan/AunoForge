import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const rootUrl = new URL('../', import.meta.url);

test('root TypeScript build is shell-independent and references every package project', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', rootUrl), 'utf8'));

  assert.equal(pkg.scripts.build, 'tsc -b');
  assert.equal(pkg.scripts.typecheck, 'tsc -b --pretty false');

  const tsconfigUrl = new URL('tsconfig.json', rootUrl);
  assert.equal(existsSync(tsconfigUrl), true, 'root tsconfig.json must exist');
  const tsconfig = JSON.parse(await readFile(tsconfigUrl, 'utf8'));

  const packageEntries = await readdir(new URL('packages/', rootUrl), { withFileTypes: true });
  const expected = packageEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `./packages/${entry.name}`)
    .sort();
  const actual = (tsconfig.references ?? []).map((entry) => entry.path).sort();

  assert.deepEqual(actual, expected);
});
