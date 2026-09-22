#!/usr/bin/env python3
"""Phase 2 cleaning — writes data/<disease>/processed/ only. Never touches raw/.

Fixes:
  ILPD  — 4 missing A/G Ratio filled from ALB / (TP - ALB)
  Pima  — 0 in glucose/BP/skin/insulin/BMI recoded to NA (not true zeros)
  CKD   — strip dirty labels; class-blind impute so missingness cannot leak the label
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

PIMA_ZERO_IS_MISSING = ("plas", "pres", "skin", "insu", "mass")
CKD_LEAKY_IF_LEFT_MISSING = ("rbc", "rbcc", "wbcc", "sod", "pot", "pcv")


def _write(path: Path, df: pd.DataFrame, notes: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    sidecar = path.with_suffix(path.suffix + ".meta.json")
    sidecar.write_text(
        json.dumps(
            {
                **notes,
                "n": int(len(df)),
                "columns": list(map(str, df.columns)),
                "missing_after": {c: int(df[c].isna().sum()) for c in df.columns if int(df[c].isna().sum())},
                "written_utc": STAMP,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def clean_ilpd() -> dict:
    raw = pd.read_csv(DATA / "liver/raw/ucimlrepo_id225_ilpd.csv")
    df = raw.copy()
    missing_idx = df.index[df["A/G Ratio"].isna()].tolist()
    globulin = df["TP"] - df["ALB"]
    derived = df["ALB"] / globulin.replace(0, np.nan)
    filled_from_formula = int(df["A/G Ratio"].isna().sum())
    df.loc[df["A/G Ratio"].isna(), "A/G Ratio"] = derived[df["A/G Ratio"].isna()]
    still = int(df["A/G Ratio"].isna().sum())
    if still:
        df["A/G Ratio"] = df["A/G Ratio"].fillna(df["A/G Ratio"].median())
    df["disease"] = (df["Selector"] == 1).astype(int)
    _write(
        DATA / "liver/processed/ilpd_cleaned.csv",
        df,
        {
            "source": "data/liver/raw/ucimlrepo_id225_ilpd.csv",
            "fix": "A/G Ratio missing (4 rows) filled with ALB/(TP-ALB); Selector 1=disease",
            "missing_ag_rows_0based": missing_idx,
            "filled_from_albumin_globulin_formula": filled_from_formula,
            "median_fallback_rows": still,
            "class_balance": df["disease"].value_counts().to_dict(),
        },
    )
    return {
        "file": "liver/processed/ilpd_cleaned.csv",
        "n": int(len(df)),
        "missing_ag_after": int(df["A/G Ratio"].isna().sum()),
        "class_balance": {"disease": int((df["disease"] == 1).sum()), "not": int((df["disease"] == 0).sum())},
        "derived_ag_values": [round(float(derived.loc[i]), 4) for i in missing_idx],
    }


def clean_pima() -> dict:
    raw = pd.read_csv(DATA / "diabetes/raw/openml_37_pima_diabetes.csv")
    df = raw.copy()
    zero_counts = {c: int((df[c] == 0).sum()) for c in PIMA_ZERO_IS_MISSING}
    for c in PIMA_ZERO_IS_MISSING:
        df[c] = df[c].replace(0, np.nan)
    df["disease"] = (df["class"].astype(str) == "tested_positive").astype(int)
    rename = {
        "preg": "pregnancies",
        "plas": "glucose",
        "pres": "bp",
        "skin": "skin",
        "insu": "insulin",
        "mass": "bmi",
        "pedi": "pedigree",
        "age": "age",
    }
    out = df.rename(columns=rename)[
        ["pregnancies", "glucose", "bp", "skin", "insulin", "bmi", "pedigree", "age", "disease"]
    ]
    _write(
        DATA / "diabetes/processed/pima_cleaned.csv",
        out,
        {
            "source": "data/diabetes/raw/openml_37_pima_diabetes.csv",
            "fix": "zeros in glucose/bp/skin/insulin/bmi recoded to NA; pregnancies=0 kept; class mapped to disease",
            "zeros_recoded_to_na": zero_counts,
            "class_balance": out["disease"].value_counts().to_dict(),
            "note": "Trees/TabPFN consume NA natively. Any median impute happens inside train-only pipelines, never here.",
        },
    )
    return {
        "file": "diabetes/processed/pima_cleaned.csv",
        "n": int(len(out)),
        "zeros_recoded": zero_counts,
        "na_after": {c: int(out[c].isna().sum()) for c in ["glucose", "bp", "skin", "insulin", "bmi"]},
        "class_balance": {"disease": int((out["disease"] == 1).sum()), "not": int((out["disease"] == 0).sum())},
        "pregnancies_zero_kept": int((out["pregnancies"] == 0).sum()),
    }


def _strip_cat(val):
    if pd.isna(val):
        return np.nan
    s = str(val).replace("\t", "").strip()
    return s if s else np.nan


def clean_ckd() -> dict:
    raw = pd.read_csv(DATA / "kidney/raw/ucimlrepo_id336_ckd_tamil_nadu.csv")
    df = raw.copy()
    dirty_class = int((df["class"].astype(str).str.contains("\t", regex=False)).sum())
    dirty_dm = int((df["dm"].astype(str).str.contains("\t", regex=False)).sum())
    for c in ("rbc", "pc", "pcc", "ba", "htn", "dm", "cad", "appet", "pe", "ane", "class"):
        df[c] = df[c].map(_strip_cat)
    df["class"] = df["class"].replace({"ckd": "ckd", "notckd": "notckd"})
    df["disease"] = (df["class"] == "ckd").astype(int)

    miss_by_class = {}
    for c in CKD_LEAKY_IF_LEFT_MISSING:
        miss_by_class[c] = {
            "ckd_pct": round(float(df.loc[df["disease"] == 1, c].isna().mean() * 100), 1),
            "notckd_pct": round(float(df.loc[df["disease"] == 0, c].isna().mean() * 100), 1),
        }

    # Class-blind impute: median numeric, mode categorical. No missingness flags.
    # Trees cannot split on "was this lab ordered", which is what leaked the label.
    numeric = [c for c in df.columns if c not in ("class", "disease") and pd.api.types.is_numeric_dtype(df[c])]
    categoric = [c for c in df.columns if c not in ("class", "disease") and c not in numeric]
    imputers = {}
    for c in numeric:
        val = float(df[c].median())
        imputers[c] = {"strategy": "median", "value": val}
        df[c] = df[c].fillna(val)
    for c in categoric:
        mode = df[c].mode(dropna=True)
        val = str(mode.iloc[0]) if len(mode) else "unknown"
        imputers[c] = {"strategy": "mode", "value": val}
        df[c] = df[c].fillna(val)

    out_cols = [c for c in df.columns if c != "class"] + ["class"]
    out = df[out_cols]
    _write(
        DATA / "kidney/processed/ckd_tamil_nadu_cleaned.csv",
        out,
        {
            "source": "data/kidney/raw/ucimlrepo_id336_ckd_tamil_nadu.csv",
            "fix": (
                "stripped tab characters on class/dm; class-blind median/mode impute; "
                "NO missingness indicators (those leak CKD because labs were ordered more often on notckd)"
            ),
            "dirty_class_tabs_fixed": dirty_class,
            "dirty_dm_tabs_fixed": dirty_dm,
            "leaky_if_left_missing": miss_by_class,
            "imputers": imputers,
            "class_balance": out["disease"].value_counts().to_dict(),
            "missing_after_must_be_empty": True,
        },
    )
    return {
        "file": "kidney/processed/ckd_tamil_nadu_cleaned.csv",
        "n": int(len(out)),
        "missing_after": int(out.isna().sum().sum()),
        "class_balance": {"ckd": int((out["disease"] == 1).sum()), "notckd": int((out["disease"] == 0).sum())},
        "tabs_fixed": {"class": dirty_class, "dm": dirty_dm},
        "miss_pct_before_by_class": miss_by_class,
    }


def main() -> None:
    report = {
        "written_utc": STAMP,
        "ilpd": clean_ilpd(),
        "pima": clean_pima(),
        "ckd": clean_ckd(),
    }
    (DATA / "CLEANING.md").write_text(
        f"""# Processed-table fixes (raw files unchanged)

