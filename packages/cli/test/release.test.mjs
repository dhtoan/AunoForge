import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateReleaseNotes } from '../dist/release.js';
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();}
async function repo(){const root=await mkdtemp(join(tmpdir(),'aunoforge-release-'));git(root,'init');git(root,'config','user.email','t@example.com');git(root,'config','user.name','T');await writeFile(join(root,'x'),'0');git(root,'add','.');git(root,'commit','-m','chore: initial');git(root,'tag','v0.1.0');for(const [n,msg] of [[1,'fix: prevent player resize'],[2,'feat: add django recipe'],[3,'security: harden redirect validation']]){await writeFile(join(root,'x'),String(n));git(root,'add','.');git(root,'commit','-m',msg);}return root;}

test('release notes classify conventional commits deterministically', async()=>{const root=await repo();const result=await generateReleaseNotes({root,from:'v0.1.0'});assert.match(result.markdown,/### Fixed[\s\S]*prevent player resize/);assert.match(result.markdown,/### Added[\s\S]*add django recipe/);assert.match(result.markdown,/### Security[\s\S]*harden redirect/);assert.match(result.markdown,/Compatibility/);});

test('release notes optionally include merged PR and contributor metadata', async()=>{const root=await repo();const reader={listMergedPullRequestsSince:async()=>[{number:8,title:'feat: contributor recipe',body:'',url:'u',labels:['recipe'],mergedAt:'2026-09-01T00:00:00Z',author:'alice',breaking:false}]};const result=await generateReleaseNotes({root,from:'v0.1.0',github:{reader,owner:'o',repo:'r',since:'2026-08-01T00:00:00Z'}});assert.match(result.markdown,/#8/);assert.match(result.markdown,/@alice/);});
