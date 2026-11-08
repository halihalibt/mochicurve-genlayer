import{createAccount}from'genlayer-js';import{client,guard,json}from'./studionet-client.mjs';import{readFileSync,writeFileSync,existsSync}from'node:fs';import{keccak256}from'viem';
const [curveId,primary,backup]=process.argv.slice(2),address='0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632';
if(!/^[a-z0-9-]+$/.test(curveId||''))throw Error('Curve ID required');
const path=`evidence/${curveId}-audit-request.json`;
if(existsSync(path)){console.log(readFileSync(path,'utf8'));process.exit(0)}
const account=createAccount(),c=client(account);await guard(c);
const metadata={curve_id:curveId,sender:account.address,contract_address:address,primary_url:primary,backup_url:backup};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{const request=JSON.parse(options.body);if(request.method==='eth_sendRawTransaction'){if(metadata.broadcast_hash)throw Error('Already broadcast; resume the saved hash');metadata.broadcast_hash=keccak256(request.params[0]);writeFileSync(path,json(metadata)+'\n');console.log('BROADCAST_HASH',metadata.broadcast_hash);}return originalFetch(url,options)};
try{metadata.tx_hash=await c.writeContract({address,functionName:'evaluate_graduation_gate',args:[curveId,primary,backup],consensusMaxRotations:3,value:0n});writeFileSync(path,json(metadata)+'\n');console.log('TX_HASH',metadata.tx_hash)}finally{globalThis.fetch=originalFetch}
process.exit(0);
