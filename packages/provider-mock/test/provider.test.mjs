import { providerContract } from '../../core/test/provider-contract.mjs';
import { MockProvider } from '../dist/index.js';

providerContract('mock', () => new MockProvider());

import test from 'node:test';
import assert from 'node:assert/strict';

test('mock provider returns honest deterministic fixture data for triage and reproduction', async()=>{
  const provider=new MockProvider();
  const base={task:'fixture',systemPolicy:'policy',trustedMetadata:{},untrustedContent:{},constraints:{readOnly:true}};
  const triage=await provider.generate({...base,outputKind:'triage-report/v1'});
  assert.equal(triage.data.type,'unknown');
  assert.equal(triage.data.severity,'info');
  assert.equal(triage.data.confidence,0);
  const reproduction=await provider.generate({...base,outputKind:'reproduction-plan/v1'});
  assert.ok(Array.isArray(reproduction.data.steps));
  assert.match(reproduction.data.expected,/mock provider/i);
});
