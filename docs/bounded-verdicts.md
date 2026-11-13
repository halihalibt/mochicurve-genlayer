# Bounded verdict resolution

MochiCurve v3 keeps the integer market, real Studionet GEN accounting, API anchors and independent leader/validator comparison. Only the pending-verdict lifecycle changes. It requires a new contract deployment; the v2 address is historical evidence only.

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
npm run build
python3 scripts/deploy_studionet.py --dry-validate
```

26 local mock tests pass; these are not real consensus results. Tests 07 and 19–26 cover permissionless review, unchanged deadlines, Sybil repetition, exact expiry boundary, an absent creator, external fetch failure, unchanged state after failure, malicious evidence-path replacement, one-time execution, reward attribution, and invalid challenges. Existing SHA, reserve, payable, withdrawal, API anchor, boost, witness and conservation cases also pass with execution advanced to the deadline.

Logs: [tests](../evidence/v3/local-tests.txt), [build](../evidence/v3/build.txt), [read-only network/schema validation](../evidence/v3/dry-validate.txt), [validation metadata](../evidence/v3/validation.json).

The first local run passed 22/23 tests; the remaining case expected `FINALIZED_VERDICT_IMMUTABLE` but received `EVALUATOR_NOT_CREATOR`. Moving the immutable-state check before evaluator-role checking corrected the error precedence. The final expanded suite passes 26/26. No prior live failure receipts were deleted.

An optional browser rehearsal check is in `tests/browser_rehearsal.cjs`, against `node scripts/serve.mjs --port 4173`. It requires Playwright and Chromium. Browser execution in this environment failed before opening a page: Chromium singleton socket creation was denied (`Operation not permitted`). The attempted run is retained in [browser-attempt.txt](../evidence/v3/browser-attempt.txt). No browser interaction or visual pass is claimed.

## Deployment and real validation

The source changes storage fields and lifecycle semantics; v2 cannot serve as v3 evidence. The frontend deployment address is empty until a new finalized successful deployment and empty-state readback are recorded. Old balances and positions remain at v2; no migration is attempted. The deploy runner writes v3 receipts into `evidence/v3/` and uses a separate public checkpoint, preserving previous evidence. The old v2 business runner refuses execution against the new lifecycle.

Before any signing, inspect the source SHA-256 and network in `evidence/v3/deployment-plan.json`. No private key or signature is included. The existing signed SDK deployment path is retained; no deployment command was executed during local validation.

Required real scenarios after signing approval:

1. Deploy this source on Stable Studionet 61999. Retain FINALIZED + SUCCESS receipt, exact source hash and empty `latest-final` readback.
2. Creator launches a new curve with 25 GEN collateral; buyer buys 71 units (104.284 GEN including fee). Creator evaluates to a deterministic adverse pending verdict. Record `verdict_deadline` and all finalized readbacks.
3. Buyer challenges. A second address attempts another challenge and execution before the deadline; retain expected failed receipts and unchanged state.
4. Without creator participation, after the actual 24-hour deadline, a third party executes the adverse verdict. Require FINALIZED + SUCCESS and read back `RUG_SLASHED`, 27,044-unit holder pool, zero collateral/escrow, no executor reward, cleared pending verdict and archived challenge.
5. On a separate curve, exercise third-party review using original URLs, verify unchanged deadline, reject repeat review/challenge, execute once after expiry, then reject double execution. Verify reserve/credits and GEN conservation, including successful graduate and boost regressions.
6. Configure the new address, rebuild the frontend, and verify desktop/mobile browser interaction before publishing updated evidence links.

Current validation stops before deployment signing. There are no v3 live receipts and no claim that v3 is ready for resubmission.
