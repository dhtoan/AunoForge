import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('release command documentation defines deterministic read-only intelligence', async()=>{
  const docs=await readFile('docs/commands/release.md','utf8');
  assert.match(docs,/--dry-run/);
  assert.match(docs,/--format json/);
  for(const category of ['Breaking','Features','Fixes','Security','Maintenance']) assert.match(docs,new RegExp(category));
  assert.match(docs,/major/);
  assert.match(docs,/minor/);
  assert.match(docs,/patch/);
  assert.match(docs,/does not (?:create|publish) a GitHub release/i);
  assert.match(docs,/does not (?:publish|modify).*package/i);
});
