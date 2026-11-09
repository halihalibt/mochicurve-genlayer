// scripts/rescue-evidence.mjs
// Runs the MochiCurve v2 evidence cases against the deployed contract.
// Usage: node scripts/rescue-evidence.mjs
// Accounts and progress live in scripts/.local/rescue-run.json (mode 0600,
// gitignored). Rerunning resumes: completed labels are skipped, accounts reused.
// No transaction is ever re-sent: every label is recorded once and skipped after.
//
// Cases (all real testnet GEN, faucet-funded):
//  (c) stranger evaluates -> must fail (hole 2 closed)
//  (a) honest delivery -> GRADUATE_APPROVED (pending, then executed)
//  (b) README-only repo + false manifest -> RUG_SLASHED, with a challenge
//      blocking execution first (challenge window), then re-evaluation + execute
//  (d) genuine over-delivery -> CATALYST_BOOST attempted; whatever consensus
//      returns is recorded honestly, never gamed
// Plus: sell + pull-payment withdrawals with EOA balance checks, a contradiction
// witness on the finalized graduate curve, and full GEN conservation at the end.
import { createAccount, generatePrivateKey, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';

const RPC = 'https://studio.genlayer.com/api';
const GEN = 10n ** 18n;
const UNIT = 10n ** 15n; // 1 accounting unit = 0.001 GEN
const FUND_GEN = 10000;
const LOCAL = 'scripts/.local';
const RUN_PATH = `${LOCAL}/rescue-run.json`;
const manifest = JSON.parse(readFileSync('evidence/deployment-manifest.json', 'utf8'));
const ADDRESS = manifest.contract_address;
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) throw new Error('No deployed contract address in evidence/deployment-manifest.json');

const genStr = (wei) => {
  const w = BigInt(wei);
  const whole = w / GEN;
  const frac = w % GEN;
  if (frac === 0n) return `${whole} GEN`;
  return `${whole}.${frac.toString().padStart(18, '0').replace(/0+$/, '')} GEN`;
};
const json = (v) => JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x, 2);
const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

// Curve math mirrors contracts/mochi_curve.py exactly (integer units).
const reserve = (s, b, k, off) => { const raw = BigInt(b) * BigInt(s) + (BigInt(k) * BigInt(s) * BigInt(s)) / 2n; return raw > BigInt(off) ? raw - BigInt(off) : 0n; };
const buyCostUnits = (s0, amount, b, k, off) => {
  const delta = reserve(s0 + amount, b, k, off) - reserve(s0, b, k, off);
  return delta + (delta * 200n) / 10000n;
};

mkdirSync(LOCAL, { recursive: true });
let run = existsSync(RUN_PATH) ? JSON.parse(readFileSync(RUN_PATH, 'utf8')) : { contract_address: ADDRESS, accounts: {}, done: {}, verdicts: {} };
const saveRun = () => { writeFileSync(RUN_PATH, json(run) + '\n'); chmodSync(RUN_PATH, 0o600); };
if (run.contract_address !== ADDRESS) throw new Error('Run checkpoint is for a different contract; remove scripts/.local/rescue-run.json to start over.');

const clientFor = (account) => createClient({ chain: studionet, endpoint: RPC, account });
const reader = createClient({ chain: studionet, endpoint: RPC });
const getBalance = async (addr) => (await reader.getBalance({ address: addr })).toString();

async function fund(name) {
  if (run.accounts[name]) return run.accounts[name];
  const pk = generatePrivateKey();
  const account = createAccount(pk);
  const client = clientFor(account);
  const fundTx = await client.request({ method: 'sim_fundAccount', params: [account.address, FUND_GEN * 10 ** 18] });
  const bal = await getBalance(account.address);
  if (bal !== (BigInt(FUND_GEN) * GEN).toString()) throw new Error(`fund ${name} amount mismatch: ${bal}`);
  run.accounts[name] = { address: account.address, privateKey: pk, fundTx: String(fundTx), funded_gen: FUND_GEN };
  saveRun();
  console.log(`fund ${name}: ${account.address} 10000 GEN (tx ${String(fundTx).slice(0, 18)}...)`);
  return run.accounts[name];
}

