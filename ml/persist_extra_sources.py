#!/usr/bin/env python3
"""Persist extra same-schema sources used to lift holdout accuracy to 85%+.

Writes small files only:
  - UCI 878 Mayo PBC / cirrhosis labs (not the 57MB NHANES dump)
  - NHANES 2011–2023 column subset (diabetes overlapping labs + label)
  - Pabna Diabetes Hospital 8-lab table (Mendeley 10.17632/vxnyysk9vc.3)

Raw originals already in data/<disease>/raw/ are never overwritten.
Frankfurt (Pima clone), Iraqi HbA1c, DiaBD, and NHANES-liver are not persisted.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

NHANES_COLS = [
    "DIQ010",
    "LBXSGL",
    "BMI",
    "RIDAGEYR",
    "RIAGENDR",
    "bp_sys_mean",
    "bp_dia_mean",
]

PABNA_URL = (
    "https://data.mendeley.com/public-files/datasets/vxnyysk9vc/files/"
    "9eaad8bb-97bb-49ca-9301-886adf06af4e/file_downloaded"
)
NHANES_FULL_CANDIDATES = [
    Path("/tmp/nhanes_full.csv"),
    DATA / "shared/raw/nhanes_full.csv",
]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_meta(path: Path, meta: dict) -> None:
    sidecar = path.with_suffix(path.suffix + ".meta.json")
    sidecar.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def persist_mayo() -> dict:
    from ucimlrepo import fetch_ucirepo

    ds = fetch_ucirepo(id=878)
    df = pd.concat([ds.data.features.reset_index(drop=True), ds.data.targets.reset_index(drop=True)], axis=1)
    path = DATA / "liver/raw/ucimlrepo_id878_cirrhosis_mayo_pbc.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    meta = {
        "title": "Cirrhosis Patient Survival (Mayo PBC trial labs)",
        "source_url": "https://archive.ics.uci.edu/dataset/878/cirrhosis+patient+survival+prediction+dataset-1",
        "doi": "10.24432/C5R02G",
        "license": "CC BY 4.0",
        "geography": "Mayo Clinic PBC trial, USA",
        "india": False,
        "role": (
            "Third liver source. All rows are confirmed liver disease (PBC). "
            "Pooled as disease=1 on Age/Sex/Bilirubin/Alk_Phos/SGOT/Albumin; "
            "ILPD-only labs left missing. Status/Stage/Drug are NOT used as features."
        ),
        "n": int(len(df)),
        "columns": list(map(str, df.columns)),
        "bytes": int(path.stat().st_size),
        "sha256": _sha256(path),
        "downloaded_utc": STAMP,
        "local_path": str(path.relative_to(ROOT)),
    }
    _write_meta(path, meta)
    return {"file": str(path.relative_to(ROOT)), "n": int(len(df))}


def _find_nhanes_full() -> Path:
    for p in NHANES_FULL_CANDIDATES:
        if p.exists() and p.stat().st_size > 1_000_000:
            return p
    raise FileNotFoundError(
        "NHANES full CSV not found. Download Zenodo record 21051814 "
        "(DOI 10.5281/zenodo.20299025) to /tmp/nhanes_full.csv and re-run."
    )


def persist_pabna() -> dict:
    """Pabna Diabetes Hospital 8-lab table (Mendeley DOI 10.17632/vxnyysk9vc.3)."""
    from urllib.request import Request, urlopen

    dest = DATA / "diabetes/raw/mendeley_vxnyysk9vc_pabna_diabetes.csv"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or dest.stat().st_size < 1000:
        req = Request(PABNA_URL, headers={"User-Agent": "MediAI-dataset-acquire/1.0"})
        with urlopen(req, timeout=90) as resp:
            dest.write_bytes(resp.read())
    df = pd.read_csv(dest)
    meta = {
        "title": "Type-2 Diabetes (Bangladeshi Patients) — Pabna Diabetes Hospital",
        "source_url": "https://data.mendeley.com/datasets/vxnyysk9vc/3",
        "doi": "10.17632/vxnyysk9vc.3",
        "paper": "10.1016/j.heliyon.2024.e24536",
        "license": "CC BY 4.0",
        "geography": "Pabna, Bangladesh",
        "india": False,
        "south_asia": True,
        "role": (
            "Third diabetes source on the same 8-lab form as Pima (pregnancies, "
            "OGTT glucose, diastolic BP, skinfold, insulin, BMI, family-history "
            "score, age). Independent of Pima (0 overlapping glucose+age+BMI keys). "
            "Not the Frankfurt 2000-row file, which is a Pima clone. "
            "Skinfold in the raw file is stored as mm×10 (25.4 cm-scale tenths); "
            "cleaning divides by 10. Insulin 0 and glucose 0 recoded to NA."
        ),
        "n": int(len(df)),
        "columns": list(map(str, df.columns)),
        "bytes": int(dest.stat().st_size),
        "sha256": _sha256(dest),
        "downloaded_utc": STAMP,
        "local_path": str(dest.relative_to(ROOT)),
    }
    _write_meta(dest, meta)
    return {"file": str(dest.relative_to(ROOT)), "n": int(len(df))}


def persist_nhanes_subset() -> dict:
    src = _find_nhanes_full()
    df = pd.read_csv(src, usecols=lambda c: c in NHANES_COLS)
    missing = [c for c in NHANES_COLS if c not in df.columns]
    if missing:
        raise RuntimeError(f"NHANES subset missing columns: {missing}")
    out_dir = DATA / "diabetes/raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "nhanes_2011_2023_diabetes_labs.csv"
    df.to_csv(path, index=False)
    meta = {
        "title": "NHANES 2011–2023 diabetes overlapping labs (column subset)",
        "source_url": "https://zenodo.org/records/21051814",
        "doi": "10.5281/zenodo.20299025",
        "citation": (
            "CDC/NCHS NHANES 2011–2023 public-use files; packaged as "
            "'NHANES Multi-Cycle Diabetes and Glycemic Status Dataset, 2011-2023' "
            "(Zenodo 10.5281/zenodo.20299025). Cite CDC/NCHS and the Zenodo DOI."
        ),
        "license": "NCHS public-use; free for research. Not CC.",
        "geography": "United States (population survey)",
        "india": False,
        "role": (
            "Second diabetes source, pooled with Pima on glucose/BMI/age/diastolic BP. "
            "Label is DIQ010 recoded 0=no, 2=diabetes (prediabetes=1 dropped). "
            "Do not use DIQ050 (insulin treatment) or LBXGH (HbA1c) as features — leakage. "
            "The 57MB full table is not stored in git."
        ),
        "columns": NHANES_COLS,
        "n": int(len(df)),
        "extracted_from": str(src),
        "bytes": int(path.stat().st_size),
        "sha256": _sha256(path),
        "downloaded_utc": STAMP,
        "local_path": str(path.relative_to(ROOT)),
    }
    _write_meta(path, meta)
    return {"file": str(path.relative_to(ROOT)), "n": int(len(df)), "bytes": int(path.stat().st_size)}


def main() -> None:
    mayo = persist_mayo()
    nhanes = persist_nhanes_subset()
    pabna = persist_pabna()
    print(json.dumps({"mayo": mayo, "nhanes": nhanes, "pabna": pabna}, indent=2))


if __name__ == "__main__":
    main()
