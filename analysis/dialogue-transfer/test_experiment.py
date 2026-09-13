"""TEST ONLY diagnostics. Synthetic processes are never real-experiment evidence."""
import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import warnings
import numpy as np
from sklearn.exceptions import ConvergenceWarning
from experiment import MODELS, InsufficientData, bins, bootstrap, categories, evaluate, fit_fold, losses, paired_summary, scoring
from run import close

CONFIG = json.loads((Path(__file__).parent / "protocol.json").read_text())


def synthetic(coupled, seed=451):
    rng = np.random.default_rng(seed)
    rows = []
    for g in range(8):
        for i in range(80):
            own, recent, older = rng.normal(size=3)
            duration = np.exp((recent if coupled else rng.normal()) * .6)
            rows.append({"id": f"TEST-ONLY-{g}-{i}", "currentRow": g * 80 + i, "targetRow": 10000 + g * 80 + i, "parentGroup": f"TEST-ONLY-{g}", "targetDuration": duration, "features": {"M1": [own, None if i % 7 == 0 else own * .5], "M2": [own, None if i % 7 == 0 else own * .5, recent], "M2-lagged": [own, None if i % 7 == 0 else own * .5, older]}})
    return rows, {"folds": 5, "assignments": {f"TEST-ONLY-{g}": g % 5 for g in range(8)}}


def fixture_record(group, p1, p2):
    return {"parentGroup": group, "category": 0, "predictions": {m: {"logLossBits": float(-np.log2(p2 if m == "M2" else p1))} for m in MODELS}}


