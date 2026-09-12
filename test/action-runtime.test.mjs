import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dynamicEvalSource = ['ev', 'al(userInput);'].join('');

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
    const result = await runProcess(command, args, { cwd: root, env: process.env });
    assert.equal(result.code, 0, result.stderr);
  }

  await writeFile(join(root, 'src', 'example.js'), `${dynamicEvalSource}\n`);
}

async function createPullRequestServer(diff) {
  const requests = [];
  const expectedPath = '/repos/owner/repo/pulls/7';
  const server = createServer((request, response) => {
    const accept = String(request.headers.accept || '');
    requests.push({ method: request.method, url: request.url, accept });
    if (request.method !== 'GET' || request.url !== expectedPath) {
      response.statusCode = 405;
      response.end('unexpected request');
      return;
    }
    if (accept.includes('diff')) {
      response.statusCode = 200;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end(diff);
      return;
    }
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      number: 7,
      title: 'Fixture pull request',
      body: '',
      head: { ref: 'feature', repo: { fork: false } },
      base: { ref: 'main' },
      user: { login: 'fixture-user' },
      labels: [],
    }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    apiBase: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
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
      `+${dynamicEvalSource}`,
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
    await initializeGitFixture(root);
    const summaryPath = join(root, 'step-summary.md');
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
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: outputPath,
        INPUT_COMMAND: 'review',
        INPUT_PROVIDER: 'mock',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'markdown',
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const markdown = await readFile(join(root, 'aunoforge-review.md'), 'utf8');
    assert.match(markdown, /^# AunoForge Review/m);
    assert.match(markdown, /javascript-eval/);

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /^## AunoForge Review/m);
    assert.match(summary, /Provider \| `mock`/);
    assert.match(summary, /Mode \| `read-only`/);
    assert.match(summary, /Report \| `aunoforge-review\.md`/);
    assert.match(summary, /High [0-9]+ · Medium [0-9]+/);

    const output = await readFile(outputPath, 'utf8');
    assert.match(output, /report-path=.*aunoforge-review\.md/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('packaged action emits SARIF from the canonical review report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-sarif-'));
  try {
    await initializeGitFixture(root);
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
        INPUT_COMMAND: 'review',
        INPUT_PROVIDER: 'mock',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'sarif',
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const sarif = JSON.parse(await readFile(join(root, 'aunoforge-review.sarif'), 'utf8'));
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].tool.driver.name, 'AunoForge');
    const output = await readFile(outputPath, 'utf8');
    assert.match(output, /report-path=.*aunoforge-review\.sarif/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('packaged action fetches PR context read-only and annotates only changed verified lines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-annotations-'));
  const diff = [
    'diff --git a/src/example.js b/src/example.js',
    '--- a/src/example.js',
    '+++ b/src/example.js',
    '@@ -1 +1 @@',
    '-export const value = 1;',
    `+${dynamicEvalSource}`,
    '',
  ].join('\n');
  const server = await createPullRequestServer(diff);
  try {
    await initializeGitFixture(root);
    const eventPath = join(root, 'event.json');
    const summaryPath = join(root, 'step-summary.md');
    await writeFile(eventPath, JSON.stringify({ pull_request: { number: 7 } }));

    const runtime = fileURLToPath(new URL('../dist/action/index.mjs', import.meta.url));
    const result = await runNode([runtime], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_ACTION_PATH: '',
        GITHUB_WORKSPACE: root,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_API_URL: server.apiBase,
        GITHUB_TOKEN: 'test-token',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: '',
        INPUT_COMMAND: 'review',
        INPUT_PROVIDER: 'mock',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'markdown',
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /::error file=src\/example\.js,line=1,endLine=1,title=/);
    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /Annotations \| 1 emitted · 0 overflow/);
    assert.ok(server.requests.length >= 3);
    assert.equal(server.requests.every((request) => request.method === 'GET'), true);
    assert.equal(server.requests.every((request) => request.url === '/repos/owner/repo/pulls/7'), true);
    assert.equal(server.requests.filter((request) => request.accept.includes('diff')).length >= 2, true);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('packaged action remains compatible when GitHub Step Summary is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-no-summary-'));
  try {
    await initializeGitFixture(root);

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
        GITHUB_OUTPUT: '',
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
