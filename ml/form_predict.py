"""Map MediAI risk-form payloads onto the four trained classifiers.

The UI strings/slider names are not the same as the training columns.
This module is the single translation layer used by eval scripts and the ML service.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

os.environ.setdefault("TABPFN_MODEL_VERSION", "v2")

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "heart": ROOT / "ml/artifacts/models/heart_catboost.joblib",
    "liver": ROOT / "ml/artifacts/models/liver_tabpfn.joblib",
    "diabetes": ROOT / "ml/artifacts/models/diabetes_catboost.joblib",
    "kidney": ROOT / "ml/artifacts/models/kidney_tabpfn.joblib",
}

# UCI Cleveland encodings used in training (see data/AUDIT.md).
CP_MAP = {
    "typical angina": 1,
    "atypical angina": 2,
    "non-anginal pain": 3,
    "nonanginal pain": 3,
    "asymptomatic (no chest pain)": 4,
    "asymptomatic": 4,
}
FBS_MAP = {
    "no (under 120 mg/dl)": 0,
    "yes (over 120 mg/dl)": 1,
    "no": 0,
    "yes": 1,
}
RESTECG_MAP = {
    "normal": 0,
    "st-t wave abnormality": 1,
    "left ventricular hypertrophy": 2,
}
SLOPE_MAP = {
    "upsloping": 1,
    "flat": 2,
    "downsloping": 3,
}
THAL_MAP = {
    "normal": 3,
    "fixed defect": 6,
    "reversible defect": 7,
}
EXANG_MAP = {"no": 0, "yes": 1}
SEX_MAP = {"male": 1, "m": 1, "1": 1, "female": 0, "f": 0, "0": 0}


def _key(val: Any) -> str:
    return str(val).strip().lower()


def _num(val: Any, default: float | None = None) -> float:
    if val is None or val == "":
        if default is None:
            return np.nan
        return float(default)
    try:
        return float(val)
    except (TypeError, ValueError):
        if default is None:
            return np.nan
        return float(default)


def diabetes_frame(payload: dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "pregnancies": _num(payload.get("pregnancies"), 0),
                "glucose": _num(payload.get("glucose")),
                "bp": _num(payload.get("bp")),
                "skin": _num(payload.get("skin")),
                "insulin": _num(payload.get("insulin")),
                "bmi": _num(payload.get("bmi")),
                "pedigree": _num(payload.get("pedigree")),
                "age": _num(payload.get("age")),
            }
        ]
    )


def heart_frame(payload: dict[str, Any]) -> pd.DataFrame:
    sex_raw = payload.get("sex", payload.get("gender", 1))
    return pd.DataFrame(
        [
            {
                "age": _num(payload.get("age")),
                "sex": SEX_MAP.get(_key(sex_raw), _num(sex_raw, 1)),
                "cp": CP_MAP.get(_key(payload.get("cp", "")), _num(payload.get("cp"), 4)),
                "trestbps": _num(payload.get("trestbps")),
                "chol": _num(payload.get("chol")),
                "fbs": FBS_MAP.get(_key(payload.get("fbs", "")), _num(payload.get("fbs"), 0)),
                "restecg": RESTECG_MAP.get(
                    _key(payload.get("restecg", "")), _num(payload.get("restecg"), 0)
                ),
                "thalach": _num(payload.get("thalach")),
                "exang": EXANG_MAP.get(_key(payload.get("exang", "")), _num(payload.get("exang"), 0)),
                "oldpeak": _num(payload.get("oldpeak"), 0),
                "slope": SLOPE_MAP.get(_key(payload.get("slope", "")), _num(payload.get("slope"), 2)),
                "ca": _num(payload.get("ca"), 0),
                "thal": THAL_MAP.get(_key(payload.get("thal", "")), _num(payload.get("thal"), 3)),
            }
        ]
    )


def liver_frame(payload: dict[str, Any]) -> pd.DataFrame:
    gender = payload.get("Gender", payload.get("gender", "Male"))
    g = str(gender)
    if g in {"0", "1"}:
        g = "Male" if g == "1" else "Female"
    elif _key(g) in {"m", "male"}:
        g = "Male"
    elif _key(g) in {"f", "female"}:
        g = "Female"
    return pd.DataFrame(
        [
            {
                "Age": _num(payload.get("Age", payload.get("age"))),
                "Gender": g,
                "TB": _num(payload.get("Total_Bilirubin", payload.get("TB"))),
                "DB": _num(payload.get("Direct_Bilirubin", payload.get("DB"))),
                "Alkphos": _num(payload.get("Alkaline_Phosphotase", payload.get("Alkphos"))),
                "Sgpt": _num(payload.get("Alamine_Aminotransferase", payload.get("Sgpt"))),
                "Sgot": _num(payload.get("Aspartate_Aminotransferase", payload.get("Sgot"))),
                "TP": _num(payload.get("Total_Protiens", payload.get("TP"))),
                "ALB": _num(payload.get("Albumin", payload.get("ALB"))),
                "AG": _num(payload.get("Albumin_and_Globulin_Ratio", payload.get("AG"))),
            }
        ]
    )


KIDNEY_COLUMNS = [
    "age",
    "bp",
    "sg",
    "al",
    "su",
    "rbc",
    "pc",
    "pcc",
    "ba",
    "bgr",
    "bu",
    "sc",
    "sod",
    "pot",
    "hemo",
    "pcv",
    "wbcc",
    "rbcc",
    "htn",
    "dm",
    "cad",
    "appet",
    "pe",
    "ane",
]


KIDNEY_CAT = {"rbc", "pc", "pcc", "ba", "htn", "dm", "cad", "appet", "pe", "ane"}


def kidney_frame(payload: dict[str, Any]) -> pd.DataFrame:
    """UI collects four labs; remaining UCI columns stay missing and are imputed in the model."""
    row: dict[str, Any] = {
        c: (None if c in KIDNEY_CAT else np.nan) for c in KIDNEY_COLUMNS
    }
    row["sc"] = _num(payload.get("creatinine", payload.get("sc")))
    row["bu"] = _num(payload.get("urea", payload.get("bu")))
    row["hemo"] = _num(payload.get("hemoglobin", payload.get("hemo")))
    row["bp"] = _num(payload.get("bp"))
    if payload.get("age") is not None:
        row["age"] = _num(payload.get("age"))
    return pd.DataFrame([row])


def form_to_frame(disease: str, payload: dict[str, Any]) -> pd.DataFrame:
    d = disease.lower().strip()
    if d == "diabetes":
        return diabetes_frame(payload)
    if d == "heart":
        return heart_frame(payload)
    if d == "liver":
        return liver_frame(payload)
    if d == "kidney":
        return kidney_frame(payload)
    raise ValueError(f"Unknown disease: {disease}")


@lru_cache(maxsize=8)
def load_bundle(disease: str) -> dict[str, Any]:
    path = MODELS[disease]
    if not path.exists():
        raise FileNotFoundError(f"Trained model missing: {path}")
    import ml.train_compare  # noqa: F401 — EncodedModel must be importable for unpickle

    bundle = joblib.load(path)
    if "model" not in bundle:
        raise RuntimeError(f"{path} has no 'model' key")
    return bundle


def predict_form(disease: str, payload: dict[str, Any]) -> dict[str, Any]:
    d = disease.lower().strip()
    bundle = load_bundle(d)
    model = bundle["model"]
    X = form_to_frame(d, payload)
    expected = list(bundle.get("columns") or X.columns)
    for col in expected:
        if col not in X.columns:
            X[col] = np.nan
    X = X[expected]
    proba = float(np.asarray(model.predict_proba(X))[0, 1])
    pct = float(min(100.0, max(0.0, 100.0 * proba)))
    return {
        "disease": d,
        "algorithm": bundle.get("algorithm"),
        "probability": proba,
        "riskPercent": round(pct, 1),
        "label": "elevated" if proba >= 0.5 else "not elevated",
        "features": expected,
        "row": X.iloc[0].to_dict(),
    }
