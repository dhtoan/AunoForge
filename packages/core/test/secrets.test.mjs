import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '../dist/secrets.js';

test('redacts known provider GitHub and private key credentials', () => {
  const input = [
    `OPENAI_API_KEY=${['sk','proj','abcdefghijklmnopqrstuvwxyz'].join('-')}`,
    `ANTHROPIC_API_KEY=${['sk','ant','abcdefghijklmnopqrstuvwxyz'].join('-')}`,
    `GITHUB_TOKEN=${['ghp','123456789012345678901234567890123456'].join('_')}`,
    ['-----BEGIN','PRIVATE KEY-----\nabc\n-----END','PRIVATE KEY-----'].join(' ')
  ].join('\n');
  const output = redactSecrets(input);
  assert.doesNotMatch(output, /sk-proj-/);
  assert.doesNotMatch(output, /sk-ant-/);
  assert.doesNotMatch(output, /ghp_/);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY/);
  assert.match(output, /REDACTED/);
});
