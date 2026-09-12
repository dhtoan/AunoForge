import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

function runNode(args, options = {}) {
  return runProcess(process.execPath, args, options);
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

test('packaged action resolves its sibling cli when GITHUB_ACTION_PATH is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-entry-'));
  try {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'example.js'), 'export const value = 1;\n');

    for (const [command, args] of [
      ['git', ['init']],
      ['git', ['config', 'user.email', 'aunoforge@example.invalid']],
      ['git', ['config', 'user.name', 'AunoForge Test']],
      ['git', ['add', '.']],
      ['git', ['commit', '-m', 'baseline']],
    ]) {
      const result = await runProcess(command, args, { cwd: root, env: process.env });
      assert.equal(result.code, 0, result.stderr);
    }

    await writeFile(join(root, 'src', 'example.js'), 'eval(userInput);\n');

    const runtime = fileURLToPath(new URL('../dist/action/index.mjs', import.meta.url));
    const result = await runNode([runtime], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_ACTION_PATH: '',
        GITHUB_WORKSPACE: root,
        GITHUB_EVENT_PATH: '',
        GITHUB_REPOSITORY: '',
        INPUT_COMMAND: 'review',
        INPUT_PROVIDER: 'mock',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'json',
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(await readFile(join(root, 'aunoforge-review.json'), 'utf8'));
    assert.ok(report.findings.some((finding) => finding.category === 'javascript-eval'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
