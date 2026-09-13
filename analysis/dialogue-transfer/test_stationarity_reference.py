"""TEST ONLY objective/gradient parity with the pinned estimator; never fits a model."""
import json
import subprocess
import unittest
import numpy as np
import sklearn
from sklearn._loss.loss import HalfMultinomialLoss
from sklearn.linear_model._linear_loss import LinearModelLoss


class StationarityReference(unittest.TestCase):
    def test_pinned_objective_and_gradient_without_fitting(self):
        self.assertEqual(sklearn.__version__, "1.7.2")
        # TEST ONLY nonstationary fixture: nontrivial classes, intercepts, C and preprocessing.
        fit = {"imputer": [2, -1], "mean": [1, 0], "scale": [2, 3],
               "coefficients": [[.4, -.2], [-.3, .5], [.1, -.1]], "intercepts": [.2, -.4, .3]}
        rows = [{"features": [None, 2], "category": 0}, {"features": [3, -2], "category": 1},
                {"features": [-1, None], "category": 2}, {"features": [4, 3], "category": 1}]
        C = 2.5
        script = """
import { readFileSync } from 'node:fs';
import { trainingObjectiveGradient } from './analysis/dialogue-transfer/stationarity.ts';
const { rows, fit, C } = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(trainingObjectiveGradient(rows, fit, C)));
"""
        scalar = json.loads(subprocess.check_output(
            ["node", "--experimental-strip-types", "--input-type=module", "-e", script],
            input=json.dumps({"rows": rows, "fit": fit, "C": C}), text=True))
        x = np.array([[((v if v is not None else fit["imputer"][j]) - fit["mean"][j]) / fit["scale"][j]
                       for j, v in enumerate(row["features"])] for row in rows])
        y = np.array([row["category"] for row in rows], dtype=float)
        weights = np.column_stack([fit["coefficients"], fit["intercepts"]])
        owner = LinearModelLoss(HalfMultinomialLoss(n_classes=3), fit_intercept=True)
        # _logistic.py's exact unweighted lbfgs scaling; evaluation only, no fit/minimize call.
        loss, gradient = owner.loss_gradient(weights, x, y, l2_reg_strength=1 / (C * len(rows)), n_threads=1)
        # 64 binary64 eps for two short, differently ordered scalar/BLAS evaluations.
        # This TEST ONLY parity tolerance is not the stationarity acceptance bound.
        tolerance = 64 * np.finfo(float).eps
        np.testing.assert_allclose(scalar["objective"], loss, atol=tolerance, rtol=0)
        np.testing.assert_allclose(scalar["gradient"], gradient[:, :-1], atol=tolerance, rtol=0)
        np.testing.assert_allclose(scalar["interceptGradient"], gradient[:, -1], atol=tolerance, rtol=0)


if __name__ == "__main__":
    unittest.main()
