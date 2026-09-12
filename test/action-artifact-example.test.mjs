import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const exampleUrl = new URL('../docs/examples/aunoforge-review-v0.2.yml', import.meta.url);
const workflowUrl = new URL('../.github/workflows/aunoforge-review.yml', import.meta.url);
const gettingStartedUrl = new URL('../docs/getting-started.md', import.meta.url);
const reviewCommandUrl = new URL('../docs/commands/review.md', import.meta.url);

test('v0.2 workflow example keeps artifact upload optional and independent from PR comments', async () => {
  const source = await readFile(exampleUrl, 'utf8');
  assert.match(source, /id:\s+aunoforge/);
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
  assert.match(source, /steps\.aunoforge\.outputs\.report-path/);
  assert.match(source, /optional/i);
  assert.match(source, /format:\s+sarif/);
  assert.doesNotMatch(source, /checks:\s*write/i);
});

test('repository smoke workflow exercises SARIF with read-only permissions and one stable artifact', async () => {
  const source = await readFile(workflowUrl, 'utf8');
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /name:\s+aunoforge-report/);
  assert.match(source, /id:\s+aunoforge-sarif/);
  assert.match(source, /format:\s+sarif/);
  assert.match(source, /steps\.aunoforge-sarif\.outputs\.report-path/);
  assert.doesNotMatch(source, /:\s*write\b/i);
});

test('getting started documents SARIF and workflow annotations as least-privilege result surfaces', async () => {
  const source = await readFile(gettingStartedUrl, 'utf8');
  assert.match(source, /SARIF 2\.1\.0/);
  assert.match(source, /workflow annotations/i);
  assert.match(source, /do not require `checks: write`/i);
  assert.match(source, /does not automatically upload/i);
  assert.match(source, /code scanning/i);
});

test('incremental baseline docs define the offline local-file boundary and all four states', async () => {
  const gettingStarted = await readFile(gettingStartedUrl, 'utf8');
  const reviewCommand = await readFile(reviewCommandUrl, 'utf8');
  const combined = `${gettingStarted}\n${reviewCommand}`;

  assert.match(combined, /--baseline\s+(?:\.\/)?previous-aunoforge-review\.json/);
  assert.match(combined, /explicit local (?:file|path)/i);
  assert.match(combined, /fully offline|works offline|comparison.*offline/i);
  assert.match(combined, /does not (?:remotely )?store.*baseline/i);
  assert.match(combined, /does not .*auto-discover.*baseline/i);
  assert.match(combined, /\bnew\b/i);
  assert.match(combined, /\bpersistent\b/i);
  assert.match(combined, /\bresolved\b/i);
  assert.match(combined, /\bregressed\b/i);
  assert.match(combined, /severity increase/i);
  assert.match(combined, /previously resolved.*return/i);
  assert.match(combined, /artifact.*orchestrat.*outside AunoForge core|outside AunoForge core.*artifact/i);
});

test('v0.2 workflow example can opt into a local baseline without adding write permissions', async () => {
  const source = await readFile(exampleUrl, 'utf8');
  assert.match(source, /baseline:\s+\.aunoforge\/baseline\.json/);
  assert.match(source, /prior AunoForge JSON|previous AunoForge JSON|baseline/i);
  assert.match(source, /comment:\s*['"]false['"]/);
  assert.doesNotMatch(source, /:\s*write\b/i);
  assert.doesNotMatch(source, /checks:\s*write/i);
});
