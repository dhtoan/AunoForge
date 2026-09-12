import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { MockProvider } from '@aunoforge/provider-mock';
import { review, REVIEW_PASSES } from '../dist/review.js';

function git(root,...args){execFileSync('git',['-C',root,...args],{stdio:'ignore'});}
async function repoWithChange(){
  const root=await mkdtemp(join(tmpdir(),'aunoforge-review-'));
  git(root,'init'); git(root,'config','user.email','test@example.com'); git(root,'config','user.name','Test');
  await writeFile(join(root,'a.ts'),'one\ntwo safe\nthree\n'); git(root,'add','.'); git(root,'commit','-m','base');
  await writeFile(join(root,'a.ts'),'one\ntwo vulnerable\nthree\n');
  return root;
}

test('local review runs six passes dedupes findings and verifies evidence', async () => {
  const root=await repoWithChange(); let calls=0;
  const provider=new MockProvider({analyze:async()=>{calls++;return {findings:[{id:`f${calls}`,severity:'high',category:'security',title:'Unsafe line',evidence:['vulnerable'],location:{file:'a.ts',startLine:2,endLine:2,verified:false},explanation:'unsafe',confidence:.9,source:'model'}]};}});
  const report=await review({root,provider});
  assert.equal(calls,REVIEW_PASSES.length); assert.equal(report.findings.length,1); assert.equal(report.findings[0].location.verified,true); assert.equal(report.summary.high,1); assert.equal(report.recommendation,'request-changes');
});

test('review downgrades hallucinated line references', async () => {
  const root=await repoWithChange();
  const provider=new MockProvider({analyze:async()=>({findings:[{id:'x',severity:'medium',category:'regression',title:'Impossible',evidence:['x'],location:{file:'a.ts',startLine:9999,endLine:9999,verified:false},explanation:'x',confidence:.95,source:'model'}]})});
  const report=await review({root,provider,passes:['regression']});
  assert.equal(report.findings[0].location,undefined); assert.ok(report.findings[0].confidence<.95);
});

test('GitHub PR review uses same pipeline without shell execution', async () => {
  const root=await repoWithChange();
  const reader={getPullRequest:async()=>({number:9,title:'Fix',body:'body',headRef:'feature',baseRef:'main',fromFork:false,labels:[]}),getPullRequestDiff:async()=>('diff --git a/a.ts b/a.ts\n+two vulnerable')};
  const provider=new MockProvider({analyze:async()=>({findings:[]})});
  const report=await review({root,provider,github:{reader,owner:'o',repo:'r',prNumber:9},passes:['correctness']});
  assert.equal(report.repository.owner,'o'); assert.equal(report.repository.ref,'pr:9'); assert.equal(report.findings.length,0);
});

test('fork PR run-tests request is skipped and audited', async () => {
  const root=await repoWithChange(); const events=[];
  const reader={getPullRequest:async()=>({number:10,title:'Fork',body:'',headRef:'x',baseRef:'main',fromFork:true,labels:[]}),getPullRequestDiff:async()=>('diff')};
  const provider=new MockProvider({analyze:async()=>({findings:[]})});
  await review({root,provider,github:{reader,owner:'o',repo:'r',prNumber:10},passes:['security'],runTests:true,audit:{write:async e=>events.push(e)}});
  assert.ok(events.some(e=>JSON.stringify(e).includes('fork-pr-no-secret-bearing-execution')));
});

test('local review only runs deterministic checks on changed diff content', async()=>{
  const root=await mkdtemp(join(tmpdir(),'aunoforge-review-scope-'));
  git(root,'init'); git(root,'config','user.email','test@example.com'); git(root,'config','user.name','Test');
  await writeFile(join(root,'legacy.js'),'export const legacy = eval("1+1");\n');
  await writeFile(join(root,'safe.js'),'export const safe = 1;\n');
  git(root,'add','.'); git(root,'commit','-m','chore: baseline');
  await writeFile(join(root,'safe.js'),'export const safe = 2;\n');
  const report=await review({root,provider:new MockProvider()});
  assert.equal(report.findings.some((finding)=>finding.category==='javascript-eval'),false);
});

test('review accepts supplied diff content without reading git state', async()=>{
  const root=await mkdtemp(join(tmpdir(),'aunoforge-review-diff-'));
  const diff='diff --git a/src/danger.js b/src/danger.js\n--- a/src/danger.js\n+++ b/src/danger.js\n@@ -1,0 +1,1 @@\n+export const value = eval(input);\n';
  const report=await review({root,provider:new MockProvider(),diff});
  assert.equal(report.findings.some((finding)=>finding.category==='javascript-eval'),true);
});
