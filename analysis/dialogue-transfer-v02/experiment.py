"""Fixed v0.2 offline study owner; no public runtime import or model service."""
import copy
import math
import warnings
import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge, PoissonRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits
from numerics import diagnose, loss


def fit_fold(train, test, study, config, fold):
    if not train or not test:
        raise ValueError("EMPTY_PARTITION")
    if {r["parentGroup"] for r in train} & {r["parentGroup"] for r in test}:
        raise ValueError("GROUP_LEAKAGE")
    y = np.array([r["targets"][study["target"]] for r in train], dtype=float)
    if not np.isfinite(y).all() or (study["estimator"] == "poisson" and np.any(y <= 0)):
        raise ValueError("INVALID_TRAINING_TARGET")
    means = {"M0": np.repeat(np.mean(y), len(test)).tolist()}
    internals, failures, fit_warnings = {}, [], []
    for model in study["models"][1:]:
        label = f"{study['id']} / fold {fold} / {model}"
        try:
            kind = study["estimator"]
            x = np.array([r["features"][model] for r in train], dtype=float)
            test_x = np.array([r["features"][model] for r in test], dtype=float)
            if np.isinf(x).any() or np.isinf(test_x).any():
                raise ValueError("INFINITE_FEATURE")
            estimator = Ridge(**config["ridge"]) if kind == "ridge" else PoissonRegressor(**config["poisson"])
            pipeline = make_pipeline(SimpleImputer(**config["imputer"]), StandardScaler(**config["scaler"]), estimator)
            with threadpool_limits(limits=1), warnings.catch_warnings(record=True) as observed:
                warnings.simplefilter("always")
                pipeline.fit(x, y)
                predictions = pipeline.predict(test_x)
            notices = [{"category": w.category.__name__, "message": str(w.message), "file": w.filename.split("site-packages/")[-1], "line": w.lineno} for w in observed]
            fit_warnings.extend({"fold": fold, "model": model, **w} for w in notices)
            if any(issubclass(w.category, ConvergenceWarning) for w in observed) or (kind == "poisson" and estimator.n_iter_ >= config["poisson"]["max_iter"]):
                raise ValueError("NONCONVERGENCE")
            imputer, scaler = pipeline.steps[0][1], pipeline.steps[1][1]
            transformed = scaler.transform(imputer.transform(x)).tolist()
            diagnostic = diagnose(transformed, y.tolist(), estimator.coef_.tolist(), float(estimator.intercept_), kind, config, label)
            if not np.isfinite(predictions).all() or (kind == "poisson" and np.any(predictions <= 0)):
                raise ValueError("INVALID_HELD_OUT_PREDICTION")
            means[model] = predictions.tolist()
            internals[model] = {"trainingIds": [r["id"] for r in train], "testIds": [r["id"] for r in test], "imputer": imputer.statistics_.tolist(), "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(), "coefficients": estimator.coef_.tolist(), "intercept": float(estimator.intercept_), "iterations": int(estimator.n_iter_) if kind == "poisson" else None, "numerical": diagnostic}
        except (ValueError, FloatingPointError, OverflowError, np.linalg.LinAlgError) as error:
            failures.append({"fold": fold, "model": model, "reason": f"{label}: {error}"})
    return means, internals, failures, fit_warnings


def aggregate(records, models, contrasts):
    if not records:
        return None
    return {"n": len(records), "loss": {m: float(np.mean([r["predictions"][m]["loss"] for r in records])) for m in models}, "mae": {m: float(np.mean([r["predictions"][m]["absoluteError"] for r in records])) for m in models}, "gain": {f"{a}_vs_{b}": float(np.mean([r["predictions"][b]["loss"] - r["predictions"][a]["loss"] for r in records])) for a, b in contrasts}}


def summaries(records, models, contrasts):
    pooled = aggregate(records, models, contrasts)
    groups = sorted({r["parentGroup"] for r in records})
    if not groups:
        return {"status": "empty", "groups": 0, "pooled": None, "macro": None, "perGroup": []}
    per = [{"parentGroup": g, **aggregate([r for r in records if r["parentGroup"] == g], models, contrasts)} for g in groups]
    macro = {kind: {key: float(np.mean([g[kind][key] for g in per])) for key in pooled[kind]} for kind in ["loss", "mae", "gain"]}
    for g in per:
        g["pooledContribution"] = {key: g["n"] / len(records) * value for key, value in g["gain"].items()}
        g["macroContribution"] = {key: value / len(groups) for key, value in g["gain"].items()}
    return {"status": "limited-group-coverage" if len(groups) < 5 else "descriptive", "groups": len(groups), "pooled": pooled, "macro": macro, "perGroup": per}


def bootstrap_plan(split, config):
    groups = sorted(split["assignments"])
    return {"groups": groups, "seed": config["seed"], "generator": config["generator"], "draws": np.random.Generator(np.random.PCG64(config["seed"])).integers(0, len(groups), size=(config["resamples"], len(groups))).tolist() if groups else [], "interpretation": config["interpretation"]}


def uncertainty(metrics, plan, config):
    per = {r["parentGroup"]: r for r in metrics["perGroup"]}
    n = np.array([per[g]["n"] for g in plan["groups"]])
    draws = np.array(plan["draws"])
    intervals = {}
    for key in metrics["pooled"]["gain"]:
        values = np.array([per[g]["gain"][key] for g in plan["groups"]])
        pooled = (values[draws] * n[draws]).sum(axis=1) / n[draws].sum(axis=1)
        macro = values[draws].mean(axis=1)
        intervals[key] = {"pooled": np.percentile(pooled, config["percentiles"], method=config["method"]).tolist(), "macro": np.percentile(macro, config["percentiles"], method=config["method"]).tolist()}
    return {"intervals": intervals, "resamples": len(plan["draws"]), "interpretation": config["interpretation"]}


def evaluate_study(rows, split, study, config, plan):
    models = study["models"]
    contrasts = [(a, b) for a, b in config["metrics"]["contrasts"] if a in models and b in models]
    failures, notices, folds, internals, records = [], [], [], [], []
    if len(split["assignments"]) < 3:
        return {**study, "status": "insufficient-data", "failures": [{"reason": "FEWER_THAN_THREE_GROUPS"}], "records": [], "folds": [], "warnings": [], "metrics": None, "uncertainty": None, "deletions": [], "strata": {}, "attemptedLearnedFits": 0}, []
    for fold in range(split["folds"]):
        train = [r for r in rows if split["assignments"][r["parentGroup"]] != fold]
        test = [r for r in rows if split["assignments"][r["parentGroup"]] == fold]
        try:
            means, fitted, rejected, observed = fit_fold(train, test, study, config, fold)
            failures.extend(rejected)
            notices.extend(observed)
            median = float(np.median([r["prefix"]["latestPartnerEndAge"] for r in train]))
            y = [r["targets"][study["target"]] for r in train]
            folds.append({"fold": fold, "trainingCount": len(train), "testCount": len(test), "trainingGroups": sorted({r["parentGroup"] for r in train}), "testGroups": sorted({r["parentGroup"] for r in test}), "latestAgeMedian": median, "trainingTargetRange": [min(y), max(y)], "baseline": float(np.mean(y))})
            internals.append({"fold": fold, "models": fitted})
            if rejected:
                continue
            for i, example in enumerate(test):
                target = example["targets"][study["target"]]
                record = {k: copy.deepcopy(v) for k, v in example.items() if k != "features"}
                record.update({"fold": fold, "target": target, "predictions": {}, "strata": {"previous": "present" if example["prefix"]["previousPresent"] else "absent", "overlap": "definite" if example["prefix"]["recentOverlap"] else "no-definite-overlap", "age": "at-or-below" if example["prefix"]["latestPartnerEndAge"] <= median else "above"}})
                for model in models:
                    predicted = float(means[model][i])
                    record["predictions"][model] = {"value": predicted, "nativePoint": predicted if study["estimator"] == "poisson" else math.exp(predicted), "loss": loss(target, predicted, study["estimator"]), "absoluteError": abs(target - predicted), "outsideTrainingCountRange": study["estimator"] == "poisson" and not min(y) <= predicted <= max(y), "outsideSourceCountRange": study["estimator"] == "poisson" and not config["numerics"]["countSourceRange"][0] <= predicted <= config["numerics"]["countSourceRange"][1]}
                record["gain"] = {f"{a}_vs_{b}": record["predictions"][b]["loss"] - record["predictions"][a]["loss"] for a, b in contrasts}
                records.append(record)
        except (ValueError, OverflowError, FloatingPointError) as error:
            failures.append({"fold": fold, "model": "fold", "reason": str(error)})
    if failures:
        records = []  # Whole-endpoint unavailable: never average only successful folds.
    records.sort(key=lambda r: r["currentRow"])
    metrics = summaries(records, models, contrasts) if records else None
    strata, deletions = {}, []
    if records:
        if [r["id"] for r in records] != [r["id"] for r in rows]:
            raise ValueError("INCOMPLETE_OR_DUPLICATE_OOF_SUPPORT")
        for partition, cells in {"previous": ["present", "absent"], "overlap": ["definite", "no-definite-overlap"], "age": ["at-or-below", "above"]}.items():
            strata[partition] = {cell: summaries([r for r in records if r["strata"][partition] == cell], models, contrasts) for cell in cells}
        deletions = [{"removedRoot": group, "identity": "Fixed-prediction deletion, no refit", "remaining": summaries([r for r in records if r["parentGroup"] != group], models, contrasts)} for group in plan["groups"]]
        metrics["outOfRangeMeans"] = {m: {key: sum(r["predictions"][m][key] for r in records) for key in ["outsideTrainingCountRange", "outsideSourceCountRange"]} for m in models}
    return {**study, "status": "failed" if failures else "completed", "failures": failures, "records": records, "folds": folds, "warnings": notices, "metrics": metrics, "uncertainty": uncertainty(metrics, plan, config["bootstrap"]) if metrics else None, "deletions": deletions, "strata": strata, "attemptedLearnedFits": split["folds"] * (len(models)-1)}, internals


def evaluate(cohorts, splits, config):
    plans = {name: bootstrap_plan(split, config["bootstrap"]) for name, split in splits.items()}
    studies, fits = [], {}
    for definition in config["studies"]:
        result, internals = evaluate_study(cohorts[definition["cohort"]], splits[definition["cohort"]], definition, config, plans[definition["cohort"]])
        studies.append(result)
        fits[definition["id"]] = internals
    attempted = sum(s["attemptedLearnedFits"] for s in studies)
    if attempted > config["fitBudget"]["total"]:
        raise ValueError("FIT_BUDGET_EXCEEDED")
    return {"status": "completed" if all(s["status"] == "completed" for s in studies) else "partial", "attemptedLearnedFits": attempted, "studies": studies, "bootstrap": plans}, fits
