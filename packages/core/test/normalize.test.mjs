import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReviewReport } from '../dist/normalize.js';

test('derives summary and recommendation from findings', () => {
  const report = normalizeReviewReport({ root:'.' }, [
    {id:'1',severity:'high',category:'security',title:'x',evidence:[],explanation:'x',confidence:.8,source:'model'},
    {id:'2',severity:'low',category:'quality',title:'y',evidence:[],explanation:'y',confidence:.7,source:'model'}
  ]);
  assert.equal(report.summary.high, 1);
  assert.equal(report.summary.low, 1);
  assert.equal(report.recommendation, 'request-changes');
});
