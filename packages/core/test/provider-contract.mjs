import test from 'node:test';
import assert from 'node:assert/strict';

export function providerContract(name, factory) {
  test(`${name}: exposes stable capabilities`, () => {
    const provider = factory();
    assert.equal(typeof provider.id, 'string');
    const caps = provider.capabilities();
    for (const key of ['structuredOutput','toolCalling','largeContext','streaming','patchGeneration']) assert.equal(typeof caps[key], 'boolean');
  });

  test(`${name}: returns structured analysis`, async () => {
    const provider = factory();
    const result = await provider.analyze({ task:'review', systemPolicy:'policy', trustedMetadata:{}, untrustedContent:{diff:'x'} });
    assert.equal(typeof result, 'object');
    assert.ok(Array.isArray(result.findings ?? []));
  });

  test(`${name}: honors abort signal`, async () => {
    const provider = factory();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => provider.analyze({ task:'review', systemPolicy:'policy', trustedMetadata:{}, untrustedContent:{} }, controller.signal), /abort/i);
  });
}
