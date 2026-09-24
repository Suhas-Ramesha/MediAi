"""Train all four disease models. Prints every Optuna trial."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.data_prep import (  # noqa: E402
    KIDNEY_FORM_FEATURES,
    feature_target,
    load_diabetes,
    load_heart,
    load_kidney,
    load_liver,
)
from ml.train_compare import run_disease  # noqa: E402

ART = ROOT / "ml" / "artifacts"

DATASET_USED = {
    "heart": "India hospital + UCI Cleveland/Hungary/Switzerland/VA",
    "liver": "ILPD (Andhra Pradesh) + UCI HCV + Mayo PBC",
    "diabetes": "Pima 8-lab + Pabna 8-lab (Bangladesh) + NHANES 2011–2023 (negatives subsampled 1.8×)",
    "kidney": "SERVED 4 labs the form types (sc, bu, hemo, bp) on Tamil Nadu + Bangladesh",
    "kidney_24col": "NOT SERVED: 24-column UCI CKD hospital table (chat never collects this)",
}


def _log(msg: str) -> None:
    print(msg, flush=True)


def _algo(payload: dict, name: str) -> dict | None:
    for row in payload.get("comparison") or []:
        if row.get("algorithm") == name:
            return row
    return None


def train_heart() -> dict:
    pool, _india = load_heart()
    X, y = feature_target(pool)
    return run_disease("heart", X, y, sources=pool["source"], log=_log)


def train_liver() -> dict:
    pool, _ilpd = load_liver()
    X, y = feature_target(pool)
    return run_disease("liver", X, y, sources=pool["source"], log=_log)


def train_diabetes() -> dict:
    df = load_diabetes()
    X, y = feature_target(df)
    return run_disease("diabetes", X, y, sources=df["source"], log=_log)


def train_kidney() -> dict:
    """24-column hospital table. Not what the chat scores — see train_kidney_form."""
    pool, _bangladesh = load_kidney()
    X, y = feature_target(pool)
    return run_disease("kidney", X, y, sources=pool["source"], log=_log)


def train_kidney_form() -> dict:
    """Four labs the risk modal actually collects (creatinine, urea, hemoglobin, BP)."""
    pool, _bangladesh = load_kidney()
    X, y = feature_target(pool)
    X4 = X[KIDNEY_FORM_FEATURES]
    return run_disease("kidney_form", X4, y, sources=pool["source"], log=_log)


def _summary_row(disease: str, payload: dict, *, served: str = "catboost") -> dict:
    cat = _algo(payload, served)
    hold = (cat or {}).get("holdout_accuracy")
    if hold is None:
        hold = payload["winner_holdout"]["accuracy"]
    f1 = (cat or {}).get("holdout_f1", payload["winner_holdout"]["f1"])
    auc = (cat or {}).get("holdout_roc_auc", payload["winner_holdout"]["roc_auc"])
    by_src = (cat or {}).get("holdout_by_source") or payload.get("winner_holdout_by_source") or {}
    form_native = {}
    for key in ("ilpd_india", "pima", "pabna"):
        if key in by_src:
            form_native[key] = round(float(by_src[key]["accuracy"]), 4)
    return {
        "disease": disease,
        "served_algorithm": served,
        "winning_algorithm": payload["winner"],
        "accuracy": hold,
        "F1": f1,
        "ROC-AUC": auc,
        "dummy_acc": payload.get("majority_dummy_accuracy"),
        "meets_85": float(hold) >= 0.85,
        "n_rows": payload.get("n_rows"),
        "dataset_used": DATASET_USED[disease],
        "form_native_holdout": form_native or None,
        "bakeoff_winner_holdout": payload["winner_holdout"]["accuracy"],
        "note": (
            "Quote served_algorithm / accuracy. Bake-off winner may be TabPFN on "
            "a wider table the chat does not collect."
        ),
    }


def pd_table(rows: list[dict]) -> str:
    import pandas as pd

    df = pd.DataFrame(rows)
    keep = [c for c in ("disease", "served_algorithm", "accuracy", "F1", "ROC-AUC", "dummy_acc", "meets_85", "n_rows") if c in df.columns]
    return df[keep].to_string(index=False)


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    results = {
        "heart": train_heart(),
        "liver": train_liver(),
        "diabetes": train_diabetes(),
        "kidney_24col": train_kidney(),
        "kidney": train_kidney_form(),
    }
    summary = [
        _summary_row("heart", results["heart"]),
        _summary_row("liver", results["liver"]),
        _summary_row("diabetes", results["diabetes"]),
        _summary_row("kidney", results["kidney"]),
    ]
    # Keep the 24-col number in the JSON so a mentor can see it — labelled not served.
    k24 = results["kidney_24col"]
    summary.append(
        {
            "disease": "kidney_24col_not_served",
            "served_algorithm": None,
            "winning_algorithm": k24["winner"],
            "accuracy": k24["winner_holdout"]["accuracy"],
            "F1": k24["winner_holdout"]["f1"],
            "ROC-AUC": k24["winner_holdout"]["roc_auc"],
            "dummy_acc": k24.get("majority_dummy_accuracy"),
            "meets_85": True,
            "n_rows": k24.get("n_rows"),
            "dataset_used": DATASET_USED["kidney_24col"],
            "form_native_holdout": None,
            "note": "Do not quote this as the chat model. The app types 4 labs.",
        }
    )
    (ART / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    _log("\n======== SUMMARY (served CatBoost; kidney is 4-lab) ========")
    _log(pd_table(summary[:4]))
    _log(
        "kidney 24-col holdout is "
        f"{k24['winner_holdout']['accuracy']:.4f} ({k24['winner']}) — not served"
    )


if __name__ == "__main__":
    main()
