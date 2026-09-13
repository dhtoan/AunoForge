import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const runtime = fileURLToPath(new URL('../scripts/action.mjs', import.meta.url));
const dynamicEvalSource = ['ev', 'al(userInput);'].join('');

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

async function initializeGitFixture(root) {
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'example.js'), 'export const value = 1;\n');

  for (const [command, args] of [
    ['git', ['init']],
    ['git', ['config', 'user.email', 'aunoforge@example.invalid']],
    ['git', ['config', 'user.name', 'AunoForge Test']],
    ['git', ['add', '.']],
    ['git', ['commit', '-m', 'baseline']],
  ]) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr);
  }

  await writeFile(join(root, 'src', 'example.js'), `${dynamicEvalSource}\n`);
}

async function writeConfig(root, config) {
  await mkdir(join(root, '.aunoforge'), { recursive: true });
  await writeFile(join(root, '.aunoforge', 'config.json'), `${JSON.stringify(config)}\n`, 'utf8');
}

async function runAction(root, { command = 'review', format = '', config } = {}) {
  if (config) await writeConfig(root, config);
  const outputPath = join(root, 'github-output.txt');
  const result = await runNode([runtime], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_ACTION_PATH: '',
      GITHUB_WORKSPACE: root,
      GITHUB_EVENT_PATH: '',
      GITHUB_REPOSITORY: '',
      GITHUB_STEP_SUMMARY: '',
      GITHUB_OUTPUT: outputPath,
      INPUT_COMMAND: command,
      INPUT_PROVIDER: 'mock',
      INPUT_MODEL: '',
      INPUT_FORMAT: format,
      INPUT_ADVISORY: '',
      INPUT_BASELINE: '',
      INPUT_COMMENT: 'false',
      INPUT_ALLOW_WRITE: 'false',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
  });
  let output = '';
  try { output = await readFile(outputPath, 'utf8'); } catch {}
  return { ...result, output };
}

async function withFixture(prefix, fn) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  try {
    await initializeGitFixture(root);
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('Action review inherits project JSON when format input is omitted', async () => {
  await withFixture('aunoforge-action-config-review-', async (root) => {
    const result = await runAction(root, { config: { schemaVersion: 1, format: 'json' } });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-review\.json/);
    JSON.parse(await readFile(join(root, 'aunoforge-review.json'), 'utf8'));
  });
});

test('Action explicit Markdown beats project JSON', async () => {
  await withFixture('aunoforge-action-explicit-review-', async (root) => {
    const result = await runAction(root, { format: 'markdown', config: { schemaVersion: 1, format: 'json' } });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-review\.md/);
  });
});

test('Action review without config or input keeps Markdown default', async () => {
  await withFixture('aunoforge-action-default-review-', async (root) => {
    const result = await runAction(root);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-review\.md/);
  });
});

test('Action security without config or input keeps terminal default', async () => {
  await withFixture('aunoforge-action-default-security-', async (root) => {
    const result = await runAction(root, { command: 'security' });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-security\.txt/);
  });
});

test('Action security inherits project JSON when format input is omitted', async () => {
  await withFixture('aunoforge-action-config-security-', async (root) => {
    const result = await runAction(root, { command: 'security', config: { schemaVersion: 1, format: 'json' } });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-security\.json/);
    JSON.parse(await readFile(join(root, 'aunoforge-security.json'), 'utf8'));
  });
});

test('Action security rejects configured Markdown when no supported input overrides it', async () => {
  await withFixture('aunoforge-action-invalid-security-', async (root) => {
    const result = await runAction(root, { command: 'security', config: { schemaVersion: 1, format: 'markdown' } });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /command=security supports format=terminal or format=json\./);
  });
});

test('Action explicit security JSON overrides incompatible configured Markdown', async () => {
  await withFixture('aunoforge-action-explicit-security-', async (root) => {
    const result = await runAction(root, { command: 'security', format: 'json', config: { schemaVersion: 1, format: 'markdown' } });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-security\.json/);
  });
});

test('Action explicit review SARIF remains highest priority over project config', async () => {
  await withFixture('aunoforge-action-explicit-sarif-', async (root) => {
    const result = await runAction(root, { format: 'sarif', config: { schemaVersion: 1, format: 'json' } });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.output, /report-path=.*aunoforge-review\.sarif/);
  });
});
