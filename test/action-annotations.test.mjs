import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGitHubAnnotation, emitGitHubAnnotations } from '../scripts/action-annotations.mjs';

test('GitHub workflow annotation escapes command properties and multiline messages', () => {
  const output = formatGitHubAnnotation({
    level: 'warning',
    file: 'src/a.js',
    line: 3,
    endLine: 3,
    title: 'Regression, risk: 100%',
    message: 'Line 1\nLine 2\r100%',
    findingId: 'f-1',
  });

  assert.equal(
    output,
    '::warning file=src/a.js,line=3,endLine=3,title=Regression%2C risk%3A 100%25::Line 1%0ALine 2%0D100%25\n',
  );
});

test('annotation emitter writes one command per selected annotation', () => {
  const chunks = [];
  emitGitHubAnnotations([
    { level: 'error', file: 'src/a.js', line: 2, endLine: 2, title: 'A', message: 'first', findingId: 'a' },
    { level: 'warning', file: 'src/b.js', line: 5, endLine: 5, title: 'B', message: 'second', findingId: 'b' },
  ], (chunk) => chunks.push(chunk));

  assert.deepEqual(chunks, [
    '::error file=src/a.js,line=2,endLine=2,title=A::first\n',
    '::warning file=src/b.js,line=5,endLine=5,title=B::second\n',
  ]);
});
