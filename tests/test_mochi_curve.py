# tests/test_mochi_curve.py
# ==============================================================================
# LOCAL MOCK SIMULATION SUITE — NOT ON-CHAIN GENLAYER CONSENSUS RESULTS
# Local mock tests cover SHA-256, integer reserves, payable value checks,
# pull-payment withdrawal, API-anchored adjudication, creator-only evaluation,
# the two-step verdict execution, challenge windows and witnesses.
# ==============================================================================

import hashlib
import json
import os
import sys
import types
import unittest

# Inject local mock `genlayer` module before importing contract
def _write_decorator(fn):
    return fn

_write_decorator.payable = _write_decorator

def _view_decorator(fn):
    return fn

class _MockRecipient:
    transfers = []

    def __init__(self, address):
        self.address = address

    def emit_transfer(self, value):
        _MockRecipient.transfers.append({"address": self.address, "value": int(value)})

def _contract_interface(cls):
    # Mirrors GenVM: the decorated class becomes a callable recipient handle.
    class Wrapped(cls):
        def __init__(self, address):
            self.address = address

        def emit_transfer(self, value):
            _MockRecipient.transfers.append({"address": self.address, "value": int(value)})

    Wrapped.__name__ = cls.__name__
    return Wrapped

class _MockPublic:
    write = staticmethod(_write_decorator)
    view = staticmethod(_view_decorator)

class _MockGL:
    class Contract:
        pass

    public = _MockPublic()
    evm = types.SimpleNamespace(contract_interface=_contract_interface)
    _webpage_handler = None
    _prompt_handler = None

    message = types.SimpleNamespace(
        sender_address=types.SimpleNamespace(as_hex="0xdemo_trader"),
        value=0,
    )
    _tag_exists = True
    _tag_sha = "c6430a1a8d380cf4384e7c516b45ec28b50bd410"
    _tag_type = "commit"
    _tag_commit_sha = "c6430a1a8d380cf4384e7c516b45ec28b50bd410"
    _tag_api_fail = False
    _api_commits = 3
    _tree_entries = None  # None = default honest tree (12 code files)
    _tag_calls = 0
    _prompt_calls = 0

    @classmethod
    def _default_tree(cls):
        return [
            {"path": "contracts/mochi_curve.py", "type": "blob", "size": 35160},
            {"path": "src/app.js", "type": "blob", "size": 40177},
            {"path": "src/config.js", "type": "blob", "size": 10123},
            {"path": "src/i18n_and_styles.js", "type": "blob", "size": 36491},
            {"path": "scripts/deploy_studionet.py", "type": "blob", "size": 1430},
            {"path": "scripts/studionet.mjs", "type": "blob", "size": 4375},
            {"path": "scripts/studionet-client.mjs", "type": "blob", "size": 854},
            {"path": "scripts/audit_curve.mjs", "type": "blob", "size": 1200},
            {"path": "scripts/serve.mjs", "type": "blob", "size": 829},
            {"path": "tests/test_mochi_curve.py", "type": "blob", "size": 16734},
            {"path": "index.html", "type": "blob", "size": 19992},
            {"path": "dist/app.js", "type": "blob", "size": 640770},
            {"path": "README.md", "type": "blob", "size": 5000},
            {"path": "release_manifest.json", "type": "blob", "size": 400},
        ]

    @classmethod
    def request(cls, url, method="GET"):
        if "api.github.com" in url:
            cls._tag_calls += 1
            if cls._tag_api_fail:
                return types.SimpleNamespace(status=429, body=b'{"message":"rate limit"}')
            if "/git/ref/tags/" in url:
                tag = url.split("/git/ref/tags/", 1)[1]
                if not cls._tag_exists:
                    return types.SimpleNamespace(status=404, body=b'{"message":"Not Found"}')
                return types.SimpleNamespace(status=200, body=json.dumps({
                    "ref": "refs/tags/" + tag,
                    "object": {"sha": cls._tag_sha, "type": cls._tag_type},
                }).encode())
            if "/git/tags/" in url:
                return types.SimpleNamespace(status=200, body=json.dumps({
                    "object": {"sha": cls._tag_commit_sha, "type": "commit"},
                }).encode())
            if "/commits?" in url:
                return types.SimpleNamespace(status=200, body=json.dumps(
                    [{"sha": f"commit{i:040d}"} for i in range(cls._api_commits)]).encode())
            if "/git/trees/" in url:
                entries = cls._tree_entries if cls._tree_entries is not None else cls._default_tree()
                return types.SimpleNamespace(status=200, body=json.dumps(
                    {"tree": entries, "truncated": False}).encode())
            raise RuntimeError("Unexpected GitHub API URL in mock: " + url)
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
mock_genlayer_mod._Recipient = _MockRecipient
mock_genlayer_mod.Address = lambda a: a
mock_genlayer_mod.u256 = int
mock_genlayer_mod.__all__ = ["gl", "_Recipient", "Address", "u256"]
sys.modules["genlayer"] = mock_genlayer_mod

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from contracts.mochi_curve import (
    GRADUATION_BUY_VOLUME_THRESHOLD,
    WEI_PER_UNIT,
    MochiCurve,
    _curve_integral_reserve,
    _normalize_release_json,
    pure_sha256_hex,
)

