# tests/test_mochi_curve.py
# ==============================================================================
# LOCAL MOCK SIMULATION SUITE — NOT ON-CHAIN GENLAYER CONSENSUS RESULTS
# 本地模拟测试（非链上真实共识结果）：用于验证纯 Python SHA-256、联合曲线整数不变量、
# 主备数据源规范化等价性、三种外部拉取状态（主源正常/主源失败走备源/双源失败回滚可重试）及矛盾环。
# ==============================================================================

import hashlib
import json
import os
import sys
import types
import unittest

# Inject local mock `genlayer` module before importing contract
class _MockPublic:
    @staticmethod
    def write(fn):
        return fn

    @staticmethod
    def view(fn):
        return fn

class _MockGL:
    class Contract:
        pass

    public = _MockPublic()
    _webpage_handler = None
    _prompt_handler = None

    message = types.SimpleNamespace(sender_address=types.SimpleNamespace(as_hex="0xdemo_trader"))
    _tag_exists = True
    _tag_api_fail = False
    _tag_calls = 0
    _prompt_calls = 0

    @classmethod
    def request(cls, url, method="GET"):
        if "api.github.com" in url:
            cls._tag_calls += 1
            if cls._tag_api_fail:
                return types.SimpleNamespace(status=429, body=b'{"message":"rate limit"}')
            tag = url.split("/git/ref/tags/", 1)[1]
            return types.SimpleNamespace(status=200 if cls._tag_exists else 404,
                body=json.dumps({"ref": "refs/tags/" + tag}).encode())
        if cls._webpage_handler is None:
            raise RuntimeError("No local mock webpage handler")
        return types.SimpleNamespace(status=200, body=cls._webpage_handler(url, "text").encode())

    @classmethod
    def exec_prompt(cls, prompt, **kwargs):
        cls._prompt_calls += 1
        if cls._prompt_handler is None:
            raise RuntimeError("No local mock prompt handler")
        return cls._prompt_handler(prompt)

    @classmethod
    def run_nondet_unsafe(cls, leader, validator):
        out = leader()
        wrapped = types.SimpleNamespace(calldata=out)
        if not validator(wrapped):
            raise AssertionError("Independent validator rejected leader")
        return out

_MockGL.nondet = types.SimpleNamespace(web=types.SimpleNamespace(request=_MockGL.request), exec_prompt=_MockGL.exec_prompt)
_MockGL.vm = types.SimpleNamespace(run_nondet_unsafe=_MockGL.run_nondet_unsafe, Return=types.SimpleNamespace)

mock_genlayer_mod = types.ModuleType("genlayer")
mock_genlayer_mod.gl = _MockGL
sys.modules["genlayer"] = mock_genlayer_mod

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from contracts.mochi_curve import (
    GRADUATION_BUY_VOLUME_THRESHOLD,
    MochiCurve,
    _curve_integral_reserve,
    _normalize_release_json,
    pure_sha256_hex,
)


