import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReader } from '../dist/index.js';

test('returns normalized pull request and diff', async () => {
  const reader=new GitHubReader({transport:async req=>{
    if(req.accept==='application/vnd.github.v3.diff') return 'diff --git a/a.js b/a.js';
    return {number:9,title:'Fix',body:'body',html_url:'url',head:{ref:'feature',repo:{fork:true}},base:{ref:'main'},user:{login:'dev'},labels:[{name:'bug'}]};
  }});
  const pr=await reader.getPullRequest({owner:'o',repo:'r',number:9});
  assert.equal(pr.fromFork,true); assert.equal(pr.headRef,'feature');
  assert.match(await reader.getPullRequestDiff({owner:'o',repo:'r',number:9}),/diff --git/);
});