function finalSuccess(tx) {
  const raw = tx.consensus_data?.leader_receipt;
  const leaders = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return tx.statusName === 'FINALIZED' && leaders.length > 0 && leaders.every((r) => r.execution_result === 'SUCCESS');
}
function leaderError(tx) {
  const raw = tx.consensus_data?.leader_receipt;
  const leaders = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const err = leaders.find((r) => r.execution_result !== 'SUCCESS');
  if (!err) return '';
  const rawResult = String(err.result || err.error || '');
  for (const enc of ['base64', 'hex']) {
    try {
      const decoded = Buffer.from(rawResult.replace(/^0x/, ''), enc).toString('utf8').replace(/\0/g, '');
      if (/CALLER_ADDRESS_MISMATCH|PENDING_CHALLENGE|EVALUATOR_NOT_CREATOR|EXECUTOR_NOT_CREATOR|NO_PENDING|FINALIZED_VERDICT|THRESHOLD/.test(decoded)) return decoded.slice(0, 300);
    } catch {}
  }
  return rawResult.slice(0, 200);
}

async function readback() {
  const curvesRaw = await reader.readContract({ address: ADDRESS, functionName: 'get_all_curves', args: [], transactionHashVariant: 'latest-final' });
  const totalsRaw = await reader.readContract({ address: ADDRESS, functionName: 'get_ledger_totals', args: [], transactionHashVariant: 'latest-final' });
  return {
    curves: typeof curvesRaw === 'string' ? JSON.parse(curvesRaw) : curvesRaw,
    ledger_totals: typeof totalsRaw === 'string' ? JSON.parse(totalsRaw) : totalsRaw,
    contract_balance_wei: await getBalance(ADDRESS),
  };
}

