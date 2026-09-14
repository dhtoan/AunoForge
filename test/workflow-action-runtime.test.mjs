import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const actionPins = {
  checkout: {
    sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
    version: 'v7.0.1',
  },
  'setup-node': {
    sha: '820762786026740c76f36085b0efc47a31fe5020',
    version: 'v7.0.0',
  },
  'upload-artifact': {
    sha: '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    version: 'v7.0.1',
  },
};

const maintainedSurfaces = [
  {
    path: '.github/workflows/ci.yml',
    actions: ['checkout', 'setup-node'],
  },
  {
    path: '.github/workflows/aunoforge-review.yml',
    actions: ['checkout', 'upload-artifact'],
  },
  {
    path: '.github/workflows/stable-action-smoke.yml',
    actions: ['checkout', 'upload-artifact'],
  },
  {
    path: 'docs/examples/aunoforge-review-v0.2.yml',
    actions: ['checkout', 'upload-artifact'],
  },
  {
    path: 'docs/examples/aunoforge-review.yml',
    actions: ['checkout', 'upload-artifact'],
  },
  {
    path: 'docs/examples/aunoforge-security.yml',
    actions: ['checkout', 'upload-artifact'],
  },
];

test('maintained workflows and examples pin external GitHub Actions to reviewed commits', async () => {
  for (const surface of maintainedSurfaces) {
    const source = await readFile(new URL(`../${surface.path}`, import.meta.url), 'utf8');

    for (const action of surface.actions) {
      const pin = actionPins[action];
      const usages = [
        ...source.matchAll(new RegExp(`actions/${action}@([^\\s#]+)(?:\\s+#\\s*([^\\n]+))?`, 'g')),
      ];

      assert.ok(usages.length > 0, `${surface.path} must use actions/${action}`);

      for (const usage of usages) {
        assert.equal(
          usage[1],
          pin.sha,
          `${surface.path} must pin actions/${action} to ${pin.sha}`,
        );
        assert.match(
          usage[2] ?? '',
          new RegExp(`^${pin.version.replaceAll('.', '\\.')}(?:\\s|$)`),
          `${surface.path} must document actions/${action} as ${pin.version}`,
        );
      }
    }
  }
});

test('Dependabot keeps GitHub Action commit pins current without auto-merge policy', async () => {
  const source = await readFile(new URL('../.github/dependabot.yml', import.meta.url), 'utf8').catch(
    () => '',
  );

  assert.match(source, /version:\s*2/);
  assert.match(source, /package-ecosystem:\s*["']?github-actions["']?/);
  assert.match(source, /directory:\s*["']?\/["']?/);
  assert.match(source, /interval:\s*["']?weekly["']?/);
  assert.doesNotMatch(source, /automerge|auto-merge/i);
});
