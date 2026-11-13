# Bounded verdict resolution

MochiCurve v3 keeps the integer market, real Studionet GEN accounting, API anchors and independent leader/validator comparison. Only the pending-verdict lifecycle changes. It has a separate v3 deployment; the v2 address is historical evidence only.

## State transitions

| Action | Permission and bound | Result |
| --- | --- | --- |
| Initial evaluation | Creator; cumulative net buys >= 100 GEN | Store consensus verdict, original evidence URLs and transaction timestamp + 86,400 seconds |
| Challenge | Non-creator; contradictory verdict; reason <= 2,000 characters; before deadline; once per curve | Preserve one attributed challenge; no money moves |
| Review | Any sender; open challenge; before deadline; one successful review; exact original URLs | Independently fetch and adjudicate again; preserve challenge and record reviewed verdict; deadline unchanged |
| Failed review | Fetch or consensus failure | No state change; expiry execution remains available |
| Execute | Any sender; transaction timestamp >= deadline | Apply latest successful verdict exactly once; archive REVIEWED/EXPIRED challenge; clear pending state |

The cap is per curve, not per address or evaluation round, so changing challenger identities cannot bypass it. Re-evaluation without a challenge is rejected. A challenge never supplies an authoritative verdict. If no review completes, expiry executes the original consensus verdict. The creator cannot avoid a pending slash by refusing to review or execute. Creator rewards always go to the creator, never to the executor. No external request occurs in `execute_verdict`.

The first valid challenge consumes the single slot. This intentionally bounds dispute handling and can prevent a later independent challenge; it does not stop execution. Manifest contents may change at a fixed URL; immutable commit URLs are preferable. Before the first evaluation the creator can still be inactive. At least one actor must submit the expiry execution transaction; this is not an automatic scheduler.

Time uses `gl.message_raw["datetime"]`, the GenVM consensus transaction context. Missing context fails closed. Browser time only enables the advisory button; the contract enforces its own timestamp. See [GenLayer transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context). Remote schema validation is not a runtime proof of time semantics.

## Automated verification

```sh
npm ci
npm test
node --test tests/frontend.test.mjs tests/finality.test.mjs
npm run build
python3 scripts/deploy_studionet.py --dry-validate
```

26 local mock tests pass; these are not real consensus results. Tests 07 and 19–26 cover permissionless review, unchanged deadlines, Sybil repetition, exact expiry boundary, an absent creator, external fetch failure, unchanged state after failure, malicious evidence-path replacement, one-time execution, reward attribution, and invalid challenges. Existing SHA, reserve, payable, withdrawal, API anchor, boost, witness and conservation cases also pass with execution advanced to the deadline.

Logs: [tests](../evidence/v3/local-tests.txt), [build](../evidence/v3/build.txt), [read-only network/schema validation](../evidence/v3/dry-validate.txt), [validation metadata](../evidence/v3/validation.json).

The first local run passed 22/23 tests; the remaining case expected `FINALIZED_VERDICT_IMMUTABLE` but received `EVALUATOR_NOT_CREATOR`. Moving the immutable-state check before evaluator-role checking corrected the error precedence. The final expanded suite passes 26/26. No prior live failure receipts were deleted.

An optional browser rehearsal check is in `tests/browser_rehearsal.cjs`, against `node scripts/serve.mjs --port 4173`. It requires Playwright and Chromium. Browser execution in this environment failed before opening a page: Chromium singleton socket creation was denied (`Operation not permitted`). The attempted run is retained in [browser-attempt.txt](../evidence/v3/browser-attempt.txt). The automated local browser check remains blocked. A separate remote browser rehearsal subsequently verified launch, buy, pending verdict, third-party challenge and review, unchanged deadline and bilingual controls; see [browser-rehearsal.json](../evidence/v3/browser-rehearsal.json). This does not establish real browser writes or mobile rendering.

## Deployment and real validation

The source changes storage fields and lifecycle semantics; v2 cannot serve as v3 evidence. The frontend targets the finalized v3 deployment recorded in `evidence/v3/deployment-manifest.json`. Old balances and positions remain at v2; no migration is attempted. The deploy runner writes v3 receipts into `evidence/v3/` and uses a separate public checkpoint, preserving previous evidence. The old v2 business runner refuses execution against the new lifecycle.

