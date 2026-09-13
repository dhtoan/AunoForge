import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

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

test('maintained workflows and examples use Node 24-native GitHub Actions majors', async () => {
  for (const surface of maintainedSurfaces) {
    const source = await readFile(new URL(`../${surface.path}`, import.meta.url), 'utf8');

    for (const action of surface.actions) {
      assert.match(
        source,
        new RegExp(`actions/${action}@v7\\b`),
        `${surface.path} must use actions/${action}@v7`,
      );
      assert.doesNotMatch(
        source,
        new RegExp(`actions/${action}@v[1-6]\\b`),
        `${surface.path} must not use a pre-Node-24 action major for actions/${action}`,
      );
    }
  }
});
