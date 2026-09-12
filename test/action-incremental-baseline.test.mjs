import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dynamicEvalSource = ['ev', 'al(userInput);'].join('');

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
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

test('packaged action compares an explicit baseline and suppresses annotations for persistent findings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-action-baseline-'));
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
    const baselinePath = join(root, 'baseline.json');
    const summaryPath = join(root, 'step-summary.md');
    await writeFile(eventPath, JSON.stringify({ pull_request: { number: 7 } }));

    const cliRuntime = fileURLToPath(new URL('../dist/action/cli.mjs', import.meta.url));
    const baselineRun = await runNode([
      cliRuntime,
      'review',
      '--root', root,
      '--provider', 'mock',
      '--format', 'json',
      '--pr', '7',
      '--owner', 'owner',
      '--repo', 'repo',
    ], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_API_URL: server.apiBase,
        GITHUB_TOKEN: 'test-token',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });
    assert.equal(baselineRun.code, 0, baselineRun.stderr);
    const baseline = JSON.parse(baselineRun.stdout);
    assert.ok(baseline.findings.some((finding) => finding.category === 'javascript-eval'));
    await writeFile(baselinePath, baselineRun.stdout, 'utf8');

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
        INPUT_FORMAT: 'json',
        INPUT_BASELINE: baselinePath,
        INPUT_COMMENT: 'false',
        INPUT_ALLOW_WRITE: 'false',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const incremental = JSON.parse(await readFile(join(root, 'aunoforge-review.json'), 'utf8'));
    assert.equal(incremental.kind, 'incremental-review');
    assert.equal(incremental.summary.new, 0);
    assert.equal(incremental.summary.regressed, 0);
    assert.ok(incremental.summary.persistent >= 1);
    assert.doesNotMatch(result.stdout, /::(?:error|warning|notice) /);

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /Incremental \| New 0 · Regressed 0 · Persistent [1-9][0-9]* · Resolved 0/);
    assert.match(summary, /Annotations \| 0 emitted · 0 overflow/);
    assert.equal(server.requests.every((request) => request.method === 'GET'), true);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
