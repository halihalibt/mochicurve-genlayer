# MochiCurve

[Application](https://halihalibt.github.io/mochicurve-genlayer/)

An integer bonding curve market whose delivery verdict changes creator rewards, curve slope and holder redemption pools. Runs exclusively on **GenLayer Stable Studionet**, chain **61999**, RPC `https://studio.genlayer.com/api`.

All mGEN are nominal contract accounting units. No real cryptocurrency is transferred.

## Deployed contract and evidence

- Contract: [0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632](https://explorer-studio.genlayer.com/address/0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632).
- Deployment: [0x8f4847b845bca91011588a3b5b4ffab21a469c892889cd08cc61c8f23809d67c](https://explorer-studio.genlayer.com/tx/0x8f4847b845bca91011588a3b5b4ffab21a469c892889cd08cc61c8f23809d67c), `FINALIZED`, `SUCCESS`.
- [Evidence index](evidence.json), [business receipts and finalized readbacks](evidence/live-verification.json).
- `curve-live-release`: live `GRADUATE_APPROVED`, scores 72 / 88 / 18; creator reward 27,044 mGEN. After selling 31 tokens, reserve is 32,800 while cumulative net buys remain 102,240. A contradiction witness preserves that audit.
- `curve-live-missing-tag`: live `RUG_SLASHED` for a deliberately absent tag; 27,044 mGEN moved into the holder pool. Full redemption returned 102,240 reserve plus 27,044 floor bonus, leaving zero supply and no position entry.

The raw audit receipts retain majority voting, including disagreement and idle votes. Successful consensus is not a claim of unanimous voting. BOOST arithmetic is covered by the separate local mock suite.

## Market and graduation

A creator locks 25,000 mGEN and a SHA-256 catalyst commitment. Buying adds the reserve integral difference to `cumulative_buy_volume` and charges a separate 2% fee. **Cumulative net buys of 100,000 mGEN** permanently unlock the graduation gate. Selling reduces supply and reserves, but never reduces cumulative buy volume or relocks the gate.

The three constructor curves carry `origin: "seed_demo"`. Their prefilled verdicts, scores and witnesses are **Seed demo data — not consensus evidence**. Only newly created curves with their own successful finalized audit receipts qualify as consensus evidence.

| Verdict | Enforced consequence |
| --- | --- |
| `GRADUATE_APPROVED` | Return creator collateral and fee escrow to the creator. |
| `CATALYST_BOOST` | Increase slope by 25%, preserve the reserve integral using a virtual offset, release creator rewards and add 15,000 nominal mGEN to the holder pool. |
| `RUG_SLASHED` | Transfer 100% of creator collateral and fee escrow into the holder pool; disable further buying. |

Supply `S`, base price `B` and slope `k` use integer arithmetic:

- Reserve: `max(0, B*S + (k*S*S)//2 - virtual_slope_offset)`.
- Marginal price: `B + k*S`.
- Sell payout: reserve difference plus `floor_pool * amount // supply_before`.

## Independent consensus

Each validator independently fetches the primary GitHub Raw manifest and its jsDelivr mirror. Either mirror can supply the canonical payload; if both succeed, their canonical hashes must agree. If both fail or disagree, execution aborts before state changes.

Every validator then checks the exact claimed tag through the GitHub Git References API (`/repos/{owner}/{repo}/git/ref/tags/{tag}`). A missing tag, repository mismatch, unpublished manifest or self-reported commit count below two deterministically causes `RUG_SLASHED`, without calling an LLM. Network errors, rate limits and invalid API responses abort before writes and leave the gate retryable.

Only after those checks pass does each validator independently assess semantic completeness, consistency and over-delivery. LLM scores cannot override a deterministic slash. Validators require identical evidence hashes, tag existence and verdict; score differences of at most 20 are accepted within that same verdict. Scores and source metadata travel in the returned consensus payload, never through mutable closure side effects.

`commit_count` remains manifest self-reporting. Tag existence is independently checked; binaries and commit history are not independently executed or verified.

Finalized verdicts cannot be replaced. A contradictory claim appends a caller-attributed witness while retaining the active verdict. Launch, buy, sell and witness attribution are checked against `gl.message.sender_address`.

## Wallets and browser session

Public finalized state can be read without connecting a wallet. Injected EVM providers, including OKX, can connect for account and balance reads. Writes require explicitly enabling the labeled temporary test account. GenLayerJS derives its address from a real signing key held only in browser memory. This is a separate account, never a signature from the connected wallet. Closing the session discards signing access; refreshing cannot restore that account's positions.

A public pending transaction hash is retained for finality tracking after refresh. The application waits for `FINALIZED`, checks successful execution, and reads `latest-final` before reporting success. A temporary read failure retries the same read without sending a new transaction.

Catalyst commitments store only `SHA-256(salt + "|" + secret)`. Salt and secret remain in the browser until reveal. The contract recomputes the hash before any reveal state write. Losing the salt makes reveal impossible; hashes do not encrypt short predictable secrets.

## Run and verify

```bash
npm ci
python3 -m unittest tests/test_mochi_curve.py -v
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
