// Resumable real Stable Studionet validation. Never resets the deployed deadline.
import { createAccount, generatePrivateKey } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { keccak256, parseEventLogs } from 'viem';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { client, guard, finalSuccess, json, RPC } from './studionet-client.mjs';
const phase = process.argv[2] || 'status';
assert(['status', 'prepare', 'finish'].includes(phase));
const OUT = 'evidence/v3';
const LOCAL = 'scripts/.local/v3-validation.json';
const UNIT = 10n ** 15n;
const GEN = 10n ** 18n;
const manifest = JSON.parse(readFileSync(`${OUT}/deployment-manifest.json`, 'utf8'));
const address = manifest.contract_address;
assert.match(address, /^0x[0-9a-fA-F]{40}$/);
const sourceHash = createHash('sha256').update(readFileSync('contracts/mochi_curve.py')).digest('hex');
assert.equal(manifest.source_sha256, sourceHash);
const reader = client();
await guard(reader);
mkdirSync('scripts/.local', { recursive: true });
let run = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, 'utf8')) : { contract_address: address, accounts: {}, transactions: {} };
assert.equal(run.contract_address, address);
// Merge published transaction hashes when restoring an older private account checkpoint.
// This keeps recovery from broadcasting transactions already recorded on chain.
const indexPath=`${OUT}/live-verification.json`;
if(existsSync(indexPath)) {
  const published=JSON.parse(readFileSync(indexPath,'utf8'));
  assert.equal(published.contract_address,address);
  for(const record of published.transactions || []) {
    const local=run.transactions[record.label];
    if(local?.tx_hash && record.tx_hash)assert.equal(local.tx_hash,record.tx_hash,'Conflicting checkpoint hashes');
    if(!local || record.verified)run.transactions[record.label]=record;
  }
  run.deadlines={...(published.deadlines || {}),...(run.deadlines || {})};
}

