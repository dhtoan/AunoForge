import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const marker = '<!-- aunoforge:review-comment -->';
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

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

async function createGitHubServer({ existingMarkedComment = true, commentListStatus = 200 } = {}) {
  const requests = [];
  const comments = [
    { id: 41, body: 'Human-maintained note', user: { login: 'maintainer' } },
    ...(existingMarkedComment ? [{ id: 77, body: `${marker}\nOld AunoForge report`, user: { login: 'github-actions[bot]' } }] : []),
  ];
  const diff = [
    'diff --git a/src/example.js b/src/example.js',
    '--- a/src/example.js',
    '+++ b/src/example.js',
    '@@ -1 +1 @@',
    '-export const value = 1;',
    `+${dynamicEvalSource}`,
    '',
  ].join('\n');

  const server = createServer(async (request, response) => {
    const accept = String(request.headers.accept || '');
    const url = request.url || '';
    requests.push({ method: request.method, url, body: undefined });
    const recorded = requests.at(-1);

    if (request.method === 'GET' && url === '/repos/owner/repo/pulls/7') {
      response.statusCode = 200;
      if (accept.includes('diff')) {
        response.setHeader('content-type', 'text/plain; charset=utf-8');
        response.end(diff);
      } else {
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
      }
      return;
    }

    if (request.method === 'GET' && url === '/repos/owner/repo/issues/7/comments?per_page=100') {
      response.statusCode = commentListStatus;
      response.setHeader('content-type', 'application/json');
      response.end(commentListStatus === 200 ? JSON.stringify(comments) : JSON.stringify({ message: 'forbidden' }));
      return;
    }

    if (request.method === 'PATCH' && url === '/repos/owner/repo/issues/comments/77') {
      recorded.body = await readJsonBody(request);
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ id: 77, body: recorded.body.body }));
      return;
    }

    if (request.method === 'POST' && url === '/repos/owner/repo/issues/7/comments') {
      recorded.body = await readJsonBody(request);
      response.statusCode = 201;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ id: 88, body: recorded.body.body }));
      return;
    }

    response.statusCode = 405;
    response.end('unexpected request');
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

async function runAction(server, {
  comment = 'true',
  allowWrite = 'true',
  token = 'test-token',
  event = { pull_request: { number: 7 } },
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-sticky-comment-'));
  try {
    await initializeGitFixture(root);
    const eventPath = join(root, 'event.json');
    await writeFile(eventPath, JSON.stringify(event));
    const runtime = fileURLToPath(new URL('../dist/action/index.mjs', import.meta.url));
    return await runProcess(process.execPath, [runtime], {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_ACTION_PATH: '',
        GITHUB_WORKSPACE: root,
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_API_URL: server.apiBase,
        GITHUB_TOKEN: token,
        GITHUB_STEP_SUMMARY: '',
        GITHUB_OUTPUT: '',
        INPUT_COMMAND: 'review',
        INPUT_PROVIDER: 'mock',
        INPUT_MODEL: '',
        INPUT_FORMAT: 'markdown',
        INPUT_COMMENT: comment,
        INPUT_ALLOW_WRITE: allowWrite,
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('comment mode updates only the existing AunoForge-owned marked comment', async () => {
  const server = await createGitHubServer({ existingMarkedComment: true });
  try {
    const result = await runAction(server);
    assert.equal(result.code, 0, result.stderr);
    const commentReads = server.requests.filter((request) => request.method === 'GET' && request.url.includes('/issues/7/comments'));
    const updates = server.requests.filter((request) => request.method === 'PATCH');
    const creates = server.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/issues/7/comments'));
    assert.equal(commentReads.length, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].url, '/repos/owner/repo/issues/comments/77');
    assert.equal(creates.length, 0);
    assert.match(updates[0].body.body, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(server.requests.some((request) => request.url === '/repos/owner/repo/issues/comments/41'), false);
  } finally {
    await server.close();
  }
});

test('comment mode creates one marked AunoForge comment when none exists', async () => {
  const server = await createGitHubServer({ existingMarkedComment: false });
  try {
    const result = await runAction(server);
    assert.equal(result.code, 0, result.stderr);
    const updates = server.requests.filter((request) => request.method === 'PATCH');
    const creates = server.requests.filter((request) => request.method === 'POST' && request.url.endsWith('/issues/7/comments'));
    assert.equal(updates.length, 0);
    assert.equal(creates.length, 1);
    assert.match(creates[0].body.body, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await server.close();
  }
});

test('comment mode refuses to write unless allow-write is explicitly enabled', async () => {
  const server = await createGitHubServer();
  try {
    const result = await runAction(server, { allowWrite: 'false' });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /comment=true requires allow-write=true/);
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});

test('comment mode requires a token before reading or writing PR comments', async () => {
  const server = await createGitHubServer();
  try {
    const result = await runAction(server, { token: '' });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /PR comment mode requires GITHUB_TOKEN/);
    assert.equal(server.requests.some((request) => request.url.includes('/issues/7/comments')), false);
    assert.equal(server.requests.some((request) => request.method === 'POST' || request.method === 'PATCH'), false);
  } finally {
    await server.close();
  }
});

test('insufficient GitHub comment permission fails clearly without attempting a create or update', async () => {
  const server = await createGitHubServer({ commentListStatus: 403 });
  try {
    const result = await runAction(server);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /GitHub comment list API returned 403/);
    assert.equal(server.requests.some((request) => request.method === 'POST' || request.method === 'PATCH'), false);
  } finally {
    await server.close();
  }
});

test('fork PR review remains read-only when comment mode is disabled', async () => {
  const server = await createGitHubServer();
  try {
    const result = await runAction(server, {
      comment: 'false',
      allowWrite: 'false',
      token: '',
      event: { pull_request: { number: 7, head: { repo: { fork: true } } } },
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(server.requests.some((request) => request.url.includes('/issues/7/comments')), false);
    assert.equal(server.requests.every((request) => request.method === 'GET'), true);
  } finally {
    await server.close();
  }
});
