import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('Action metadata includes Marketplace branding and a deterministic release check', async () => {
  const action = await readFile('action.yml', 'utf8');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));

  assert.match(action, /branding:\s*\n\s+icon:\s+['"]?shield['"]?\s*\n\s+color:\s+['"]?blue['"]?/m);
  assert.equal(
    pkg.scripts?.['release:check'],
    'pnpm build:action && node scripts/release-readiness.mjs --stable-tag v0.1.0 --next-tag v0.2.0',
  );
});

test('release readiness validator accepts the prepared v0.2 candidate metadata', async () => {
  const result = await runNode([
    'scripts/release-readiness.mjs',
    '--stable-tag', 'v0.1.0',
    '--next-tag', 'v0.2.0',
  ]);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Release readiness: PASS/);
  assert.match(result.stdout, /v0\.2\.0/);
});

test('release guide keeps Marketplace publication as an explicit human UI step', async () => {
  const guide = await readFile('docs/releasing.md', 'utf8');
  const notes = await readFile('docs/releases/v0.2.0.md', 'utf8');

  assert.match(guide, /Marketplace Developer Agreement/i);
  assert.match(guide, /Publish this Action to the GitHub Marketplace/i);
  assert.match(guide, /manual/i);
  assert.match(guide, /do not claim/i);
  assert.match(notes, /^# AunoForge v0\.2\.0/m);
  assert.match(notes, /Node 24/i);
  assert.match(notes, /Step Summary/i);
  assert.match(notes, /SARIF/i);
  assert.match(notes, /incremental/i);
  assert.doesNotMatch(notes, /\bTBD\b|\bTODO\b|placeholder/i);
});