const save = () => writeFileSync(LOCAL, json(run) + '\n', { mode: 0o600 });
const publicIndex = () => writeFileSync(`${OUT}/live-verification.json`, json({network:'Stable Studionet',chain_id:61999,rpc:RPC,source_sha256:sourceHash,contract_address:address,origin:'user_created',phase:run.phase || 'IN_PROGRESS',transactions:Object.values(run.transactions),deadlines:run.deadlines || {},reconciliation:run.reconciliation || null,accounts:Object.fromEntries(Object.entries(run.accounts).map(([k,a])=>[k,{address:a.address,funded_gen:10000}]))})+'\n');
async function state() {
  const raw = await reader.readContract({ address, functionName: 'get_all_curves', args: [], transactionHashVariant: 'latest-final' });
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
async function snapshot() {
  const totals = await reader.readContract({address,functionName:'get_ledger_totals',args:[],transactionHashVariant:'latest-final'});
  return {curves:await state(), ledger_totals:typeof totals==='string'?JSON.parse(totals):totals,contract_balance_wei:String(await reader.getBalance({address})),readback_variant:'latest-final',captured_at:new Date().toISOString()};
}
function actor(name) { return createAccount(run.accounts[name].privateKey); }
async function fund(name) {
  if (!run.accounts[name]) {
    const privateKey = generatePrivateKey(), account = createAccount(privateKey);
    run.accounts[name] = {address:account.address,privateKey,funding_requested:false};save();
  }
  const a=run.accounts[name];
  if (!a.funding_requested) {
    a.funding_requested=true;save();
    await reader.request({method:'sim_fundAccount',params:[a.address,10000*10**18]});
  }
  // An uncertain faucet response is not automatically repeated.
  assert(BigInt(await reader.getBalance({address:a.address})) > 500n*GEN, 'Check faucet before resuming');
  return a.address;
}
function failureText(tx) {
  const raw=tx.consensus_data?.leader_receipt;
  return (Array.isArray(raw)?raw:raw?[raw]:[]).map(r=>r.genvm_result?.stderr || r.error || '').join('\n');
}
async function transaction(label, who, method, args, value=0n, expectedError='') {
  let rec=run.transactions[label];
  if(rec?.verified) {console.log('SKIP',label);return rec;}
  if(!rec) {
    rec=run.transactions[label]={label,actor:who,method,args,value_wei:String(value),expected_error:expectedError};
    if(expectedError) {
      rec.before_state=`${label}-before-state.json`;
      writeFileSync(`${OUT}/${rec.before_state}`,json(await snapshot())+'\n');
    }
    save();
  }
  assert.equal(rec.method,method); assert.deepEqual(rec.args,args);
  if(!rec.tx_hash && rec.broadcast_hash) {
    const receipt=await reader.request({method:'eth_getTransactionReceipt',params:[rec.broadcast_hash]});
    if(!receipt)throw Error(`Uncertain broadcast for ${label}; inspect ${rec.broadcast_hash}, do not resend`);
    const events=parseEventLogs({abi:studionet.consensusMainContract.abi,eventName:'NewTransaction',logs:receipt.logs});
    if(events.length) rec.tx_hash=events[0].args.txId;
    else {
      // Studio uses the EVM hash directly; query it rather than rebroadcast.
      const tx=await reader.getTransaction({hash:rec.broadcast_hash});
      if(tx)rec.tx_hash=rec.broadcast_hash;
    }
    save();
    if(!rec.tx_hash)throw Error(`Cannot resolve broadcast for ${label}`);
  }
  if(!rec.tx_hash) {
    const account=actor(who);
    const signingAccount={...account,signTransaction:async(...params)=>{
      const raw=await account.signTransaction(...params);
      if(rec.broadcast_hash)throw Error('Broadcast already recorded');
      rec.broadcast_hash=keccak256(raw);save();publicIndex();return raw;
    }};
    rec.tx_hash=await client(signingAccount).writeContract({address,functionName:method,args,value,consensusMaxRotations:3});save();publicIndex();
    console.log(label,rec.tx_hash);
  }
  let tx;
  for(let i=0;i<120;i++) {
    tx=await reader.getTransaction({hash:rec.tx_hash});
    if(rec.status!==tx.statusName){rec.status=tx.statusName;save();console.log(label,rec.status);}
    if(['FINALIZED','CANCELED','UNDETERMINED'].includes(tx.statusName))break;
    await new Promise(r=>setTimeout(r,3000));
  }
  writeFileSync(`${OUT}/${label}-receipt.json`,json(tx)+'\n');
  rec.receipt=`${label}-receipt.json`;rec.execution_result=finalSuccess(tx)?'SUCCESS':'ERROR';save();publicIndex();
  assert.equal(tx.statusName,'FINALIZED',`${label} not finalized; resume existing hash`);
  const rb=await snapshot();writeFileSync(`${OUT}/${label}-readback.json`,json(rb)+'\n');
  rec.readback=`${label}-readback.json`; rec.readback_variant='latest-final';
  if(expectedError) {
    assert(!finalSuccess(tx),`${label} unexpectedly succeeded`);
    assert(failureText(tx).includes(expectedError),`${label}: expected ${expectedError}; inspect retained receipt`);
    if(rec.before_state) {
      const before=JSON.parse(readFileSync(`${OUT}/${rec.before_state}`,'utf8'));
      assert.deepEqual(rb.curves,before.curves,`${label} mutated curves`);
      assert.deepEqual(rb.ledger_totals,before.ledger_totals,`${label} mutated ledger`);
      assert.equal(rb.contract_balance_wei,before.contract_balance_wei,`${label} changed contract balance`);
    }
  } else assert(finalSuccess(tx),`${label} execution failed; receipt retained`);
  rec.verified=true;save();publicIndex();return rec;
}
const scenarios = [
  {id:'v3-rug-expiry',repo:'halihalibt/mochicurve-rug-demo',path:'release_manifest.json',body:'Deliver a real verifiable software release with multiple code files and functional commits.',rug:true,review:false},
  {id:'v3-rug-review',repo:'halihalibt/mochicurve-rug-demo',path:'release_manifest.json',body:'Deliver production code, tagged release and substantive functional implementation with automated tests.',rug:true,review:true},
  {id:'v3-graduate',repo:'halihalibt/mochicurve-genlayer',path:'evidence-manifests/graduate-v2.json',body:'Deliver verifiable v1.0 release tag, GenVM bonding curve module, scroll-driven frontend, mock tests and Studionet deploy scripts in halihalibt/mochicurve-genlayer.',rug:false,review:false},
  {id:'v3-boost',repo:'halihalibt/mochicurve-genlayer',path:'evidence-manifests/boost-v2.json',body:'Deliver the GenVM bonding curve contract for v1.0 in halihalibt/mochicurve-genlayer.',rug:false,review:false}
];
function urls(s){return [`https://raw.githubusercontent.com/${s.repo}/main/${s.path}`,`https://cdn.jsdelivr.net/gh/${s.repo}@main/${s.path}`];}
if(phase==='status') {
  const curves=await state();
  console.log(json(Object.fromEntries(Object.entries(curves).map(([k,c])=>[k,{status:c.gate_status,verdict:c.pending_verdict?.verdict,deadline:c.verdict_deadline,deadline_utc:c.verdict_deadline?new Date(c.verdict_deadline*1000).toISOString():null}]))));
  process.exit(0);
}
if(phase==='prepare') {
  for(const name of ['creator','buyer','stranger'])await fund(name);
  const creator=run.accounts.creator.address,buyer=run.accounts.buyer.address,stranger=run.accounts.stranger.address;
  for(const s of scenarios) {
    const id=s.id,[p,b]=urls(s);
    await transaction(`${id}-01-launch`,'creator','launch_curve',[id,id,'$MCV3',creator,s.repo,s.body,createHash('sha256').update(`salt-${id}|secret-${id}`).digest('hex')],25000n*UNIT);
    await transaction(`${id}-02-buy`,'buyer','buy_tokens',[id,71,buyer],104284n*UNIT);
    await transaction(`${id}-03-evaluate`,'creator','evaluate_graduation_gate',[id,p,b,creator]);
    let c=(await state())[id];
    assert.equal(c.gate_status,'VERDICT_PENDING');
    assert.equal(c.creator_collateral,25000);
    if(s.rug)assert.equal(c.pending_verdict.verdict,'RUG_SLASHED');
    run.deadlines ||= {};run.deadlines[id]=c.verdict_deadline;save();publicIndex();
    if(s.rug) {
      await transaction(`${id}-04-challenge`,'buyer','challenge_pending_verdict',[id,buyer,'GRADUATE_APPROVED','Request independent review of delivery before applying the pending slash.']);
      await transaction(`${id}-05-sybil-rejected`,'stranger','challenge_pending_verdict',[id,stranger,'GRADUATE_APPROVED','Second identity cannot extend the deadline.'],0n,'CHALLENGE_LIMIT_REACHED');
      await transaction(`${id}-06-early-execute-rejected`,'stranger','execute_verdict',[id,stranger],0n,'VERDICT_WINDOW_OPEN');
      if(s.review) {
        await transaction(`${id}-07-review-path-rejected`,'stranger','evaluate_graduation_gate',[id,p+'x',b+'x',stranger],0n,'REVIEW_EVIDENCE_PATH_CHANGED');
        await transaction(`${id}-08-review`,'stranger','evaluate_graduation_gate',[id,p,b,stranger]);
        c=(await state())[id]; assert.equal(c.review_used,true);assert.equal(c.verdict_deadline,run.deadlines[id]);
        assert.equal(c.pending_challenges[0].resolution,'REVIEWED');
        await transaction(`${id}-09-repeat-review-rejected`,'stranger','evaluate_graduation_gate',[id,p,b,stranger],0n,'NO_REVIEW_AVAILABLE');
      }
    }
  }
  run.phase='WAITING_FOR_REAL_DEADLINES';save();publicIndex();
  console.log('DEADLINES',json(run.deadlines));
}
if(phase==='finish') {
  const curves=await state();
  const latest=Math.max(...scenarios.map(s=>Number(curves[s.id]?.verdict_deadline || Infinity)));
  if(Date.now()<latest*1000+60000)throw Error(`Real expiry not reached: ${new Date(latest*1000+60000).toISOString()}. No transaction sent.`);
  const creator=run.accounts.creator.address,buyer=run.accounts.buyer.address,stranger=run.accounts.stranger.address;
  for(const s of scenarios) {
    const id=s.id;
    const current=(await state())[id];const beforePath=`${OUT}/${id}-before-finalization.json`;
    if(!existsSync(beforePath))writeFileSync(beforePath,json(current)+'\n');
    const before=JSON.parse(readFileSync(beforePath,'utf8'));
    await transaction(`${id}-20-execute`,'stranger','execute_verdict',[id,stranger]);
    const c=(await state())[id];
    assert.equal(c.pending_verdict,null);assert.equal(c.pending_challenges.length,0);
    assert.equal(c.gate_status,before.pending_verdict.verdict);
    assert.equal(c.last_audit.executed_by,stranger.toLowerCase());
    assert.equal(c.last_audit.verdict_deadline,String(run.deadlines[id]));
    assert.equal(c.creator_collateral,0);assert.equal(c.fee_escrow_pool,0);
    if(s.rug){assert.equal(c.redemption_floor_pool,27044);assert.equal(c.last_audit.challenges[0].resolution,s.review?'REVIEWED':'EXPIRED');}
    assert.equal(String(await reader.readContract({address,functionName:'get_user_balance',args:[stranger],transactionHashVariant:'latest-final'})),'0');
    await transaction(`${id}-21-double-execute-rejected`,'stranger','execute_verdict',[id,stranger],0n,'NO_PENDING_VERDICT');
    await transaction(`${id}-22-sell`,'buyer','sell_tokens',[id,71,buyer]);
    await transaction(`${id}-23-withdraw-buyer`,'buyer','withdraw',[]);
    if(!s.rug)await transaction(`${id}-24-withdraw-creator`,'creator','withdraw',[]);
  }
  const snap=await snapshot();let sum=BigInt(snap.contract_balance_wei);
  const balances={};for(const [name,a] of Object.entries(run.accounts)){balances[name]=String(await reader.getBalance({address:a.address}));sum+=BigInt(balances[name]);}
  assert.equal(sum,30000n*GEN);
  assert.equal(BigInt(snap.contract_balance_wei),(BigInt(snap.ledger_totals.total_received_units)-BigInt(snap.ledger_totals.total_withdrawn_units))*UNIT);
  run.reconciliation={eoa_balances_wei:balances,contract_balance_wei:snap.contract_balance_wei,total_wei:String(sum),expected_wei:String(30000n*GEN),conservation_holds:true,contract_equals_received_minus_withdrawn:true};
  run.phase='FINALIZED_VERIFIED';save();publicIndex();console.log('FINALIZED_VERIFIED');
}
