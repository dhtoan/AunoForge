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
  assert.match(docs,/CLI.*action input.*>.*project config.*>.*preset.*>.*(?:surface|built-in) default/i);
  assert.match(docs,/CLI review[^\n]*terminal/i);
  assert.match(docs,/CLI release[^\n]*markdown/i);
  assert.match(docs,/CLI security[^\n]*terminal/i);
  assert.match(docs,/Action review[^\n]*markdown/i);
  assert.match(docs,/Action security[^\n]*terminal/i);
  assert.match(docs,/SARIF[^\n]*(?:explicit|override)|(?:explicit|override)[^\n]*SARIF/i);
  assert.match(docs,/security[^\n]*markdown[^\n]*(?:invalid|unsupported|reject|fail)/i);
  assert.match(docs,/explicit[^\n]*(?:terminal|json)[^\n]*security[^\n]*(?:override|wins)|security[^\n]*explicit[^\n]*(?:terminal|json)[^\n]*(?:override|wins)/i);
  assert.match(docs,/cannot.*(?:enable|grant).*write/i);
  assert.match(docs,/credentials?.*runtime|runtime.*credentials?/i);
});

test('getting started references the versioned JSON project config path',async()=>{
  const docs=await readFile('docs/getting-started.md','utf8');
  assert.match(docs,/\.aunoforge\/config\.json/);
  assert.doesNotMatch(docs,/\.aunoforge\/config\.yml/);
});
