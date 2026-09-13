import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../dist/index.js';

test('package-lock inventory emits deterministic resolved direct and transitive evidence', () => {
  assert.equal(typeof core.parsePackageLockInventory, 'function');
  const parse = core.parsePackageLockInventory;
  const source = JSON.stringify({
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      'node_modules/zeta': { version: '9.0.0' },
      'node_modules/dev': { version: '2.1.0' },
      'node_modules/alpha/node_modules/leaf': { version: '4.5.6' },
      'node_modules/alpha': { version: '1.2.3' },
      'node_modules/@scope/direct': { version: '3.4.5' },
      '': {
        dependencies: { alpha: '^1.0.0', '@scope/direct': '^3.0.0' },
        devDependencies: { dev: '^2.0.0' },
      },
    },
  });

  assert.deepEqual(parse(source, 'fixtures/package-lock.json'), [
    { ecosystem: 'npm', name: '@scope/direct', resolvedVersion: '3.4.5', relationship: 'direct', scope: 'runtime', sourcePath: 'fixtures/package-lock.json', packagePath: 'node_modules/@scope/direct' },
    { ecosystem: 'npm', name: 'alpha', resolvedVersion: '1.2.3', relationship: 'direct', scope: 'runtime', sourcePath: 'fixtures/package-lock.json', packagePath: 'node_modules/alpha' },
    { ecosystem: 'npm', name: 'leaf', resolvedVersion: '4.5.6', relationship: 'transitive', sourcePath: 'fixtures/package-lock.json', packagePath: 'node_modules/alpha/node_modules/leaf' },
    { ecosystem: 'npm', name: 'dev', resolvedVersion: '2.1.0', relationship: 'direct', scope: 'development', sourcePath: 'fixtures/package-lock.json', packagePath: 'node_modules/dev' },
    { ecosystem: 'npm', name: 'zeta', resolvedVersion: '9.0.0', relationship: 'transitive', sourcePath: 'fixtures/package-lock.json', packagePath: 'node_modules/zeta' },
  ]);
});

test('package-lock v2 classifies only the top-level root declaration as direct', () => {
  assert.equal(typeof core.parsePackageLockInventory, 'function');
  const parse = core.parsePackageLockInventory;
  const source = JSON.stringify({
    lockfileVersion: 2,
    packages: {
      '': { dependencies: { shared: '^1.0.0' } },
      'node_modules/shared': { version: '1.5.0' },
      'node_modules/parent/node_modules/shared': { version: '2.0.0' },
    },
  });

  assert.deepEqual(parse(source), [
    { ecosystem: 'npm', name: 'shared', resolvedVersion: '2.0.0', relationship: 'transitive', sourcePath: 'package-lock.json', packagePath: 'node_modules/parent/node_modules/shared' },
    { ecosystem: 'npm', name: 'shared', resolvedVersion: '1.5.0', relationship: 'direct', scope: 'runtime', sourcePath: 'package-lock.json', packagePath: 'node_modules/shared' },
  ]);
});

test('package-lock inventory fails closed for unsupported or ambiguous lockfile metadata', () => {
  assert.equal(typeof core.parsePackageLockInventory, 'function');
  const parse = core.parsePackageLockInventory;

  assert.throws(() => parse('{not json'), /Invalid package-lock\.json JSON/);
  assert.throws(() => parse(JSON.stringify({ lockfileVersion: 1, packages: { '': {} } })), /Unsupported package-lock lockfileVersion/);
  assert.throws(() => parse(JSON.stringify({ lockfileVersion: 3 })), /package-lock packages must be an object/);
  assert.throws(() => parse(JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/a': { version: '1.0.0' } } })), /package-lock root package metadata is required/);
  assert.throws(() => parse(JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/a': { version: 1 } } })), /node_modules\/a version must be a string/);
});
