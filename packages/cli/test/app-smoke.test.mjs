import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { runCli } from '../dist/app.js';

async function capture(argv){
  const lines=[]; const originalLog=console.log; const originalError=console.error;
  console.log=(...args)=>lines.push(args.join(' ')); console.error=(...args)=>lines.push(args.join(' '));
  try{return {code:await runCli(argv),output:lines.join('\n')};}finally{console.log=originalLog;console.error=originalError;}
}

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();}
async function releaseRepo(){const root=await mkdtemp(join(tmpdir(),'aunoforge-cli-release-'));git(root,'init');git(root,'config','user.email','t@example.com');git(root,'config','user.name','T');await writeFile(join(root,'x'),'0');git(root,'add','.');git(root,'commit','-m','chore: initial');git(root,'tag','v0.1.0');await writeFile(join(root,'x'),'1');git(root,'add','.');git(root,'commit','-m','feat: deterministic release json');return root;}

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

test('review command emits SARIF 2.1.0 from the same deterministic report', async()=>{
  const root=await mkdtemp(join(tmpdir(),'aunoforge-cli-sarif-'));
  const result=await capture(['review','--root',root,'--diff',resolve('test/fixtures/sample.diff'),'--provider','mock','--format','sarif']);
  assert.equal(result.code,0);
  const sarif=JSON.parse(result.output);
  assert.equal(sarif.version,'2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name,'AunoForge');
  assert.equal(sarif.runs[0].results.some((entry)=>entry.ruleId==='javascript-eval'),true);
});

test('release --format json --dry-run emits deterministic dataset and performs zero repository writes', async()=>{const root=await releaseRepo();const beforeHead=git(root,'rev-parse','HEAD');const beforeStatus=git(root,'status','--porcelain');const beforeTags=git(root,'tag','--list');const result=await capture(['release','--root',root,'--from','v0.1.0','--format','json','--dry-run']);assert.equal(result.code,0);const report=JSON.parse(result.output);assert.equal(report.recommendedBump,'minor');assert.deepEqual(report.categories.Features.map(change=>change.title),['deterministic release json']);assert.equal('published' in report,false);assert.equal(git(root,'rev-parse','HEAD'),beforeHead);assert.equal(git(root,'status','--porcelain'),beforeStatus);assert.equal(git(root,'tag','--list'),beforeTags);});

test('release rejects unsupported formats clearly', async()=>{const root=await releaseRepo();await assert.rejects(()=>capture(['release','--root',root,'--from','v0.1.0','--format','sarif']),/--format must be terminal, markdown, or json/);});
