# MochiCurve

[Application](https://halihalibt.github.io/mochicurve-genlayer/)

An integer bonding curve market whose delivery verdict changes creator rewards, curve slope and holder redemption pools. Runs exclusively on **GenLayer Stable Studionet**, chain **61999**, RPC `https://studio.genlayer.com/api`.

All money is real testnet GEN (faucet-funded). 1 accounting unit = 0.001 GEN. Launches attach 25 GEN of creator collateral; buys attach GEN; sells, rewards and slashes become withdrawable credits pulled with `withdraw`. There is no simulated ledger and no protocol subsidy.

## v3 source and deployment boundary

The current source adds bounded challenge resolution. It is deployed at [0x47767c833bC218e193177bC39F79235CCA639200](https://explorer-studio.genlayer.com/address/0x47767c833bC218e193177bC39F79235CCA639200) on Stable Studionet, chain 61999. [Deployment transaction](https://explorer-studio.genlayer.com/tx/0xa1505183d0dc3943cd867a773dabf6c5658eefee3ac53071dacf9a83b0986d45) is `FINALIZED` with successful execution; the constructor readback was empty. Source SHA-256: `9e47037e0e388789baea4ba432ae41cd7678952d6e42fe6db7c3c9d600e33482`. The frontend targets this v3 address. Existing v2 funds and positions remain at the old contract; there is no automatic migration.

Real v3 business validation is in progress. The live-verification index records only actual receipts and finalized readbacks. The fixed 24-hour expiry cases have not completed yet; v2 history does not establish v3 expiry behavior.

[Bounded-verdict specification and validation](docs/bounded-verdicts.md). Deployment dry validation writes to `evidence/v3/`; v2 receipts are retained unchanged. GEN used for validation is free faucet-funded testnet currency.

## Historical v2 deployment and evidence

- Contract: [0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742](https://explorer-studio.genlayer.com/address/0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742).
- Deployment: [0x5dbcd6a288efc2d7a72a5d159860d5588cca3f28c0290912f0de80f77e311cc3](https://explorer-studio.genlayer.com/tx/0x5dbcd6a288efc2d7a72a5d159860d5588cca3f28c0290912f0de80f77e311cc3), `FINALIZED`, `SUCCESS`. Source SHA-256 `e46c1b914df184eaec2f7a92498c45c434a0bd14a6ae58bca3d52332444eec69` identifies the deployed v2 source, not the current v3 source.
- [Evidence index](evidence.json), [business receipts and finalized readbacks](evidence/live-verification.json).
- `curve-v2-graduate`: live `GRADUATE_APPROVED`, scores 85 / 90 / 0; creator withdrew 27.044 GEN. After selling 31 tokens, reserve is 32,800 while cumulative net buys remain 102,240. A contradiction witness preserves that audit.
- `curve-v2-rug`: live `RUG_SLASHED` for a README-only repo with a false manifest (API commits 1 vs claimed 12, 0 code files, all anchors false). A challenge blocked execution first; re-evaluation cleared it. Full redemption returned 102.240 reserve plus 27.044 floor bonus, leaving zero supply and no position entry.
- `curve-v2-boost`: live `CATALYST_BOOST`, scores 88 / 92 / 78; slope k 40 → 50 with a virtual offset preserving solvency; creator withdrew 27.044 GEN.
- A stranger calling `evaluate_graduation_gate` reverts (`contract_error exit_code 1`); v2 restricted evaluation and execution to the creator.
- GEN conservation holds exactly: EOA balances + contract balance sum to 30,000 GEN (3 × 10,000 faucet GEN); contract balance 135.04 GEN equals received 387.852 GEN minus withdrawn 252.812 GEN.

The raw audit receipts retain majority voting, including disagreement and idle votes. Successful consensus is not a claim of unanimous voting.

The v1 contract (`0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632`) is superseded; its evidence is archived under `evidence/v1/`.

## Market and graduation

A creator locks 25 GEN and a SHA-256 catalyst commitment. Buying adds the reserve integral difference to `cumulative_buy_volume` and charges a separate 2% fee. **Cumulative net buys of 100 GEN** permanently unlock the graduation gate. Selling reduces supply and reserves, but never reduces cumulative buy volume or relocks the gate.

The v2 constructor starts empty. Local rehearsal seed curves carry `origin: "seed_demo"`. Their prefilled verdicts, scores and witnesses are **Seed demo data — not consensus evidence**. Only newly created curves with their own successful finalized audit receipts qualify as consensus evidence.

| Verdict | Enforced consequence |
| --- | --- |
| `GRADUATE_APPROVED` | Return creator collateral and fee escrow to the creator as a withdrawable credit. |
| `CATALYST_BOOST` | Increase slope by 25%, preserve the reserve integral using a virtual offset, release creator rewards. No subsidy is added. |
| `RUG_SLASHED` | Transfer 100% of creator collateral and fee escrow into the holder pool; disable further buying. |

Supply `S`, base price `B` and slope `k` use integer arithmetic:

- Reserve: `max(0, B*S + (k*S*S)//2 - virtual_slope_offset)`.
- Marginal price: `B + k*S`.
- Sell payout: reserve difference plus `floor_pool * amount // supply_before`.

## Independent consensus

Each validator independently fetches the primary GitHub Raw manifest and its jsDelivr mirror. Either mirror can supply the canonical payload; if both succeed, their canonical hashes must agree. If both fail or disagree, execution aborts before state changes.

The manifest is only a pointer. Validators then anchor it against the GitHub API: the tag's commit SHA (annotated tags resolved through the tag object) must match the manifest's `commit_sha`; the commit count is recomputed from the commits API and the manifest count must be within it and at least 2; the repository tree at that SHA must contain at least 3 real code files totalling at least 1000 bytes. `deliverable_digest` is computed from the fetched tree, not the manifest body. A missing tag, repository mismatch, unpublished manifest, SHA mismatch, insufficient commits or too little code deterministically causes `RUG_SLASHED`, without calling an LLM. Network errors, rate limits and invalid API responses abort before writes and leave the gate retryable.

Only after those checks pass does each validator independently assess semantic completeness, consistency and over-delivery against the fetched file tree. LLM scores cannot override a deterministic slash. Validators require identical evidence hashes, tag existence and verdict; score differences of at most 20 are accepted within that same verdict. Scores and source metadata travel in the returned consensus payload, never through mutable closure side effects.

Initial `evaluate_graduation_gate` remains creator-only and writes no money. It fixes a 24-hour deadline using the consensus transaction timestamp (`gl.message_raw["datetime"]`). Each curve permits one contradictory non-creator challenge before that deadline. Anyone may re-run evaluation once on a challenged verdict using the original two evidence URLs. A successful review records its outcome without deleting the challenge or extending the deadline. Unavailable evidence leaves the pending verdict and deadline unchanged.

At or after the deadline, **any authenticated caller** may call `execute_verdict`, including for `RUG_SLASHED`, with or without a completed review. It applies the latest successful consensus verdict; an allegation alone never changes the verdict. Challenges and review requests are rejected at the boundary. Execution archives challenge resolution as `REVIEWED` or `EXPIRED` and clears the pending verdict, preventing double execution. No external fetch or creator cooperation is required for expiry execution.

Finalized verdicts cannot be replaced. A contradictory claim appends a caller-attributed witness while retaining the active verdict. Launch, buy, sell and witness attribution are checked against `gl.message.sender_address`.

## Wallets and browser session

Public finalized state can be read without connecting a wallet. Injected EVM providers, including OKX, can connect for account and balance reads. Writes require explicitly enabling the labeled temporary test account. GenLayerJS derives its address from a real signing key held only in browser memory. This is a separate account, never a signature from the connected wallet. Closing the session discards signing access; refreshing cannot restore that account's positions.

A public pending transaction hash is retained for finality tracking after refresh. The application waits for `FINALIZED`, checks successful execution, and reads `latest-final` before reporting success. A temporary read failure retries the same read without sending a new transaction.

Catalyst commitments store only `SHA-256(salt + "|" + secret)`. Salt and secret remain in the browser until reveal. The contract recomputes the hash before any reveal state write. Losing the salt makes reveal impossible; hashes do not encrypt short predictable secrets.

## Run and verify

```bash
npm ci
python3 -m unittest tests/test_mochi_curve.py -v
node --test tests/frontend.test.mjs tests/finality.test.mjs
npm run build
python3 scripts/deploy_studionet.py --dry-validate
python3 scripts/deploy_studionet.py
python3 scripts/deploy_studionet.py --tx-hash <existing-transaction-hash>
```

The Python tests are **local mock simulations, not on-chain consensus results**. Dry validation rejects wrong RPC, chain and gas parameters, then checks the remote network and contract schema. It sends no deployment transaction.

Deployment uses `genlayer-js` 1.1.8 with an in-memory signing account and `eth_sendRawTransaction`. It records the public broadcast hash before sending and resumes an existing checkpoint rather than redeploying. Gas price must be zero; the SDK estimates a nominal execution limit.

- [Known limitations](KNOWN_LIMITATIONS.md)
- [Reviewer fast path](docs/reviewer-fast-path.md)
- Contract source: [contracts/mochi_curve.py](contracts/mochi_curve.py)
- Evidence: [evidence/](evidence/)

## Evidence format

`evidence/deployment-manifest.json` identifies network, source commit and SHA-256, sender, contract address and deployment transaction. `evidence/deployment-receipt.json` retains the raw finalized transaction. Business verification records pair each transaction receipt with a finalized `get_all_curves` readback. Seed states and local fixtures are excluded from business verification claims.

## Implementation

The persistent MOCHI stage follows scroll from front to side to back using transforms and opacity. Reduced motion holds a static front view. Mobile layout uses touch controls and viewport-safe spacing. The frontend includes English and Chinese presentation; contract values remain English.

GenLayerJS and Viem provide transaction encoding and signing. Their bundled license notices are preserved in `dist/app.js.LEGAL.txt`. MOCHI assets are supplied with the project.
