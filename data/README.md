# MediAI disease-classifier datasets (raw)

Downloaded (UTC): `2026-09-22T10:41:05Z`

Raw files in `data/<disease>/raw/` are **untouched originals** (plus a `.meta.json` sidecar).
`processed/` is empty until Phase 3 cleaning.

## Why these files

MediAI needs four *product* models that accept the existing risk-form fields.
Where an **Indian** table exists with a compatible schema, it is the primary source and other
same-schema tables are stored for **pooled training** (not a single combined multi-disease model).

| Disease | India / South Asia | Extra same-schema sources | Product form |
|---|---|---|---|
| Heart | Mendeley Indian hospital (DOI 10.17632/dzz48mvjht.1, n≈1000) | UCI Cleveland + Hungary + Switzerland + VA Long Beach | Cleveland 13 features |
| Liver | UCI ILPD, Andhra Pradesh (DOI 10.24432/C5D02C) | UCI HCV (Germany) + Mayo PBC (UCI 878) | ILPD panel |
| Diabetes | Pabna Bangladesh 8-lab (DOI 10.17632/vxnyysk9vc.3); no public Indian 8-lab table | Pima (US, form match) + NHANES 2011–2023 overlapping labs; Sylhet Bangladesh (symptoms, not poolable) | Pima 8 labs |
| Kidney | UCI CKD, Karaikudi, Tamil Nadu (DOI 10.24432/C5G020) | UCI 857 Bangladesh (pooled; BP left missing) | **Served = 4 labs**, not the 24-col hospital table |

## Files

### heart

- `heart/raw/india_mendeley_dzz48mvjht_Cardiovascular_Disease_Dataset.csv` — Cardiovascular_Disease_Dataset (Indian multispecialty hospital)  
  source: https://raw.githubusercontent.com/Ravi8548/Cardiovascular-diseases-CVDs-analysis/main/Cardiovascular_Disease_Dataset.csv  
  license: CC BY 4.0 · DOI: 10.17632/dzz48mvjht.1  
  sha256: `9376367dde41e79e432d6402ea5d9e44223fc318ff54ed09966d721923947d1e` · bytes: 43633 · 2026-09-22T10:41:05Z
