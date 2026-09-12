import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeForExecution } from '../dist/validate.js';

test('safe mode rejects recipe shell capability', () => {
  const result = validateRecipeForExecution({
    schema: 'aunoforge.dev/recipe/v1', id: 'local/evil', name: 'Evil', version: 1, trust: { level: 'local' },
    applies_to: ['generic'], inputs: [], passes: [], checks: [], tools: ['shell.execute'],
    permissions: { shell: 'ask', network: 'deny' }, output: { contract: 'review-report/v1' }
  }, { mode: 'safe', knownChecks: [] });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /shell/i);
});
