import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectConfig, resolveProjectConfig, builtinPresetIds } from '../dist/config.js';

const expectedPresets=['recommended','minimal','strict','security','node','python','wordpress'];

test('configuration schema requires schemaVersion 1 and exposes the seven approved built-in presets',()=>{
  assert.deepEqual([...builtinPresetIds],expectedPresets);
  assert.throws(()=>validateProjectConfig({}),/schemaVersion/);
  assert.throws(()=>validateProjectConfig({schemaVersion:2}),/schemaVersion must be 1/);
  assert.deepEqual(validateProjectConfig({schemaVersion:1}),{schemaVersion:1});
});

test('configuration extends built-in presets only and resolves deterministically',()=>{
  const config=validateProjectConfig({schemaVersion:1,extends:'wordpress',format:'json'});
  const first=resolveProjectConfig(config);
  const second=resolveProjectConfig(config);
  assert.deepEqual(first,second);
  assert.equal(first.preset,'wordpress');
  assert.equal(first.format,'json');
  assert.throws(()=>validateProjectConfig({schemaVersion:1,extends:'https://example.com/preset.json'}),/extends must be a built-in preset/);
});

test('configuration rejects unknown and security-sensitive write or credential keys',()=>{
  assert.throws(()=>validateProjectConfig({schemaVersion:1,unknownSetting:true}),/Unknown configuration key: unknownSetting/);
  assert.throws(()=>validateProjectConfig({schemaVersion:1,'allow-write':true}),/allow-write.*runtime/i);
  assert.throws(()=>validateProjectConfig({schemaVersion:1,allowWrite:true}),/allowWrite.*runtime/i);
  assert.throws(()=>validateProjectConfig({schemaVersion:1,token:'secret'}),/credential|token/i);
  assert.throws(()=>validateProjectConfig({schemaVersion:1,apiKey:'secret'}),/credential|apiKey/i);
});

test('explicit overrides beat project config, project config beats preset, and preset beats defaults',()=>{
  const config=validateProjectConfig({schemaVersion:1,extends:'minimal',format:'json'});
  const fromConfig=resolveProjectConfig(config);
  assert.equal(fromConfig.format,'json');
  const fromCli=resolveProjectConfig(config,{format:'terminal'});
  assert.equal(fromCli.format,'terminal');
  const presetOnly=resolveProjectConfig(validateProjectConfig({schemaVersion:1,extends:'minimal'}));
  assert.equal(presetOnly.format,'terminal');
  const defaults=resolveProjectConfig(validateProjectConfig({schemaVersion:1}));
  assert.equal(defaults.format,'terminal');
});

test('surface defaults are lowest precedence and do not override preset config or explicit format',()=>{
  const bare=validateProjectConfig({schemaVersion:1});
  assert.equal(resolveProjectConfig(bare,{}, {format:'markdown'}).format,'markdown');

  const preset=validateProjectConfig({schemaVersion:1,extends:'security'});
  assert.equal(resolveProjectConfig(preset,{}, {format:'markdown'}).format,'json');

  const configured=validateProjectConfig({schemaVersion:1,extends:'security',format:'terminal'});
  assert.equal(resolveProjectConfig(configured,{}, {format:'markdown'}).format,'terminal');
  assert.equal(resolveProjectConfig(configured,{format:'json'},{format:'markdown'}).format,'json');
});
