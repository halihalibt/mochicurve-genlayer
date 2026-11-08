import { sha256, stringToBytes, keccak256 } from "viem";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
// src/config.js
// Centralized Configuration, Exact Contract Seed Mirror, and Studionet RPC / Ephemeral Signer Adapter
// Repository base path and Studionet configuration are centralized below.

export const APP_CONFIG = {
  REPO_NAME: "mochicurve-genlayer",
  BASE_PATH: "/mochicurve-genlayer/",
  CHAIN_ID: 61999,
  CHAIN_ID_HEX: "0xf22f",
  RPC_URL: "https://studio.genlayer.com/api",
  EXPLORER_URL: "https://explorer-studio.genlayer.com",
  // Leave empty ("") until deployed on Studionet; when empty, UI enforces honest Local Rehearsal mode
  // and NEVER fakes a FINALIZED status or fake transaction hash.
  CONTRACT_ADDRESS: "0x0A96f7CB3636Dc46d517CEacb7b6E63b292b2632",
  GRADUATION_BUY_VOLUME_THRESHOLD: 100000,
  DEFAULT_BASE_PRICE: 20,
  DEFAULT_SLOPE_K: 40,
  DEFAULT_CREATOR_COLLATERAL: 25000,
  TRADE_FEE_BPS: 200,
  BPS_SCALE: 10000,
  // Fixed 5-color palette from MOCHI Character Design Specification
  PALETTE: {
    PURPLE: "#C73AF2",
    CYAN: "#22E8F2",
    NAVY: "#122147",
    LAVENDER_WHITE: "#F3F1FA",
    GREY_SILVER: "#B9B7C9"
  },
  // All 9 MOCHI PNG assets (mochi-celebrate-jump.png unified as .png)
  MOCHI_ASSETS: {
    FRONT: "./assets/mochi-front.png",
    SIDE: "./assets/mochi-side.png",
    BACK: "./assets/mochi-back.png",
    FLOAT: "./assets/mochi-float.png",
    POINT: "./assets/mochi-point.png",
    THINKING: "./assets/mochi-thinking.png",
    HAPPY: "./assets/mochi-happy.png",
    CELEBRATE_EXPR: "./assets/mochi-celebrate-expr.png",
    CELEBRATE_JUMP: "./assets/mochi-celebrate-jump.png"
  }
};

