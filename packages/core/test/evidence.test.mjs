import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyFindingEvidence } from '../dist/evidence.js';

test('verifies a valid file and line reference', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-evidence-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/a.ts'), 'one\ntwo vulnerable\nthree\n');
  const result = await verifyFindingEvidence(root, {
    id:'f1', severity:'high', category:'security', title:'x', evidence:['vulnerable'],
    location:{file:'src/a.ts', startLine:2, endLine:2, verified:false}, explanation:'x', confidence:0.95, source:'model'
  });
  assert.equal(result.location?.verified, true);
  assert.equal(result.confidence, 0.95);
});

test('rejects impossible line references and downgrades confidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-evidence-'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/a.ts'), 'one\ntwo\n');
  const result = await verifyFindingEvidence(root, {
    id:'f1', severity:'high', category:'regression', title:'bad', evidence:['x'],
    location:{file:'src/a.ts', startLine:999, endLine:999, verified:false}, explanation:'x', confidence:0.95, source:'model'
  });
  assert.equal(result.location, undefined);
  assert.ok(result.confidence < 0.95);
});
