import{createAccount}from'genlayer-js';import{client,guard,json}from'./studionet-client.mjs';import{readFileSync,writeFileSync,existsSync}from'node:fs';import{keccak256}from'viem';
// Usage: node scripts/audit_curve.mjs <curve_id> <primary_url> <backup_url> <evaluator_address>
// The evaluator must be the curve creator (creator-only evaluation, v2).
// The contract address is read from evidence/deployment-manifest.json.
const manifest=JSON.parse(readFileSync('evidence/deployment-manifest.json','utf8'));
const address=manifest.contract_address;
const [curveId,primary,backup,evaluator]=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(curveId||'')||!primary||!backup||!/^0x[0-9a-fA-F]{40}$/.test(evaluator||''))throw Error('Usage: audit_curve.mjs <curve_id> <primary_url> <backup_url> <evaluator_address>');
const path=`evidence/${curveId}-audit-request.json`;
if(existsSync(path)){console.log(readFileSync(path,'utf8'));process.exit(0)}
const account=createAccount(),c=client(account);await guard(c);
const metadata={curve_id:curveId,sender:account.address,contract_address:address,primary_url:primary,backup_url:backup,evaluator};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{const request=JSON.parse(options.body);if(request.method==='eth_sendRawTransaction'){if(metadata.broadcast_hash)throw Error('Already broadcast; resume the saved hash');metadata.broadcast_hash=keccak256(request.params[0]);writeFileSync(path,json(metadata)+'\n');console.log('BROADCAST_HASH',metadata.broadcast_hash);}return originalFetch(url,options)};
try{metadata.tx_hash=await c.writeContract({address,functionName:'evaluate_graduation_gate',args:[curveId,primary,backup,evaluator],consensusMaxRotations:3,value:0n});writeFileSync(path,json(metadata)+'\n');console.log('TX_HASH',metadata.tx_hash)}finally{globalThis.fetch=originalFetch}
process.exit(0);