`evidence/v3/deployment-plan.json` records the exact source SHA-256 and network and links the successful deployment receipt. No private key is included.

Real validation scenarios:

1. Deploy this source on Stable Studionet 61999. Retain FINALIZED + SUCCESS receipt, exact source hash and empty `latest-final` readback.
2. Creator launches a new curve with 25 GEN collateral; buyer buys 71 units (104.284 GEN including fee). Creator evaluates to a deterministic adverse pending verdict. Record `verdict_deadline` and all finalized readbacks.
3. Buyer challenges. A second address attempts another challenge and execution before the deadline; retain expected failed receipts and unchanged state.
4. Without creator participation, after the actual 24-hour deadline, a third party executes the adverse verdict. Require FINALIZED + SUCCESS and read back `RUG_SLASHED`, 27,044-unit holder pool, zero collateral/escrow, no executor reward, cleared pending verdict and archived challenge.
5. On a separate curve, exercise third-party review using original URLs, verify unchanged deadline, reject repeat review/challenge, execute once after expiry, then reject double execution. Verify reserve/credits and GEN conservation, including successful graduate and boost regressions.
6. Configure the new address, rebuild the frontend, and verify desktop/mobile browser interaction before publishing updated evidence links.

The v3 deployment is FINALIZED with SUCCESS. Real business transactions are recorded in `evidence/v3/live-verification.json`; the 24-hour expiry scenarios remain in progress.

`node scripts/verify-v3.mjs prepare` records the pre-expiry transactions. `node scripts/verify-v3.mjs status` only reads finalized state. `node scripts/verify-v3.mjs finish` refuses to send any transaction before the actual latest deadline plus a one-minute safety margin. It records permissionless execution, repeat-execution rejection, redemption, withdrawals and GEN conservation. Public hashes are checkpointed before broadcast; uncertain broadcasts are resumed rather than resent. Fresh faucet-funded test account credentials stay in the ignored private local checkpoint, never in published evidence.

## Public browser reads

A remote browser loaded the v3-targeted frontend at commit `8e8e506` and read the real finalized `v3-rug-expiry` and `v3-rug-review` curves, pending slashes, original evidence URLs and UTC deadlines. It displayed LIVE_STUDIONET_61999 and disabled execution before expiry. The check exposed an invalid `eth_getBalance` request for the pre-connection demo address. Balance requests now require a valid 20-byte hexadecimal address; two automated frontend tests cover public reads without a wallet and connected-wallet balance reads. The earlier failed browser launch log remains retained.

## Receipt classification

The first local classification of transaction `0x3bd0164f9027435dd7766be299e8139b95a1e4634f808cc0346e3f8d9b1407fb` reported ERROR because `leader_receipt` also contained a validator cancelled after quorum. The raw receipt is preserved: FINALIZED, MAJORITY_AGREE, mode=leader execution SUCCESS, and the finalized readback contains GRADUATE_APPROVED pending state. Success checking now requires FINALIZED, MAJORITY_AGREE, and exactly one mode=leader receipt with SUCCESS. Missing consensus, missing/ambiguous leaders and actual contract errors fail closed. Cancelled validator entries are retained as voting history and do not replace the leader result. Tests use these real receipts and adversarial malformed variants; recovery rechecks the existing transaction hash, never re-evaluates merely to change its classification.

## Finalized pre-expiry evidence

All 21 pre-expiry transactions have finalized with MAJORITY_AGREE: 15 successful operations and 6 expected contract rejections. Each expected rejection preserved the curves, ledger totals and contract balance compared with the preceding finalized readback. [Pre-expiry checks](../evidence/v3/pre-expiry-checks.json) records the actual pending results and deadlines. Both rug cases are RUG_SLASHED, ordinary delivery is GRADUATE_APPROVED, and over-delivery is CATALYST_BOOST. These are pending contract verdicts, not executed payouts. The last real deadline is 2026-11-14 09:38:56 UTC; expiry execution, redemption, withdrawal and final conservation remain unverified until then.
