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
