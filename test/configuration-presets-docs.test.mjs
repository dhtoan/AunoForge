import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('configuration documentation defines the safe versioned preset contract',async()=>{
  const docs=await readFile('docs/commands/config.md','utf8');
  assert.match(docs,/\.aunoforge\/config\.json/);
  assert.match(docs,/schemaVersion[^\n]*1/);
  assert.match(docs,/config validate/);
  for(const preset of ['recommended','minimal','strict','security','node','python','wordpress']) assert.match(docs,new RegExp(`\\b${preset}\\b`));
  assert.match(docs,/built-in presets? only/i);
  assert.match(docs,/CLI.*>.*project config.*>.*preset.*>.*default/i);
  assert.match(docs,/cannot.*(?:enable|grant).*write/i);
  assert.match(docs,/credentials?.*runtime|runtime.*credentials?/i);
});
