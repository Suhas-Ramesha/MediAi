#!/usr/bin/env python3
"""POST every form sample to the local FastAPI /predict endpoint."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.form_samples import SAMPLES  # noqa: E402

URL = os.environ.get("ML_SERVICE_URL", "http://127.0.0.1:5050")


def post(disease: str, payload: dict) -> dict:
    body = json.dumps({"disease": disease, "payload": payload}).encode()
    req = urllib.request.Request(
        f"{URL}/predict",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    with urllib.request.urlopen(f"{URL}/health", timeout=30) as resp:
        health = json.loads(resp.read().decode())
    print("health:", json.dumps(health))
    failed = 0
    for disease, rows in SAMPLES.items():
        print(f"\n======== {disease.upper()} ========")
        for name, payload in rows:
            try:
                out = post(disease, payload)
                pct = out.get("riskPercent")
                src = out.get("modelSource")
                print(f"  {name:28s}  risk={pct!s:>6}  source={src}")
            except urllib.error.HTTPError as e:
                failed += 1
                detail = e.read().decode()[:400]
                print(f"  {name:28s}  HTTP {e.code} {detail}")
            except Exception as e:
                failed += 1
                print(f"  {name:28s}  ERROR {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
