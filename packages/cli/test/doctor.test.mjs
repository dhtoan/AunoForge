import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor } from '../dist/doctor.js';

test('doctor score is deterministic and reports missing CODEOWNERS', async () => {
  const root=await mkdtemp(join(tmpdir(),'aunoforge-doctor-'));
  await writeFile(join(root,'LICENSE'),'license');
  await writeFile(join(root,'SECURITY.md'),'security');
  await writeFile(join(root,'CONTRIBUTING.md'),'contrib');
  await mkdir(join(root,'.github','workflows'),{recursive:true});
  await writeFile(join(root,'.github','workflows','ci.yml'),'name: ci');
  await writeFile(join(root,'package.json'),JSON.stringify({scripts:{test:'node --test'},engines:{node:'>=20'}}));
  const a=await runDoctor(root); const b=await runDoctor(root);
  assert.deepEqual(a,b);
  assert.ok(a.score>=0&&a.score<=100);
  assert.ok(a.checks.some(x=>x.id==='codeowners'&&!x.pass));
});