class TestMochiCurveLocalMock(unittest.TestCase):
    """8 Local Mock Unit Tests (NOT on-chain consensus evidence)."""

    def setUp(self):
        self.contract = MochiCurve()
        _MockGL._webpage_handler = None
        _MockGL._prompt_handler = None
        _MockGL._tag_exists = True
        _MockGL._tag_api_fail = False
        _MockGL._tag_calls = 0
        _MockGL._prompt_calls = 0
        _MockGL.message.sender_address.as_hex = "0xdemo_trader"

    def test_01_pure_sha256_matches_stdlib_vectors(self):
        vectors = [
            "",
            "abc",
            "mochi-salt-01|v1.0-mainnet-bridge-module",
            "genlayer-craft/cyber-paw|v2.1.0|12|true|autonomous liquidity sentinel v2.1",
            "a" * 128,
        ]
        for vec in vectors:
            expected = hashlib.sha256(vec.encode("utf-8")).hexdigest()
            actual = pure_sha256_hex(vec)
            self.assertEqual(actual, expected)

    def test_02_seed_curves_solvency_invariant(self):
        curves = json.loads(self.contract.get_all_curves())
        self.assertEqual(len(curves), 3)
        for cid, c in curves.items():
            r_eff = _curve_integral_reserve(
                int(c["Supply"]),
                int(c["base_price"]),
                int(c["slope_k"]),
                int(c["virtual_slope_offset"]),
            )
            self.assertEqual(r_eff, int(c["curve_reserve"]), f"Solvency mismatch on {cid}")

    def test_03_threshold_graduation_trigger_and_guard(self):
        self.contract.launch_curve(
            "curve-unit-01",
            "Unit Test Cat",
            "$UCAT",
            "0xDEMO_TRADER",
            "genlayer-craft/unit-cat",
            "Ship deterministic unit test suite with >=4 verified release commits.",
            pure_sha256_hex("salt-u|secret-u"),
        )
        # Buy 70 tokens -> R(70) = 20*70 + 20*4900 = 99,400 < 100,000 threshold
        res1 = json.loads(self.contract.buy_tokens("curve-unit-01", 70, "0xDEMO_TRADER"))
        self.assertEqual(int(res1["new_reserve"]), 99400)
        self.assertEqual(res1["gate_status"], "TRADING_OPEN")

        with self.assertRaises(Exception) as ctx:
            self.contract.evaluate_graduation_gate(
                "curve-unit-01",
                "https://raw.githubusercontent.com/genlayer-craft/unit-cat/main/release_manifest.json",
                "https://cdn.jsdelivr.net/gh/genlayer-craft/unit-cat@main/release_manifest.json",
            )
        self.assertIn("GRADUATION_THRESHOLD_NOT_REACHED", str(ctx.exception))

        # Buy 1 more token (Supply=71) -> R(71) = 102,240 >= 100,000 -> GATE_UNLOCKED
        res2 = json.loads(self.contract.buy_tokens("curve-unit-01", 1, "0xDEMO_TRADER"))
        self.assertGreaterEqual(int(res2["new_reserve"]), GRADUATION_BUY_VOLUME_THRESHOLD)
        self.assertEqual(res2["gate_status"], "GATE_UNLOCKED")

    def test_04_primary_and_backup_canonical_equivalence(self):
        # Payload omits repo_slug to verify URL-based slug extraction across both mirrors
        payload = json.dumps({
            "tag_name": "v1.0.0",
            "commit_count": 7,
            "published": True,
            "draft": False,
            "body": "  Shipped   v1.0   bonding   curve  module! \n ",
        })
        p_url = "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json"
        b_url = "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"
        norm_p = _normalize_release_json(payload, p_url)
        norm_b = _normalize_release_json(payload, b_url)
        self.assertEqual(norm_p["canonical_str"], norm_b["canonical_str"])
        self.assertEqual(norm_p["evidence_hash"], norm_b["evidence_hash"])
        self.assertEqual(norm_p["repo_slug"], "genlayer-craft/mochi-prime")

    def test_05_consensus_primary_ok_catalyst_boost_invariant(self):
        p_url = "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json"
        b_url = "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"
        _MockGL._webpage_handler = lambda url, mode: json.dumps({
            "tag_name": "v1.2.0",
            "commit_count": 9,
            "published": True,
            "body": "Delivered v1.2 release tag and GenVM bonding curve module with full benchmarks",
        })
        _MockGL._prompt_handler = lambda prompt: json.dumps({
            "completeness_score": "90",
            "authenticity_score": "90",
            "overdelivery_bonus": "90",
        })

        audit = json.loads(self.contract.evaluate_graduation_gate("curve-mochi-prime", p_url, b_url))
        self.assertEqual(audit["verdict"], "CATALYST_BOOST")
        self.assertEqual(audit["source_used"], "primary")
        self.assertEqual(audit["new_slope_k"], "50")

        curves = json.loads(self.contract.get_all_curves())
        c = curves["curve-mochi-prime"]
        r_eff = _curve_integral_reserve(
            int(c["Supply"]),
            int(c["base_price"]),
            int(c["slope_k"]),
            int(c["virtual_slope_offset"]),
        )
        self.assertEqual(r_eff, int(c["curve_reserve"]))
        self.assertEqual(int(c["redemption_floor_pool"]), 15000)

    def test_06_consensus_primary_fail_backup_ok_rug_slashed_and_floor_sell(self):
        p_url = "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json"
        b_url = "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"

        def _fallback_fetcher(url, mode):
            if "raw.githubusercontent.com" in url:
                raise ConnectionError("Primary mirror timeout")
            return json.dumps({
                "tag_name": "none",
                "commit_count": 1,
                "published": False,
                "body": "empty placeholder",
            })

        _MockGL._webpage_handler = _fallback_fetcher
        _MockGL._prompt_handler = lambda prompt: json.dumps({
            "completeness_score": "20",
            "authenticity_score": "20",
            "overdelivery_bonus": "0",
        })

        audit = json.loads(self.contract.evaluate_graduation_gate("curve-mochi-prime", p_url, b_url))
        self.assertEqual(audit["verdict"], "RUG_SLASHED")
        self.assertEqual(audit["source_used"], "backup")
        # 25000 creator_collateral + 2044 fee_escrow_pool = 27044 slashed into floor pool
        self.assertEqual(audit["slashed_amount"], "27044")

        _MockGL.message.sender_address.as_hex = "0xa4b...33f2"
        sell_res = json.loads(self.contract.sell_tokens("curve-mochi-prime", 40, "0xA4B...33F2"))
        self.assertGreater(int(sell_res["floor_bonus"]), 0)

    def test_07_consensus_both_sources_fail_reverts_before_write_and_retryable(self):
        p_url = "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json"
        b_url = "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"

        def _both_fail(url, mode):
            raise ConnectionError("Both primary and backup offline")

        _MockGL._webpage_handler = _both_fail
        with self.assertRaises(Exception) as ctx:
            self.contract.evaluate_graduation_gate("curve-mochi-prime", p_url, b_url)
        self.assertIn("EXTERNAL_FETCH_FAILED_BOTH_SOURCES_PENDING_RETRY", str(ctx.exception))

        # Verify state remained GATE_UNLOCKED and can be retried once source recovers
        curves = json.loads(self.contract.get_all_curves())
        self.assertEqual(curves["curve-mochi-prime"]["gate_status"], "GATE_UNLOCKED")
        self.assertIsNone(curves["curve-mochi-prime"]["last_audit"])

    def test_08_commit_reveal_and_contradiction_witness_immutability(self):
        with self.assertRaises(Exception) as ctx:
            self.contract.reveal_secret_catalyst("curve-mochi-prime", "wrong-salt", "wrong-secret")
        self.assertIn("COMMITMENT_MISMATCH_BEFORE_WRITE", str(ctx.exception))

        digest = self.contract.reveal_secret_catalyst(
            "curve-mochi-prime", "mochi-salt-01", "v1.0-mainnet-bridge-module"
        )
        self.assertTrue(len(digest) == 64)

        _MockGL.message.sender_address.as_hex = "0x71c...89a1"
        # Record contradiction against already finalized `curve-cyber-paw` (CATALYST_BOOST)
        wit = json.loads(
            self.contract.record_contradiction_claim(
                "curve-cyber-paw", "0x71C...89A1", "RUG_SLASHED", "v0.0.0-fake"
            )
        )
        self.assertEqual(wit["active_finalized_verdict"], "CATALYST_BOOST")
        curves = json.loads(self.contract.get_all_curves())
        self.assertEqual(curves["curve-cyber-paw"]["gate_status"], "CATALYST_BOOST")
        self.assertEqual(len(curves["curve-cyber-paw"]["contradiction_witnesses"]), 2)

    def _healthy_evidence(self):
        _MockGL._webpage_handler = lambda url, mode: json.dumps({
            "tag_name": "v1.2.0", "commit_count": 9, "published": True,
            "body": "Delivered the agreed module plus tests and benchmarks"})
        _MockGL._prompt_handler = lambda prompt: json.dumps({
            "completeness_score": "90", "authenticity_score": "90", "overdelivery_bonus": "90"})

    def test_09_cumulative_gate_survives_sell_and_audit(self):
        self.contract.launch_curve("cumulative", "Cumulative", "$CUM", "0xDEMO_TRADER",
            "genlayer-craft/mochi-prime", "Deliver a tested release of the bonding curve module.", pure_sha256_hex("salt|secret"))
        self.contract.buy_tokens("cumulative", 71, "0xDEMO_TRADER")
        self.contract.sell_tokens("cumulative", 70, "0xDEMO_TRADER")
        c = json.loads(self.contract.get_all_curves())["cumulative"]
        self.assertEqual(c["cumulative_buy_volume"], 102240)
        self.assertEqual(c["curve_reserve"], 40)
        self.assertEqual(c["gate_status"], "GATE_UNLOCKED")
        self._healthy_evidence()
        result = json.loads(self.contract.evaluate_graduation_gate("cumulative",
            "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json",
            "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"))
        self.assertEqual(result["verdict"], "CATALYST_BOOST")
        self.assertEqual(result["completeness_score"], "90")
        self.assertEqual(_MockGL._tag_calls, 2)
        self.assertEqual(_MockGL._prompt_calls, 2)

    def test_10_missing_tag_slashes_without_llm(self):
        self._healthy_evidence()
        _MockGL._tag_exists = False
        result = json.loads(self.contract.evaluate_graduation_gate("curve-mochi-prime",
            "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json",
            "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json"))
        self.assertEqual(result["verdict"], "RUG_SLASHED")
        self.assertEqual(_MockGL._prompt_calls, 0)

    def test_11_tag_api_failure_keeps_state_byte_identical(self):
        self._healthy_evidence()
        _MockGL._tag_api_fail = True
        before = self.contract.get_all_curves()
        with self.assertRaisesRegex(Exception, "GITHUB_TAG_API_UNAVAILABLE"):
            self.contract.evaluate_graduation_gate("curve-mochi-prime",
                "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json",
                "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json")
        self.assertEqual(before, self.contract.get_all_curves())
        self.assertEqual(_MockGL._prompt_calls, 0)

    def test_12_identity_binding_rejects_impersonation_before_write(self):
        before = self.contract.get_all_curves(), self.contract.balances_json
        for fn, args in [(self.contract.buy_tokens, ("curve-mochi-prime", 1, "0xother")),
                         (self.contract.sell_tokens, ("curve-mochi-prime", 1, "0xother")),
                         (self.contract.launch_curve, ("bad", "Bad", "$BAD", "0xother", "owner/repo", "An adequately long manifesto.", "a" * 64))]:
            with self.assertRaisesRegex(Exception, "CALLER_ADDRESS_MISMATCH"):
                fn(*args)
            self.assertEqual(before, (self.contract.get_all_curves(), self.contract.balances_json))

    def test_13_zero_position_removed_and_cumulative_not_decremented(self):
        self.contract.launch_curve("zero", "Zero", "$ZERO", "0xDEMO_TRADER", "owner/repo",
            "Deliver a tested release of the integer module.", "a" * 64)
        self.contract.buy_tokens("zero", 3, "0xDEMO_TRADER")
        self.contract.sell_tokens("zero", 3, "0xDEMO_TRADER")
        c = json.loads(self.contract.get_all_curves())["zero"]
        self.assertNotIn("0xdemo_trader", c["positions"])
        self.assertEqual(c["cumulative_buy_volume"], 240)

    def test_14_independent_validator_rejects_conflicting_evidence(self):
        self._healthy_evidence()
        counter = [0]
        def changed(url, mode):
            counter[0] += 1
            return json.dumps({"tag_name": "v1.2.0" if counter[0] <= 2 else "v2.0.0",
                               "commit_count": 9, "published": True, "body": "Delivered module"})
        _MockGL._webpage_handler = changed
        before = self.contract.get_all_curves()
        with self.assertRaisesRegex(AssertionError, "Independent validator rejected"):
            self.contract.evaluate_graduation_gate("curve-mochi-prime",
                "https://raw.githubusercontent.com/genlayer-craft/mochi-prime/main/release_manifest.json",
                "https://cdn.jsdelivr.net/gh/genlayer-craft/mochi-prime@main/release_manifest.json")
        self.assertEqual(before, self.contract.get_all_curves())


if __name__ == "__main__":
    unittest.main(verbosity=2)