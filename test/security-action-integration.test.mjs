import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('Action exposes security as a first-class command with explicit advisory opt-in', async () => {
  const manifest = await readFile(fileURLToPath(new URL('../action.yml', import.meta.url)), 'utf8');
  assert.match(manifest, /v0\.2 supports review or security\./);
  assert.match(manifest, /\n  advisory:\n/);
  assert.match(manifest, /OSV advisory enrichment/);
});

test('packaged Action runs security inventory fully offline without provider credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-security-'));
  try {
    await writeFile(join(root, 'package-lock.json'), JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { alpha: '^1.0.0' } },
        'node_modules/alpha': { version: '1.2.3' },
      },
    }));
    const outputPath = join(root, 'github-output.txt');
    const runtime = fileURLToPath(new URL('../dist/action/index.mjs', import.meta.url));
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
        GITHUB_TOKEN: '',
        INPUT_COMMAND: 'security',
        INPUT_PROVIDER: '',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'json',
        INPUT_ADVISORY: '',
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(await readFile(join(root, 'aunoforge-security.json'), 'utf8'));
    assert.equal(report.mode, 'offline');
    assert.deepEqual(report.sources[0].inventory.map((item) => [item.name, item.resolvedVersion]), [
      ['alpha', '1.2.3'],
    ]);
    const output = await readFile(outputPath, 'utf8');
    assert.match(output, /report-path=.*aunoforge-security\.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('maintained security Action docs keep the default workflow read-only and zero-key', async () => {
  const commandDocPath = fileURLToPath(new URL('../docs/commands/security.md', import.meta.url));
  const examplePath = fileURLToPath(new URL('../docs/examples/aunoforge-security.yml', import.meta.url));
  assert.equal(existsSync(commandDocPath), true, 'docs/commands/security.md must exist');
  assert.equal(existsSync(examplePath), true, 'docs/examples/aunoforge-security.yml must exist');

  const commandDoc = await readFile(commandDocPath, 'utf8');
  const example = await readFile(examplePath, 'utf8');
  assert.match(commandDoc, /offline by default/i);
  assert.match(commandDoc, /--advisory osv/);
  assert.match(example, /permissions:\n  contents: read/);
  assert.match(example, /command: security/);
  assert.match(example, /format: json/);
  assert.doesNotMatch(example, /GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|pull-requests: write/);
});
