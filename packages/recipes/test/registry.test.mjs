import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { BuiltinRecipeRegistry } from '../dist/registry.js';

test('loads at least ten builtin recipes', async () => {
  const registry = await BuiltinRecipeRegistry.fromRoot(resolve('.'));
  assert.ok(registry.list().length >= 10);
  assert.ok(registry.list().includes('wordpress/plugin-review'));
});
