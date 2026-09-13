"""Run only the committed protocol. --check reproduces without overwriting artifacts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import importlib.metadata

# Bound native libraries before importing NumPy, never inspect provider secrets.
for variable in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ[variable] = "1"
from experiment import evaluate  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BASE = Path("analysis/dialogue-transfer")
FREEZE = "5c07c77ec8f9b3a028737ec7a73b63181e44ee98"
FROZEN = ["protocol.json", "features-v1.json", "split-manifest.json", "eligibility-audit.json", "inputs/cohort.json", "inputs/validated.json", "requirements.txt", "cohort.ts"]
PRODUCER_FILES = [str(BASE / f) for f in FROZEN + ["experiment.py", "run.py"]] + ["scripts/prepare-prediction.ts", "src/lab/parse.ts", "src/lab/model.ts", "data/context/sperm-whale-dialogues.csv", "data/context/source-record.json", "data/context/1-exchange-plot.ipynb.txt", "data/context/4-rubato.ipynb.txt"]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads((ROOT / path).read_text())


def encoded(value):
    return (json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n").encode()


def check_versions():
    if platform.python_version() != "3.12.14":
        raise ValueError("Use pinned Python 3.12.14 in the isolated environment")
    versions = {"python": platform.python_version()}
    for line in (ROOT / BASE / "requirements.txt").read_text().splitlines():
        name, expected = line.split("==")
        actual = importlib.metadata.version(name)
        if actual != expected:
            raise ValueError(f"Pinned dependency mismatch: {name}")
        versions[name] = actual
    return versions


def binding(call):
    return {"sourceLine": call["sourceLine"], "rec": call["rec"], "caller": call["caller"], "onset": call["onset"], "end": call["onset"] + call["duration"], "duration": call["duration"], "clickCount": len(call["clicks"])}


def close(actual, expected, tolerance, path="root"):
    if isinstance(actual, dict) and isinstance(expected, dict):
        if actual.keys() != expected.keys():
            raise ValueError(f"Reproduction keys differ: {path}")
        for key in actual:
            close(actual[key], expected[key], tolerance, f"{path}.{key}")
    elif isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected):
            raise ValueError(f"Reproduction length differs: {path}")
        for i, (a, b) in enumerate(zip(actual, expected)):
            close(a, b, tolerance, f"{path}[{i}]")
    elif isinstance(actual, (int, float)) and not isinstance(actual, bool) and isinstance(expected, (int, float)):
        if abs(actual - expected) > tolerance["absoluteTolerance"] + tolerance["relativeTolerance"] * abs(expected):
            raise ValueError(f"Reproduction number differs: {path}")
    elif actual != expected:
        raise ValueError(f"Reproduction differs: {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    os.chdir(ROOT)
    versions = check_versions()
    for file in FROZEN:
        path = str(BASE / file)
        if git("show", f"{FREEZE}:{path}") != (ROOT / path).read_bytes():
            raise ValueError(f"Frozen input changed: {path}")
    if args.check:
        saved = read(BASE / "results/report.json")
        producer = saved["provenance"]["producerCommit"]
    else:
        if (ROOT / BASE / "results/report.json").exists():
            raise ValueError("Saved run exists. Use --check; preserve prior artifacts before any documented correction.")
        producer = git("rev-parse", "HEAD").decode().strip()
    git("merge-base", "--is-ancestor", FREEZE, producer)
    hashes = {}
    for path in PRODUCER_FILES:
        data = (ROOT / path).read_bytes()
        if git("show", f"{producer}:{path}") != data:
            raise ValueError(f"Commit producer code/inputs before scoring: {path}")
        hashes[path] = digest(data)
    config = read(BASE / "protocol.json")
    examples = read(BASE / "inputs/cohort.json")["examples"]
    split = read(BASE / "split-manifest.json")
    calls = {c["sourceLine"]: c for c in read(BASE / "inputs/validated.json")["calls"]}
    audit = read(BASE / "eligibility-audit.json")
    result, internals = evaluate(examples, split, config)
    for r in result["records"]:
        r["sourceBindings"] = {"current": binding(calls[r["currentRow"]]), "target": binding(calls[r["targetRow"]]), "self": [binding(calls[line]) for line in r["selfRows"]], "recent": [binding(calls[line]) for line in r["recentRows"]], "lagged": [binding(calls[line]) for line in r["laggedRows"]]}
    selected = []
    for id_ in split["selectedExamples"]:
        match = next((r for r in result["records"] if r["id"] == id_), None)
        if match:
            selected.append({"record": match, "history": [calls[line] for line in dict.fromkeys(match["selfRows"] + match["recentRows"] + match["laggedRows"])], "target": calls[match["targetRow"]]})
    report = {"schemaVersion": "dialogue-transfer-report-v1", "identity": "Precomputed held-out prediction", "question": "Does completed partner history improve the next recorded focal coda's duration-category prediction beyond its own history?", "provenance": {"freezeCommit": FREEZE, "producerCommit": producer, "producerTree": git("rev-parse", f"{producer}^{{tree}}").decode().strip(), "artifactCommit": "later commit containing this file; not the producer", "hashes": hashes, "versions": versions, "platform": platform.platform(), "threads": 1, "numericalTolerance": config["reproducibility"]}, "source": read("data/context/source-record.json"), "protocol": config, "cohort": {k: audit[k] for k in ["sourceRows", "validRows", "excludedRows", "exactRecGroups", "recordingPrefixes", "sixCharacterRoots", "longValidCodas", "beforeLagRequirement", "lagRequirementCost", "eligibleExamples", "eligibleRecGroups", "eligibleParentGroups", "exclusionCounts"]}, "split": split, **result, "selectedExamples": selected, "limitations": config["limitations"]}
    summary = {k: report[k] for k in ["identity", "question", "status", "failures", "cohort", "folds", "metrics", "selectedExamples", "limitations"]}
    summary.update({"schemaVersion": "dialogue-transfer-summary-v1", "provenance": report["provenance"], "source": {"recordUrl": report["source"]["recordUrl"], "license": "CC BY 4.0", "releaseCommit": report["source"]["releaseCommit"], "csvSha256": config["sourceSha256"], "attribution": "Sharma et al.; Dominica Sperm Whale Project. Contextual and combinatorial structure in sperm whale vocalisations (2024)."}, "uncertainty": None if not result["bootstrap"] else {k: v for k, v in result["bootstrap"].items() if k != "draws"}, "report": {"path": "/prediction/dialogue-transfer-report.json", "sha256": digest(encoded(report)), "bytes": len(encoded(report))}})
    outputs = {BASE / "results/report.json": report, BASE / "results/fold-fits.json": internals, Path("public/prediction/dialogue-transfer-report.json"): report, Path("public/prediction/summary.json"): summary}
    if args.check:
        for path, value in outputs.items():
            # platform metadata is observation of the original run, not a numerical claim.
            if isinstance(value, dict) and "provenance" in value:
                value["provenance"]["platform"] = saved["provenance"]["platform"]
            if path.name == "summary.json":
                value["report"] = read(path)["report"]
            close(value, read(path), config["reproducibility"], str(path))
        print("REPRODUCIBILITY PASS: same protocol, folds and probabilities/metrics within atol=1e-8 rtol=1e-7; no artifacts overwritten")
    else:
        for path, value in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(encoded(value))
        print(json.dumps({"status": report["status"], "examples": len(report["records"]), "cohort": report["cohort"], "metrics": report["metrics"], "intervals": None if not report["bootstrap"] else report["bootstrap"]["intervals"], "failures": report["failures"]}, indent=2))
    return 0 if report["status"] == "completed" else 2


if __name__ == "__main__":
    sys.exit(main())
