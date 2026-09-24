#!/usr/bin/env python3
"""Export CatBoost copies of liver/kidney for a 4GB laptop (no TabPFN/Torch).

Bake-off still records TabPFN as the CV-AUC winner on those two diseases.
Holdout accuracy for CatBoost already clears the 85% gate, and the joblib files
are a few hundred KB instead of ~30MB plus a PyTorch foundation model.
"""
from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import joblib
from sklearn.model_selection import train_test_split

from ml.data_prep import KIDNEY_FORM_FEATURES, feature_target, load_kidney, load_liver
from ml.train_compare import (  # noqa: E402
    MODELS,
    RANDOM_STATE,
    EncodedModel,
    evaluate_model,
)


def _best_catboost_params(results_path: Path) -> dict:
    payload = json.loads(results_path.read_text())
    best_auc = -1.0
    best: dict | None = None
    for line in payload["trial_logs"]["catboost"]:
        m = re.search(r"AUC=([0-9.]+).*params=(\{.*\})", line)
        if not m:
            continue
        auc = float(m.group(1))
        params = ast.literal_eval(m.group(2))
        if auc > best_auc:
            best_auc = auc
            best = params
    if not best:
        raise RuntimeError(f"no catboost trials in {results_path}")
    print(f"  best catboost CV-AUC={best_auc:.4f}  params={best}")
    return best


def export(name: str, df) -> Path:
    print(f"\n======== {name} catboost (local) ========")
    params = _best_catboost_params(ROOT / "ml/artifacts" / f"{name}_results.json")
    X, y = feature_target(df)
    Xtr, Xho, ytr, yho = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    model = EncodedModel("catboost", params, int(ytr.sum()), int((ytr == 0).sum()))
    model.fit(Xtr, ytr)
    hold = evaluate_model(model, Xho, yho)
    print(
        f"  holdout acc={hold['accuracy']:.4f}  F1={hold['f1']:.4f}  "
        f"AUC={hold['roc_auc']:.4f}"
    )
    MODELS.mkdir(parents=True, exist_ok=True)
    path = MODELS / f"{name}_catboost.joblib"
    joblib.dump(
        {
            "disease": name,
            "algorithm": "catboost",
            "serving": "ram_local",
            "model": model,
            "columns": list(X.columns),
            "best_params": params,
            "holdout": hold,
        },
        path,
    )
    print(f"  wrote {path} ({path.stat().st_size} bytes)")
    return path


def export_kidney_form_model() -> Path:
    """4-lab CatBoost matching the risk modal (creatinine, urea, hemoglobin, BP)."""
    print("\n======== kidney catboost 4-lab (local form) ========")
    form_results = ROOT / "ml/artifacts/kidney_form_results.json"
    params_src = form_results if form_results.exists() else ROOT / "ml/artifacts/kidney_results.json"
    params = _best_catboost_params(params_src)
    pool, _ = load_kidney()
    X, y = feature_target(pool)
    X4 = X[KIDNEY_FORM_FEATURES]
    Xtr, Xho, ytr, yho = train_test_split(
        X4, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    model = EncodedModel("catboost", params, int(ytr.sum()), int((ytr == 0).sum()))
    model.fit(Xtr, ytr)
    hold = evaluate_model(model, Xho, yho)
    print(
        f"  holdout acc={hold['accuracy']:.4f}  F1={hold['f1']:.4f}  "
        f"AUC={hold['roc_auc']:.4f}"
    )
    MODELS.mkdir(parents=True, exist_ok=True)
    path = MODELS / "kidney_catboost.joblib"
    joblib.dump(
        {
            "disease": "kidney",
            "algorithm": "catboost",
            "serving": "ram_local_form_labs",
            "model": model,
            "columns": ["sc", "bu", "hemo", "bp"],
            "best_params": params,
            "holdout": hold,
            "note": (
                "Trained on the four labs the risk form collects. UCI `bp` is "
                "diastolic; the UI sends systolic and form_predict converts it."
            ),
        },
        path,
    )
    print(f"  wrote {path} ({path.stat().st_size} bytes)")
    return path


def main() -> None:
    liver, _ = load_liver()
    export("liver", liver)
    export_kidney_form_model()


if __name__ == "__main__":
    main()
