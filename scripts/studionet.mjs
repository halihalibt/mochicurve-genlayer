import {createAccount} from 'genlayer-js';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {keccak256,parseEventLogs} from 'viem';
import { studionet } from 'genlayer-js/chains';
import { mkdirSync } from 'node:fs';
import {client,guard,finalSuccess,json,RPC} from './studionet-client.mjs';
const output='evidence/v3';
mkdirSync(output,{recursive:true});
const checkpoint='scripts/.deploy_v3_checkpoint.json';
const source=readFileSync('contracts/mochi_curve.py','utf8');
const hash=createHash('sha256').update(source).digest('hex');
const command=process.argv[2] || 'validate';
const publicClient=client();
await guard(publicClient);
if(command==='validate') {
  const schema=await publicClient.getContractSchemaForCode(source);
  writeFileSync(`${output}/remote-schema.json`,json(schema)+'\n');
  console.log('Validated remote chain 61999, zero gas price, and contract schema. No transaction sent.');
  process.exit(0);
}
let cp=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{};
if(cp.source_sha256 && cp.source_sha256!==hash) throw Error('Checkpoint source differs. Inspect prior deployment; do not silently redeploy.');
const save=()=>writeFileSync(checkpoint,json(cp)+'\n');
if(command==='resume') { cp.tx_hash=process.argv[3]||cp.tx_hash; }
if(!cp.tx_hash && !cp.evm_hash) {
  if(command!=='deploy') throw Error('No transaction hash to resume');
  await publicClient.getContractSchemaForCode(source);
  const account=createAccount(); // Signing material exists in process memory only.
  let commit=''; try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{}
  cp={network:'Stable Studionet',chain_id:61999,rpc:RPC,source_sha256:hash,source_commit:commit,sender:account.address,status:'SUBMITTING',created_at:new Date().toISOString()};
  // Persist the public EVM hash before broadcast. A lost response must be resumed, not resent.
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const request=JSON.parse(options.body);
    if(request.method==='eth_sendRawTransaction') {
      if(cp.evm_hash) throw Error('A deployment broadcast already exists; resume its hash');
      cp.evm_hash=keccak256(request.params[0]); save();
      console.log('EVM_HASH',cp.evm_hash);
    }
    return originalFetch(url,options);
  };
  try {
    cp.tx_hash=await client(account).deployContract({code:source,args:[],consensusMaxRotations:3});
    cp.status='PENDING';save();console.log('TX_HASH',cp.tx_hash);
  } finally {globalThis.fetch=originalFetch;}
}
if(!cp.tx_hash && cp.evm_hash) {
  const receipt=await publicClient.request({method:'eth_getTransactionReceipt',params:[cp.evm_hash]});
  if(!receipt) throw Error('Broadcast outcome unknown. Resume the same checkpoint; no new transaction sent.');
  const events=parseEventLogs({abi:studionet.consensusMainContract.abi,eventName:'NewTransaction',logs:receipt.logs});
  if(!events.length) throw Error('Inspect EVM receipt before retry: no NewTransaction event');
  cp.tx_hash=events[0].args.txId; save();
}
let previous='';
for(let i=0;i<150;i++) {
  const tx=await publicClient.getTransaction({hash:cp.tx_hash});
  const status=tx.statusName;
  if(status!==previous){console.log('STATUS',status);previous=status;}
  cp.status=status;save();
  if(status==='FINALIZED' || ['CANCELED','UNDETERMINED'].includes(status)) {
    writeFileSync(`${output}/deployment-receipt.json`,json(tx)+'\n');
    if(!finalSuccess(tx)) throw Error('Deployment did not execute successfully. Receipt retained; do not redeploy automatically.');
    cp.contract_address=tx.to_address || tx.toAddress || tx.recipient || '';
    cp.finalized_at=new Date().toISOString();save();
    if(!/^0x[0-9a-fA-F]{40}$/.test(cp.contract_address)) throw Error('Read the raw receipt to extract the deployed contract address');
    const curves=await publicClient.readContract({address:cp.contract_address,functionName:'get_all_curves',args:[],transactionHashVariant:'latest-final'});
    writeFileSync(`${output}/deployment-readback.json`,typeof curves==='string'?curves:json(curves));
    writeFileSync(`${output}/deployment-manifest.json`,json({...cp,execution_result:'SUCCESS',constructor_args:[]})+'\n');
    console.log('CONTRACT_ADDRESS',cp.contract_address);process.exit(0);
  }
  await new Promise(r=>setTimeout(r,4000));
}
throw Error('Still pending. Resume the checkpoint or use --tx-hash; do not send another deployment.');
