"""Stable Studionet deployment through the signed GenLayerJS SDK transport."""
import argparse
import ast
from pathlib import Path
import subprocess

RPC = "https://studio.genlayer.com/api"
ROOT = Path(__file__).resolve().parent.parent


def validate_parameters(rpc, chain_id, gas):
    if rpc.rstrip("/") != RPC:
        raise SystemExit("Forbidden RPC: only Stable Studionet is allowed")
    if chain_id != 61999:
        raise SystemExit("Forbidden chain ID: expected 61999")
    if gas != 0:
        raise SystemExit("Nonzero gas setting blocked")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rpc", default=RPC)
    parser.add_argument("--chain-id", type=int, default=61999)
    parser.add_argument("--gas", type=int, default=0)
    parser.add_argument("--dry-validate", action="store_true")
    parser.add_argument("--tx-hash", default="")
    args = parser.parse_args()
    # Always validate local parameters before the dry-mode branch or any request.
    validate_parameters(args.rpc, args.chain_id, args.gas)
    ast.parse((ROOT / "contracts/mochi_curve.py").read_text())
    command = "validate" if args.dry_validate else "resume" if args.tx_hash else "deploy"
    child = ["node", "scripts/studionet.mjs", command]
    if args.tx_hash:
        child.append(args.tx_hash)
    raise SystemExit(subprocess.call(child, cwd=ROOT))


if __name__ == "__main__":
    main()
