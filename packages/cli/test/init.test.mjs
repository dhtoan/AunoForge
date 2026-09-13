import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApprovalToken } from '@aunoforge/core';
import { initializeAunoForge } from '../dist/init.js';

test('init creates schemaVersion 1 config.json only with approval and never overwrites existing config', async () => {
  const root=await mkdtemp(join(tmpdir(),'aunoforge-init-'));
  await writeFile(join(root,'package.json'),'{"name":"x"}');
  const first=await initializeAunoForge(root,{approvalToken:createApprovalToken('interactive')});
  assert.equal(first.created,true);
  const path=join(root,'.aunoforge','config.json');
  assert.equal(first.path,path);
  const before=await readFile(path,'utf8');
  const config=JSON.parse(before);
  assert.equal(config.schemaVersion,1);
  assert.equal('allowWrite' in config,false);
  assert.equal('allowMerge' in config,false);
  assert.equal('allowPublish' in config,false);
  const second=await initializeAunoForge(root,{approvalToken:createApprovalToken('interactive')});
  assert.equal(second.skippedExisting,true);
  assert.equal(await readFile(path,'utf8'),before);
});

test('init dry run previews versioned config and performs zero writes', async () => {
  const root=await mkdtemp(join(tmpdir(),'aunoforge-init-'));
  const result=await initializeAunoForge(root,{dryRun:true});
  assert.equal(result.created,false);
  assert.equal(result.path,join(root,'.aunoforge','config.json'));
  assert.equal(JSON.parse(result.preview).schemaVersion,1);
  await assert.rejects(()=>readFile(join(root,'.aunoforge','config.json'),'utf8'));
});
