"""Committed fixed package runner. --check never overwrites an artifact."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import subprocess

for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ[name] = "1"
from experiment import evaluate

ROOT = Path(__file__).resolve().parents[2]
BASE = Path("analysis/dialogue-transfer-v02")
FREEZE = "ab422e5e9df914a924f7df65229fefd1cb1711f3"

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)

def read(path):
    return json.loads((ROOT / path).read_text())

def encoded(value):
    return (json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False)+"\n").encode()

def sha(value):
    return hashlib.sha256(value).hexdigest()

def close(a, b, tolerance, path="root"):
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            raise ValueError(f"Reproduction keys differ: {path}")
        for key in a:
            close(a[key], b[key], tolerance, f"{path}.{key}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            raise ValueError(f"Reproduction support differs: {path}")
        for i, (left, right) in enumerate(zip(a, b)):
            close(left, right, tolerance, f"{path}[{i}]")
    elif isinstance(a, (int, float)) and not isinstance(a, bool) and isinstance(b, (int, float)):
        if not math.isfinite(a) or not math.isfinite(b) or abs(a-b) > tolerance["absoluteTolerance"]+tolerance["relativeTolerance"]*abs(b):
            raise ValueError(f"Reproduction number differs: {path}")
    elif a != b:
        raise ValueError(f"Reproduction differs: {path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    os.chdir(ROOT)
    if platform.python_version() != "3.12.14":
        raise ValueError("Use isolated pinned Python 3.12.14")
    versions = {"python": platform.python_version()}
    for line in (BASE / "requirements.txt").read_text().splitlines():
        name, expected = line.split("==")
        versions[name] = importlib.metadata.version(name)
        if versions[name] != expected:
            raise ValueError(f"Pinned version changed: {name}")
    manifest = read(BASE / "input-manifest.json")
    for row in manifest["v01Preserved"]:
        if sha((ROOT / row["path"]).read_bytes()) != row["sha256"] or sha(git("show", f"{manifest['baseline']}:{row['path']}")) != row["sha256"]:
            raise ValueError(f"v0.1 protected file changed: {row['path']}")
    frozen = [row["path"] for row in manifest["inputs"]] + [str(BASE / "input-manifest.json")]
    for path in frozen:
        if git("show", f"{FREEZE}:{path}") != (ROOT / path).read_bytes():
            raise ValueError(f"Frozen v0.2 input changed: {path}")
    outputs_exist = (BASE / "results/report.json").exists()
    if outputs_exist and not args.check:
        raise ValueError("Saved run exists; use --check. Do not overwrite results.")
    saved = read(BASE / "results/report.json") if args.check else None
    producer = saved["provenance"]["producerCommit"] if saved else git("rev-parse", "HEAD").decode().strip()
    git("merge-base", "--is-ancestor", FREEZE, producer)
    hashes = {}
    for path in frozen + [str(BASE / file) for file in ["experiment.py", "numerics.py", "run.py"]]:
        data = (ROOT / path).read_bytes()
        if git("show", f"{producer}:{path}") != data:
            raise ValueError(f"Commit producer before scoring: {path}")
        hashes[path] = sha(data)
    config = read(BASE / "protocol.json")
    cohorts = {name: read(BASE / f"inputs/{name}.json") for name in ["core", "coverage"]}
    splits = {name: read(BASE / f"{name}-split.json") for name in cohorts}
    result, fits = evaluate(cohorts, splits, config)
    calls = {c["sourceLine"]: c for c in read("analysis/dialogue-transfer/inputs/validated.json")["calls"]}
    examples = []
    for id_ in splits["core"]["selectedExamples"]:
        row = next(r for r in cohorts["core"] if r["id"] == id_)
        examples.append({"id": id_, "currentRow": row["currentRow"], "cutoff": row["cutoff"], "rec": row["rec"], "parentGroup": row["parentGroup"], "history": [calls[line] for line in row["selfRows"]+row["recentRows"]+row["laggedRows"]], "target": calls[row["targetRow"]], "gapSeconds": row["targetGapSeconds"]})
    provenance = {"freezeCommit": FREEZE, "producerCommit": producer, "producerTree": git("rev-parse", f"{producer}^{{tree}}").decode().strip(), "artifactCommit": "later commit containing saved results; not producer", "hashes": hashes, "versions": versions, "platform": saved["provenance"]["platform"] if saved else platform.platform(), "numericalTolerance": config["reproducibility"]}
    report = {"schemaVersion": "dialogue-transfer-report-v02", "identity": "Precomputed held-out exploratory research", "provenance": provenance, "source": read("data/context/source-record.json"), "sourceAudit": read(BASE / "source-audit.json"), "protocol": config, "cohorts": read(BASE / "eligibility-audit.json"), "splits": splits, **result, "examples": examples, "limitations": config["limitations"]}
    studies = []
    for study in result["studies"]:
        studies.append({k: v for k, v in study.items() if k not in ["records", "deletions", "warnings", "strata"]} | {"warningsCount": len(study["warnings"]), "selectedRecords": [r for r in study["records"] if r["id"] in splits["core"]["selectedExamples"]] if study["cohort"] == "core" else [], "strata": {partition: {cell: {k: v for k, v in values.items() if k != "perGroup"} for cell, values in cells.items()} for partition, cells in study["strata"].items()}, "deletions": [{"removedRoot": d["removedRoot"], "n": d["remaining"]["pooled"]["n"], "pooledGain": d["remaining"]["pooled"]["gain"], "macroGain": d["remaining"]["macro"]["gain"]} for d in study["deletions"]]})
    summary = {"schemaVersion": "dialogue-transfer-summary-v02", "identity": report["identity"], "status": report["status"], "source": {"recordUrl": report["source"]["recordUrl"], "releaseCommit": report["source"]["releaseCommit"], "csvSha256": config["sourceSha256"], "license": "CC BY 4.0", "attribution": "Sharma et al.; Dominica Sperm Whale Project (2024)"}, "provenance": provenance, "cohorts": {k: report["cohorts"][k] for k in ["core", "coverage", "beforeHistoryRequirement", "fewerThanTwoCost"]}, "studies": studies, "examples": examples, "limitations": config["limitations"], "report": {"path": "/prediction-v02/dialogue-transfer-report.json", "sha256": sha(encoded(report)), "bytes": len(encoded(report))}}
    if len(encoded(summary)) > config["publicBounds"]["summaryBytes"] or len(encoded(report)) > config["publicBounds"]["reportBytes"]:
        raise ValueError("PUBLIC_ARTIFACT_SIZE_BOUND_EXCEEDED")
    outputs = {BASE / "results/report.json": report, BASE / "results/fold-fits.json": fits, Path("public/prediction-v02/dialogue-transfer-report.json"): report, Path("public/prediction-v02/summary.json"): summary}
    if args.check:
        for path, value in outputs.items():
            if path.name == "summary.json":
                value["report"] = read(path)["report"]
            close(value, read(path), config["reproducibility"], str(path))
        print("V0.2 REPRODUCTION PASS: fixed package, no outputs overwritten; atol=1e-8 rtol=1e-7")
    else:
        for path, value in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(encoded(value))
        print(json.dumps({"status": report["status"], "attemptedLearnedFits": result["attemptedLearnedFits"], "summaryBytes": len(encoded(summary)), "reportBytes": len(encoded(report)), "studies": [{"id": s["id"], "status": s["status"], "failures": s["failures"], "warnings": len(s["warnings"]), "pooled": None if not s["metrics"] else s["metrics"]["pooled"], "intervals": s["uncertainty"]} for s in result["studies"]]}, indent=2))

if __name__ == "__main__":
    main()
