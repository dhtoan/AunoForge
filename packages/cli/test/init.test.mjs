import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApprovalToken } from '@aunoforge/core';
import { initializeAunoForge } from '../dist/init.js';

test('init creates safe config only with approval and never overwrites existing config', async () => {
  const root=await mkdtemp(join(tmpdir(),'aunoforge-init-'));
  await writeFile(join(root,'package.json'),'{"name":"x"}');
  const first=await initializeAunoForge(root,{approvalToken:createApprovalToken('interactive')});
  assert.equal(first.created,true);
  const path=join(root,'.aunoforge','config.yml');
  const before=await readFile(path,'utf8');
  const second=await initializeAunoForge(root,{approvalToken:createApprovalToken('interactive')});
  assert.equal(second.skippedExisting,true);
  assert.equal(await readFile(path,'utf8'),before);
});

test('init dry run performs zero writes', async () => {
  const root=await mkdtemp(join(tmpdir(),'aunoforge-init-'));
  const result=await initializeAunoForge(root,{dryRun:true});
  assert.equal(result.created,false);
  await assert.rejects(()=>readFile(join(root,'.aunoforge','config.yml'),'utf8'));
});
