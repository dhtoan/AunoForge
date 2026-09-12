import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReader } from '../dist/index.js';

test('filters merged pull requests since a timestamp and keeps explicit breaking markers', async () => {
  const reader=new GitHubReader({transport:async ()=>[
    {number:1,title:'feat: old',body:'',html_url:'u1',merged_at:'2026-01-01T00:00:00Z',labels:[],user:{login:'a'}},
    {number:2,title:'feat!: new API',body:'BREAKING CHANGE: api',html_url:'u2',merged_at:'2026-09-01T00:00:00Z',labels:[{name:'breaking-change'}],user:{login:'b'}}
  ]});
  const prs=await reader.listMergedPullRequestsSince({owner:'o',repo:'r'},'2026-08-01T00:00:00Z');
  assert.equal(prs.length,1); assert.equal(prs[0].breaking,true); assert.equal(prs[0].author,'b');
});