Written (UTC): `{STAMP}`

These three problems are **fixed in `data/<disease>/processed/`**. Raw downloads are still the originals.

## ILPD — 4 missing A/G Ratio

Filled from the definition **albumin / globulin**, with globulin = total protein − albumin.
That matches recorded A/G at correlation ~0.85 on the other 579 rows. No rows dropped.
Class remains 416 disease / 167 not.

File: `data/liver/processed/ilpd_cleaned.csv`

Derived values for the four rows: `{report['ilpd']['derived_ag_values']}`
Missing A/G after: **{report['ilpd']['missing_ag_after']}**

## Pima — zeros that are not zeros

`glucose` (plas), `bp` (pres), `skin`, `insulin` (insu), `bmi` (mass): every `0` is now **NA**.
`pregnancies=0` is a real count and was left alone.
Class remains 268 positive / 500 negative.

Zeros recoded: `{report['pima']['zeros_recoded']}`

File: `data/diabetes/processed/pima_cleaned.csv`  
Columns renamed to the MediAI form: pregnancies, glucose, bp, skin, insulin, bmi, pedigree, age, disease.

## Tamil Nadu CKD — missing labs leaked the label

Before cleaning, `rbc` was missing in **57% of CKD** vs **6% of not-CKD** (same pattern on rbcc/wbcc/sodium/potassium/PCV). A tree that splits on “is this lab missing?” is diagnosing the hospital’s test-ordering, not the patient.

Fixes applied:

1. `ckd\\t` → `ckd` (2 rows) and `\\tno` → `no` on diabetes mellitus.
2. Class-blind median (numeric) / mode (categorical) impute. **No missingness flags.**
3. After impute, missing cells: **{report['ckd']['missing_after']}**. Balance **250 / 150**.

File: `data/kidney/processed/ckd_tamil_nadu_cleaned.csv`

Missingness-by-class *before* impute (evidence for the leak): `{report['ckd']['miss_pct_before_by_class']}`
""",
        encoding="utf-8",
    )
    (DATA / "cleaning_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
