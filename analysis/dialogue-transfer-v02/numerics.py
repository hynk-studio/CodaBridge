"""Scalar numerical acceptance independent of NumPy/estimator linear algebra."""
import math
import sys


def loss(y, prediction, kind):
    if not math.isfinite(prediction) or not math.isfinite(y):
        raise ValueError("NONFINITE_PREDICTION_OR_TARGET")
    if kind == "poisson":
        if y <= 0 or prediction <= 0:
            raise ValueError("NONPOSITIVE_POISSON_MEAN_OR_TARGET")
        return 2 * (y * math.log(y / prediction) - y + prediction)
    return (y - prediction) ** 2


def diagnose(x, y, coefficients, intercept, kind, config, label):
    n, p = len(y), len(coefficients)
    if not n or not all(math.isfinite(v) for row in x for v in row) or not all(math.isfinite(v) for v in [*y, *coefficients, intercept]):
        raise ValueError(f"{label}: NONFINITE_FIT_OR_TRAINING_INPUT")
    linear = [math.fsum([intercept, *(v * w for v, w in zip(row, coefficients))]) for row in x]
    predictions = [math.exp(z) if kind == "poisson" else z for z in linear]
    if not all(math.isfinite(v) and (kind != "poisson" or v > 0) for v in predictions):
        raise ValueError(f"{label}: NONFINITE_OR_NONPOSITIVE_TRAINING_PREDICTION")
    residual = [a - b for a, b in zip(predictions, y)]
    alpha = config[kind]["alpha"]
    if kind == "poisson":
        gradient = [math.fsum(row[j] * r for row, r in zip(x, residual)) / n + alpha * coefficients[j] for j in range(p)]
        gradient.append(math.fsum(residual) / n)
        objective = math.fsum(loss(t, mu, kind) / 2 for t, mu in zip(y, predictions)) / n + alpha * math.fsum(w*w for w in coefficients) / 2
        maximum, bound = max(map(abs, gradient)), config["poisson"]["tol"]
        diagnostic = {"maximumGradient": maximum, "bound": bound, "objective": objective}
    else:
        normal = [math.fsum(row[j] * r for row, r in zip(x, residual)) + alpha * coefficients[j] for j in range(p)] + [math.fsum(residual)]
        scales = [max(1, math.fsum(abs(row[j]) * (abs(a) + abs(b)) for row, a, b in zip(x, predictions, y)) + alpha * abs(coefficients[j])) for j in range(p)]
        scales.append(max(1, math.fsum(abs(a) + abs(b) for a, b in zip(predictions, y))))
        maximum = max(abs(r)/s for r, s in zip(normal, scales))
        bound = config["numerics"]["ridgeEpsilonFactor"] * sys.float_info.epsilon * (n+p+1)
        objective = math.fsum(r*r for r in residual) + alpha * math.fsum(w*w for w in coefficients)
        diagnostic = {"maximumNormalizedResidual": maximum, "maximumAbsoluteResidual": max(map(abs, normal)), "bound": bound, "objective": objective}
    if not math.isfinite(maximum) or not math.isfinite(objective) or maximum > bound:
        raise ValueError(f"{label}: NUMERICAL_ACCEPTANCE_FAILED maximum={maximum} bound={bound}")
    return diagnostic
