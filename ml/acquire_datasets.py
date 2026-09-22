#!/usr/bin/env python3
"""Phase 2: download raw disease-classification tables. Does not train.

India-first when a citable India (or South Asia) table exists.
Multiple same-schema sources are stored side-by-side for later pooled training.
Raw files are never overwritten by cleaning.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
UA = "MediAI-dataset-acquire/1.0 (research; +https://github.com/Suhas-Ramesha/MediAi)"
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

HEART_COLS = [
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


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch(url: str, timeout: int = 90) -> bytes:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def write_raw(path: Path, content: bytes, meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    sidecar = path.with_suffix(path.suffix + ".meta.json")
    payload = {
        **meta,
        "bytes": len(content),
        "sha256": sha256_bytes(content),
        "downloaded_utc": STAMP,
        "local_path": str(path.relative_to(ROOT)),
    }
    sidecar.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def load_csv_bytes(b: bytes, **kwargs: Any) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(b), **kwargs)


def missing_report(df: pd.DataFrame) -> dict[str, int]:
    miss = df.isna().sum()
    return {str(c): int(miss[c]) for c in df.columns if int(miss[c]) > 0}


def balance(series: pd.Series) -> dict[str, int]:
    vc = series.astype(str).value_counts(dropna=False)
    return {str(k): int(v) for k, v in vc.items()}


def try_ucimlrepo(uci_id: int) -> tuple[pd.DataFrame, dict[str, Any]]:
    from ucimlrepo import fetch_ucirepo

    ds = fetch_ucirepo(id=uci_id)
    x = ds.data.features.copy()
    y = ds.data.targets.copy()
    df = pd.concat([x.reset_index(drop=True), y.reset_index(drop=True)], axis=1)
    meta = {
        "uci_id": uci_id,
        "name": getattr(ds.metadata, "name", None) or (ds.metadata.get("name") if isinstance(ds.metadata, dict) else None),
        "variables": None,
    }
    try:
        meta["name"] = ds.metadata.name if hasattr(ds.metadata, "name") else ds.metadata["name"]
    except Exception:
        pass
    return df, meta


def acquire_heart() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    raw = DATA / "heart" / "raw"
    (DATA / "heart" / "processed").mkdir(parents=True, exist_ok=True)

    # Official UCI zip (Cleveland + other sites + unprocessed dumps)
    zip_url = "https://archive.ics.uci.edu/static/public/45/heart+disease.zip"
    zbytes = fetch(zip_url)
    write_raw(
        raw / "uci_heart_disease.zip",
        zbytes,
        {
            "title": "UCI Heart Disease (all sites)",
            "source_url": zip_url,
            "page": "https://archive.ics.uci.edu/dataset/45/heart+disease",
            "doi": "10.24432/C52P4X",
            "license": "CC BY 4.0",
            "geography": "USA (Cleveland, VA Long Beach), Hungary, Switzerland",
            "india": False,
            "role": "multi-site pool (same 13 clinical features as the MediAI heart form)",
        },
    )
    with zipfile.ZipFile(io.BytesIO(zbytes)) as zf:
        zf.extractall(raw / "uci_heart_disease_unzipped")

    site_files = {
        "cleveland": "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data",
        "hungarian": "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.hungarian.data",
        "switzerland": "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.switzerland.data",
        "va_long_beach": "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.va.data",
    }
    frames = []
    for site, url in site_files.items():
        b = fetch(url)
        write_raw(
            raw / f"processed.{site}.data",
            b,
            {
                "title": f"UCI Heart Disease processed {site}",
                "source_url": url,
                "doi": "10.24432/C52P4X",
                "license": "CC BY 4.0",
                "geography": site,
                "india": False,
                "role": "cleveland=core US cath-lab table; others=same-schema extra sites for pooled training",
            },
        )
        df = pd.read_csv(io.BytesIO(b), header=None, names=HEART_COLS, na_values=["?"])
        df["data_source"] = site
        frames.append(df)
        records.append(
            {
                "disease": "heart",
                "file": f"processed.{site}.data",
                "n": int(len(df)),
                "columns": HEART_COLS,
                "target": "num (0=absence, 1-4=presence; binarize as num>0)",
                "class_balance_raw": balance(df["num"]),
                "class_balance_binary": balance((df["num"] > 0).astype(int)),
                "missing": missing_report(df),
                "india": False,
                "geography": site,
            }
        )

    # India multispecialty hospital table (Mendeley DOI). File retrieved from a public
    # GitHub copy because Mendeley's file API requires a browser session.
    india_url = (
        "https://raw.githubusercontent.com/Ravi8548/Cardiovascular-diseases-CVDs-analysis/"
        "main/Cardiovascular_Disease_Dataset.csv"
    )
    ib = fetch(india_url)
    write_raw(
        raw / "india_mendeley_dzz48mvjht_Cardiovascular_Disease_Dataset.csv",
        ib,
        {
            "title": "Cardiovascular_Disease_Dataset (Indian multispecialty hospital)",
            "source_url": india_url,
            "original_page": "https://data.mendeley.com/datasets/dzz48mvjht/1",
            "doi": "10.17632/dzz48mvjht.1",
            "license": "CC BY 4.0",
            "authors": "Doppala, Bhanu Prakash; Bhattacharyya, Debnath",
            "geography": "India (unspecified multispecialty hospital)",
            "india": True,
            "role": "India primary heart table; Cleveland-like features (no thal). Retrieval path is GitHub; cite the Mendeley DOI.",
            "note": "Inspect for duplication vs UCI Cleveland before pooling.",
        },
    )
    idf = load_csv_bytes(ib)
    records.append(
        {
            "disease": "heart",
            "file": "india_mendeley_dzz48mvjht_Cardiovascular_Disease_Dataset.csv",
            "n": int(len(idf)),
            "columns": list(map(str, idf.columns)),
            "target": "target (0=absence, 1=presence)",
            "class_balance_raw": balance(idf["target"]) if "target" in idf.columns else {},
            "missing": missing_report(idf.replace({0: pd.NA}) if "serumcholestrol" in idf.columns else idf),
            "india": True,
            "geography": "India",
            "head": idf.head(2).to_dict(orient="records"),
        }
    )

    # ucimlrepo Cleveland-only convenience table
    df45, _ = try_ucimlrepo(45)
    csv = df45.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id45_cleveland.csv",
        csv,
        {
            "title": "ucimlrepo fetch id=45 (Cleveland 14-col subset)",
            "source_url": "https://archive.ics.uci.edu/dataset/45/heart+disease",
            "doi": "10.24432/C52P4X",
            "license": "CC BY 4.0",
            "india": False,
            "role": "same as processed.cleveland via the official Python client",
        },
    )
    return records


def acquire_liver() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    raw = DATA / "liver" / "raw"
    (DATA / "liver" / "processed").mkdir(parents=True, exist_ok=True)

    df, _ = try_ucimlrepo(225)
    b = df.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id225_ilpd.csv",
        b,
        {
            "title": "ILPD Indian Liver Patient Dataset",
            "source_url": "https://archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset",
            "doi": "10.24432/C5D02C",
            "license": "CC BY 4.0",
            "geography": "North-East Andhra Pradesh, India",
            "india": True,
            "role": "India primary liver table; matches the MediAI liver form",
        },
    )
    # Also keep the original UCI CSV bytes
    orig = fetch(
        "https://archive.ics.uci.edu/ml/machine-learning-databases/00225/"
        "Indian%20Liver%20Patient%20Dataset%20(ILPD).csv"
    )
    write_raw(
        raw / "Indian_Liver_Patient_Dataset_ILPD.csv",
        orig,
        {
            "title": "ILPD original UCI CSV (no header row)",
            "source_url": "https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv",
            "doi": "10.24432/C5D02C",
            "license": "CC BY 4.0",
            "india": True,
        },
    )
    records.append(
        {
            "disease": "liver",
            "file": "ucimlrepo_id225_ilpd.csv",
            "n": int(len(df)),
            "columns": list(map(str, df.columns)),
            "target": "Selector (1=liver disease, 2=no disease)",
            "class_balance_raw": balance(df.iloc[:, -1]),
            "missing": missing_report(df),
            "india": True,
            "geography": "Andhra Pradesh, India",
        }
    )

    hcv, _ = try_ucimlrepo(571)
    hb = hcv.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id571_hcv.csv",
        hb,
        {
            "title": "UCI HCV data",
            "source_url": "https://archive.ics.uci.edu/dataset/571/hcv+data",
            "doi": "10.24432/C5D612",
            "license": "CC BY 4.0",
            "geography": "Germany (Hannover / Trillium labs)",
            "india": False,
            "role": "Second liver source. Not India. Same-task (disease vs donor) with overlapping labs; pool with missing ILPD-only columns, or hold out as external validation.",
        },
    )
    records.append(
        {
            "disease": "liver",
            "file": "ucimlrepo_id571_hcv.csv",
            "n": int(len(hcv)),
            "columns": list(map(str, hcv.columns)),
            "target": "Category (blood donor vs hepatitis/fibrosis/cirrhosis)",
            "class_balance_raw": balance(
                hcv[[c for c in hcv.columns if "cat" in c.lower() or c == "Category"][0]]
                if any("cat" in c.lower() or c == "Category" for c in hcv.columns)
                else hcv.iloc[:, -1]
            ),
            "missing": missing_report(hcv),
            "india": False,
            "geography": "Germany",
        }
    )
    return records


def acquire_diabetes() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    raw = DATA / "diabetes" / "raw"
    (DATA / "diabetes" / "processed").mkdir(parents=True, exist_ok=True)

    # Pima — NOT India (Arizona / Akimel O'odham). Kept because the MediAI form is this 8-lab schema.
    openml = fetch("https://www.openml.org/data/get_csv/37/dataset_37_diabetes.arff")
    write_raw(
        raw / "openml_37_pima_diabetes.csv",
        openml,
        {
            "title": "Pima Indians Diabetes (OpenML 37 / NIDDK)",
            "source_url": "https://www.openml.org/d/37",
            "citation": "Smith, Everhart, Dickson, Knowler, Johannes 1988 SCAMC",
            "license": "historic UCI dump; cite NIDDK / Smith 1988",
            "geography": "Gila River community, Arizona, USA — not India despite the name",
            "india": False,
            "role": "Schema match for the current diabetes form. Ethics limitation must stay in the notebook.",
        },
    )
    # OpenML CSV sometimes has a comment header
    text = openml.decode("utf-8", errors="replace")
    if text.lstrip().startswith("<"):
        raise RuntimeError("OpenML returned HTML, not CSV")
    pdf = pd.read_csv(io.BytesIO(openml))
    # normalize class col
    target_col = [c for c in pdf.columns if c.lower() in {"class", "outcome"}][-1]
    records.append(
        {
            "disease": "diabetes",
            "file": "openml_37_pima_diabetes.csv",
            "n": int(len(pdf)),
            "columns": list(map(str, pdf.columns)),
            "target": target_col,
            "class_balance_raw": balance(pdf[target_col]),
            "missing": missing_report(pdf),
            "zeros_as_possible_missing": {
                c: int((pdf[c] == 0).sum())
                for c in pdf.columns
                if pd.api.types.is_numeric_dtype(pdf[c]) and c.lower() not in {target_col.lower(), "preg", "pregnancies"}
            },
            "india": False,
            "geography": "USA (Pima / Akimel O'odham women ≥21)",
        }
    )

    # Early-stage questionnaire — Sylhet, Bangladesh (South Asia, not India)
    es, _ = try_ucimlrepo(529)
    eb = es.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id529_early_stage_diabetes_sylhet.csv",
        eb,
        {
            "title": "Early Stage Diabetes Risk Prediction",
            "source_url": "https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset",
            "license": "CC BY 4.0 (UCI)",
            "paper": "Islam et al. 2020 doi:10.1007/978-981-13-8798-2_12",
            "geography": "Sylhet Diabetes Hospital, Bangladesh",
            "india": False,
            "south_asia": True,
            "role": "South-Asian extra table. Symptom schema, not Pima labs — cannot pool into the product model; keep as a second diabetes view / schema-shift check.",
        },
    )
    tcol = es.columns[-1]
    records.append(
        {
            "disease": "diabetes",
            "file": "ucimlrepo_id529_early_stage_diabetes_sylhet.csv",
            "n": int(len(es)),
            "columns": list(map(str, es.columns)),
            "target": str(tcol),
            "class_balance_raw": balance(es[tcol]),
            "missing": missing_report(es),
            "india": False,
            "geography": "Bangladesh (Sylhet)",
        }
    )

    # Optional Pabna hospital table (Pima-like schema, Bangladesh) if a public file appears later.
    pabna_attempts = [
        "https://raw.githubusercontent.com/ShariaArfinTanim/Type-2-Diabetes/main/diabetes.csv",
        "https://raw.githubusercontent.com/alrafiaurnob/Type-2-Diabetes/main/dataset.csv",
    ]
    for url in pabna_attempts:
        try:
            b = fetch(url)
            if b.startswith(b"404") or b.startswith(b"Not Found") or len(b) < 200:
                continue
            write_raw(
                raw / "pabna_bangladesh_attempt.csv",
                b,
                {
                    "title": "Attempted Pabna Diabetes Hospital table",
                    "source_url": url,
                    "doi": "10.17632/vxnyysk9vc.2",
                    "geography": "Pabna, Bangladesh",
                    "india": False,
                    "south_asia": True,
                    "role": "Same-schema extra source IF this is the genuine hospital file (verify vs Pima duplication).",
                },
            )
            break
        except Exception:
            continue
    return records


def acquire_kidney() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    raw = DATA / "kidney" / "raw"
    (DATA / "kidney" / "processed").mkdir(parents=True, exist_ok=True)

    k1, _ = try_ucimlrepo(336)
    b = k1.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id336_ckd_tamil_nadu.csv",
        b,
        {
            "title": "UCI Chronic Kidney Disease",
            "source_url": "https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease",
            "doi": "10.24432/C5G020",
            "license": "CC BY 4.0",
            "geography": "Apollo Hospitals, Karaikudi, Tamil Nadu, India",
            "india": True,
            "role": "India primary CKD table. MediAI form is a 4-lab subset (creatinine, urea, hemoglobin, BP).",
        },
    )
    tcol = [c for c in k1.columns if c.lower() in {"class", "ckd"}][-1]
    records.append(
        {
            "disease": "kidney",
            "file": "ucimlrepo_id336_ckd_tamil_nadu.csv",
            "n": int(len(k1)),
            "columns": list(map(str, k1.columns)),
            "target": str(tcol),
            "class_balance_raw": balance(k1[tcol]),
            "missing": missing_report(k1),
            "india": True,
            "geography": "Tamil Nadu, India",
        }
    )

    k2, _ = try_ucimlrepo(857)
    b2 = k2.to_csv(index=False).encode("utf-8")
    write_raw(
        raw / "ucimlrepo_id857_ckd_bangladesh.csv",
        b2,
        {
            "title": "UCI Risk Factor Prediction of Chronic Kidney Disease",
            "source_url": "https://archive.ics.uci.edu/dataset/857/risk+factor+prediction+of+chronic+kidney+disease",
            "doi": "10.24432/C5WP64",
            "license": "CC BY 4.0",
            "geography": "Enam Medical College, Savar, Dhaka, Bangladesh",
            "india": False,
            "south_asia": True,
            "role": "Second CKD source, overlapping labs. Pool on intersecting columns with the Tamil Nadu table.",
        },
    )
    t2 = k2.columns[-1]
    records.append(
        {
            "disease": "kidney",
            "file": "ucimlrepo_id857_ckd_bangladesh.csv",
            "n": int(len(k2)),
            "columns": list(map(str, k2.columns)),
            "target": str(t2),
            "class_balance_raw": balance(k2[t2]),
            "missing": missing_report(k2),
            "india": False,
            "geography": "Bangladesh",
        }
    )
    return records


def render_readme(audits: list[dict[str, Any]]) -> str:
    lines = [
        "# MediAI disease-classifier datasets (raw)",
        "",
        f"Downloaded (UTC): `{STAMP}`",
        "",
        "Raw files in `data/<disease>/raw/` are **untouched originals** (plus a `.meta.json` sidecar).",
        "`processed/` is empty until Phase 3 cleaning.",
        "",
        "## Why these files",
        "",
        "MediAI needs four *product* models that accept the existing risk-form fields.",
        "Where an **Indian** table exists with a compatible schema, it is the primary source and other",
        "same-schema tables are stored for **pooled training** (not a single combined multi-disease model).",
        "",
        "| Disease | India / South Asia | Extra same-schema sources | Product form |",
        "|---|---|---|---|",
        "| Heart | Mendeley Indian hospital (DOI 10.17632/dzz48mvjht.1, n≈1000) | UCI Cleveland + Hungary + Switzerland + VA Long Beach | Cleveland 13 features |",
        "| Liver | UCI ILPD, Andhra Pradesh (DOI 10.24432/C5D02C) | UCI HCV (Germany) — overlapping labs | ILPD panel |",
        "| Diabetes | No public Indian 8-lab table found | Pima (US, form match) + Sylhet Bangladesh (symptoms, not poolable) | Pima 8 labs |",
        "| Kidney | UCI CKD, Karaikudi, Tamil Nadu (DOI 10.24432/C5G020) | UCI 857 Bangladesh | 4 labs ⊂ 24 UCI columns |",
        "",
        "## Files",
        "",
    ]
    for disease in ("heart", "liver", "diabetes", "kidney"):
        raw = DATA / disease / "raw"
        lines.append(f"### {disease}")
        lines.append("")
        if not raw.exists():
            lines.append("_missing_")
            continue
        for p in sorted(raw.rglob("*")):
            if p.is_dir() or p.name.endswith(".meta.json"):
                continue
            meta_path = p.with_suffix(p.suffix + ".meta.json")
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            rel = p.relative_to(DATA)
            lines.append(
                f"- `{rel}` — {meta.get('title', p.name)}  \n"
                f"  source: {meta.get('source_url') or meta.get('page') or ''}  \n"
                f"  license: {meta.get('license', '?')} · DOI: {meta.get('doi', '—')}  \n"
                f"  sha256: `{meta.get('sha256', '')}` · bytes: {meta.get('bytes', '')} · {meta.get('downloaded_utc', '')}"
            )
        lines.append("")
    lines.append("## Audit snapshot")
    lines.append("")
    lines.append("See `data/AUDIT.md` for row counts, columns, class balance, missingness, and dictionaries.")
    lines.append("")
    return "\n".join(lines) + "\n"


DICTIONARIES = {
    "heart_uci": """
