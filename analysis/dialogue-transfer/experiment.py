"""Bounded offline statistical owner. Never imported by the public runtime."""
import warnings
import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

MODELS = ("M0", "M1", "M2", "M2-lagged")
CONTRASTS = (("M2", "M1"), ("M2-lagged", "M1"), ("M2", "M2-lagged"))


class InsufficientData(ValueError):
    pass


def bins(training_durations, config):
    edges = np.quantile(training_durations, config["target"]["quantiles"], method=config["target"]["method"])
    if not np.all(np.isfinite(edges)) or edges[0] >= edges[1]:
        raise InsufficientData("COLLAPSED_TRAINING_EDGES")
    labels = categories(training_durations, edges)
    if set(labels) != {0, 1, 2}:
        raise InsufficientData("MISSING_TRAINING_CLASS")
    return edges, labels


def categories(durations, edges):
    return np.searchsorted(edges, durations, side="left")


def scoring(raw, epsilon):
    raw = np.asarray(raw, dtype=float)
    if raw.ndim != 2 or raw.shape[1] != 3 or not np.all(np.isfinite(raw)) or np.any(raw < 0) or np.any(raw > 1) or not np.allclose(raw.sum(axis=1), 1, atol=1e-10, rtol=0):
        raise ValueError("INVALID_PROBABILITIES")
    floored = np.maximum(raw, epsilon)
    return floored / floored.sum(axis=1, keepdims=True), (raw < epsilon).sum(axis=1)


def losses(probabilities, labels):
    return -np.log2(probabilities[np.arange(len(labels)), labels])


