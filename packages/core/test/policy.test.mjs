import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../dist/policy.js';

test('safe mode denies write shell and recipe network', () => {
  const policy = new PolicyEngine({ mode: 'safe' });
  assert.equal(policy.decide('filesystem.write').allowed, false);
  assert.equal(policy.decide('shell.execute').allowed, false);
  assert.equal(policy.decide('network.fetch', { source: 'recipe' }).allowed, false);
});

test('recipe cannot self-elevate GitHub write permissions', () => {
  const policy = new PolicyEngine({ mode: 'safe' });
  assert.equal(policy.decide('github.issue.write', { requestedBy: 'recipe' }).allowed, false);
});

test('ask mode requires approval for writes', () => {
  const policy = new PolicyEngine({ mode: 'ask' });
  const decision = policy.decide('filesystem.write');
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, true);
});
