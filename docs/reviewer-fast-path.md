# MochiCurve v3 — reviewer fast path

**Live application:** https://halihalibt.github.io/mochicurve-genlayer/  
**Network:** GenLayer Stable Studionet (Chain ID 61999)  
**Current protocol:** v3 bounded challenge resolution

## Current deployment

- **Contract:** [0x47767c833bC218e193177bC39F79235CCA639200](https://explorer-studio.genlayer.com/address/0x47767c833bC218e193177bC39F79235CCA639200)
- **Deployment transaction:** [0xa1505183d0dc3943cd867a773dabf6c5658eefee3ac53071dacf9a83b0986d45](https://explorer-studio.genlayer.com/tx/0xa1505183d0dc3943cd867a773dabf6c5658eefee3ac53071dacf9a83b0986d45) — FINALIZED / MAJORITY_AGREE / leader SUCCESS
- **Deployed source SHA-256:** `9e47037e0e388789baea4ba432ae41cd7678952d6e42fe6db7c3c9d600e33482`
- **Source:** [contracts/mochi_curve.py](../contracts/mochi_curve.py); [deployment manifest](../evidence/v3/deployment-manifest.json); [deployment receipt](../evidence/v3/deployment-receipt.json)
- **Full business evidence:** [v3 live-verification index](../evidence/v3/live-verification.json) and its individual original receipts / `latest-final` readbacks in [evidence/v3](../evidence/v3/)
- **Mechanism and edge cases:** [bounded-verdict specification](bounded-verdicts.md); [26 contract mock tests](../evidence/v3/local-tests.txt); [validation summary](../evidence/v3/validation.json)

## Review the bounded verdict lifecycle

1. Check the current contract source and deployment manifest's SHA-256. Verify the deployment receipt is FINALIZED with MAJORITY_AGREE and successful leader execution. The frontend targets this same v3 address.
2. Read `evidence/v3/live-verification.json`: phase `FINALIZED_VERIFIED`, 39 recorded FINALIZED / MAJORITY_AGREE transactions, comprising **29 successful executions and 10 expected contract rejections**. Expected-error receipts are not successful business operations.
3. Inspect **`v3-rug-expiry`**: the initial `RUG_SLASHED` verdict stays pending during the fixed 86,400-second challenge window. A buyer's first challenge succeeds; a different address is rejected with `CHALLENGE_LIMIT_REACHED`. Premature execution fails with `VERDICT_WINDOW_OPEN`. After actual expiry, a third party executes the adverse verdict without the creator, and repeated execution fails with `NO_PENDING_VERDICT`. The challenge is archived as `EXPIRED`.
4. Inspect **`v3-rug-review`**: a third party reviews the open challenge using the original evidence URLs. The original deadline is unchanged; changing the evidence paths and repeating review are rejected. After expiry a third party executes the reviewed adverse verdict; the challenge is archived as `REVIEWED`.
5. Inspect **`v3-graduate`** and **`v3-boost`**: both successful verdicts are executed by the independent third party after the same deadline rule. Creator rewards remain credited to the creator, not to the executor; duplicate executions are rejected.
6. For all four cases, compare each transaction receipt with its `latest-final` readback. Confirm executed status, cleared pending verdict, zero remaining collateral and fee escrow, and the recorded redemption / withdrawal paths. The final `v3-boost-24-withdraw-creator-readback.json` shows contract balance zero and total received equal to total withdrawn. The run reconciles all three faucet-funded EOAs plus the contract to **30,000 test GEN**.

The first evaluation is still creator-only; **review during an open challenge** and **execution after the fixed deadline** are permissionless. The challenge limit is per curve, not per wallet, and review cannot reset the deadline. No automatic transaction scheduler is claimed. The pending verdict is not itself a payout. Missing consensus or failed execution does not count as a completed verdict.

## Validation and limitations

The [latest successful CI workflow](https://github.com/halihalibt/mochicurve-genlayer/actions/runs/43583435470) ran `npm test` (26 contract mocks), six frontend/receipt tests, `npm run build`, and an isolated desktop/mobile browser rehearsal. The browser test uses a synthetic clock and is **not** live on-chain expiry evidence. The 39 v3 receipts and finalized reads were gathered separately with actual elapsed time, not timestamp overrides. Review [KNOWN_LIMITATIONS.md](../KNOWN_LIMITATIONS.md) for third-party execution, mutable URLs, session-only test keys, and consensus limitations.

## Historical deployments (not v3 proof)

- **v2:** [0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742](https://explorer-studio.genlayer.com/address/0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742), [23 historical transactions](../evidence/live-verification.json) and [historical evidence notes](../evidence/README.md). v2 restricted verdict execution to the creator and must not be used to establish this v3 fix.
- **v1:** historical source, receipts and limitations in [evidence/v1](../evidence/v1/).

There is no migration of v2 positions or GEN into v3.