CREATOR = "0xcreator0000000000000000000000000000000001"
BUYER = "0xbuyer000000000000000000000000000000000002"
STRANGER = "0xstranger00000000000000000000000000000003"
MANIFESTO = "Deliver verifiable v1.0 release tag, GenVM bonding curve module, and >=5 functional commits in halihalibt/mochicurve-genlayer."
P_URL = "https://raw.githubusercontent.com/halihalibt/mochicurve-genlayer/main/evidence-manifests/graduate-v2.json"
B_URL = "https://cdn.jsdelivr.net/gh/halihalibt/mochicurve-genlayer@main/evidence-manifests/graduate-v2.json"


def honest_manifest(body="Delivered the agreed v1 module with tests and benchmarks."):
    return json.dumps({
        "repo_slug": "halihalibt/mochicurve-genlayer",
        "tag_name": "v1.0.0",
        "commit_sha": "c6430a1a8d380cf4384e7c516b45ec28b50bd410",
        "commit_count": 3,
        "published": True,
        "draft": False,
        "body": body,
    })


class TestMochiCurveLocalMock(unittest.TestCase):
    """Local mock unit tests (NOT on-chain consensus evidence)."""

    def setUp(self):
        self.contract = MochiCurve()
        _MockGL._webpage_handler = None
        _MockGL._prompt_handler = None
        _MockGL._tag_exists = True
        _MockGL._tag_sha = "c6430a1a8d380cf4384e7c516b45ec28b50bd410"
        _MockGL._tag_type = "commit"
        _MockGL._tag_commit_sha = "c6430a1a8d380cf4384e7c516b45ec28b50bd410"
        _MockGL._tag_api_fail = False
        _MockGL._api_commits = 3
        _MockGL._tree_entries = None
        _MockGL._tag_calls = 0
        _MockGL._prompt_calls = 0
        _MockGL.message.sender_address.as_hex = CREATOR
        _MockGL.message.value = 0
        _MockRecipient.transfers = []

    def _set_sender(self, address):
        _MockGL.message.sender_address.as_hex = address

    def _launch(self, cid="curve-unit-01", creator=CREATOR, repo="halihalibt/mochicurve-genlayer", manifesto=MANIFESTO, value_units=25000):
        self._set_sender(creator)
        _MockGL.message.value = value_units * WEI_PER_UNIT
        return self.contract.launch_curve(
            cid, "Unit Test Cat", "$UCAT", creator, repo, manifesto,
            pure_sha256_hex("salt-u|secret-u"),
        )

    def _buy(self, cid, amount, buyer):
        self._set_sender(buyer)
        c = json.loads(self.contract.get_all_curves())[cid]
        s0 = int(c["Supply"])
        r0 = _curve_integral_reserve(s0, int(c["base_price"]), int(c["slope_k"]), int(c["virtual_slope_offset"]))
        r1 = _curve_integral_reserve(s0 + amount, int(c["base_price"]), int(c["slope_k"]), int(c["virtual_slope_offset"]))
        total = (r1 - r0) + ((r1 - r0) * 200) // 10000
        _MockGL.message.value = total * WEI_PER_UNIT
        return json.loads(self.contract.buy_tokens(cid, amount, buyer))

    def _unlock(self, cid="curve-unit-01", creator=CREATOR, buyer=BUYER):
        self._launch(cid, creator)
        return self._buy(cid, 71, buyer)

    def _healthy_evidence(self, scores=("70", "70", "50")):
        _MockGL._webpage_handler = lambda url, mode: honest_manifest()
        _MockGL._prompt_handler = lambda prompt: json.dumps({
            "completeness_score": scores[0],
            "authenticity_score": scores[1],
            "overdelivery_bonus": scores[2],
        })

    def test_01_pure_sha256_matches_stdlib_vectors(self):
        vectors = [
            "",
            "abc",
            "mochi-salt-01|v1.0-mainnet-bridge-module",
            "halihalibt/mochicurve-genlayer|v1.0.0|c6430a1a8d380cf4384e7c516b45ec28b50bd410|3|true|delivered module",
            "a" * 128,
        ]
        for vec in vectors:
            self.assertEqual(pure_sha256_hex(vec), hashlib.sha256(vec.encode("utf-8")).hexdigest())

    def test_02_constructor_starts_empty_no_seed_balances(self):
        self.assertEqual(json.loads(self.contract.get_all_curves()), {})
        totals = json.loads(self.contract.get_ledger_totals())
        self.assertEqual(totals, {"total_received_units": "0", "total_withdrawn_units": "0"})
        self.assertEqual(self.contract.get_user_balance(CREATOR), "0")

    def test_03_launch_requires_exact_collateral_value(self):
        self._set_sender(CREATOR)
        _MockGL.message.value = 24 * 10**18  # 24 GEN, short of 25 GEN
        with self.assertRaisesRegex(Exception, "COLLATERAL_VALUE_MISMATCH"):
            self.contract.launch_curve("c1", "Cat", "$CAT", CREATOR, "halihalibt/mochicurve-genlayer",
                                       MANIFESTO, pure_sha256_hex("salt|secret"))
        self.assertEqual(json.loads(self.contract.get_all_curves()), {})
        self._launch("c1")
        c = json.loads(self.contract.get_all_curves())["c1"]
        self.assertEqual(c["creator_collateral"], 25000)
        self.assertEqual(c["gate_status"], "TRADING_OPEN")
        totals = json.loads(self.contract.get_ledger_totals())
        self.assertEqual(totals["total_received_units"], "25000")

    def test_04_buy_requires_exact_value_and_unlocks_threshold(self):
        self._launch()
        self._set_sender(BUYER)
        _MockGL.message.value = 1  # wrong value
        with self.assertRaisesRegex(Exception, "BUY_VALUE_MISMATCH"):
            self.contract.buy_tokens("curve-unit-01", 70, BUYER)
        res1 = self._buy("curve-unit-01", 70, BUYER)
        self.assertEqual(int(res1["new_reserve"]), 99400)
        self.assertEqual(res1["gate_status"], "TRADING_OPEN")
        # 70 tokens cost 99,400 + 1,988 fee = 101,388 units
        totals = json.loads(self.contract.get_ledger_totals())
        self.assertEqual(totals["total_received_units"], str(25000 + 101388))
        res2 = self._buy("curve-unit-01", 1, BUYER)
        self.assertEqual(res2["gate_status"], "GATE_UNLOCKED")

    def test_05_sell_credits_withdrawable_and_withdraw_pays_real_value(self):
        self._unlock()
        self._set_sender(BUYER)
        sell = json.loads(self.contract.sell_tokens("curve-unit-01", 40, BUYER))
        self.assertGreater(int(sell["total_payout"]), 0)
        self.assertEqual(self.contract.get_user_balance(BUYER), str(int(sell["total_payout"])))
        # No GEN moved yet: nothing withdrawn, no transfers recorded.
        self.assertEqual(_MockRecipient.transfers, [])
        self._set_sender(BUYER)
        out = json.loads(self.contract.withdraw())
        self.assertEqual(out["withdrawn_units"], str(int(sell["total_payout"])))
        self.assertEqual(out["withdrawn_wei"], str(int(sell["total_payout"]) * WEI_PER_UNIT))
        self.assertEqual(len(_MockRecipient.transfers), 1)
        self.assertEqual(_MockRecipient.transfers[0]["address"], BUYER.lower())
        self.assertEqual(_MockRecipient.transfers[0]["value"], int(sell["total_payout"]) * WEI_PER_UNIT)
        self.assertEqual(self.contract.get_user_balance(BUYER), "0")
        with self.assertRaisesRegex(Exception, "NO_WITHDRAWABLE_BALANCE"):
            self.contract.withdraw()

    def test_06_evaluate_is_creator_only_and_writes_pending_only(self):
        self._unlock()
        # Stranger as sender: authentication fails before anything else.
        self._set_sender(STRANGER)
        with self.assertRaisesRegex(Exception, "CALLER_ADDRESS_MISMATCH"):
            self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        # Stranger as sender naming themselves as evaluator: auth passes, role check fails.
        self._set_sender(STRANGER)
        with self.assertRaisesRegex(Exception, "EVALUATOR_NOT_CREATOR"):
            self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, STRANGER)
        # Creator evaluates: pending verdict, gate VERDICT_PENDING, no money moved.
        self._healthy_evidence()
        self._set_sender(CREATOR)
        result = json.loads(self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR))
        self.assertEqual(result["verdict"], "GRADUATE_APPROVED")
        self.assertEqual(result["sha_match"], "true")
        self.assertEqual(result["count_ok"], "true")
        self.assertEqual(result["code_ok"], "true")
        self.assertEqual(result["api_commit_count"], "3")
        self.assertEqual(result["code_file_count"], "12")
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        self.assertEqual(c["gate_status"], "VERDICT_PENDING")
        self.assertEqual(c["pending_verdict"]["verdict"], "GRADUATE_APPROVED")
        self.assertIsNone(c["last_audit"])
        self.assertEqual(c["creator_collateral"], 25000)  # still locked
        self.assertEqual(self.contract.get_user_balance(CREATOR), "0")

    def test_07_challenge_blocks_execute_and_reevaluate_clears_it(self):
        self._unlock()
        self._healthy_evidence()
        self._set_sender(CREATOR)
        self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        # Buyer challenges the pending GRADUATE verdict.
        self._set_sender(BUYER)
        ch = json.loads(self.contract.challenge_pending_verdict(
            "curve-unit-01", BUYER, "RUG_SLASHED", "Tag looks fine but delivery is thin."))
        self.assertEqual(ch["pending_verdict"], "GRADUATE_APPROVED")
        # Creator cannot execute while the challenge is open.
        self._set_sender(CREATOR)
        with self.assertRaisesRegex(Exception, "PENDING_CHALLENGE_BLOCKS_EXECUTION"):
            self.contract.execute_verdict("curve-unit-01", CREATOR)
        # Creator re-evaluates: supersedes the pending verdict, clears challenges.
        self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        self.assertEqual(c["pending_challenges"], [])
        # Now execution succeeds and credits the creator reward as withdrawable.
        audit = json.loads(self.contract.execute_verdict("curve-unit-01", CREATOR))
        self.assertEqual(audit["verdict"], "GRADUATE_APPROVED")
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        self.assertEqual(c["gate_status"], "GRADUATE_APPROVED")
        self.assertIsNone(c["pending_verdict"])
        self.assertEqual(self.contract.get_user_balance(CREATOR), "27044")  # 25000 + 2044 fee

    def test_08_execute_is_creator_only_and_needs_pending_verdict(self):
        self._unlock()
        self._set_sender(CREATOR)
        with self.assertRaisesRegex(Exception, "NO_PENDING_VERDICT"):
            self.contract.execute_verdict("curve-unit-01", CREATOR)
        self._healthy_evidence()
        self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        self._set_sender(STRANGER)
        with self.assertRaisesRegex(Exception, "CALLER_ADDRESS_MISMATCH"):
            self.contract.execute_verdict("curve-unit-01", CREATOR)
        with self.assertRaisesRegex(Exception, "EXECUTOR_NOT_CREATOR"):
            self.contract.execute_verdict("curve-unit-01", STRANGER)

    def test_09_readme_only_repo_slashes_on_all_three_anchors(self):
        self._unlock()
        # Adversarial manifest: wrong commit SHA, inflated count, README-only tree.
        _MockGL._tree_entries = [
            {"path": "README.md", "type": "blob", "size": 800},
            {"path": "release_manifest.json", "type": "blob", "size": 300},
        ]
        _MockGL._api_commits = 1
        _MockGL._webpage_handler = lambda url, mode: json.dumps({
            "repo_slug": "halihalibt/mochicurve-rug-demo",
            "tag_name": "v0.1.0",
            "commit_sha": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            "commit_count": 12,
            "published": True,
            "body": "Full v1 delivery with 12 commits.",
        })
        _MockGL._prompt_handler = lambda prompt: json.dumps({
            "completeness_score": "95", "authenticity_score": "95", "overdelivery_bonus": "95",
        })
        # The rug curve points at the rug repo, not the real repo.
        self._set_sender(CREATOR)
        _MockGL.message.value = 25000 * WEI_PER_UNIT
        self.contract.launch_curve("curve-rug-01", "Rug Demo", "$RUG", CREATOR,
                                   "halihalibt/mochicurve-rug-demo", MANIFESTO,
                                   pure_sha256_hex("salt-r|secret-r"))
        self._buy("curve-rug-01", 71, BUYER)
        rug_p = "https://raw.githubusercontent.com/halihalibt/mochicurve-rug-demo/main/release_manifest.json"
        rug_b = "https://cdn.jsdelivr.net/gh/halihalibt/mochicurve-rug-demo@main/release_manifest.json"
        self._set_sender(CREATOR)
        result = json.loads(self.contract.evaluate_graduation_gate("curve-rug-01", rug_p, rug_b, CREATOR))
        self.assertEqual(result["verdict"], "RUG_SLASHED")
        self.assertEqual(result["sha_match"], "false")
        self.assertEqual(result["count_ok"], "false")
        self.assertEqual(result["code_ok"], "false")
        self.assertEqual(result["code_file_count"], "0")
        self.assertEqual(_MockGL._prompt_calls, 0)  # deterministic slash, no LLM
        audit = json.loads(self.contract.execute_verdict("curve-rug-01", CREATOR))
        self.assertEqual(audit["verdict"], "RUG_SLASHED")
        c = json.loads(self.contract.get_all_curves())["curve-rug-01"]
        self.assertEqual(c["gate_status"], "RUG_SLASHED")
        self.assertEqual(c["redemption_floor_pool"], 27044)  # 25000 + 2044 fee, real GEN held
        self.assertEqual(c["creator_collateral"], 0)

    def test_10_missing_tag_slashes_without_llm(self):
        self._unlock()
        self._healthy_evidence()
        _MockGL._tag_exists = False
        self._set_sender(CREATOR)
        result = json.loads(self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR))
        self.assertEqual(result["verdict"], "RUG_SLASHED")
        self.assertEqual(result["tag_exists"], "false")
        self.assertEqual(_MockGL._prompt_calls, 0)

    def test_11_annotated_tag_resolves_to_commit(self):
        self._unlock()
        self._healthy_evidence()
        _MockGL._tag_type = "tag"  # annotated tag object
        _MockGL._tag_sha = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111"
        _MockGL._tag_commit_sha = "c6430a1a8d380cf4384e7c516b45ec28b50bd410"
        self._set_sender(CREATOR)
        result = json.loads(self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR))
        self.assertEqual(result["verdict"], "GRADUATE_APPROVED")
        self.assertEqual(result["commit_sha"], "c6430a1a8d380cf4384e7c516b45ec28b50bd410")
        self.assertEqual(result["sha_match"], "true")

    def test_12_boost_changes_slope_and_preserves_reserve_no_invented_subsidy(self):
        self._unlock()
        self._healthy_evidence(scores=("90", "90", "90"))
        self._set_sender(CREATOR)
        pending = json.loads(self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR))
        self.assertEqual(pending["verdict"], "CATALYST_BOOST")
        audit = json.loads(self.contract.execute_verdict("curve-unit-01", CREATOR))
        self.assertEqual(audit["new_slope_k"], "50")
        self.assertEqual(audit["boost_subsidy_added"], "0")
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        r_eff = _curve_integral_reserve(int(c["Supply"]), int(c["base_price"]), int(c["slope_k"]), int(c["virtual_slope_offset"]))
        self.assertEqual(r_eff, int(c["curve_reserve"]))
        self.assertEqual(c["redemption_floor_pool"], 0)  # nothing invented
        self.assertEqual(self.contract.get_user_balance(CREATOR), "27044")

    def test_13_both_sources_fail_reverts_before_write_and_retryable(self):
        self._unlock()
        _MockGL._webpage_handler = lambda url, mode: (_ for _ in ()).throw(ConnectionError("Both offline"))
        self._set_sender(CREATOR)
        with self.assertRaisesRegex(Exception, "EXTERNAL_FETCH_FAILED_BOTH_SOURCES_PENDING_RETRY"):
            self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        self.assertEqual(c["gate_status"], "GATE_UNLOCKED")
        self.assertIsNone(c["pending_verdict"])
        self.assertIsNone(c["last_audit"])

    def test_14_tag_api_failure_keeps_state_unchanged(self):
        self._unlock()
        self._healthy_evidence()
        _MockGL._tag_api_fail = True
        before = self.contract.get_all_curves()
        self._set_sender(CREATOR)
        with self.assertRaisesRegex(Exception, "GITHUB_TAG_API_UNAVAILABLE"):
            self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        self.assertEqual(before, self.contract.get_all_curves())
        self.assertEqual(_MockGL._prompt_calls, 0)

    def test_15_reveal_requires_creator_and_commitment(self):
        self._launch()
        self._set_sender(STRANGER)
        with self.assertRaisesRegex(Exception, "CALLER_ADDRESS_MISMATCH"):
            self.contract.reveal_secret_catalyst("curve-unit-01", "salt-u", "secret-u", CREATOR)
        self._set_sender(STRANGER)
        with self.assertRaisesRegex(Exception, "REVEALER_NOT_CREATOR"):
            self.contract.reveal_secret_catalyst("curve-unit-01", "salt-u", "secret-u", STRANGER)
        self._set_sender(CREATOR)
        with self.assertRaisesRegex(Exception, "COMMITMENT_MISMATCH_BEFORE_WRITE"):
            self.contract.reveal_secret_catalyst("curve-unit-01", "wrong", "wrong", CREATOR)
        digest = self.contract.reveal_secret_catalyst("curve-unit-01", "salt-u", "secret-u", CREATOR)
        self.assertEqual(len(digest), 64)

    def test_16_contradiction_witness_preserves_finalized_verdict(self):
        self._unlock()
        self._healthy_evidence()
        self._set_sender(CREATOR)
        self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        self.contract.execute_verdict("curve-unit-01", CREATOR)
        self._set_sender(BUYER)
        wit = json.loads(self.contract.record_contradiction_claim(
            "curve-unit-01", BUYER, "RUG_SLASHED", "v0.0.0-fake"))
        self.assertEqual(wit["active_finalized_verdict"], "GRADUATE_APPROVED")
        c = json.loads(self.contract.get_all_curves())["curve-unit-01"]
        self.assertEqual(c["gate_status"], "GRADUATE_APPROVED")
        self.assertEqual(len(c["contradiction_witnesses"]), 1)

    def test_17_money_reconciles_received_minus_withdrawn(self):
        self._unlock()
        self._set_sender(BUYER)
        self.contract.sell_tokens("curve-unit-01", 40, BUYER)
        self._healthy_evidence()
        self._set_sender(CREATOR)
        self.contract.evaluate_graduation_gate("curve-unit-01", P_URL, B_URL, CREATOR)
        self.contract.execute_verdict("curve-unit-01", CREATOR)
        # Creator withdraws the 27,044 reward; buyer keeps the sell credit.
        self._set_sender(CREATOR)
        self.contract.withdraw()
        totals = json.loads(self.contract.get_ledger_totals())
        received = int(totals["total_received_units"])
        withdrawn = int(totals["total_withdrawn_units"])
        self.assertEqual(received, 25000 + 104284)  # collateral + buys
        self.assertEqual(withdrawn, 27044)
        # Contract still holds the reserve (102,240) + buyer sell credit.
        curves = json.loads(self.contract.get_all_curves())
        c = curves["curve-unit-01"]
        buyer_credit = int(self.contract.get_user_balance(BUYER))
        self.assertEqual(received - withdrawn, int(c["curve_reserve"]) + buyer_credit)

    def test_18_normalize_release_json_carries_commit_sha(self):
        payload = json.dumps({
            "tag_name": "v1.0.0",
            "commit_sha": "C6430A1A8D380CF4384E7C516B45EC28B50BD410",
            "commit_count": 7,
            "published": True,
            "draft": False,
            "body": "  Shipped   v1.0   bonding   curve  module! \n ",
        })
        norm = _normalize_release_json(payload, P_URL)
        self.assertEqual(norm["commit_sha"], "c6430a1a8d380cf4384e7c516b45ec28b50bd410")
        self.assertEqual(norm["commit_count"], "7")
        self.assertEqual(norm["repo_slug"], "halihalibt/mochicurve-genlayer")


if __name__ == "__main__":
    unittest.main(verbosity=2)
