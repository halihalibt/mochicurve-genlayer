import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function refreshCurvesFromChainIfConfigured()'),source.indexOf('function transactionSucceeded(tx)'));
function harness(address) {
  const calls=[];
  const context={APP_CONFIG:{CONTRACT_ADDRESS:'0x47767c833bC218e193177bC39F79235CCA639200'},appState:{activeTraderAddress:address,activeCurveId:'gone',curves:{},balances:{}},publicClient:{
    readContract:async args=>{calls.push(args.functionName);return args.functionName==='get_all_curves'?'{"live-curve":{"gate_status":"VERDICT_PENDING"}}':'123';},
    getBalance:async()=>{calls.push('eth_getBalance');return 456n;}
  },document:{getElementById:()=>({textContent:''})}};
  runInNewContext(code+';this.refresh=refreshCurvesFromChainIfConfigured;',context);
  return {context,calls};
}
test('public finalized-state reads never query balances for a demo or absent wallet',async()=>{
  for(const address of ['0xDEMO_TRADER','',null,undefined]){
    const {context,calls}=harness(address);assert.equal(await context.refresh(),true);
    assert.deepEqual(calls,['get_all_curves']);assert.equal(context.appState.activeCurveId,'live-curve');
  }
});
test('valid connected address receives balance and withdrawable-credit reads',async()=>{
  const address='0x1111111111111111111111111111111111111111';
  const {context,calls}=harness(address);await context.refresh();
  assert.deepEqual(calls,['get_all_curves','get_user_balance','eth_getBalance']);
  assert.equal(context.appState.balances[address],123);assert.equal(context.appState.walletGenWei,456n);
});
