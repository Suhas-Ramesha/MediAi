"""Train all four disease models. Prints every Optuna trial."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.data_prep import (  # noqa: E402
    feature_target,
    load_diabetes,
    load_heart,
    load_kidney,
    load_liver,
)
from ml.train_compare import run_disease  # noqa: E402

ART = ROOT / "ml" / "artifacts"


def _log(msg: str) -> None:
    print(msg, flush=True)


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
    primary, secondary = load_kidney()
    X, y = feature_target(primary)
    Xs, ys = feature_target(secondary)
    common = [c for c in X.columns if c in Xs.columns and c != "bp"]
    return run_disease(
        "kidney",
        X,
        y,
        secondary=(Xs[common], ys) if common else None,
        sources=primary["source"],
        log=_log,
    )


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    results = {
        "heart": train_heart(),
        "liver": train_liver(),
        "diabetes": train_diabetes(),
        "kidney": train_kidney(),
    }
    summary = []
    for disease, payload in results.items():
        hold = payload["winner_holdout"]
        summary.append(
            {
                "disease": disease,
                "winning_algorithm": payload["winner"],
                "accuracy": hold["accuracy"],
                "f1": hold["f1"],
                "roc_auc": hold["roc_auc"],
                "dataset": {
                    "heart": "India hospital + UCI Cleveland/Hungary/Switzerland/VA",
                    "liver": "ILPD (Andhra Pradesh) + UCI HCV",
                    "diabetes": "Pima (8-lab form; zeros recoded to NA)",
                    "kidney": "UCI CKD Tamil Nadu (leak-blocked) + Bangladesh secondary",
                }[disease],
            }
        )
    (ART / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    _log("\n======== SUMMARY ========")
    _log(pd_table(summary))


def pd_table(rows: list[dict]) -> str:
    import pandas as pd

    df = pd.DataFrame(rows)
    return df.to_string(index=False)


if __name__ == "__main__":
    main()
