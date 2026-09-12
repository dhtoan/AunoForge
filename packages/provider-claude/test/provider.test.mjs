import test from 'node:test';
import assert from 'node:assert/strict';
import { providerContract } from '../../core/test/provider-contract.mjs';
import { ClaudeProvider } from '../dist/index.js';

const valid = JSON.stringify({ findings: [], data: { ok: true } });
function factory(capture = []) {
  return new ClaudeProvider({ apiKey:'test-anthropic-key', model:'test-claude', transport: async (request) => {
    capture.push(request);
    return { content:[{ type:'text', text: valid }] };
  }});
}
providerContract('claude', () => factory());

test('claude keeps credentials out of transport request object', async () => {
  const capture=[]; const provider=factory(capture);
  await provider.analyze({task:'review',systemPolicy:'SYSTEM',trustedMetadata:{},untrustedContent:{body:'malicious prompt'}});
  const serialized=JSON.stringify(capture[0]);
  assert.match(serialized,/UNTRUSTED/);
  assert.doesNotMatch(serialized,/test-anthropic-key/);
});

test('claude rejects malformed JSON output', async () => {
  const provider = new ClaudeProvider({ apiKey:'k', model:'m', transport: async () => ({ content:[{type:'text',text:'nope'}] }) });
  await assert.rejects(() => provider.analyze({task:'x',systemPolicy:'p',trustedMetadata:{},untrustedContent:{}}), /JSON|structured/i);
});
