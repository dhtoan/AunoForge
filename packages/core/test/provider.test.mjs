import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderCapabilities } from '../dist/provider.js';

test('provider capabilities use stable booleans', () => {
  const caps = validateProviderCapabilities({ structuredOutput: true, toolCalling: false, largeContext: true, streaming: false, patchGeneration: false });
  assert.equal(caps.structuredOutput, true);
  assert.throws(() => validateProviderCapabilities({ ...caps, streaming: 'yes' }), /streaming/);
});
