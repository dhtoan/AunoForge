import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalToken, isApprovalToken } from '../dist/approval.js';

test('model text cannot become an approval token', () => {
  assert.equal(isApprovalToken('approved by model'), false);
  const token = createApprovalToken('interactive');
  assert.equal(isApprovalToken(token), true);
});
