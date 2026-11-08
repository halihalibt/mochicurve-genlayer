# Reviewer fast path

1. Read the deployment manifest and match its source SHA-256 against `contracts/mochi_curve.py`.
2. Open the deployment transaction in `https://explorer-studio.genlayer.com/tx/<tx_hash>`. Confirm `FINALIZED` and `SUCCESS`; finality alone is insufficient.
3. Inspect the receipt and finalized readback for each business transaction. Use a `user_created` curve, not one of the three `seed_demo` placeholders.
4. On the application, enable the explicitly labeled temporary test account, create a curve with a real GitHub repository and a browser-computed commitment, and buy enough tokens to cross cumulative net buys of 100,000 mGEN. With the default curve, 71 tokens cost 102,240 mGEN plus a separate 2% fee.
5. Audit the matching Raw and jsDelivr manifest paths. Inspect the exact GitHub tag API link, canonical evidence hash and score-bearing finalized audit. API failure leaves state unchanged and retryable.
6. Sell tokens to inspect reserve and holder-pool payouts. Append a conflicting witness and verify that the previous audit remains unchanged.
7. Run the local mock suite separately. Its results demonstrate implementation properties, not live consensus.
