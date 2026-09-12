import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { detectProject } from '../dist/project.js';

test('detects WordPress Node and Python fixtures', async () => {
  assert.equal((await detectProject(resolve('fixtures/wordpress-clean'))).type,'wordpress-plugin');
  assert.equal((await detectProject(resolve('fixtures/node-clean'))).type,'node');
  assert.equal((await detectProject(resolve('fixtures/python-clean'))).type,'python');
});

test('detects monorepo before generic node', async () => {
  const root=await mkdtemp(resolve(tmpdir(),'aunoforge-monorepo-'));
  await writeFile(resolve(root,'package.json'),JSON.stringify({workspaces:['packages/*']}));
  assert.equal((await detectProject(root)).type,'monorepo');
});