// Pure-JS SHA-256 helper matching contracts/mochi_curve.py `pure_sha256_hex`
export async function sha256HexBrowser(message) {
  if (!crypto.subtle) return sha256(stringToBytes(message)).slice(2);
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic integer curve math matching contracts/mochi_curve.py 100%
export function calcCurveIntegralReserve(supply, basePrice, slopeK, virtualOffset) {
  const s = Number(supply);
  const b = Number(basePrice);
  const k = Number(slopeK);
  const vOff = Number(virtualOffset);
  const raw = b * s + Math.floor((k * s * s) / 2);
  return raw > vOff ? raw - vOff : 0;
}

export function calcSpotPrice(supply, basePrice, slopeK) {
  return Number(basePrice) + Number(slopeK) * Number(supply);
}

// Seed Balances & 3 Seed Curves matching `contracts/mochi_curve.py` 100%
export const INITIAL_SEED_STATE = {
  balances: {
    "0x71C...89A1": 250000,
    "0xA4B...33F2": 180000,
    "0x99E...11C0": 150000,
    "0xDEMO_TRADER": 300000
  },
  curves: {
    "curve-mochi-prime": {
      curve_id: "curve-mochi-prime",
      name: "Mochi Prime",
      ticker: "$MPRIME",
      creator: "0x71C...89A1",
      expected_repo_slug: "genlayer-craft/mochi-prime",
      manifesto_text:
        "Deliver verifiable v1.0 release tag, GenVM bonding curve module, and >=5 functional commits in genlayer-craft/mochi-prime.",
      manifesto_hash: "a398346fd271421f00005821c3b0f0f3957f15588b0b6b3662ed51e5014dc42c",
      secret_catalyst_commitment: "615b938c30e0256d0057b9d3751035fd4bb88e59c08691ca67aa4ae700c7f0b9",
      revealed_secret_catalyst: "",
      Supply: 71,
      base_price: 20,
      slope_k: 40,
      virtual_slope_offset: 0,
      curve_reserve: 102240,
      cumulative_buy_volume: 102240,
      origin: "seed_demo",
      graduation_threshold: 100000,
      creator_collateral: 25000,
      protocol_catalyst_pool: 15000,
      fee_escrow_pool: 2044,
      redemption_floor_pool: 0,
      floor_multiplier_bps: 10000,
      spot_price: 2860,
      gate_status: "GATE_UNLOCKED",
      mochi_state: "mochi-float.png",
      positions: { "0x71C...89A1": 31, "0xA4B...33F2": 40 },
      last_audit: null,
      contradiction_witnesses: []
    },
    "curve-cyber-paw": {
      curve_id: "curve-cyber-paw",
      name: "Cyber Paw AI",
      ticker: "$CPAW",
      creator: "0xA4B...33F2",
      expected_repo_slug: "genlayer-craft/cyber-paw",
      manifesto_text:
        "Ship autonomous liquidity sentinel v2.1 with dual-source fail-safe telemetry and >=8 verified commits in genlayer-craft/cyber-paw.",
      manifesto_hash: "30703ba5aa37ed9a4f0cb33de5174c06757c3e59c3dd5868ae0c3b86b519f2c2",
      secret_catalyst_commitment: "7453e3390d672fb7fb681b1820ddc7bad907517a56b35c58887c859482c53f03",
      revealed_secret_catalyst: "neural-orderbook-v2",
      Supply: 80,
      base_price: 20,
      slope_k: 50,
      virtual_slope_offset: 32000,
      curve_reserve: 129600,
      cumulative_buy_volume: 129600,
      origin: "seed_demo",
      graduation_threshold: 100000,
      creator_collateral: 0,
      protocol_catalyst_pool: 0,
      fee_escrow_pool: 0,
      redemption_floor_pool: 15000,
      floor_multiplier_bps: 11157,
      spot_price: 4020,
      gate_status: "CATALYST_BOOST",
      mochi_state: "mochi-celebrate-jump.png",
      positions: { "0xA4B...33F2": 50, "0x99E...11C0": 30 },
      last_audit: {
        verdict: "CATALYST_BOOST",
        source_used: "primary",
        primary_url: "https://raw.githubusercontent.com/genlayer-craft/cyber-paw/main/release_manifest.json",
        backup_url: "https://cdn.jsdelivr.net/gh/genlayer-craft/cyber-paw@main/release_manifest.json",
        evidence_hash: "d062cd0921b0ddcdaccc4f370fff6571d7e818662020ed631dcc9cd895e2358a",
        tag_name: "v2.1.0",
        commit_count: "12",
        completeness_score: "95",
        authenticity_score: "92",
        overdelivery_bonus: "88",
        slashed_amount: "0",
        boost_subsidy_added: "15000",
        new_slope_k: "50"
      },
      contradiction_witnesses: [
        {
          witness_id: "wit-cpaw-01",
          challenger: "0x99E...11C0",
          claimed_verdict: "RUG_SLASHED",
          claimed_tag: "none",
          active_finalized_verdict: "CATALYST_BOOST",
          contradiction_cycle:
            "Finalized state has verified tag v2.1.0 (commits=12) vs conflicting claim tag=none; finalized state preserved.",
          witness_hash: "7d8d2f005e04c1f7ef0db2ff224d2dc11d35041f32b3ca8317628feeba0d7597"
        }
      ]
    },
    "curve-shadow-cat": {
      curve_id: "curve-shadow-cat",
      name: "Shadow Cat Router",
      ticker: "$SCAT",
      creator: "0x99E...11C0",
      expected_repo_slug: "genlayer-craft/shadow-cat",
      manifesto_text:
        "Launch cross-dex router v1.0 with full zero-slippage proofs and >=6 verified commits in genlayer-craft/shadow-cat.",
      manifesto_hash: "b46fa13d6c1abedd301aa03f57593b0e11fbd8a0f16df772c155f33510d56e72",
      secret_catalyst_commitment: "0e82c27906f52ef0430651233926b18a06f811f9412833c4ce7c8bfa8946eed4",
      revealed_secret_catalyst: "",
      Supply: 75,
      base_price: 20,
      slope_k: 40,
      virtual_slope_offset: 0,
      curve_reserve: 114000,
      cumulative_buy_volume: 114000,
      origin: "seed_demo",
      graduation_threshold: 100000,
      creator_collateral: 0,
      protocol_catalyst_pool: 15000,
      fee_escrow_pool: 0,
      redemption_floor_pool: 27280,
      floor_multiplier_bps: 12392,
      spot_price: 3020,
      gate_status: "RUG_SLASHED",
      mochi_state: "mochi-point.png",
      positions: { "0x71C...89A1": 45, "0xA4B...33F2": 30 },
      last_audit: {
        verdict: "RUG_SLASHED",
        source_used: "backup",
        primary_url: "https://raw.githubusercontent.com/genlayer-craft/shadow-cat/main/release_manifest.json",
        backup_url: "https://cdn.jsdelivr.net/gh/genlayer-craft/shadow-cat@main/release_manifest.json",
        evidence_hash: "49d89d72cceda887a5eee02e35a5b2fe58ad91761556c8457dbf5674cc12d9b8",
        tag_name: "none",
        commit_count: "1",
        completeness_score: "15",
        authenticity_score: "20",
        overdelivery_bonus: "0",
        slashed_amount: "27280",
        boost_subsidy_added: "0",
        new_slope_k: "40"
      },
      contradiction_witnesses: []
    }
  }
};

// The signing object is held in module memory; no private key is serialized or stored.
let testAccount = null;
export const publicClient = createClient({ chain: studionet, endpoint: APP_CONFIG.RPC_URL });
export function getOrCreateEphemeralTestAccount() {
  if (!testAccount) testAccount = createAccount();
  return { address: testAccount.address.toLowerCase(),
    label: `${testAccount.address.slice(0, 6)}...${testAccount.address.slice(-4)} (EPHEMERAL TEST ACCOUNT)` };
}
export function getTestSigningClient(onSignedTransaction) {
  if (!testAccount) throw new Error("ENABLE_TEMPORARY_TEST_ACCOUNT");
  const account = { ...testAccount, signTransaction: async (...args) => {
    const raw = await testAccount.signTransaction(...args);
    onSignedTransaction?.(keccak256(raw));
    return raw;
  }};
  return createClient({ chain: studionet, endpoint: APP_CONFIG.RPC_URL, account });
}
export async function verifyStableNetwork() {
  if (Number(await publicClient.request({ method: "eth_chainId" })) !== 61999) throw new Error("WRONG_NETWORK");
  if (BigInt(await publicClient.request({ method: "eth_gasPrice" })) !== 0n) throw new Error("NONZERO_GAS_PRICE_BLOCKED");
}

export async function connectInjectedEvmWallet() {
  const provider = window.okxwallet || window.ethereum;
  if (!provider) {
    throw new Error("NO_INJECTED_WALLET: Install OKX Wallet, MetaMask, Rabby, or Coinbase Wallet to connect.");
  }
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const chainIdHex = await provider.request({ method: "eth_chainId" });
  return {
    address: accounts[0] || "",
    chainId: parseInt(chainIdHex, 16),
    providerName: window.okxwallet ? "OKX Wallet" : "Injected EVM Wallet"
  };
}
for (const c of Object.values(INITIAL_SEED_STATE.curves)) {
 c.creator = c.creator.toLowerCase();
 c.positions = Object.fromEntries(Object.entries(c.positions).map(([k,v]) => [k.toLowerCase(),v]));
}
INITIAL_SEED_STATE.balances = Object.fromEntries(Object.entries(INITIAL_SEED_STATE.balances).map(([k,v]) => [k.toLowerCase(),v]));