async function writeTx(label, account, functionName, args, value = 0n, expectSuccess = true) {
  if (run.done[label]) { console.log(`skip ${label} (already recorded ${run.done[label].tx_hash.slice(0, 18)}...)`); return run.done[label]; }
  const client = clientFor(account);
  const hash = await client.writeContract({ address: ADDRESS, functionName, args, value, consensusMaxRotations: 3 });
  console.log(`${label} tx: ${hash}${value > 0n ? ` (value ${genStr(value)})` : ''}`);
  const observations = [];
  let tx = null;
  for (let i = 0; i < 180; i++) {
    tx = await reader.getTransaction({ hash });
    if (observations.at(-1)?.status !== tx.statusName) {
      observations.push({ status: tx.statusName, observed_at: new Date().toISOString() });
      console.log(`  ${label}: ${tx.statusName}`);
    }
    if (['FINALIZED', 'CANCELED', 'UNDETERMINED'].includes(tx.statusName)) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (!tx || !['FINALIZED', 'CANCELED', 'UNDETERMINED'].includes(tx.statusName)) throw new Error(`${label} did not finalize; resume with the same hash ${hash}`);
  const ok = finalSuccess(tx);
  const errText = ok ? '' : leaderError(tx);
  if (expectSuccess && !ok) throw new Error(`${label} expected SUCCESS but failed: ${errText} (tx ${hash}; raw receipt retained)`);
  if (!expectSuccess && ok) throw new Error(`${label} expected FAILURE but succeeded (tx ${hash})`);
  const rb = await readback();
  writeFileSync(`evidence/${label}-receipt.json`, json(tx) + '\n');
  writeFileSync(`evidence/${label}-readback.json`, json(rb) + '\n');
  writeFileSync(`evidence/${label}-observations.json`, json(observations) + '\n');
  const record = {
    label, functionName, args: JSON.stringify(args, (_k, v) => typeof v === 'bigint' ? v.toString() : v),
    value_wei: value.toString(), tx_hash: hash, status: tx.statusName,
    execution_result: ok ? 'SUCCESS' : 'ERROR', error: errText || undefined,
    receipt: `${label}-receipt.json`, readback: `${label}-readback.json`, observations: `${label}-observations.json`,
    readback_variant: 'latest-final', readback_captured_at: new Date().toISOString(),
  };
  run.done[label] = record;
  saveRun();
  console.log(`  ${label}: recorded ${ok ? 'SUCCESS' : 'EXPECTED-FAILURE ' + errText}`);
  return record;
}

function accountFor(name) {
  const a = run.accounts[name];
  return createAccount(a.privateKey);
}
const curveState = (rb, cid) => rb.curves[cid];

const MANIFESTO_GRADUATE = 'Deliver verifiable v1.0 release tag, GenVM bonding curve module, scroll-driven frontend, mock tests and Studionet deploy scripts in halihalibt/mochicurve-genlayer.';
const MANIFESTO_BOOST = 'Deliver the GenVM bonding curve contract for v1.0 in halihalibt/mochicurve-genlayer.';
const MANIFESTO_RUG = 'Deliver verifiable v1.0 release tag, GenVM bonding curve module, and >=5 functional commits in halihalibt/mochicurve-rug-demo.';
const GRAD_P = 'https://raw.githubusercontent.com/halihalibt/mochicurve-genlayer/main/evidence-manifests/graduate-v2.json';
const GRAD_B = 'https://cdn.jsdelivr.net/gh/halihalibt/mochicurve-genlayer@main/evidence-manifests/graduate-v2.json';
const BOOST_P = 'https://raw.githubusercontent.com/halihalibt/mochicurve-genlayer/main/evidence-manifests/boost-v2.json';
const BOOST_B = 'https://cdn.jsdelivr.net/gh/halihalibt/mochicurve-genlayer@main/evidence-manifests/boost-v2.json';
const RUG_P = 'https://raw.githubusercontent.com/halihalibt/mochicurve-rug-demo/main/release_manifest.json';
const RUG_B = 'https://cdn.jsdelivr.net/gh/halihalibt/mochicurve-rug-demo@main/release_manifest.json';

async function main() {
  const creator = await fund('creator');
  const buyer = await fund('buyer');
  const stranger = await fund('stranger');
  const creatorAcct = accountFor('creator');
  const buyerAcct = accountFor('buyer');
  const strangerAcct = accountFor('stranger');

  // --- Case (c): stranger evaluates -> must fail (hole 2 closed) ---
  // Curve A must exist and be unlocked first.
  const commitA = sha256hex('mochi-salt-v2a|v2-graduate-secret');
  await writeTx('v2-01-launch-graduate', creatorAcct, 'launch_curve',
    ['curve-v2-graduate', 'Mochi Release v2', '$MREL', creator.address, 'halihalibt/mochicurve-genlayer', MANIFESTO_GRADUATE, commitA], 25000n * UNIT);
  await writeTx('v2-02-buy-graduate', buyerAcct, 'buy_tokens',
    ['curve-v2-graduate', 71, buyer.address], buyCostUnits(0, 71, 20, 40, 0) * UNIT);
  await writeTx('v2-03-stranger-evaluate', strangerAcct, 'evaluate_graduation_gate',
    ['curve-v2-graduate', GRAD_P, GRAD_B, creator.address], 0n, false);
  run.verdicts.stranger_evaluate_error = run.done['v2-03-stranger-evaluate'].error;

  // --- Case (a): honest delivery -> GRADUATE_APPROVED ---
  const evA = await writeTx('v2-04-evaluate-graduate', creatorAcct, 'evaluate_graduation_gate',
    ['curve-v2-graduate', GRAD_P, GRAD_B, creator.address]);
  const rbA = JSON.parse(readFileSync('evidence/v2-04-evaluate-graduate-readback.json', 'utf8'));
  run.verdicts.graduate_pending = curveState(rbA, 'curve-v2-graduate').pending_verdict.verdict;
  console.log(`  case (a) pending verdict: ${run.verdicts.graduate_pending}`);
  const exA = await writeTx('v2-05-execute-graduate', creatorAcct, 'execute_verdict',
    ['curve-v2-graduate', creator.address]);
  const rbA2 = JSON.parse(readFileSync('evidence/v2-05-execute-graduate-readback.json', 'utf8'));
  run.verdicts.graduate_final = curveState(rbA2, 'curve-v2-graduate').gate_status;
  console.log(`  case (a) final verdict: ${run.verdicts.graduate_final}`);
  // Creator withdraws the reward; buyer sells 31 and withdraws.
  const balCreatorBefore = BigInt(await getBalance(creator.address));
  await writeTx('v2-06-withdraw-creator-graduate', creatorAcct, 'withdraw', []);
  const balCreatorAfter = BigInt(await getBalance(creator.address));
  run.verdicts.creator_graduate_withdrawn_wei = (balCreatorAfter - balCreatorBefore).toString();
  console.log(`  creator withdrew ${genStr(run.verdicts.creator_graduate_withdrawn_wei)} (EOA delta)`);
  await writeTx('v2-07-sell-graduate', buyerAcct, 'sell_tokens', ['curve-v2-graduate', 31, buyer.address]);
  const balBuyerBefore = BigInt(await getBalance(buyer.address));
  await writeTx('v2-08-withdraw-buyer-graduate', buyerAcct, 'withdraw', []);
  const balBuyerAfter = BigInt(await getBalance(buyer.address));
  run.verdicts.buyer_graduate_withdrawn_wei = (balBuyerAfter - balBuyerBefore).toString();
  console.log(`  buyer withdrew ${genStr(run.verdicts.buyer_graduate_withdrawn_wei)} (EOA delta)`);
  // Contradiction witness on the finalized graduate curve.
  await writeTx('v2-09-witness-graduate', buyerAcct, 'record_contradiction_claim',
    ['curve-v2-graduate', buyer.address, 'RUG_SLASHED', 'v0.0.0-fake']);

  // --- Case (b): README-only repo + false manifest -> RUG_SLASHED ---
  const commitB = sha256hex('mochi-salt-v2b|v2-rug-secret');
  await writeTx('v2-10-launch-rug', creatorAcct, 'launch_curve',
    ['curve-v2-rug', 'Rug Demo v2', '$RUG2', creator.address, 'halihalibt/mochicurve-rug-demo', MANIFESTO_RUG, commitB], 25000n * UNIT);
  await writeTx('v2-11-buy-rug', buyerAcct, 'buy_tokens',
    ['curve-v2-rug', 71, buyer.address], buyCostUnits(0, 71, 20, 40, 0) * UNIT);
  await writeTx('v2-12-evaluate-rug', creatorAcct, 'evaluate_graduation_gate',
    ['curve-v2-rug', RUG_P, RUG_B, creator.address]);
  const rbB = JSON.parse(readFileSync('evidence/v2-12-evaluate-rug-readback.json', 'utf8'));
  run.verdicts.rug_pending = curveState(rbB, 'curve-v2-rug').pending_verdict;
  console.log(`  case (b) pending verdict: ${run.verdicts.rug_pending.verdict} sha_match=${run.verdicts.rug_pending.sha_match} count_ok=${run.verdicts.rug_pending.count_ok} code_ok=${run.verdicts.rug_pending.code_ok}`);
  // Challenge blocks execution.
  await writeTx('v2-13-challenge-rug', buyerAcct, 'challenge_pending_verdict',
    ['curve-v2-rug', buyer.address, 'GRADUATE_APPROVED', 'Delivery looks thin but the tag exists; re-check before slashing.']);
  await writeTx('v2-14-execute-blocked', creatorAcct, 'execute_verdict',
    ['curve-v2-rug', creator.address], 0n, false);
  run.verdicts.execute_blocked_error = run.done['v2-14-execute-blocked'].error;
  // Re-evaluation supersedes the challenge; execution then succeeds.
  await writeTx('v2-15-reevaluate-rug', creatorAcct, 'evaluate_graduation_gate',
    ['curve-v2-rug', RUG_P, RUG_B, creator.address]);
  await writeTx('v2-16-execute-rug', creatorAcct, 'execute_verdict',
    ['curve-v2-rug', creator.address]);
  const rbB2 = JSON.parse(readFileSync('evidence/v2-16-execute-rug-readback.json', 'utf8'));
  run.verdicts.rug_final = curveState(rbB2, 'curve-v2-rug').gate_status;
  console.log(`  case (b) final verdict: ${run.verdicts.rug_final}`);
  // Buyer sells everything: floor bonus comes from the slashed real GEN.
  await writeTx('v2-17-sell-rug', buyerAcct, 'sell_tokens', ['curve-v2-rug', 71, buyer.address]);
  const balBuyerBefore2 = BigInt(await getBalance(buyer.address));
  await writeTx('v2-18-withdraw-buyer-rug', buyerAcct, 'withdraw', []);
  const balBuyerAfter2 = BigInt(await getBalance(buyer.address));
  run.verdicts.buyer_rug_withdrawn_wei = (balBuyerAfter2 - balBuyerBefore2).toString();
  console.log(`  buyer withdrew ${genStr(run.verdicts.buyer_rug_withdrawn_wei)} after rug (EOA delta)`);

  // --- Case (d): genuine over-delivery -> CATALYST_BOOST attempted ---
  const commitD = sha256hex('mochi-salt-v2d|v2-boost-secret');
  await writeTx('v2-19-launch-boost', creatorAcct, 'launch_curve',
    ['curve-v2-boost', 'Mochi Boost v2', '$MBST', creator.address, 'halihalibt/mochicurve-genlayer', MANIFESTO_BOOST, commitD], 25000n * UNIT);
  await writeTx('v2-20-buy-boost', buyerAcct, 'buy_tokens',
    ['curve-v2-boost', 71, buyer.address], buyCostUnits(0, 71, 20, 40, 0) * UNIT);
  await writeTx('v2-21-evaluate-boost', creatorAcct, 'evaluate_graduation_gate',
    ['curve-v2-boost', BOOST_P, BOOST_B, creator.address]);
  const rbD = JSON.parse(readFileSync('evidence/v2-21-evaluate-boost-readback.json', 'utf8'));
  run.verdicts.boost_pending = curveState(rbD, 'curve-v2-boost').pending_verdict;
  console.log(`  case (d) pending verdict: ${run.verdicts.boost_pending.verdict} scores=${run.verdicts.boost_pending.completeness_score}/${run.verdicts.boost_pending.authenticity_score}/${run.verdicts.boost_pending.overdelivery_bonus}`);
  await writeTx('v2-22-execute-boost', creatorAcct, 'execute_verdict',
    ['curve-v2-boost', creator.address]);
  const rbD2 = JSON.parse(readFileSync('evidence/v2-22-execute-boost-readback.json', 'utf8'));
  run.verdicts.boost_final = curveState(rbD2, 'curve-v2-boost').gate_status;
  console.log(`  case (d) final verdict: ${run.verdicts.boost_final}`);
  const balCreatorBefore2 = BigInt(await getBalance(creator.address));
  await writeTx('v2-23-withdraw-creator-boost', creatorAcct, 'withdraw', []);
  const balCreatorAfter2 = BigInt(await getBalance(creator.address));
  run.verdicts.creator_boost_withdrawn_wei = (balCreatorAfter2 - balCreatorBefore2).toString();
  console.log(`  creator withdrew ${genStr(run.verdicts.creator_boost_withdrawn_wei)} after boost (EOA delta)`);

  // --- Final reconciliation: GEN conservation ---
  const eoaCreator = BigInt(await getBalance(creator.address));
  const eoaBuyer = BigInt(await getBalance(buyer.address));
  const eoaStranger = BigInt(await getBalance(stranger.address));
  const contractBal = BigInt(await getBalance(ADDRESS));
  const totals = JSON.parse(await reader.readContract({ address: ADDRESS, functionName: 'get_ledger_totals', args: [], transactionHashVariant: 'latest-final' }));
  const total = eoaCreator + eoaBuyer + eoaStranger + contractBal;
  const expectedTotal = 3n * BigInt(FUND_GEN) * GEN;
  const receivedWei = BigInt(totals.total_received_units) * UNIT;
  const withdrawnWei = BigInt(totals.total_withdrawn_units) * UNIT;
  const reconciliation = {
    eoa_creator_wei: eoaCreator.toString(), eoa_buyer_wei: eoaBuyer.toString(),
    eoa_stranger_wei: eoaStranger.toString(), contract_balance_wei: contractBal.toString(),
    sum_wei: total.toString(), expected_sum_wei: expectedTotal.toString(),
    conservation_holds: total === expectedTotal,
    ledger_received_wei: receivedWei.toString(), ledger_withdrawn_wei: withdrawnWei.toString(),
    contract_equals_received_minus_withdrawn: contractBal === (receivedWei - withdrawnWei),
  };
  console.log('RECONCILIATION', json(reconciliation));
  if (!reconciliation.conservation_holds) throw new Error('GEN conservation FAILED');
  if (!reconciliation.contract_equals_received_minus_withdrawn) throw new Error('Contract balance != received - withdrawn');
  run.reconciliation = reconciliation;

  // --- Write the v2 live-verification index ---
  const index = {
    network: 'Stable Studionet', chain_id: 61999, contract_address: ADDRESS, origin: 'user_created',
    money: 'Real testnet GEN (faucet-funded). 1 unit = 0.001 GEN. No simulated ledger.',
    transactions: Object.values(run.done).map((r) => ({
      label: r.label, functionName: r.functionName, tx_hash: r.tx_hash, status: r.status,
      execution_result: r.execution_result, error: r.error, value_wei: r.value_wei,
      receipt: r.receipt, readback: r.readback, observations: r.observations,
      readback_variant: 'latest-final', readback_captured_at: r.readback_captured_at,
    })),
    verdicts: run.verdicts,
    reconciliation,
    readback_scope: 'Readbacks were captured from latest-final after the referenced transaction finalized; they can include later finalized transactions. The exact per-transaction return and lifecycle are retained in each raw receipt.',
  };
  writeFileSync('evidence/live-verification.json', json(index) + '\n');
  saveRun();
  console.log('DONE. Verdicts:', json(run.verdicts));
}

await main();
