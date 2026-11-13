import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizedExecutionSucceeded} from '../src/finality.js';
const receipt=name=>JSON.parse(readFileSync(new URL(`../evidence/v3/${name}`,import.meta.url),'utf8'));
const mixed=receipt('v3-graduate-03-evaluate-receipt.json');
test('real finalized majority-agree leader succeeds despite cancelled validator receipt',()=>{
  assert(mixed.consensus_data.leader_receipt.some(r=>r.mode==='validator'&&r.execution_result==='ERROR'));
  assert.equal(finalizedExecutionSucceeded(mixed),true);
});
test('real finalized contract-error receipt remains a failed execution despite agreement',()=>{
  assert.equal(finalizedExecutionSucceeded(receipt('v3-rug-expiry-05-sybil-rejected-receipt.json')),false);
});
test('pending and undetermined outcomes never pass a successful leader alone',()=>{
  for(const patch of [{statusName:'ACCEPTED'},{statusName:'UNDETERMINED'},{result_name:'MAJORITY_DISAGREE'},{result_name:undefined}]){
    assert.equal(finalizedExecutionSucceeded({...mixed,...patch}),false);
  }
});
test('missing, ambiguous or failed leader receipts fail closed',()=>{
  for(const receipts of [[],[{mode:'validator',execution_result:'SUCCESS'}],[{mode:'leader',execution_result:'ERROR'},{mode:'validator',execution_result:'SUCCESS'}],[{mode:'leader',execution_result:'SUCCESS'},{mode:'leader',execution_result:'SUCCESS'}]]) {
    assert.equal(finalizedExecutionSucceeded({...mixed,consensus_data:{leader_receipt:receipts}}),false);
  }
});
