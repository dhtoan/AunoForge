import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const actionSourceUrl = new URL('../action.yml', import.meta.url);

function isQuotedScalar(value) {
  return (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'));
}

test('action manifest quotes description scalars that contain mapping colons', async () => {
  const source = await readFile(actionSourceUrl, 'utf8');
  const violations = source
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /^\s*description:\s+/.test(line))
    .map(({ line, number }) => ({
      number,
      value: line.replace(/^\s*description:\s+/, ''),
    }))
    .filter(({ value }) => value.includes(': ') && !isQuotedScalar(value));

  assert.deepEqual(violations, []);
});

test('action runs from a checked-in Node 24 runtime without consumer installs or builds', async () => {
  const source = await readFile(actionSourceUrl, 'utf8');

  assert.match(source, /runs:\s*\n\s+using:\s+node24\b/);
  assert.match(source, /\n\s+main:\s+dist\/action\/index\.mjs\b/);
  assert.doesNotMatch(source, /pnpm install/);
  assert.doesNotMatch(source, /pnpm build/);
  assert.doesNotMatch(source, /corepack prepare/);
  assert.doesNotMatch(source, /using:\s+composite/);
});

test('Action exposes SARIF without adding a write-capable permission or token input', async () => {
  const source = await readFile(actionSourceUrl, 'utf8');

  assert.match(source, /Report format: markdown, json, terminal, or sarif\./);
  assert.doesNotMatch(source, /checks:\s*write/i);
  assert.doesNotMatch(source, /^\s{2}(?:github-)?token:\s*$/mi);
  assert.doesNotMatch(source, /^\s{2}annotations?:\s*$/mi);
});

test('Action exposes an explicit local baseline path without adding GitHub write capability', async () => {
  const source = await readFile(actionSourceUrl, 'utf8');

  assert.match(source, /^\s{2}baseline:\s*$/m);
  assert.match(source, /Optional path to a prior AunoForge JSON report for incremental comparison\./);
  assert.match(source, /baseline:\s*\n\s+description:[^\n]+\n\s+required:\s+false\n\s+default:\s+''/m);
  assert.doesNotMatch(source, /checks:\s*write/i);
  assert.doesNotMatch(source, /^\s{2}(?:github-)?token:\s*$/mi);
});

test('packaged action bundle targets Node 24', async () => {
  const source = await readFile(new URL('../scripts/build-action.mjs', import.meta.url), 'utf8');

  assert.match(source, /target:\s*['"]node24['"]/);
  assert.doesNotMatch(source, /target:\s*['"]node20['"]/);
});

test('packaged action runtime is committed', () => {
  assert.equal(existsSync(new URL('../dist/action/index.mjs', import.meta.url)), true);
  assert.equal(existsSync(new URL('../dist/action/cli.mjs', import.meta.url)), true);
});
