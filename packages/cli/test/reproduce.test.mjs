import test from 'node:test';
import assert from 'node:assert/strict';
import { MockProvider } from '@aunoforge/provider-mock';
import { reproduceIssue, renderReproduction } from '../dist/reproduce.js';

test('reproduce returns environment steps expected actual and missing evidence', async () => {
  const reader={getIssue:async()=>({number:4,title:'Drawer bug',body:'On mobile it breaks',url:'u',labels:['bug']})};
  const provider=new MockProvider({generate:async()=>({data:{environment:['mobile viewport'],steps:['Open post','Open comments'],expected:'Full width video',actual:'Video shrinks',likelyAffectedAreas:['viewer.ts'],missingEvidence:['browser version']}})});
  const plan=await reproduceIssue({reader,provider,owner:'o',repo:'r',issueNumber:4});
  assert.deepEqual(plan.steps,['Open post','Open comments']);
  assert.match(renderReproduction(plan,'markdown'),/Full width video/);
  assert.equal(JSON.parse(renderReproduction(plan,'json')).schemaVersion,'1');
});
