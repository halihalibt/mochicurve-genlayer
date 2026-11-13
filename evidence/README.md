# Historical MochiCurve v2 evidence

These receipts describe the deployed v2 contract. They do not verify the current v3 bounded-verdict source. New local validation is in `v3/`; no v3 deployment or business transaction has been sent.

All amounts are real Studionet GEN. 1 accounting unit = 0.001 GEN. Buys and launches attach GEN; sells, rewards and slashes become withdrawable credits pulled with `withdraw`. No simulated ledger remains.

- **Contract:** [0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742](https://explorer-studio.genlayer.com/address/0xf3C716d9ff7FB529cd08e2fD15413E75Ebc1B742)
- **Deployment tx:** [0x5dbcd6a288efc2d7a72a5d159860d5588cca3f28c0290912f0de80f77e311cc3](https://explorer-studio.genlayer.com/tx/0x5dbcd6a288efc2d7a72a5d159860d5588cca3f28c0290912f0de80f77e311cc3), `FINALIZED`, `SUCCESS`. Source SHA-256 `e46c1b914df184eaec2f7a92498c45c434a0bd14a6ae58bca3d52332444eec69` belongs to the deployed v2 source (see `deployment-manifest.json`).
- **Live verification index:** [live-verification.json](live-verification.json) — 23 transactions, verdicts, and the GEN conservation reconciliation.
- **Local mock tests:** [local-tests.txt](local-tests.txt) — 18 tests, all passing. Local mocks only; not consensus evidence.

## Cases (three faucet-funded accounts × 10,000 GEN: creator, buyer, stranger)

| Case | Curve | Result |
| --- | --- | --- |
| (c) Stranger evaluates | `curve-v2-graduate` | Reverted (`contract_error exit_code 1`); only the creator can evaluate. |
| (a) Honest delivery | `curve-v2-graduate` | `GRADUATE_APPROVED`, scores 85 / 90 / 0; API commits 3, 12 code files, 806,935 bytes, all anchors true. Creator withdrew 27.044 GEN. Buyer sold 31, withdrew 69.44 GEN. Reserve 32,800; one contradiction witness recorded. |
| (b) README-only repo + false manifest | `curve-v2-rug` | `RUG_SLASHED`, scores 0 / 0 / 0; `sha_match=false`, `count_ok=false`, `code_ok=false`, 0 code files, API commits 1 vs manifest claim 12. A challenge blocked execution; re-evaluation cleared it; execution slashed. Buyer sold all 71 and withdrew 129.284 GEN (102.240 reserve + 27.044 floor). |
| (d) Genuine over-delivery | `curve-v2-boost` | `CATALYST_BOOST`, scores 88 / 92 / 78; slope k 40 → 50, virtual offset 25,205, spot 3,570. Creator withdrew 27.044 GEN. No protocol subsidy exists in v2. |

## Reconciliation

EOA balances + contract balance sum to exactly 30,000 GEN (3 × 10,000 faucet GEN). Contract balance 135.04 GEN equals received 387.852 GEN minus withdrawn 252.812 GEN.

## Notes on the run

- The first evidence run crashed on a transient Studionet RPC failure (the gateway returned an HTML error page) after `v2-15-reevaluate-rug` had already finalized on-chain. That transaction was recorded from its live finalized receipt and readback before the run resumed at `v2-16`; no transaction was re-sent. See `notes` in `live-verification.json`.
- The v1 contract (`0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632`) is superseded. Its evidence is archived under [v1/](v1/).
