import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('OSV advisory adapter batches resolved npm packages and normalizes deterministic fixture evidence', async () => {
  const core = await import('../dist/index.js');
  assert.equal(typeof core.OsvAdvisoryAdapter, 'function');

  const fixture = JSON.parse(await readFile(resolve('packages/core/test/fixtures/osv-querybatch.json'), 'utf8'));
  const requests = [];
  const adapter = new core.OsvAdvisoryAdapter({
    transport: async (request) => {
      requests.push(request);
      return fixture;
    },
  });

  const result = await adapter.lookup([
    { ecosystem: 'npm', name: 'zeta', version: '2.0.0' },
    { ecosystem: 'npm', name: 'alpha', version: '1.2.3' },
  ]);

  assert.deepEqual(requests, [
    {
      url: 'https://api.osv.dev/v1/querybatch',
      body: {
        queries: [
          { package: { ecosystem: 'npm', name: 'alpha' }, version: '1.2.3' },
          { package: { ecosystem: 'npm', name: 'zeta' }, version: '2.0.0' },
        ],
      },
    },
  ]);

  assert.deepEqual(result, [
    {
      package: { ecosystem: 'npm', name: 'alpha', version: '1.2.3' },
      advisories: [
        {
          id: 'GHSA-ALPHA-1',
          severity: 'high',
          fixedVersions: ['1.2.4'],
          provenance: 'osv',
          confidence: 1,
        },
        {
          id: 'OSV-ALPHA-2',
          severity: 'medium',
          fixedVersions: ['1.3.0'],
          provenance: 'osv',
          confidence: 1,
        },
      ],
    },
    {
      package: { ecosystem: 'npm', name: 'zeta', version: '2.0.0' },
      advisories: [],
    },
  ]);
});
