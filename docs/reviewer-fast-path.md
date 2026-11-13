# Current source and historical deployment

The current v3 deployment is finalized successfully; real business validation is in progress. See [bounded verdicts](bounded-verdicts.md). The application targets the v3 address in `evidence/v3/deployment-manifest.json`. The following instructions describe historical v2 evidence only.

# Reviewer fast path

1. Start with [the evidence index](../evidence.json). Read the deployment manifest and match its source SHA-256 against `contracts/mochi_curve.py`.
2. Open the deployment transaction in `https://explorer-studio.genlayer.com/tx/<tx_hash>`. Confirm `FINALIZED` and `SUCCESS`; finality alone is insufficient.
3. Inspect the receipt and finalized readback for each business transaction in [live-verification.json](../evidence/live-verification.json). Use a `user_created` curve, not a `seed_demo` rehearsal placeholder (the v2 constructor starts empty).
4. On the application, select **curve-v2-graduate** to inspect a real approved audit, **curve-v2-rug** to inspect the deterministic missing-code slash with its challenge window, or **curve-v2-boost** to inspect a real catalyst boost (slope k 40 → 50).
5. To reproduce the flow, enable the explicitly labeled temporary test account, create a curve with a real GitHub repository and a browser-computed commitment, and buy enough tokens to cross cumulative net buys of 100 GEN. With the default curve, 71 tokens cost 102.240 GEN plus a separate 2% fee (104.284 GEN total attached).
6. Audit the matching Raw and jsDelivr manifest paths, then the GitHub API anchors: the tag commit SHA, the commit count, and the repository tree at that commit. A stranger calling evaluate reverts; evaluation writes only a pending verdict, and execution is a separate creator-only step that refuses while a challenge is open. API failure leaves state unchanged and retryable.
7. Sell tokens to inspect reserve and holder-pool payouts, then withdraw the pull-payment credit and check the EOA balance delta. Append a conflicting witness and verify that the previous audit remains unchanged.
8. Run the local mock suite separately. Its results demonstrate implementation properties, not live consensus.
