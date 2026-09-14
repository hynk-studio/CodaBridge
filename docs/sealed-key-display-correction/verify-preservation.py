"""One-time correction evidence against the reviewed commit; no app-code freeze."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
REVIEWED = "c13210ad9d4aec4a0e146a3732e82b4a95cb7756"
EDITED = {"src/exchange/Exchange.tsx", "tests/browser/sealed.spec.ts", "docs/MVP_08.md"}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


records = []
total_bytes = 0
for entry in git("ls-tree", "-rz", REVIEWED).split(b"\0"):
    if not entry:
        continue
    meta, raw_path = entry.split(b"\t", 1)
    mode, kind, expected = meta.decode().split()
    path = raw_path.decode()
    assert kind == "blob", path
    if path in EDITED:
        continue
    actual = os.readlink(ROOT / path).encode() if mode == "120000" else (ROOT / path).read_bytes()
    blob = hashlib.sha1(b"blob " + str(len(actual)).encode() + b"\0" + actual).hexdigest()
    assert blob == expected, "Changed historical file: " + path
    total_bytes += len(actual)
    records.append({"path": path, "bytes": len(actual), "gitBlob": blob, "sha256": hashlib.sha256(actual).hexdigest()})

changed = set(git("diff", "--name-only", REVIEWED).decode().splitlines())
assert all(p in EDITED or p.startswith("docs/sealed-key-display-correction/") for p in changed), sorted(changed)
protected = {"src/exchange/sealed.ts", "src/exchange/format.ts", "src/exchange/json.ts", "src/exchange/session.ts", "scripts/verify-sealed.mjs", "tests/sealed.test.ts"}
print(json.dumps({
    "scope": "Read-only delivery comparison, not a future application guard",
    "reviewedHead": REVIEWED,
    "reviewedTree": git("rev-parse", REVIEWED + "^{tree}").decode().strip(),
    "allowedExistingEdits": sorted(EDITED),
    "unchangedTrackedFiles": len(records),
    "comparedBytes": total_bytes,
    "orderedFileIdentitiesSha256": hashlib.sha256(json.dumps(records, separators=(",", ":")).encode()).hexdigest(),
    "priorSealedEvidenceFiles": sum(r["path"].startswith("docs/sealed-coda-v1/") for r in records),
    "cryptographicAndSessionFiles": [r for r in records if r["path"] in protected],
    "allOtherReviewedFilesExact": True,
}, indent=2))
