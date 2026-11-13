import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
export const RPC = 'https://studio.genlayer.com/api';
export const client = (account) => createClient({chain:studionet,endpoint:RPC,...(account?{account}:{} )});
export async function guard(c=client()) {
  if (Number(await c.request({method:'eth_chainId'})) !== 61999) throw Error('Forbidden remote chain');
  if (BigInt(await c.request({method:'eth_gasPrice'})) !== 0n) throw Error('Nonzero gas price; transaction blocked');
}
export { finalizedExecutionSucceeded as finalSuccess } from '../src/finality.js';
export const json=(v)=>JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x,2);
