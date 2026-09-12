import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('packaged cli runs a zero-key deterministic mock review', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-runtime-'));
  try {
    const diffPath = join(root, 'change.diff');
    await writeFile(diffPath, [
      'diff --git a/src/example.js b/src/example.js',
      '--- a/src/example.js',
      '+++ b/src/example.js',
      '@@ -0,0 +1 @@',
      '+eval(userInput);',
      '',
    ].join('\n'));

    const runtime = fileURLToPath(new URL('../dist/action/cli.mjs', import.meta.url));
    const result = await runNode([
      runtime,
      'review',
      '--root', root,
      '--provider', 'mock',
      '--format', 'json',
      '--diff', diffPath,
    ], {
      cwd: root,
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(report.findings.some((finding) => finding.category === 'javascript-eval'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
