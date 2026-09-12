import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReader } from '../dist/index.js';

test('normalizes issue through a read-only client and keeps token out of request object', async () => {
  const capture=[];
  const reader=new GitHubReader({token:'secret-token',transport:async req=>{capture.push(req);return {number:5,title:'Bug',body:'broken',html_url:'https://github.com/o/r/issues/5',labels:[{name:'bug'}],user:{login:'u'}};}});
  const issue=await reader.getIssue({owner:'o',repo:'r',number:5});
  assert.equal(issue.number,5); assert.equal(issue.body,'broken'); assert.deepEqual(issue.labels,['bug']);
  assert.doesNotMatch(JSON.stringify(capture[0]),/secret-token/);
  assert.equal(reader.commentIssue, undefined);
});

test('normalizes duplicate search candidates', async () => {
  const reader=new GitHubReader({transport:async ()=>({items:[{number:7,title:'Same bug',html_url:'u'}]})});
  const items=await reader.findDuplicateCandidates({owner:'o',repo:'r',query:'player resize'});
  assert.deepEqual(items,[{number:7,title:'Same bug',url:'u'}]);
});
