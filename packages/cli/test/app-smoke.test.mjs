import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli } from '../dist/app.js';

async function capture(argv){
  const lines=[]; const originalLog=console.log; const originalError=console.error;
  console.log=(...args)=>lines.push(args.join(' ')); console.error=(...args)=>lines.push(args.join(' '));
  try{return {code:await runCli(argv),output:lines.join('\n')};}finally{console.log=originalLog;console.error=originalError;}
}

test('triage and reproduce can use a local issue fixture with mock provider', async()=>{
  const fixture=resolve('test/fixtures/github-issue.json');
  const triage=await capture(['triage','1','--owner','fixture','--repo','fixture','--fixture',fixture,'--provider','mock','--format','json']);
  assert.equal(triage.code,0); assert.equal(JSON.parse(triage.output).severity,'info');
  const reproduce=await capture(['reproduce','1','--owner','fixture','--repo','fixture','--fixture',fixture,'--provider','mock','--format','json']);
  assert.equal(reproduce.code,0); assert.ok(JSON.parse(reproduce.output).steps.length>0);
});

test('review command accepts a diff fixture and emits deterministic JSON finding', async()=>{
  const root=await mkdtemp(join(tmpdir(),'aunoforge-cli-diff-'));
  const result=await capture(['review','--root',root,'--diff',resolve('test/fixtures/sample.diff'),'--provider','mock','--format','json']);
  assert.equal(result.code,0);
  const report=JSON.parse(result.output);
  assert.equal(report.findings.some((finding)=>finding.category==='javascript-eval'),true);
});