- `heart/raw/processed.cleveland.data` — UCI Heart Disease processed cleveland  
  source: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8` · bytes: 18461 · 2026-09-22T10:41:05Z
- `heart/raw/processed.hungarian.data` — UCI Heart Disease processed hungarian  
  source: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.hungarian.data  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `d1ad108f785768cd3d7e82dc522e6f5a61eea93cccfb3a46ee8076f73fc3d796` · bytes: 10263 · 2026-09-22T10:41:05Z
- `heart/raw/processed.switzerland.data` — UCI Heart Disease processed switzerland  
  source: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.switzerland.data  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `834a405ccf5b66ab4056bb77794adc8df0b7125186454c0a1d002d33c6c3b314` · bytes: 4109 · 2026-09-22T10:41:05Z
- `heart/raw/processed.va_long_beach.data` — UCI Heart Disease processed va_long_beach  
  source: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.va.data  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `e7c93d8d0d2acdadfa4c5e8de768e2191e7f618b952e29623f1f0d5949ff6b8f` · bytes: 6737 · 2026-09-22T10:41:05Z
- `heart/raw/uci_heart_disease.zip` — UCI Heart Disease (all sites)  
  source: https://archive.ics.uci.edu/static/public/45/heart+disease.zip  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `b17cd273da9ce1caa4710fce80227ea454d4dbf9fcbc8e6a9121672751563adc` · bytes: 128894 · 2026-09-22T10:41:05Z
- `heart/raw/ucimlrepo_id45_cleveland.csv` — ucimlrepo fetch id=45 (Cleveland 14-col subset)  
  source: https://archive.ics.uci.edu/dataset/45/heart+disease  
  license: CC BY 4.0 · DOI: 10.24432/C52P4X  
  sha256: `c3855e7c0a818f03a1e90e4f23e0ad5d058dfbd1f276f1aab15d1f02693c1d0d` · bytes: 12472 · 2026-09-22T10:41:05Z

### liver

- `liver/raw/Indian_Liver_Patient_Dataset_ILPD.csv` — ILPD original UCI CSV (no header row)  
  source: https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv  
  license: CC BY 4.0 · DOI: 10.24432/C5D02C  
  sha256: `84feac16488de5cf89bd22bd802c77f25841fe93e9ddd32355683e94d46c3425` · bytes: 23755 · 2026-09-22T10:41:05Z
- `liver/raw/ucimlrepo_id225_ilpd.csv` — ILPD Indian Liver Patient Dataset  
  source: https://archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset  
  license: CC BY 4.0 · DOI: 10.24432/C5D02C  
  sha256: `9a59315bee30d451f43ea7f46a7e9b68bb2d6900ab56b8c996695d58edf93fe7` · bytes: 24013 · 2026-09-22T10:41:05Z
- `liver/raw/ucimlrepo_id571_hcv.csv` — UCI HCV data  
  source: https://archive.ics.uci.edu/dataset/571/hcv+data  
  license: CC BY 4.0 · DOI: 10.24432/C5D612  
  sha256: `5df221c426fe184ab72724f305dc69808a3b72284abcee47a56c387d250575ff` · bytes: 41892 · 2026-09-22T10:41:05Z
- `liver/raw/ucimlrepo_id878_cirrhosis_mayo_pbc.csv` — Mayo PBC / cirrhosis labs (UCI 878)  
  source: https://archive.ics.uci.edu/dataset/878/cirrhosis+patient+survival+prediction+dataset-1  
  license: CC BY 4.0 · DOI: 10.24432/C5R02G  
  role: extra confirmed liver-disease rows; Status/Stage/Drug are not features

### diabetes

- `diabetes/raw/openml_37_pima_diabetes.csv` — Pima Indians Diabetes (OpenML 37 / NIDDK)  
  source: https://www.openml.org/d/37  
  license: historic UCI dump; cite NIDDK / Smith 1988 · DOI: —  
  sha256: `de2e5ee67a97714d8cabfad8abe892375fc621feed7e9bf76c11a4ee43f403f6` · bytes: 33824 · 2026-09-22T10:41:05Z
- `diabetes/raw/ucimlrepo_id529_early_stage_diabetes_sylhet.csv` — Early Stage Diabetes Risk Prediction  
  source: https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset  
  license: CC BY 4.0 (UCI) · DOI: —  
  sha256: `aedb4c29fa697086c957ede846c5487f52e70eb93f7899d5e15d70bb68f8a397` · bytes: 34161 · 2026-09-22T10:41:05Z
- `diabetes/raw/nhanes_2011_2023_diabetes_labs.csv` — NHANES 2011–2023 overlapping labs (column subset, not the 57MB dump)  
  source: CDC/NCHS NHANES packaged at https://zenodo.org/records/21051814  
  license: NCHS public-use · DOI: 10.5281/zenodo.20299025  
  role: second diabetes source; DIQ010 0 vs 2; subsample negatives 1.8× in `ml/data_prep.py`
- `diabetes/raw/mendeley_vxnyysk9vc_pabna_diabetes.csv` — Pabna Diabetes Hospital 8-lab (women ≥21)  
  source: https://data.mendeley.com/datasets/vxnyysk9vc/3  
  license: CC BY 4.0 · DOI: 10.17632/vxnyysk9vc.3  
  role: third diabetes source, same 8 labs as the form; not a Pima clone

### kidney

- `kidney/raw/ucimlrepo_id336_ckd_tamil_nadu.csv` — UCI Chronic Kidney Disease  
  source: https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease  
  license: CC BY 4.0 · DOI: 10.24432/C5G020  
  sha256: `b2a110ee4fe787629ab726d427fc91783f6e42857bf75a646810bceb5989ee10` · bytes: 48295 · 2026-09-22T10:41:05Z
- `kidney/raw/ucimlrepo_id857_ckd_bangladesh.csv` — UCI Risk Factor Prediction of Chronic Kidney Disease  
  source: https://archive.ics.uci.edu/dataset/857/risk+factor+prediction+of+chronic+kidney+disease  
  license: CC BY 4.0 · DOI: 10.24432/C5WP64  
  sha256: `bbc5265624da2df64745e109c66585ed06deaf1b28270aee946c3cc77d90cb3d` · bytes: 33851 · 2026-09-22T10:41:05Z

## Accuracy / pooling notes (mentor)

Holdout accuracy target is **≥ 85%**, and it must beat the majority-class dummy:

- Heart: India + UCI 4 sites (already ≥ 85% on the 13-field form).
- Liver: ILPD + HCV + Mayo PBC. ILPD-only is harder (~70%) — quote pooled **and** ILPD-by-source. No extra public ILPD-like labelled table was found.
- Diabetes: Pima cannot hit 85% on a proper holdout (~74%). Pabna (same 8 labs, South Asia) is pooled. NHANES adults are pooled on glucose/BMI/age/BP; negatives subsampled so dummy ≈ 65%. Frankfurt clone / Iraqi HbA1c / DiaBD were inspected and rejected.
- Kidney: **quote the 4-lab served CatBoost**, not the 24-column TabPFN ~100%. Tamil Nadu + Bangladesh. UCI CKD’s 24-col near-1.0 is a property of that hospital table, which the chat never collects.

Do not commit `nhanes_full.csv` (≈57MB). Rebuild the column subset with `python -m ml.persist_extra_sources`.

