import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderJson, renderTerminal, renderReport } from '../dist/index.js';

const sample = {
  schemaVersion:'1', repository:{root:'.'},
  findings:[{id:'1',severity:'medium',category:'regression',title:'Player resize',evidence:['observer detached'],location:{file:'a.ts',startLine:2,endLine:2,verified:true},explanation:'May regress mobile flow.',verification:['Open comments'],confidence:.82,source:'model'}],
  summary:{critical:0,high:0,medium:1,low:0,info:0}, recommendation:'needs-review'
};

test('markdown renders source confidence and verified location', () => {
  const out = renderMarkdown(sample);
  assert.match(out, /Source: model/);
  assert.match(out, /Confidence: 0.82/);
  assert.match(out, /a\.ts:2/);
});

test('json output round trips as JSON', () => {
  assert.equal(JSON.parse(renderJson(sample)).recommendation, 'needs-review');
});

test('terminal output includes severity and title', () => {
  assert.match(renderTerminal(sample), /MEDIUM/);
  assert.match(renderTerminal(sample), /Player resize/);
});

test('report dispatcher preserves existing formats', () => {
  assert.equal(renderReport(sample, 'json'), renderJson(sample));
  assert.equal(renderReport(sample, 'markdown'), renderMarkdown(sample));
  assert.equal(renderReport(sample, 'terminal'), renderTerminal(sample));
});
