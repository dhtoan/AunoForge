import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveRepositoryPath } from '../dist/paths.js';

test('rejects path traversal outside repository root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-path-'));
  await assert.rejects(() => resolveRepositoryPath(root, '../../etc/passwd', { forWrite: true }), /outside repository root/i);
});

test('rejects protected writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-path-'));
  await assert.rejects(() => resolveRepositoryPath(root, '.env', { forWrite: true }), /protected/i);
  await assert.rejects(() => resolveRepositoryPath(root, '.git/config', { forWrite: true }), /protected/i);
});

test('rejects symlink escapes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-path-'));
  const outside = await mkdtemp(join(tmpdir(), 'aunoforge-outside-'));
  await mkdir(join(root, 'safe'), { recursive: true });
  await symlink(outside, join(root, 'safe', 'escape'));
  await assert.rejects(() => resolveRepositoryPath(root, 'safe/escape/file.txt', { forWrite: true }), /symlink|outside/i);
});
