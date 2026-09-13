import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runCli } from '../dist/app.js';

async function capture(argv) {
  const lines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  try {
    return { code: await runCli(argv), output: lines.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('security command discovers supported dependency evidence recursively and emits deterministic offline JSON', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-security-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({
    dependencies: { rootdep: '^1.0.0' },
  }));

  const appRoot = join(root, 'packages', 'app');
  await mkdir(appRoot, { recursive: true });
  await writeFile(join(appRoot, 'package-lock.json'), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { alpha: '^1.0.0' } },
      'node_modules/alpha': { version: '1.2.3' },
      'node_modules/transitive': { version: '2.0.0' },
    },
  }));

  const result = await capture(['security', '--root', root, '--format', 'json']);
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.output), {
    schemaVersion: '1',
    mode: 'offline',
    sources: [
      {
        path: 'package.json',
        format: 'package-json',
        status: 'supported',
        inventory: [
          {
            ecosystem: 'npm',
            name: 'rootdep',
            declaredVersion: '^1.0.0',
            relationship: 'direct',
            scope: 'runtime',
            sourcePath: 'package.json',
          },
        ],
      },
      {
        path: 'packages/app/package-lock.json',
        format: 'package-lock',
        status: 'supported',
        inventory: [
          {
            ecosystem: 'npm',
            name: 'alpha',
            resolvedVersion: '1.2.3',
            relationship: 'direct',
            scope: 'runtime',
            sourcePath: 'packages/app/package-lock.json',
            packagePath: 'node_modules/alpha',
          },
          {
            ecosystem: 'npm',
            name: 'transitive',
            resolvedVersion: '2.0.0',
            relationship: 'transitive',
            sourcePath: 'packages/app/package-lock.json',
            packagePath: 'node_modules/transitive',
          },
        ],
      },
    ],
  });
});

test('security command reports unsupported dependency evidence explicitly instead of guessing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-security-unsupported-'));
  await writeFile(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '8.0'\nimporters: {}\n");

  const result = await capture(['security', '--root', root, '--format', 'json']);
  assert.equal(result.code, 0);
  const report = JSON.parse(result.output);
  assert.deepEqual(report.sources, [
    {
      path: 'pnpm-lock.yaml',
      format: 'pnpm-lock',
      status: 'unsupported',
      error: 'Unsupported pnpm lockfileVersion; expected 9.0',
    },
  ]);
});

test('security command renders a concise terminal inventory by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-security-terminal-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({
    devDependencies: { tooling: '~3.0.0' },
  }));

  const result = await capture(['security', '--root', root]);
  assert.equal(result.code, 0);
  assert.match(result.output, /AunoForge security \(offline\)/);
  assert.match(result.output, /package\.json/);
  assert.match(result.output, /tooling/);
  assert.match(result.output, /~3\.0\.0/);
  assert.match(result.output, /direct/);
  assert.match(result.output, /development/);
});

test('security command enriches only resolved lockfile versions when OSV is explicitly enabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aunoforge-security-osv-'));
  await writeFile(join(root, 'package.json'), JSON.stringify({
    dependencies: { manifestOnly: '^9.0.0' },
  }));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { zeta: '^2.0.0', alpha: '^1.0.0' } },
      'node_modules/zeta': { version: '2.0.0' },
      'node_modules/alpha': { version: '1.2.3' },
    },
  }));

  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      results: [
        {
          vulns: [
            {
              id: 'GHSA-ALPHA-1',
              database_specific: { severity: 'HIGH' },
              affected: [{ ranges: [{ events: [{ introduced: '0' }, { fixed: '1.2.4' }] }] }],
            },
          ],
        },
        {},
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await capture(['security', '--root', root, '--format', 'json', '--advisory', 'osv']);
    assert.equal(result.code, 0);
    assert.deepEqual(requests, [
      {
        url: 'https://api.osv.dev/v1/querybatch',
        body: {
          queries: [
            { package: { ecosystem: 'npm', name: 'alpha' }, version: '1.2.3' },
            { package: { ecosystem: 'npm', name: 'zeta' }, version: '2.0.0' },
          ],
        },
      },
    ]);

    const report = JSON.parse(result.output);
    assert.equal(report.mode, 'advisory');
    assert.deepEqual(report.advisories, [
      {
        package: { ecosystem: 'npm', name: 'alpha', version: '1.2.3' },
        advisories: [
          {
            id: 'GHSA-ALPHA-1',
            severity: 'high',
            fixedVersions: ['1.2.4'],
            provenance: 'osv',
            confidence: 1,
          },
        ],
      },
      {
        package: { ecosystem: 'npm', name: 'zeta', version: '2.0.0' },
        advisories: [],
      },
    ]);
    assert.equal(report.sources[0].inventory[0].declaredVersion, '^9.0.0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
