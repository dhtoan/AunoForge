import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../dist/index.js';

test('package.json inventory is deterministic, offline, and evidence-preserving', () => {
  assert.equal(typeof core.parsePackageJsonInventory, 'function');
  const parse = core.parsePackageJsonInventory;
  const source = JSON.stringify({
    dependencies: { zeta: '^2.0.0', alpha: '^1.0.0' },
    optionalDependencies: { optional: '~3.1.0' },
    peerDependencies: { peer: '>=4' },
    devDependencies: { dev: '5.0.0' },
  });

  assert.deepEqual(parse(source, 'packages/app/package.json'), [
    { ecosystem: 'npm', name: 'alpha', declaredVersion: '^1.0.0', relationship: 'direct', scope: 'runtime', sourcePath: 'packages/app/package.json' },
    { ecosystem: 'npm', name: 'zeta', declaredVersion: '^2.0.0', relationship: 'direct', scope: 'runtime', sourcePath: 'packages/app/package.json' },
    { ecosystem: 'npm', name: 'optional', declaredVersion: '~3.1.0', relationship: 'direct', scope: 'optional', sourcePath: 'packages/app/package.json' },
    { ecosystem: 'npm', name: 'peer', declaredVersion: '>=4', relationship: 'direct', scope: 'peer', sourcePath: 'packages/app/package.json' },
    { ecosystem: 'npm', name: 'dev', declaredVersion: '5.0.0', relationship: 'direct', scope: 'development', sourcePath: 'packages/app/package.json' },
  ]);
});

test('package.json inventory deduplicates dependency scopes with deterministic precedence', () => {
  assert.equal(typeof core.parsePackageJsonInventory, 'function');
  const parse = core.parsePackageJsonInventory;
  const source = JSON.stringify({
    dependencies: { shared: '^1.0.0' },
    optionalDependencies: { shared: '^2.0.0' },
    peerDependencies: { shared: '^3.0.0' },
    devDependencies: { shared: '^4.0.0' },
  });

  assert.deepEqual(parse(source), [
    { ecosystem: 'npm', name: 'shared', declaredVersion: '^1.0.0', relationship: 'direct', scope: 'runtime', sourcePath: 'package.json' },
  ]);
});

test('package.json inventory fails closed for malformed or ambiguous dependency metadata', () => {
  assert.equal(typeof core.parsePackageJsonInventory, 'function');
  const parse = core.parsePackageJsonInventory;

  assert.throws(() => parse('{not json'), /Invalid package\.json JSON/);
  assert.throws(() => parse('[]'), /package\.json must contain an object/);
  assert.throws(() => parse(JSON.stringify({ dependencies: ['alpha'] })), /dependencies must be an object/);
  assert.throws(() => parse(JSON.stringify({ dependencies: { alpha: 1 } })), /dependencies\.alpha must be a string/);
});

test('pnpm lock inventory uses importer evidence for direct dependencies and package keys for transitives', () => {
  assert.equal(typeof core.parsePnpmLockInventory, 'function');
  const parse = core.parsePnpmLockInventory;
  const source = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      alpha:
        specifier: ^1.0.0
        version: 1.2.3
      workspace-only:
        specifier: workspace:*
        version: link:packages/workspace-only
    devDependencies:
      '@scope/dev':
        specifier: ^2.0.0
        version: 2.1.0
packages:
  alpha@1.2.3: {}
  '@scope/dev@2.1.0': {}
  transitive@3.4.5: {}
`;

  assert.deepEqual(parse(source), [
    { ecosystem: 'npm', name: '@scope/dev', resolvedVersion: '2.1.0', relationship: 'direct', scope: 'development', sourcePath: 'pnpm-lock.yaml', importerPath: '.' },
    { ecosystem: 'npm', name: 'alpha', resolvedVersion: '1.2.3', relationship: 'direct', scope: 'runtime', sourcePath: 'pnpm-lock.yaml', importerPath: '.' },
    { ecosystem: 'npm', name: 'transitive', resolvedVersion: '3.4.5', relationship: 'transitive', sourcePath: 'pnpm-lock.yaml' },
  ]);
});

test('pnpm lock inventory is deterministic across importers and deduplicates resolved package identities', () => {
  assert.equal(typeof core.parsePnpmLockInventory, 'function');
  const parse = core.parsePnpmLockInventory;
  const source = `lockfileVersion: '9.0'
importers:
  packages/zeta:
    optionalDependencies:
      shared:
        specifier: ^4
        version: 4.2.0
  packages/alpha:
    dependencies:
      shared:
        specifier: ^4
        version: 4.2.0
packages:
  shared@4.2.0: {}
`;

  assert.deepEqual(parse(source, 'repo/pnpm-lock.yaml'), [
    { ecosystem: 'npm', name: 'shared', resolvedVersion: '4.2.0', relationship: 'direct', scope: 'runtime', sourcePath: 'repo/pnpm-lock.yaml', importerPath: 'packages/alpha' },
  ]);
});

test('pnpm lock inventory fails closed for unsupported or ambiguous evidence', () => {
  assert.equal(typeof core.parsePnpmLockInventory, 'function');
  const parse = core.parsePnpmLockInventory;

  assert.throws(() => parse(`lockfileVersion: '8.0'\nimporters: {}\npackages: {}\n`), /Unsupported pnpm lockfileVersion/);
  assert.throws(() => parse(`lockfileVersion: '9.0'\npackages: {}\n`), /pnpm lock importers are required/);
  assert.throws(() => parse(`lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      alpha:\n        specifier: ^1\npackages: {}\n`), /alpha version is required/);
});
