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


def _risk_summary_for_percent(pct: float) -> str:
    """Plain-language read of the percentage (not diagnosis)."""
    if pct < 20:
        return (
            "The percentage is on the lower side for this screen. That usually means the pattern of "
            "numbers you entered looked more like examples the model treats as lower risk — it does "
            "not rule anything out and is not a diagnosis."
        )
    if pct < 45:
        return (
            "The percentage is in a low-to-moderate range. A score here can still warrant healthy "
            "habits and routine check-ups, especially if you have symptoms or a family history."
        )
    if pct < 70:
        return (
            "The percentage is in a moderate range. The model is flagging a meaningful level of "
            "uncertainty from your inputs — useful as a prompt to discuss screening with a clinician, "
            "not as a label of disease."
        )
    return (
        "The percentage is on the higher side for this calculator. That often reflects stronger "
        "signals in the fields you entered (such as blood sugar, cholesterol, or liver enzymes). "
        "It does not confirm illness by itself; it means follow-up with a professional is especially sensible."
    )


def _diabetes_factors_from_inputs(row: dict[str, float]) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    g = float(row.get("glucose", 100))
    if g > 125:
        factors.append(
            {
                "name": "Glucose level",
                "weight": 0.35,
                "explanation": (
                    f"At {g:.0f} mg/dL, glucose is above a common screening cut-off (126 mg/dL is often "
                    "used for fasting tests). Higher glucose tends to push diabetes risk estimates up on this model."
                ),
            }
        )
    elif g > 100:
        factors.append(
            {
                "name": "Glucose level",
                "weight": 0.2,
                "explanation": (
                    f"At {g:.0f} mg/dL, glucose is slightly above a relaxed \"watch\" range (~100). "
                    "That can nudge the estimate upward even when other numbers look fine."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Glucose level",
                "weight": 0.08,
                "explanation": (
                    f"At {g:.0f} mg/dL, glucose is in a range many people consider reassuring. "
                    "If the overall score is still not very low, other fields (BMI, age, insulin) are likely driving it."
                ),
            }
        )

    bmi = float(row.get("bmi", 25))
    if bmi >= 30:
        factors.append(
            {
                "name": "BMI",
                "weight": 0.3,
                "explanation": (
                    f"A BMI near {bmi:.1f} is in the obesity range on standard charts. "
                    "Models like this often weight BMI heavily because it tracks with insulin resistance risk."
                ),
            }
        )
    elif bmi >= 25:
        factors.append(
            {
                "name": "BMI",
                "weight": 0.18,
                "explanation": (
                    f"A BMI near {bmi:.1f} is in the overweight range. That alone is a mild upward pull "
                    "on diabetes-type risk scores in many calculators."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "BMI",
                "weight": 0.08,
                "explanation": (
                    f"At BMI {bmi:.1f}, weight-for-height is in a band usually considered lower risk. "
                    "A higher total score then points more to glucose, age, or family/pregnancy factors."
                ),
            }
        )

    age = float(row.get("age", 30))
    if age >= 45:
        factors.append(
            {
                "name": "Age",
                "weight": 0.15,
                "explanation": (
                    f"At age {age:.0f}, type 2 diabetes becomes more common, so many models add a small "
                    "risk lift even when lab values look okay."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Age",
                "weight": 0.06,
                "explanation": (
                    f"At age {age:.0f}, age contributes less than it would after mid-forties. "
                    "If your score still feels high, look mainly at glucose, BMI, and insulin."
                ),
            }
        )

    ins = float(row.get("insulin", 80))
    if ins > 200 or ins < 30:
        factors.append(
            {
                "name": "Insulin level",
                "weight": 0.12,
                "explanation": (
                    f"An insulin reading around {ins:.0f} µU/mL is unusually high or low for many people; "
                    "extremes can swing this style of model because they hint at how hard the body is working to control sugar."
                ),
            }
        )

    preg = float(row.get("pregnancies", 0))
    if preg >= 3:
        factors.append(
            {
                "name": "Pregnancy history",
                "weight": 0.1,
                "explanation": (
                    f"With {preg:.0f} prior pregnancies, some datasets show a modest association with "
                    "later glucose issues; calculators may reflect that as a small extra weight."
                ),
            }
        )

    factors.sort(key=lambda x: -float(x["weight"]))
    return factors[:4]


def _heart_factors_from_inputs(d: dict[str, Any]) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    age = float(d.get("age", 54))
    if age >= 55:
        factors.append(
            {
                "name": "Age",
                "weight": 0.22,
                "explanation": (
                    f"At {age:.0f} years, heart disease prevalence rises in population data, "
                    "so risk tools often increase the score even when a few other answers look good."
                ),
            }
        )
    elif age >= 45:
        factors.append(
            {
                "name": "Age",
                "weight": 0.14,
                "explanation": (
                    f"At {age:.0f} years, age adds a moderate background contribution compared with younger adults."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Age",
                "weight": 0.08,
                "explanation": (
                    f"At {age:.0f} years, age alone usually lowers the baseline compared with older groups; "
                    "a high score then comes more from cholesterol, blood pressure, chest pain, or exercise findings."
                ),
            }
        )

    chol = float(d.get("chol", 200))
    if chol >= 240:
        factors.append(
            {
                "name": "Cholesterol",
                "weight": 0.28,
                "explanation": (
                    f"Total cholesterol near {chol:.0f} mg/dL is often read as high on screening charts. "
                    "That tends to push heart-risk estimates up in rule-based and ML models alike."
                ),
            }
        )
    elif chol >= 200:
        factors.append(
            {
                "name": "Cholesterol",
                "weight": 0.16,
                "explanation": (
                    f"Near {chol:.0f} mg/dL is borderline-high for many guidelines — a moderate upward nudge, "
                    "especially with other risk factors."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Cholesterol",
                "weight": 0.08,
                "explanation": (
                    f"At {chol:.0f} mg/dL, cholesterol is not in a high band by itself, "
                    "so a high overall score is more about BP, chest pain, or exercise test signals."
                ),
            }
        )

    tbps = float(d.get("trestbps", 120))
    if tbps >= 140:
        factors.append(
            {
                "name": "Resting blood pressure",
                "weight": 0.2,
                "explanation": (
                    f"A resting BP around {tbps:.0f} mm Hg is often treated as stage 1 hypertension or higher. "
                    "Elevated BP is one of the strongest routine inputs for heart-risk calculators."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Resting blood pressure",
                "weight": 0.08,
                "explanation": (
                    f"At {tbps:.0f} mm Hg, resting BP is not in a very high range on typical cut-offs (140+), "
                    "so it is less likely to be the main driver if your score is still high."
                ),
            }
        )

    th = float(d.get("thalach", 150))
    if th < 120:
        factors.append(
            {
                "name": "Max heart rate achieved",
                "weight": 0.18,
                "explanation": (
                    f"A peak heart rate near {th:.0f} is on the low side. This model treats a *higher* "
                    "maximum heart rate as healthier, so dragging this slider down (not up) raises risk."
                ),
            }
        )
    elif th >= 170:
        factors.append(
            {
                "name": "Max heart rate achieved",
                "weight": 0.1,
                "explanation": (
                    f"A peak heart rate near {th:.0f} is in a fitter band for this screen and tends to "
                    "pull estimated heart risk down — unlike a naive “all sliders high” rule."
                ),
            }
        )

    cp = str(d.get("cp", "")).lower()
    if "asymptomatic" in cp:
        factors.append(
            {
                "name": "Chest pain type",
                "weight": 0.25,
                "explanation": (
                    "“Asymptomatic (no chest pain)” maps to the UCI Cleveland code this model associates "
                    "with higher disease probability — not the same as “no symptoms, so low risk.”"
                ),
            }
        )

    ex = str(d.get("exang", "")).lower()
    if ex == "yes":
        factors.append(
            {
                "name": "Exercise-induced angina",
                "weight": 0.2,
                "explanation": (
                    "Yes here usually maps to pain with exertion — a signal many heart models weight strongly."
                ),
            }
        )

    factors.sort(key=lambda x: -float(x["weight"]))
    return factors[:4]


def _liver_factors_from_inputs(d: dict[str, Any]) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    tb = float(d.get("Total_Bilirubin", 1))
    altv = float(d.get("Alamine_Aminotransferase", 40))
    ast = float(d.get("Aspartate_Aminotransferase", 40))
    ag = float(d.get("Albumin_and_Globulin_Ratio", 1.2))
    alb = float(d.get("Albumin", 3.5))

    if tb > 2.5:
        factors.append(
            {
                "name": "Total bilirubin",
                "weight": 0.3,
                "explanation": (
                    f"Bilirubin near {tb:.1f} is higher than many everyday ranges; that can lift liver-screen "
                    "scores because it overlaps with several liver-stress patterns in training data."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Total bilirubin",
                "weight": 0.1,
                "explanation": (
                    f"At {tb:.1f}, bilirubin is not markedly high on typical lab cut-offs. "
                    "If the tool still shows higher risk, it may be reacting to enzymes, proteins, or its label output instead."
                ),
            }
        )

    if altv > 80:
        factors.append(
            {
                "name": "ALT",
                "weight": 0.28,
                "explanation": (
                    f"ALT near {altv:.0f} U/L is often read as elevated; many liver models treat that as a "
                    "meaningful upward signal."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "ALT",
                "weight": 0.1,
                "explanation": (
                    f"ALT near {altv:.0f} is not in a high band for many labs. "
                    "Lower enzyme values usually pull estimated liver concern down unless other fields disagree."
                ),
            }
        )

    if ast > 80:
        factors.append(
            {
                "name": "AST",
                "weight": 0.24,
                "explanation": (
                    f"AST near {ast:.0f} U/L is elevated for many reference ranges and can track with liver cell stress."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "AST",
                "weight": 0.08,
                "explanation": (
                    f"AST near {ast:.0f} is often considered closer to normal; paired with ALT it helps describe "
                    "whether the pattern looks more muscle- or liver-related in real care (here, only a rough screen)."
                ),
            }
        )

    if ag < 1.0 or ag > 2.5:
        factors.append(
            {
                "name": "Albumin/globulin ratio",
                "weight": 0.18,
                "explanation": (
                    f"A ratio near {ag:.2f} is outside a common \"about 1\" comfort zone; some models use that "
                    "as a soft signal for protein balance and liver synthetic function."
                ),
            }
        )

    if alb < 3.0:
        factors.append(
            {
                "name": "Albumin",
                "weight": 0.22,
                "explanation": (
                    f"Albumin near {alb:.1f} g/dL is on the low side. This model treats higher albumin as "
                    "healthier, so dragging this slider down can raise estimated liver risk."
                ),
            }
        )
    elif alb >= 4.5:
        factors.append(
            {
                "name": "Albumin",
                "weight": 0.1,
                "explanation": (
                    f"Albumin near {alb:.1f} g/dL is in a healthier band and tends to pull estimated liver "
                    "risk down — unlike a naive “all sliders high” rule."
                ),
            }
        )

    factors.sort(key=lambda x: -float(x["weight"]))
    return factors[:4]


def _kidney_factors_from_inputs(d: dict[str, Any]) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    sc = float(d.get("creatinine", 1))
    bu = float(d.get("urea", 30))
    hemo = float(d.get("hemoglobin", 14))
    bp = float(d.get("bp", 120))

    if sc >= 1.5:
        factors.append(
            {
                "name": "Creatinine",
                "weight": 0.34,
                "explanation": (
                    f"Creatinine near {sc:.1f} mg/dL is higher than a typical adult range (~0.6–1.3). "
                    "This model treats elevated creatinine as a strong CKD-leaning signal."
                ),
            }
        )
    else:
        factors.append(
            {
                "name": "Creatinine",
                "weight": 0.1,
                "explanation": (
                    f"At {sc:.1f} mg/dL, creatinine is not in a high band by itself. "
                    "If the overall score is still high, hemoglobin or urea is likely doing more of the work."
                ),
            }
        )

    if hemo < 11:
        factors.append(
            {
                "name": "Hemoglobin",
                "weight": 0.32,
                "explanation": (
                    f"Hemoglobin near {hemo:.1f} g/dL is low. In the UCI CKD tables this model learned from, "
                    "anemia is strongly associated with CKD — so dragging this slider *down* raises risk, "
                    "it does not lower it."
                ),
            }
        )
    elif hemo >= 14:
        factors.append(
            {
                "name": "Hemoglobin",
                "weight": 0.12,
                "explanation": (
                    f"Hemoglobin near {hemo:.1f} g/dL is in a healthier band. "
                    "Higher hemoglobin here pulls estimated CKD risk *down*, unlike a naive “all sliders high” rule."
                ),
            }
        )

    if bu >= 50:
        factors.append(
            {
                "name": "Urea",
                "weight": 0.22,
                "explanation": (
                    f"Urea near {bu:.0f} mg/dL is elevated on many lab charts and often rises with reduced kidney clearance."
                ),
            }
        )

    if bp >= 140:
        factors.append(
            {
                "name": "Blood pressure",
                "weight": 0.16,
                "explanation": (
                    f"A reading around {bp:.0f} mm Hg is in a hypertensive band, which this model can treat as extra CKD-related risk."
                ),
            }
        )

    factors.sort(key=lambda x: -float(x["weight"]))
    return factors[:4]


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


def _factors_for(disease: str, raw: dict[str, Any]) -> list[dict[str, Any]]:
    if disease == "diabetes":
        return _diabetes_factors_from_inputs(raw)
    if disease == "heart":
        return _heart_factors_from_inputs(raw)
    if disease == "liver":
        return _liver_factors_from_inputs(raw)
    if disease == "kidney":
        return _kidney_factors_from_inputs(raw)
    return []


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

    factors = _factors_for(disease, raw)
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
        "riskSummary": _risk_summary_for_percent(scored["riskPercent"]),
        "contributingFactors": factors,
        "modelSource": f"local_{scored.get('algorithm')}",
        "probability": round(float(scored["probability"]), 4),
    }
