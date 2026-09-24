"""Map MediAI risk-form payloads onto the four trained classifiers.

The UI strings/slider names are not the same as the training columns.
This module is the single translation layer used by eval scripts and the ML service.

Serving uses laptop-sized trees (CatBoost, or LightGBM when CatBoost misses
the 85% gate). Kidney TabPFN ~100% is the 24-column hospital table the chat
never collects; the served file is the 4-lab CatBoost (sc, bu, hemo, bp).
Liver CatBoost already clears the 85% pooled holdout; ILPD-only is harder.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

os.environ.setdefault("OMP_NUM_THREADS", "2")

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "heart": ROOT / "ml/artifacts/models/heart_catboost.joblib",
    "liver": ROOT / "ml/artifacts/models/liver_catboost.joblib",
    "diabetes": ROOT / "ml/artifacts/models/diabetes_lightgbm.joblib",
    "kidney": ROOT / "ml/artifacts/models/kidney_catboost.joblib",
}

# UCI Cleveland encodings used in training (see data/AUDIT.md).
CP_MAP = {
    "typical angina": 1,
    "tightness or pressure when i walk or climb stairs": 1,
    "atypical angina": 2,
    "odd chest discomfort, not like classic squeezing": 2,
    "non-anginal pain": 3,
    "nonanginal pain": 3,
    "ache that does not feel like heart pain": 3,
    "asymptomatic (no chest pain)": 4,
    "asymptomatic": 4,
    "no chest pain or tightness": 4,
    "i'm not sure": 3,
    "im not sure": 3,
    "i don't know": 3,
}
FBS_MAP = {
    "no (under 120 mg/dl)": 0,
    "yes (over 120 mg/dl)": 1,
    "no": 0,
    "yes": 1,
    "i don't have this number": 0,
    "i dont have this number": 0,
}
RESTECG_MAP = {
    "normal": 0,
    "st-t wave abnormality": 1,
    "left ventricular hypertrophy": 2,
    "i don't know": 0,
    "i dont know": 0,
}
SLOPE_MAP = {
    "upsloping": 1,
    "flat": 2,
    "downsloping": 3,
    "i don't know": 2,
    "i dont know": 2,
}
THAL_MAP = {
    "normal": 3,
    "fixed defect": 6,
    "reversible defect": 7,
    "i don't know": 3,
    "i dont know": 3,
}
EXANG_MAP = {
    "no": 0,
    "yes": 1,
    "i don't know": 0,
    "i dont know": 0,
}
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


KIDNEY_COLUMNS = ["sc", "bu", "hemo", "bp"]

# UI labels for TreeSHAP — ranking/sign come from CatBoost, not lab cut-offs.
FEATURE_LABELS: dict[str, str] = {
    "pregnancies": "Pregnancies",
    "glucose": "Blood sugar",
    "bp": "Blood pressure",
    "skin": "Skin-fold thickness",
    "insulin": "Insulin",
    "bmi": "BMI",
    "pedigree": "Family diabetes history",
    "age": "Age",
    "sex": "Sex",
    "cp": "Chest discomfort",
    "trestbps": "Resting blood pressure",
    "chol": "Cholesterol",
    "fbs": "Fasting blood sugar",
    "restecg": "Heart tracing (ECG)",
    "thalach": "Highest heart rate",
    "exang": "Chest pain with exercise",
    "oldpeak": "Exercise-test line dip",
    "slope": "Exercise-test line shape",
    "ca": "Heart-artery dye test",
    "thal": "Heart blood-flow scan",
    "Age": "Age",
    "Gender": "Gender",
    "TB": "Total bilirubin",
    "DB": "Direct bilirubin",
    "Alkphos": "Alkaline phosphatase",
    "Sgpt": "ALT",
    "Sgot": "AST",
    "TP": "Total proteins",
    "ALB": "Albumin",
    "AG": "Albumin / globulin ratio",
    "sc": "Creatinine",
    "bu": "Urea",
    "hemo": "Hemoglobin",
}

# Shown next to the value the user typed so the chat reads like a lab slip.
FEATURE_UNITS: dict[str, str] = {
    "glucose": "mg/dL",
    "bp": "mm Hg",
    "skin": "mm",
    "insulin": "µU/mL",
    "bmi": "kg/m²",
    "age": "years",
    "Age": "years",
    "trestbps": "mm Hg",
    "chol": "mg/dL",
    "thalach": "bpm",
    "oldpeak": "mm",
    "TB": "mg/dL",
    "DB": "mg/dL",
    "Alkphos": "U/L",
    "Sgpt": "U/L",
    "Sgot": "U/L",
    "TP": "g/dL",
    "ALB": "g/dL",
    "sc": "mg/dL",
    "bu": "mg/dL",
    "hemo": "g/dL",
}

# Form payload key for the value the user actually typed (may differ from train col).
FEATURE_PAYLOAD_KEY: dict[str, str] = {
    "sc": "creatinine",
    "bu": "urea",
    "hemo": "hemoglobin",
    "bp": "bp",
    "TB": "Total_Bilirubin",
    "DB": "Direct_Bilirubin",
    "Alkphos": "Alkaline_Phosphotase",
    "Sgpt": "Alamine_Aminotransferase",
    "Sgot": "Aspartate_Aminotransferase",
    "TP": "Total_Protiens",
    "ALB": "Albumin",
    "AG": "Albumin_and_Globulin_Ratio",
    "Age": "Age",
    "Gender": "Gender",
    "sex": "sex",
    "cp": "cp",
    "fbs": "fbs",
    "restecg": "restecg",
    "exang": "exang",
    "slope": "slope",
    "thal": "thal",
}


def kidney_frame(payload: dict[str, Any]) -> pd.DataFrame:
    """Four labs the served kidney model was trained on: sc, bu, hemo, bp.

    UCI CKD ``bp`` is diastolic. The form now sends diastolic with
    ``bpScale=diastolic``. Older systolic sliders are still converted.
    """
    raw = payload.get("diastolic", payload.get("bp"))
    scale = str(payload.get("bpScale", "")).strip().lower()
    old_systolic = "creatinine" in payload and scale != "diastolic" and payload.get("diastolic") is None
    if raw is None or raw == "":
        dbp = np.nan
    else:
        raw_n = _num(raw)
        if scale == "diastolic":
            dbp = float(raw_n)
        elif old_systolic and raw_n > 110:
            dbp = float(np.clip(raw_n - 40.0, 40.0, 180.0))
        elif payload.get("systolic") is not None and payload.get("diastolic") is None:
            dbp = float(np.clip(_num(payload.get("systolic")) - 40.0, 40.0, 180.0))
        else:
            dbp = float(raw_n)
    return pd.DataFrame(
        [
            {
                "sc": _num(payload.get("creatinine", payload.get("sc"))),
                "bu": _num(payload.get("urea", payload.get("bu"))),
                "hemo": _num(payload.get("hemoglobin", payload.get("hemo"))),
                "bp": dbp,
            }
        ]
    )


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


def _aligned_frame(disease: str, payload: dict[str, Any], bundle: dict[str, Any]) -> pd.DataFrame:
    X = form_to_frame(disease, payload)
    expected = list(bundle.get("columns") or X.columns)
    for col in expected:
        if col not in X.columns:
            X[col] = np.nan
    return X[expected]


def _display_value(feature: str, payload: dict[str, Any], row: dict[str, Any]) -> str:
    key = FEATURE_PAYLOAD_KEY.get(feature, feature)
    raw = payload.get(key, payload.get(feature, row.get(feature)))
    if raw is None or raw == "":
        raw = row.get(feature)
    if isinstance(raw, (bool,)):
        return str(raw)
    if isinstance(raw, (int, float, np.integer, np.floating)):
        raw_f = float(raw)
        if raw_f == int(raw_f):
            shown = str(int(raw_f))
        else:
            shown = f"{raw_f:.2f}".rstrip("0").rstrip(".")
        unit = FEATURE_UNITS.get(feature)
        return f"{shown} {unit}" if unit else shown
    return str(raw)


def _shap_factors(
    names: list[str],
    contrib: np.ndarray,
    payload: dict[str, Any],
    row: dict[str, Any],
    *,
    top_k: int = 4,
) -> list[dict[str, Any]]:
    total = float(np.abs(contrib).sum()) or 1.0
    ranked = sorted(zip(names, contrib), key=lambda t: abs(float(t[1])), reverse=True)
    factors: list[dict[str, Any]] = []
    for feat, shap_val in ranked[:top_k]:
        shap_val = float(shap_val)
        if abs(shap_val) < 1e-12:
            continue
        direction = "up" if shap_val > 0 else "down"
        label = FEATURE_LABELS.get(feat, feat)
        shown = _display_value(feat, payload, row)
        share = abs(shap_val) / total
        if shap_val > 0:
            why = (
                f"You entered {shown}. This raised the estimate "
                f"(about {share:.0%} of the reasons behind this score)."
            )
        else:
            why = (
                f"You entered {shown}. This lowered the estimate "
                f"(about {share:.0%} of the reasons behind this score)."
            )
        factors.append(
            {
                "name": label,
                "feature": feat,
                "weight": round(share, 4),
                "shap": round(shap_val, 4),
                "direction": direction,
                "explanation": why,
            }
        )
    return factors


def _shap_summary(pct: float, factors: list[dict[str, Any]]) -> str:
    # Percent is already shown as the chat headline; this block answers "why".
    _ = pct
    ups = [f["name"] for f in factors if f.get("direction") == "up"]
    downs = [f["name"] for f in factors if f.get("direction") == "down"]
    bits: list[str] = []
    if ups and downs:
        bits.append(
            f"For the numbers you entered, {ups[0]} raised the score the most, "
            f"and {downs[0]} brought it down the most."
        )
    elif ups:
        bits.append(f"For the numbers you entered, {ups[0]} raised the score the most.")
    elif downs:
        bits.append(f"For the numbers you entered, {downs[0]} brought the score down the most.")
    return " ".join(bits)


def predict_form(disease: str, payload: dict[str, Any]) -> dict[str, Any]:
    d = disease.lower().strip()
    bundle = load_bundle(d)
    model = bundle["model"]
    X = _aligned_frame(d, payload, bundle)
    proba = float(np.asarray(model.predict_proba(X))[0, 1])
    pct = float(min(100.0, max(0.0, 100.0 * proba)))
    names, contrib, bias = model.shap_contrib(X)
    factors = _shap_factors(names, contrib, payload, X.iloc[0].to_dict())
    shap_map = {str(n): round(float(v), 6) for n, v in zip(names, contrib)}
    return {
        "disease": d,
        "algorithm": bundle.get("algorithm"),
        "probability": proba,
        "riskPercent": round(pct, 1),
        "label": "elevated" if proba >= 0.5 else "not elevated",
        "features": list(X.columns),
        "row": X.iloc[0].to_dict(),
        "shapBias": round(float(bias), 4),
        "shap": shap_map,
        "riskSummary": _shap_summary(pct, factors),
        "contributingFactors": factors,
    }
