import{client,finalSuccess,json}from'./studionet-client.mjs';import{writeFileSync,readFileSync,existsSync}from'node:fs';
const [label,hash,curveId="curve-live-release"]=process.argv.slice(2);if(!/^[a-z0-9-]+$/.test(label||'')||!/^0x[0-9a-f]{64}$/i.test(hash||''))throw Error('Usage: capture_transaction.mjs <label> <tx_hash>');
const address='0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632', c=client(), observations=[];
for(let i=0;i<150;i++){
 const tx=await c.getTransaction({hash});
 if(observations.at(-1)?.status!==tx.statusName){observations.push({status:tx.statusName,observed_at:new Date().toISOString()});console.log(label,tx.statusName);}
 if(['FINALIZED','CANCELED','UNDETERMINED'].includes(tx.statusName)){
  writeFileSync(`evidence/${label}-receipt.json`,json(tx)+'\n');
  writeFileSync(`evidence/${label}-observations.json`,json(observations)+'\n');
  if(!finalSuccess(tx))throw Error('Transaction did not succeed; raw receipt retained');
  const raw=await c.readContract({address,functionName:'get_all_curves',args:[],transactionHashVariant:'latest-final'});
  writeFileSync(`evidence/${label}-readback.json`,typeof raw==='string'?raw:json(raw));
  console.log('READBACK',JSON.stringify({curve_id:curveId,Supply:JSON.parse(raw)[curveId]?.Supply,cumulative_buy_volume:JSON.parse(raw)[curveId]?.cumulative_buy_volume,gate_status:JSON.parse(raw)[curveId]?.gate_status}));
  const path='evidence/live-verification.json';const all=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{network:'Stable Studionet',chain_id:61999,contract_address:address,curve_id:'curve-live-release',origin:'user_created',transactions:[]};
  const record={label,curve_id:curveId,readback_variant:'latest-final',readback_captured_at:new Date().toISOString(),tx_hash:hash,status:'FINALIZED',execution_result:'SUCCESS',receipt:`${label}-receipt.json`,readback:`${label}-readback.json`,observations:`${label}-observations.json`};
  all.transactions=all.transactions.filter(x=>x.tx_hash!==hash);all.transactions.push(record);writeFileSync(path,json(all)+'\n');process.exit(0);
 }
 await new Promise(r=>setTimeout(r,4000));
}
throw Error('Tracking timed out. Resume this same hash; no transaction was sent by this script.');