class Tests(unittest.TestCase):
    def test_hand_computable_bits_sign_floor_and_renormalization(self):
        raw = np.array([[.5, .25, .25], [.25, .5, .25]])
        p, count = scoring(raw, 1e-12)
        self.assertEqual(losses(p, [0, 0]).tolist(), [1, 2])
        self.assertEqual(count.tolist(), [0, 0])
        a = fixture_record("A", .25, .5)
        b = fixture_record("B", .5, .25)
        self.assertEqual(paired_summary([a])["gainBits"]["M2_vs_M1"], 1)
        self.assertEqual(paired_summary([b])["gainBits"]["M2_vs_M1"], -1)
        self.assertEqual(paired_summary([a, b])["gainBits"]["M2_vs_M1"], 0)
        q, clipped = scoring([[0, 1, 0]], 1e-12)
        np.testing.assert_allclose(q, [[1e-12 / (1 + 2e-12), 1 / (1 + 2e-12), 1e-12 / (1 + 2e-12)]], rtol=0, atol=1e-15)
        self.assertEqual(clipped.tolist(), [2])
        for invalid in [[[1, 1, 1]], [[-.1, .5, .6]], [[float("nan"), 0, 1]]]:
            with self.assertRaises(ValueError): scoring(invalid, 1e-12)

    def test_training_only_bins_imputation_scaling_and_separate_control_fit(self):
        rows, _ = synthetic(True)
        train, test = rows[:480], rows[480:]
        result = fit_fold(train, test, CONFIG)
        altered = copy.deepcopy(test)
        for r in altered:
            r["targetDuration"] *= 10000
            r["futurePartner"] = {"duration": 99999}
        changed = fit_fold(train, altered, CONFIG)
        self.assertEqual(result["edges"], changed["edges"])
        self.assertEqual(result["diagnostics"], changed["diagnostics"])
        for m in MODELS:
            np.testing.assert_array_equal(result["raw"][m], changed["raw"][m])
        self.assertIsNot(result["fitted"]["M2"], result["fitted"]["M2-lagged"])
        self.assertNotEqual(result["diagnostics"]["M2"]["coefficients"], result["diagnostics"]["M2-lagged"]["coefficients"])
        for m in MODELS[1:]:
            self.assertEqual(result["diagnostics"][m]["trainingIds"], [r["id"] for r in train])
            self.assertEqual(result["diagnostics"][m]["testIds"], [r["id"] for r in test])
            x = np.asarray([r["features"][m] for r in train], dtype=float)
            medians = np.nanmedian(x, axis=0)
            np.testing.assert_allclose(result["diagnostics"][m]["imputer"], medians)
            filled = np.where(np.isnan(x), medians, x)
            np.testing.assert_allclose(result["diagnostics"][m]["mean"], filled.mean(axis=0))
        pipeline = result["fitted"]["M2"]
        x = np.asarray([r["features"]["M2"] for r in test], dtype=float)
        modified = x.copy(); modified[:, -1] += 2
        self.assertFalse(np.allclose(pipeline.predict_proba(x), pipeline.predict_proba(modified)))

    def test_quantiles_boundaries_degenerate_folds_and_nonconvergence(self):
        edges, _ = bins([1, 2, 3, 4, 5, 6], CONFIG)
        np.testing.assert_allclose(edges, [8 / 3, 13 / 3])
        self.assertEqual(categories(edges, edges).tolist(), [0, 1])
        for values in [[1, 1, 1], [1, 1, 1, 2]]:
            with self.assertRaises(InsufficientData): bins(values, CONFIG)
        rows, split = synthetic(True)
        with self.assertRaises(ValueError): fit_fold(rows[:5], rows[5:10], CONFIG)
        insufficient = evaluate(rows, {"folds": 2}, CONFIG)[0]
        self.assertIsNone(insufficient["metrics"])
        with patch("experiment.fit_fold", side_effect=ConvergenceWarning("TEST ONLY nonconvergence")):
            failed, _ = evaluate(rows, split, CONFIG)
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(len(failed["failures"]), 5)
        self.assertEqual(failed["records"], [])
        self.assertIsNone(failed["metrics"])
        degenerate = copy.deepcopy(rows)
        for r in degenerate: r["targetDuration"] = 1
        self.assertEqual(evaluate(degenerate, split, CONFIG)[0]["status"], "failed")

    def test_bootstrap_pairing_multiplicity_and_weighting(self):
        rows = [fixture_record("A", .25, .5)] * 3 + [fixture_record("B", .5, .25), fixture_record("C", .5, .5)]
        result = bootstrap(rows, CONFIG["bootstrap"])
        draws = np.random.Generator(np.random.PCG64(20260913)).integers(0, 3, (2000, 3)).tolist()
        self.assertEqual(result["draws"], draws)
        # Independent hand-weighted arithmetic for A (+1, n=3), B (-1, n=1), C (0, n=1).
        values, macros = [], []
        for draw in draws:
            a, b, c = draw.count(0), draw.count(1), draw.count(2)
            values.append((3 * a - b) / (3 * a + b + c))
            macros.append((a - b) / 3)
        np.testing.assert_allclose(result["intervals"]["M2_vs_M1"]["pooled"], np.percentile(values, [2.5, 97.5]))
        np.testing.assert_allclose(result["intervals"]["M2_vs_M1"]["groupMacro"], np.percentile(macros, [2.5, 97.5]))
        self.assertEqual(paired_summary(rows)["gainBits"]["M2_vs_M1"], .4)

    def test_synthetic_known_coupling_and_independent_process_diagnostics(self):
        diagnostics = {"identity": "TEST ONLY synthetic diagnostics; never source evidence", "seed": 451}
        for name, coupled in [("knownCoupling", True), ("independentProcess", False)]:
            rows, split = synthetic(coupled)
            with warnings.catch_warnings():
                warnings.simplefilter("error", ConvergenceWarning)
                result, _ = evaluate(rows, split, CONFIG)
            self.assertEqual(result["status"], "completed")
            diagnostics[name] = result["metrics"]["gainBits"]
            if coupled:
                self.assertGreater(result["metrics"]["gainBits"]["M2_vs_M1"], .5)
            else:
                # Finite independent samples can have gain of either sign.
                self.assertLess(abs(result["metrics"]["gainBits"]["M2_vs_M1"]), .35)
        print(json.dumps(diagnostics))

    def test_reproducibility_tolerance_detects_change(self):
        close({"v": [1.0]}, {"v": [1 + 1e-9]}, CONFIG["reproducibility"])
        with self.assertRaises(ValueError): close({"v": [1.]}, {"v": [1.1]}, CONFIG["reproducibility"])


if __name__ == "__main__":
    unittest.main()
