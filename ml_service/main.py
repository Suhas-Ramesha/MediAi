"""
ML risk service: four local CatBoost classifiers (form-field payloads).

Fits a 4GB laptop: no PyTorch/TabPFN. Joblib files live in
``ml/artifacts/models/*_catboost.joblib`` (~1.2MB total).

Run from the ``ml_service`` directory (not the repo root), or use ``ml_service/start.bat``
or ``run_ml_service.bat`` at the repo root::

    cd ml_service
    python -m uvicorn main:app --host 127.0.0.1 --port 5050
"""
from __future__ import annotations

import os
import re
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

# Repo root so ``ml.form_predict`` / trained EncodedModel unpickle.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    from ml.form_predict import MODELS, load_bundle

    for disease, path in MODELS.items():
        if path.exists():
            load_bundle(disease)
    yield


app = FastAPI(title="MediAi Risk ML", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_diabetes_lock = threading.Lock()
_heart_lock = threading.Lock()
_liver_lock = threading.Lock()
_diabetes_client: Any = None
_heart_client: Any = None
_liver_client: Any = None


def _get_diabetes_client() -> Any:
    global _diabetes_client
    with _diabetes_lock:
        if _diabetes_client is not None:
            return _diabetes_client
        try:
            from gradio_client import Client

            _diabetes_client = Client("Suhas319/diabetes-prediction")
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Diabetes Gradio client failed: {e}",
            ) from e
        return _diabetes_client


def _get_heart_client() -> Any:
    global _heart_client
    with _heart_lock:
        if _heart_client is not None:
            return _heart_client
        try:
            from gradio_client import Client

            _heart_client = Client("Suhas319/heart-disease")
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Heart Gradio client failed: {e}",
            ) from e
        return _heart_client


def _get_liver_client() -> Any:
    global _liver_client
    with _liver_lock:
        if _liver_client is not None:
            return _liver_client
        try:
            from gradio_client import Client

            _liver_client = Client("Suhas319/liver_disease_detection")
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Liver Gradio client failed: {e}",
            ) from e
        return _liver_client


def _parse_diabetes_percent(text: str) -> float:
    """Diabetes-positive probability (%), not 'no diabetes' score."""
    if not text:
        return 50.0
    pos_pct: float | None = None
    neg_pct: float | None = None
    for line in text.splitlines():
        low = line.lower()
        m = re.search(r"(\d+\.?\d*)\s*%", line)
        if not m:
            continue
        val = float(m.group(1))
        if "no diabetes" in low:
            neg_pct = val
        elif re.search(r"(?i)[-*]\s*diabetes\s*:", line) and "no diabetes" not in low:
            pos_pct = val
    if pos_pct is not None:
        return float(min(100, max(0, pos_pct)))
    if neg_pct is not None:
        return float(min(100, max(0, 100.0 - neg_pct)))
    low = text.lower()
    if "not diabetic" in low or "non-diabetic" in low:
        return 18.0
    if "diabet" in low and "no " not in low:
        return 78.0
    m = re.search(r"(\d+\.?\d*)\s*%", text)
    if m:
        return float(min(100, max(0, float(m.group(1)))))
    return 45.0


def _parse_gradio_risk_percent(
    text: str,
    *,
    pos_line_hints: tuple[str, ...],
    neg_line_hints: tuple[str, ...],
) -> float:
    """Parse 0–100 risk from Gradio markdown; uses labeled lines when possible."""
    if not text:
        return 45.0
    m_prob = re.search(r"(\d+\.?\d*)\s*%\s*probability", text, re.I)
    if m_prob:
        return float(min(100, max(0, float(m_prob.group(1)))))
    m_hi = re.search(
        r"(?i)(high\s+risk|low\s+risk)[^\d]{0,40}(\d+\.?\d*)\s*%",
        text,
    )
    if m_hi:
        val = float(m_hi.group(2))
        if "low" in m_hi.group(1).lower():
            return float(min(100, max(0, 100.0 - val)))
        return float(min(100, max(0, val)))
    pos_pct: float | None = None
    neg_pct: float | None = None
    for line in text.splitlines():
        low = line.lower()
        m = re.search(r"(\d+\.?\d*)\s*%", line)
        if not m:
            continue
        val = float(m.group(1))
        if any(h in low for h in neg_line_hints):
            neg_pct = val
        elif any(h in low for h in pos_line_hints):
            pos_pct = val
    if pos_pct is not None:
        return float(min(100, max(0, pos_pct)))
    if neg_pct is not None:
        return float(min(100, max(0, 100.0 - neg_pct)))
    low = text.lower()
    all_pct = [float(x) for x in re.findall(r"(\d+\.?\d*)\s*%", text)]
    if len(all_pct) >= 2 and abs(sum(all_pct[:2]) - 100) < 2:
        return float(min(100, max(0, max(all_pct[:2]))))
    if all_pct:
        return float(min(100, max(0, all_pct[-1])))
    if any(k in low for k in ("negative", "low risk", "no disease", "absent")):
        return 22.0
    if any(k in low for k in ("positive", "high risk", "present", "detected")):
        return 72.0
    return 45.0