def fit_fold(train, test, config):
    if not train or not test:
        raise InsufficientData("EMPTY_PARTITION")
    if {r["parentGroup"] for r in train} & {r["parentGroup"] for r in test}:
        raise ValueError("GROUP_LEAKAGE")
    edges, y = bins([r["targetDuration"] for r in train], config)
    test_y = categories([r["targetDuration"] for r in test], edges)
    counts = np.bincount(y, minlength=3)
    predictions = {"M0": np.tile(counts / len(y), (len(test), 1))}
    fitted = {}
    diagnostics = {}
    with threadpool_limits(limits=1):
        for name in MODELS[1:]:
            # New pipeline per model, including a separately trained lagged control.
            pipeline = make_pipeline(SimpleImputer(**config["imputer"]), StandardScaler(**config["scaler"]), LogisticRegression(**config["logistic"]))
            x = np.asarray([r["features"][name] for r in train], dtype=float)
            test_x = np.asarray([r["features"][name] for r in test], dtype=float)
            if np.any(np.isinf(x)) or np.any(np.isinf(test_x)):
                raise ValueError("NONFINITE_FEATURE")
            with warnings.catch_warnings():
                warnings.simplefilter("error", ConvergenceWarning)
                pipeline.fit(x, y)
            predictions[name] = pipeline.predict_proba(test_x)
            imputer, scaler, model = pipeline.steps[0][1], pipeline.steps[1][1], pipeline.steps[2][1]
            if not np.array_equal(model.classes_, [0, 1, 2]) or np.max(model.n_iter_) >= config["logistic"]["max_iter"]:
                raise ValueError("NONCONVERGENCE_OR_CLASSES")
            fitted[name] = pipeline
            diagnostics[name] = {"imputer": imputer.statistics_.tolist(), "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "coefficients": model.coef_.tolist(), "intercepts": model.intercept_.tolist(), "iterations": model.n_iter_.tolist(), "trainingIds": [r["id"] for r in train], "testIds": [r["id"] for r in test]}
    return {"edges": edges.tolist(), "trainClassCounts": counts.tolist(), "testClassCounts": np.bincount(test_y, minlength=3).tolist(), "labels": test_y, "raw": predictions, "diagnostics": diagnostics, "fitted": fitted}


def paired_summary(records):
    if not records:
        raise InsufficientData("EMPTY_EVALUATION")
    matrix = np.asarray([[r["predictions"][m]["logLossBits"] for m in MODELS] for r in records])
    gain = {f"{a}_vs_{b}": float(np.mean(matrix[:, MODELS.index(b)] - matrix[:, MODELS.index(a)])) for a, b in CONTRASTS}
    return {"n": len(records), "classCounts": np.bincount([r["category"] for r in records], minlength=3).tolist(), "logLossBits": dict(zip(MODELS, np.mean(matrix, axis=0).tolist())), "gainBits": gain}


def bootstrap(records, config):
    groups = sorted({r["parentGroup"] for r in records})
    if len(groups) < 3:
        raise InsufficientData("FEWER_THAN_THREE_GROUPS")
    by_group = [[r for r in records if r["parentGroup"] == g] for g in groups]
    n = np.asarray([len(rows) for rows in by_group])
    gains = np.asarray([[paired_summary(rows)["gainBits"][f"{a}_vs_{b}"] for a, b in CONTRASTS] for rows in by_group])
    rng = np.random.Generator(np.random.PCG64(config["seed"]))
    draws = rng.integers(0, len(groups), size=(config["resamples"], len(groups)))
    pooled = (gains[draws] * n[draws, None]).sum(axis=1) / n[draws].sum(axis=1)[:, None]
    macro = gains[draws].mean(axis=1)
    return {"groups": groups, "draws": draws.tolist(), "resamples": config["resamples"], "seed": config["seed"], "weighting": config["weighting"], "coverage": "limited; conditional on fitted OOF records; no model-refit uncertainty or certified encounter independence", "intervals": {f"{a}_vs_{b}": {"pooled": np.percentile(pooled[:, i], config["percentiles"], method=config["method"]).tolist(), "groupMacro": np.percentile(macro[:, i], config["percentiles"], method=config["method"]).tolist()} for i, (a, b) in enumerate(CONTRASTS)}}


def evaluate(examples, split, config):
    if split["folds"] < 3:
        return {"status": "insufficient-data", "failures": [{"fold": None, "reason": "FEWER_THAN_THREE_GROUPS"}], "folds": [], "records": [], "metrics": None, "bootstrap": None}, []
    records, folds, internals, failures = [], [], [], []
    for fold in range(split["folds"]):
        train = [e for e in examples if split["assignments"][e["parentGroup"]] != fold]
        test = [e for e in examples if split["assignments"][e["parentGroup"]] == fold]
        try:
            result = fit_fold(train, test, config)
            fold_meta = {"fold": fold, "trainingGroups": sorted({r["parentGroup"] for r in train}), "testGroups": sorted({r["parentGroup"] for r in test}), "trainingCount": len(train), "testCount": len(test), "edges": result["edges"], "trainClassCounts": result["trainClassCounts"], "testClassCounts": result["testClassCounts"], "iterations": {m: d["iterations"] for m, d in result["diagnostics"].items()}}
            folds.append(fold_meta)
            internals.append({"fold": fold, "models": result["diagnostics"]})
            probabilities = {m: scoring(result["raw"][m], config["probabilities"]["epsilon"]) for m in MODELS}
            for i, e in enumerate(test):
                predictions = {m: {"raw": result["raw"][m][i].tolist(), "scoring": probabilities[m][0][i].tolist(), "clippedClasses": int(probabilities[m][1][i]), "logLossBits": float(-np.log2(probabilities[m][0][i, result["labels"][i]]))} for m in MODELS}
                records.append({k: v for k, v in e.items() if k != "features"} | {"fold": fold, "category": int(result["labels"][i]), "edges": result["edges"], "predictions": predictions, "gainBits": {f"{a}_vs_{b}": predictions[b]["logLossBits"] - predictions[a]["logLossBits"] for a, b in CONTRASTS}})
        except (ValueError, ConvergenceWarning, FloatingPointError) as error:
            failures.append({"fold": fold, "reason": str(error), "type": type(error).__name__, "trainingCount": len(train), "testCount": len(test)})
    # Never compute aggregate on unequal or successful-fold-only support.
    if failures or len(records) != len(examples):
        return {"status": "failed", "failures": failures or [{"reason": "INCOMPLETE_SUPPORT"}], "folds": folds, "records": [], "metrics": None, "bootstrap": None}, internals
    records.sort(key=lambda r: r["currentRow"])
    group_metrics = [{"parentGroup": g, **paired_summary([r for r in records if r["parentGroup"] == g])} for g in sorted(split["assignments"])]
    metrics = {**paired_summary(records), "perGroup": group_metrics, "groupMacroGainBits": {key: float(np.mean([g["gainBits"][key] for g in group_metrics])) for key in records[0]["gainBits"]}, "clipping": {m: {"classes": sum(r["predictions"][m]["clippedClasses"] for r in records), "rows": sum(r["predictions"][m]["clippedClasses"] > 0 for r in records)} for m in MODELS}}
    return {"status": "completed", "failures": [], "folds": folds, "records": records, "metrics": metrics, "bootstrap": bootstrap(records, config["bootstrap"])}, internals
