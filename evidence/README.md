# Live verification evidence

The deployment and ten business transactions target Stable Studionet (61999). Receipts contain finality, successful execution, consensus votes, per-node results and protocol monitoring timestamps. `consensus_history` records the transition from PENDING through finality.

`live-verification.json` maps each transaction to its receipt and `get_all_curves` readback. Readbacks use `latest-final` and can contain later transactions; exact transaction outputs remain in the raw receipts. This distinction prevents treating a later aggregate snapshot as a historical read at the transaction boundary.

`curve-live-release` and `curve-live-missing-tag` have `origin: "user_created"`. Prefilled seed verdicts and witnesses are excluded from verification claims. The missing-tag JSON is a clearly labeled negative fixture, while its audit and redemption receipts are real network results.

The approved audit was invoked through the browser test account. The missing-tag audit was invoked through the signed SDK script using a separate ephemeral account. Full floor redemption was signed in the deployed Pages application by the position holder. Signing keys are absent from this evidence.

`local-tests.txt` reports local mocks only. It covers BOOST math, rollback under external failure, independent validator disagreement and identity checks separately from live network evidence.