| Column | Meaning |
|---|---|
| age | years |
| sex | 1=male, 0=female |
| cp | chest pain: 1 typical angina, 2 atypical, 3 non-anginal, 4 asymptomatic (UCI encoding) |
| trestbps | resting blood pressure mmHg |
| chol | serum cholesterol mg/dl |
| fbs | fasting blood sugar > 120 mg/dl |
| restecg | 0 normal, 1 ST-T abnormality, 2 LVH |
| thalach | max heart rate |
| exang | exercise-induced angina |
| oldpeak | ST depression vs rest |
| slope | peak exercise ST slope |
| ca | major vessels coloured by fluoroscopy (0–3) |
| thal | 3 normal, 6 fixed defect, 7 reversible defect |
| num | 0 = <50% narrowing, 1–4 = disease present |
""",
    "heart_india": """
Indian hospital table uses 0-based chest-pain codes (0 typical … 3 asymptomatic) and has **no `thal`**.
`serumcholestrol` of 0 is treated as missing in the published description. Align encodings before pooling with UCI.
""",
    "liver_ilpd": """
| Column | Meaning |
|---|---|
| Age | years |
| Gender | Male / Female |
| TB | total bilirubin |
| DB | direct bilirubin |
| Alkphos | alkaline phosphatase |
| Sgpt | ALT |
| Sgot | AST |
| TP | total proteins |
| ALB | albumin |
| A/G Ratio | albumin/globulin |
| Selector | 1 = liver patient, 2 = non-liver patient |
""",
    "diabetes_pima": """