def _parse_liver_gradio_label(text: str) -> float:
    """Liver Space often returns a short label without %."""
    low = text.lower()
    if "not detected" in low or "no liver" in low or ("normal" in low and "detected" not in low):
        return 12.0
    if "liver disease detected" in low or ("detected" in low and "liver" in low):
        return 76.0
    if "no disease" in low or "negative" in low:
        return 15.0
    return _parse_gradio_risk_percent(
        text,
        pos_line_hints=("liver", "disease", "positive", "probability", "risk", "chance"),
        neg_line_hints=("no liver", "normal", "negative", "low risk", "no disease"),
    )


class DiabetesPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pregnancies: float = 0
    glucose: float = 100
    bp: float = 70
    skin: float = 20
    insulin: float = 80
    bmi: float = 25
    pedigree: float = 0.5
    age: float = 30


class HeartPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    age: float = Field(54, ge=18, le=100)
    sex: str = Field("Male")
    cp: str = Field("Asymptomatic (no chest pain)")
    trestbps: float = Field(130, ge=80, le=200)
    chol: float = Field(240, ge=100, le=600)
    fbs: str = Field("No (under 120 mg/dl)")
    restecg: str = Field("Normal")
    thalach: float = Field(150, ge=60, le=220)
    exang: str = Field("No")
    oldpeak: float = Field(1.0, ge=0, le=6.5)
    slope: str = Field("Flat")
    ca: float = Field(0, ge=0, le=3)
    thal: str = Field("Normal")


class LiverPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    Age: float = Field(..., ge=1, le=120, description="Age in years")
    Gender: str = Field(...)
    Total_Bilirubin: float = Field(..., ge=0, le=50)
    Direct_Bilirubin: float = Field(..., ge=0, le=30)
    Alkaline_Phosphotase: float = Field(..., ge=0, le=2000)
    Alamine_Aminotransferase: float = Field(..., ge=0, le=2000)
    Aspartate_Aminotransferase: float = Field(..., ge=0, le=2000)
    Total_Protiens: float = Field(..., ge=1, le=10, description="Total proteins (API spelling)")
    Albumin: float = Field(..., ge=1, le=6)
    Albumin_and_Globulin_Ratio: float = Field(..., ge=0.3, le=4)


class KidneyPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    creatinine: float = Field(1.0, ge=0.1, le=20)
    urea: float = Field(30, ge=1, le=400)
    hemoglobin: float = Field(14, ge=3, le=22)
    bp: float = Field(120, ge=50, le=250)
    age: float | None = Field(None, ge=1, le=120)


class PredictRequest(BaseModel):
    disease: str
    payload: dict[str, Any]


@app.get("/health")
def health() -> dict[str, Any]:
    from ml.form_predict import MODELS

    return {
        "status": "ok",
        "backend": "local_trained_models",
        "models": {k: v.exists() for k, v in MODELS.items()},
    }


@app.post("/predict")
def predict(req: PredictRequest) -> dict[str, Any]:
    disease = req.disease.lower().strip()
    raw = dict(req.payload or {})

    if disease == "diabetes":
        DiabetesPayload.model_validate(raw)
    elif disease == "heart":
        HeartPayload.model_validate(raw)
    elif disease == "liver":
        LiverPayload.model_validate(raw)
    elif disease == "kidney":
        KidneyPayload.model_validate(raw)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown disease: {req.disease}")

    try:
        from ml.form_predict import predict_form

        scored = predict_form(disease, raw)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{disease} prediction failed: {e}") from e

    titles = {
        "diabetes": "Diabetes risk estimate",
        "heart": "Heart disease risk estimate",
        "liver": "Liver disease risk estimate",
        "kidney": "Kidney disease risk estimate",
    }
    return {
        "disease": disease,
        "riskPercent": scored["riskPercent"],
        "label": titles[disease],
        "riskSummary": scored["riskSummary"],
        "contributingFactors": scored["contributingFactors"],
        "modelSource": f"local_{scored.get('algorithm')}_treeshap",
        "probability": round(float(scored["probability"]), 4),
    }
