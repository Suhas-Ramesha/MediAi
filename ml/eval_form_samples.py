#!/usr/bin/env python3
"""Score form-shaped sample payloads against the four trained models."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "2")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.form_predict import MODELS, predict_form  # noqa: E402
from ml.form_samples import SAMPLES  # noqa: E402


def main() -> None:
    print("model files:")
    for d, p in MODELS.items():
        print(f"  {d}: {p} exists={p.exists()} bytes={p.stat().st_size if p.exists() else 0}")
    print()
    report: dict[str, dict[str, float]] = {}
    for disease, rows in SAMPLES.items():
        print(f"======== {disease.upper()} ========")
        report[disease] = {}
        for name, payload in rows:
            out = predict_form(disease, payload)
            report[disease][name] = out["riskPercent"]
            print(
                f"  {name:28s}  p={out['probability']:.3f}  "
                f"risk={out['riskPercent']:5.1f}%  label={out['label']}"
            )
        print()
    out_path = ROOT / "ml/artifacts/form_sample_eval.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
