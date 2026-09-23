"""Load and align the four disease tables for training. Raw files are never modified."""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

HEART_UCI_COLS = [
    "age",
    "sex",
    "cp",
    "trestbps",
    "chol",
    "fbs",
    "restecg",
    "thalach",
    "exang",
    "oldpeak",
    "slope",
    "ca",
    "thal",
    "num",
]

EXCEL_MONTH = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _read_uci_heart(site: str) -> pd.DataFrame:
    path = DATA / "heart" / "raw" / f"processed.{site}.data"
    df = pd.read_csv(path, header=None, names=HEART_UCI_COLS, na_values=["?"])
    df["disease"] = (df["num"] > 0).astype(int)
    df["source"] = site
    return df.drop(columns=["num"])


def load_heart() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Pooled India + UCI sites. Returns (full_pool, india_only) for extra reporting."""
    parts = [_read_uci_heart(s) for s in ("cleveland", "hungarian", "switzerland", "va_long_beach")]
    uci = pd.concat(parts, ignore_index=True)

    india = pd.read_csv(
        DATA / "heart/raw/india_mendeley_dzz48mvjht_Cardiovascular_Disease_Dataset.csv"
    )
    mapped = pd.DataFrame(
        {
            "age": india["age"],
            "sex": india["gender"],
            "cp": india["chestpain"] + 1,  # 0-3 -> 1-4
            "trestbps": india["restingBP"],
            "chol": india["serumcholestrol"].replace(0, np.nan),
            "fbs": india["fastingbloodsugar"],
            "restecg": india["restingrelectro"],
            "thalach": india["maxheartrate"],
            "exang": india["exerciseangia"],
            "oldpeak": india["oldpeak"],
            "slope": india["slope"].replace(0, np.nan),
            "ca": india["noofmajorvessels"],
            "thal": np.nan,
            "disease": india["target"].astype(int),
            "source": "india",
        }
    )
    pool = pd.concat([mapped, uci], ignore_index=True)
    return pool, mapped


def load_liver() -> tuple[pd.DataFrame, pd.DataFrame]:
    """ILPD (India, full schema) plus HCV rows with ILPD-only labs left missing."""
    ilpd = pd.read_csv(DATA / "liver/processed/ilpd_cleaned.csv")
    core = pd.DataFrame(
        {
            "Age": ilpd["Age"],
            "Gender": ilpd["Gender"].astype(str),
            "TB": ilpd["TB"],
            "DB": ilpd["DB"],
            "Alkphos": ilpd["Alkphos"],
            "Sgpt": ilpd["Sgpt"],
            "Sgot": ilpd["Sgot"],
            "TP": ilpd["TP"],
            "ALB": ilpd["ALB"],
            "AG": ilpd["A/G Ratio"],
            "disease": ilpd["disease"].astype(int),
            "source": "ilpd_india",
        }
    )
    hcv = pd.read_csv(DATA / "liver/raw/ucimlrepo_id571_hcv.csv")
    cat = hcv["Category"].astype(str)
    keep = ~cat.str.contains("suspect", case=False)
    hcv = hcv.loc[keep].copy()
    hcv_part = pd.DataFrame(
        {
            "Age": hcv["Age"],
            "Gender": hcv["Sex"].map({"m": "Male", "f": "Female", "M": "Male", "F": "Female"}),
            "TB": hcv["BIL"],
            "DB": np.nan,
            "Alkphos": hcv["ALP"],
            "Sgpt": hcv["ALT"],
            "Sgot": hcv["AST"],
            "TP": hcv["PROT"],
            "ALB": hcv["ALB"],
            "AG": np.nan,
            "disease": (~cat.loc[keep].str.contains("Blood Donor", case=False)).astype(int),
            "source": "hcv_germany",
        }
    )
    pool = pd.concat([core, hcv_part], ignore_index=True)
    return pool, core


def load_diabetes() -> pd.DataFrame:
    df = pd.read_csv(DATA / "diabetes/processed/pima_cleaned.csv")
    df["source"] = "pima"
    return df


def load_diabetes_sylhet() -> pd.DataFrame:
    """Schema-shift table — not concatenated onto Pima."""
    df = pd.read_csv(DATA / "diabetes/raw/ucimlrepo_id529_early_stage_diabetes_sylhet.csv")
    out = df.copy()
    out["disease"] = (out["class"].astype(str).str.lower() == "positive").astype(int)
    out["source"] = "sylhet"
    return out.drop(columns=["class"])


def _midpoint(val) -> float:
    if pd.isna(val):
        return np.nan
    s = str(val).strip()
    if s in {"", "nan", "None", "p"}:
        return np.nan
    s = s.replace("≥", ">=").replace("≤", "<=").replace("–", "-")
    low = s.lower()
    # Excel date artifacts: "1-Jan" -> 1, "20-Dec" -> 16 (was 12-20)
    m = re.fullmatch(r"(\d{1,2})-([A-Za-z]{3})", s)
    if m:
        n = int(m.group(1))
        month = EXCEL_MONTH.get(m.group(2).lower())
        if month == 12 and n == 20:
            return 16.0
        if month is not None and n <= 5:
            return float(n)
        if month is not None:
            return float((n + month) / 2)
    if re.fullmatch(r"\d+", s):
        return float(s)
    rng = re.match(r"^([<>]=?)\s*([0-9.]+)$", s)
    if rng:
        x = float(rng.group(2))
        return x * 0.9 if "<" in rng.group(1) else x * 1.1
    rng = re.match(r"^([0-9.]+)\s*-\s*([0-9.]+)$", s)
    if rng:
        return (float(rng.group(1)) + float(rng.group(2))) / 2
    return np.nan


def load_kidney() -> tuple[pd.DataFrame, pd.DataFrame]:
    primary = pd.read_csv(DATA / "kidney/processed/ckd_tamil_nadu_cleaned.csv")
    primary = primary.copy()
    primary["source"] = "tamil_nadu"
    # Bangladesh secondary: overlapping labs, drop leakage cols
    raw = pd.read_csv(DATA / "kidney/raw/ucimlrepo_id857_ckd_bangladesh.csv")
    sec = pd.DataFrame(
        {
            "age": raw["age"].map(_midpoint),
            "bp": pd.to_numeric(raw["bp (Diastolic)"], errors="coerce"),
            "sg": raw["sg"].map(_midpoint),
            "al": raw["al"].map(_midpoint),
            "su": raw["su"].map(_midpoint),
            "bgr": raw["bgr"].map(_midpoint),
            "bu": raw["bu"].map(_midpoint),
            "sc": raw["sc"].map(_midpoint),
            "sod": raw["sod"].map(_midpoint),
            "pot": raw["pot"].map(_midpoint),
            "hemo": raw["hemo"].map(_midpoint),
            "pcv": raw["pcv"].map(_midpoint),
            "wbcc": raw["wbcc"].map(_midpoint),
            "rbcc": raw["rbcc"].map(_midpoint),
            "htn": raw["htn"].map({0: "no", 1: "yes", "0": "no", "1": "yes"}),
            "dm": raw["dm"].map({0: "no", 1: "yes", "0": "no", "1": "yes"}),
            "cad": raw["cad"].map({0: "no", 1: "yes", "0": "no", "1": "yes"}),
            "appet": raw["appet"].map({0: "good", 1: "poor", "0": "good", "1": "poor"}),
            "pe": raw["pe"].map({0: "no", 1: "yes", "0": "no", "1": "yes"}),
            "ane": raw["ane"].map({0: "no", 1: "yes", "0": "no", "1": "yes"}),
            "disease": (raw["class"].astype(str).str.strip() == "ckd").astype(int),
            "source": "bangladesh",
        }
    )
    return primary, sec


def feature_target(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    drop = [c for c in ("disease", "class", "Selector", "source", "patientid") if c in df.columns]
    y = df["disease"].astype(int)
    X = df.drop(columns=drop)
    return X, y
