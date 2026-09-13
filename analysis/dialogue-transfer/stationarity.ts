// Independent scalar evaluation only: no estimator, BLAS or fitting dependency.
import assert from "node:assert/strict";

export interface SavedFit {
  imputer: number[]; mean: number[]; scale: number[];
  coefficients: number[][]; intercepts: number[];
}
export interface TrainingRow { features: (number | null)[]; category: number }

export function reconstructPrediction(features: TrainingRow["features"], fit: SavedFit) {
  const x = features.map((v, j) => ((v ?? fit.imputer[j]) - fit.mean[j]) / fit.scale[j]);
  const logits = fit.coefficients.map((w, k) => w.reduce((sum, v, j) => sum + v * x[j], fit.intercepts[k]));
  const maximum = Math.max(...logits), exp = logits.map(v => Math.exp(v - maximum)), sum = exp.reduce((a, b) => a + b, 0);
  return { x, logits, logNormalizer: Math.log(sum), maximum, p: exp.map(v => v / sum) };
}

// sklearn 1.7.2 _logistic.py uses l2_reg_strength = 1 / (C * n) for lbfgs.
// _linear_loss.py: mean natural-log loss + ||W||² / (2*C*n), unpenalized intercept.
// Training uses natural logs; the separate held-out reporting metric uses log2.
export function trainingObjectiveGradient(rows: TrainingRow[], fit: SavedFit, C: number) {
  assert.ok(rows.length > 0 && Number.isFinite(C) && C > 0, "Invalid training count or regularization");
  const divisor = rows.length * C;
  const gradient = fit.coefficients.map(w => w.map(v => v / divisor));
  const interceptGradient = fit.intercepts.map(() => 0);
  let objective = fit.coefficients.flat().reduce((sum, v) => sum + v * v, 0) / (2 * divisor);
  for (const row of rows) {
    const { x, p, logits, maximum, logNormalizer } = reconstructPrediction(row.features, fit);
    objective += (logNormalizer + (maximum - logits[row.category])) / rows.length;
    for (let k = 0; k < fit.coefficients.length; k++) {
      const residual = (p[k] - Number(k === row.category)) / rows.length;
      interceptGradient[k] += residual;
      x.forEach((v, j) => { gradient[k][j] += residual * v; });
    }
  }
  return { objective, gradient, interceptGradient };
}

export function assertTrainingStationarity(diagnostic: ReturnType<typeof trainingObjectiveGradient>, tolerance: number, identity: { fold: number; model: string }) {
  const label = `Fold ${identity.fold} / ${identity.model}`; // zero-based fold ID from the saved manifest
  assert.ok(Number.isFinite(tolerance) && tolerance > 0, `${label}: invalid frozen protocol tolerance`);
  const components = [...diagnostic.gradient.flat(), ...diagnostic.interceptGradient];
  assert.ok(components.length > 0 && components.every(Number.isFinite), `${label}: nonfinite training gradient`);
  assert.ok(Number.isFinite(diagnostic.objective), `${label}: nonfinite training objective`);
  const maximum = Math.max(...components.map(Math.abs));
  // No bound constraints: L-BFGS-B's projected gradient is the ordinary gradient.
  // Enforce the frozen gtol exactly; no extra floating-point allowance is introduced.
  assert.ok(maximum <= tolerance, `${label}: maximum training gradient ${maximum} exceeds frozen protocol tolerance ${tolerance}`);
  return maximum;
}
