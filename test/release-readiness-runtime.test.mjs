import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../scripts/release-readiness.mjs', import.meta.url));
const statusArgs = ['status', '--porcelain=v1', '--untracked-files=all'];

async function releaseFixture(t) {
  const temporary = await mkdtemp(join(tmpdir(), 'aunoforge-release-runtime-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, 'candidate with spaces');
  const env = { ...process.env };
  // Keep fixture Git commands isolated from the caller's repository and config.
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = join(temporary, 'gitconfig');
  env.GIT_TERMINAL_PROMPT = '0';
  await writeFile(env.GIT_CONFIG_GLOBAL, '');
  const files = {
    'action.yml': 'runs:\n  using: node24\nbranding:\n  icon: shield\n  color: blue\n',
    'README.md': 'uses: dhtoan/AunoForge@v0.1.0\n',
    'docs/examples/aunoforge-review.yml': 'uses: dhtoan/AunoForge@v0.1.0\n',
    'docs/releases/v0.2.0.md': '# AunoForge v0.2.0\nNode 24, Step Summary, SARIF, incremental evidence review.\n',
    'docs/releasing.md': 'Marketplace Developer Agreement\nPublish this Action to the GitHub Marketplace\nPublication is manual; do not claim publication before confirmation.\n',
    'dist/action/index.mjs': 'export const entry = true;\n',
    'dist/action/cli.mjs': 'export const cli = true;\n',
    'dist/action/chunk.mjs': 'export const chunk = true;\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  const git = (args) => execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: root, env, encoding: 'utf8', stdio: 'pipe',
  });
  git(['init', '--template=']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'core.fsmonitor', 'false']);
  git(['add', '.']);
  git(['-c', 'user.name=AunoForge Test', '-c', 'user.email=aunoforge@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'release fixture']);
  return { root, env, git };
}

function runCheck({ root, env }) {
  const result = spawnSync(process.execPath, [checker, '--stable-tag', 'v0.1.0', '--next-tag', 'v0.2.0'], {
    cwd: root, env, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

async function readOnlyCheck(fixture) {
  const indexPath = join(fixture.root, '.git', 'index');
  const indexBefore = await readFile(indexPath);
  const statusBefore = fixture.git(statusArgs);
  const result = runCheck(fixture);
  assert.deepEqual(await readFile(indexPath), indexBefore, 'validator must not rewrite the Git index');
  assert.equal(fixture.git(statusArgs), statusBefore, 'validator must not stage, discard, or commit changes');
  return result;
}

function assertRejected(result) {
  assert.equal(result.status, 1, `Dirty runtime must fail, got:\n${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /Generated dist\/action runtime differs from the checked-in tree/);
  assert.match(result.stderr, /run pnpm build:action and commit the result/);
  assert.doesNotMatch(result.stdout, /Release readiness: PASS/);
}

test('release readiness accepts a clean committed runtime without changing the Git index', async (t) => {
  const result = await readOnlyCheck(await releaseFixture(t));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release readiness: PASS/);
});

test('release runtime check ignores unrelated staged and untracked work', async (t) => {
  const fixture = await releaseFixture(t);
  await writeFile(join(fixture.root, 'README.md'), 'uses: dhtoan/AunoForge@v0.1.0\nLocal documentation edit.\n');
  fixture.git(['add', 'README.md']);
  await writeFile(join(fixture.root, 'unrelated.txt'), 'Untracked work outside the runtime.\n');
  const result = await readOnlyCheck(fixture);
  assert.equal(result.status, 0, result.stderr);
});

const dirtyRuntimeCases = [
  ['unstaged runtime edits', async ({ root }) => {
    await writeFile(join(root, 'dist/action/index.mjs'), 'export const changed = true;\n');
  }],
  ['staged runtime edits', async ({ root, git }) => {
    await writeFile(join(root, 'dist/action/index.mjs'), 'export const changed = true;\n');
    git(['add', 'dist/action/index.mjs']);
  }],
  ['staged runtime additions', async ({ root, git }) => {
    await writeFile(join(root, 'dist/action/extra.mjs'), 'export const extra = true;\n');
    git(['add', 'dist/action/extra.mjs']);
  }],
  ['staged runtime deletions', async ({ git }) => {
    git(['rm', 'dist/action/chunk.mjs']);
  }],
  ['untracked nested runtime files even when Git normally hides untracked files', async ({ root, git }) => {
    git(['config', 'status.showUntrackedFiles', 'no']);
    await mkdir(join(root, 'dist/action/new chunk'), { recursive: true });
    await writeFile(join(root, 'dist/action/new chunk/extra.mjs'), 'export const extra = true;\n');
  }],
];

for (const [name, makeDirty] of dirtyRuntimeCases) {
  test(`release readiness rejects ${name}`, async (t) => {
    const fixture = await releaseFixture(t);
    await makeDirty(fixture);
    assertRejected(await readOnlyCheck(fixture));
  });
}

test('release readiness fails closed when Git cannot establish runtime cleanliness', async (t) => {
  const fixture = await releaseFixture(t);
  await rm(join(fixture.root, '.git'), { recursive: true, force: true });
  assertRejected(runCheck(fixture));
});
