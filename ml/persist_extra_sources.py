#!/usr/bin/env python3
"""Persist extra same-schema sources used to lift holdout accuracy to 85%+.

Writes small files only:
  - UCI 878 Mayo PBC / cirrhosis labs (not the 57MB NHANES dump)
  - NHANES 2011–2023 column subset (diabetes overlapping labs + label)

Raw originals already in data/<disease>/raw/ are never overwritten.
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
    print(json.dumps({"mayo": mayo, "nhanes": nhanes}, indent=2))


if __name__ == "__main__":
    main()