| Column | Meaning |
|---|---|
| preg / Pregnancies | number of pregnancies |
| plas / Glucose | 2-hour OGTT plasma glucose |
| pres / BloodPressure | diastolic mmHg |
| skin / SkinThickness | triceps skinfold mm |
| insu / Insulin | 2-hour serum insulin µU/ml |
| mass / BMI | kg/m² |
| pedi / DiabetesPedigreeFunction | family-history score |
| age | years |
| class / Outcome | tested_positive / tested_negative |
Zeros in glucose, BP, skin, insulin, BMI are **missing**, not true zeros.
Women ≥ 21 only. Not an Indian cohort.
""",
    "kidney_uci": """
| Column | Meaning |
|---|---|
| age | years |
| bp | blood pressure mmHg |
| sg | urine specific gravity |
| al | albumin (0–5) |
| su | sugar (0–5) |
| rbc / pc | red cells / pus cells normal|abnormal |
| pcc / ba | pus clumps / bacteria present|notpresent |
| bgr | random blood glucose mg/dl |
| bu | blood urea mg/dl |
| sc | serum creatinine mg/dl |
| sod / pot | sodium / potassium |
| hemo | hemoglobin g/dl |
| pcv / wc / rc | packed cell volume, WBC, RBC counts |
| htn / dm / cad | hypertension / diabetes / CAD yes|no |
| appet / pe / ane | appetite, pedal edema, anemia |
| class | ckd / notckd |
MediAI currently collects sc, bu, hemo, bp (+ sex/lifestyle). Other columns are optional at serving time.
""",
}


def render_audit(audits: list[dict[str, Any]]) -> str:
    lines = [
        "# Phase 2 data audit — four disease tables",
        "",
        f"Generated (UTC): `{STAMP}`",
        "",
        "No training has been run. Raw files are unmodified.",
        "",
        "## Training plan these files support",
        "",
        "Each disease still gets **one** deployed model. That model is trained on **all compatible rows**",
        "(India first, then extra sites), with a site-stratified holdout and per-source metrics.",
        "Incompatible schemas are stored but **not concatenated**.",
        "",
        "| Disease | Pooled training rows (plan) | Held out / extra |",
        "|---|---|---|",
        "| Heart | Indian hospital + UCI 4 sites, aligned encodings | 20% stratified by source; also report India-only and Cleveland-only AUC |",
        "| Liver | ILPD (India) as the full-schema core; HCV rows appended with ILPD-only labs set missing | HCV-only external score |",
        "| Diabetes | Pima only for the product 8-lab model (no second India 8-lab table) | Sylhet early-stage as a separate symptom-schema check, not a pool |",
        "| Kidney | Tamil Nadu UCI 336 + Bangladesh UCI 857 on intersecting columns | 20% stratified by source |",
        "",
        "## Per-file audit",
        "",
    ]
    for rec in audits:
        lines.append(f"### {rec['disease']} — `{rec['file']}`")
        lines.append("")
        lines.append(f"- rows: **{rec.get('n')}**")
        lines.append(f"- geography: {rec.get('geography')} · india={rec.get('india')}")
        lines.append(f"- target: {rec.get('target')}")
        lines.append(f"- class balance: `{rec.get('class_balance_raw')}`")
        if rec.get("class_balance_binary"):
            lines.append(f"- binary balance (disease present): `{rec['class_balance_binary']}`")
        lines.append(f"- columns ({len(rec.get('columns') or [])}): `{rec.get('columns')}`")
        lines.append(f"- missing (non-zero only): `{rec.get('missing')}`")
        if rec.get("zeros_as_possible_missing"):
            lines.append(f"- zeros that may be missing: `{rec['zeros_as_possible_missing']}`")
        lines.append("")
    lines.append("## Data dictionaries")
    lines.append(DICTIONARIES["heart_uci"])
    lines.append(DICTIONARIES["heart_india"])
    lines.append(DICTIONARIES["liver_ilpd"])
    lines.append(DICTIONARIES["diabetes_pima"])
    lines.append(DICTIONARIES["kidney_uci"])
    lines.append("## Caveats to confirm before Phase 3")
    lines.append("")
    lines.append("1. Indian heart `chestpain` coding is 0–3; UCI `cp` is 1–4. Must remap before pooling.")
    lines.append("2. Indian heart has no `thal`; product form has `thal` — keep as optional/missing.")
    lines.append("3. Check whether the Indian heart file duplicates UCI Cleveland rows (synthetic-clone risk).")
    lines.append("4. Pima is **not** an Indian dataset. NMB-2017 (7496 Indians, DOI 10.17632/twp8xw6p25.1) exists but uses HbA1c/waist/self-report, not the 8 form labs, and Mendeley did not yield a file without a browser session.")
    lines.append("5. Pabna Bangladesh (DOI 10.17632/vxnyysk9vc.2) is Pima-like and would be a valid extra pool if a raw file becomes available; it was not downloaded this run.")
    lines.append("6. UCI CKD missingness may itself leak the label — Phase 3 must report complete-case vs missing-indicator.")
    lines.append("7. These classifiers are not diagnoses.")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> int:
    DATA.mkdir(exist_ok=True)
    audits: list[dict[str, Any]] = []
    audits.extend(acquire_heart())
    audits.extend(acquire_liver())
    audits.extend(acquire_diabetes())
    audits.extend(acquire_kidney())
    (DATA / "README.md").write_text(render_readme(audits), encoding="utf-8")
    (DATA / "AUDIT.md").write_text(render_audit(audits), encoding="utf-8")
    (DATA / "audit.json").write_text(json.dumps(audits, indent=2, default=str) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "n_records": len(audits), "stamp": STAMP}, indent=2))
    for rec in audits:
        print(f"{rec['disease']:8} n={rec['n']:5} india={str(rec.get('india')):5} {rec['file']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
