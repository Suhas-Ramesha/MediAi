# Phase 1 plan — four independent tabular disease classifiers

**Status:** PHASE 1 LOCKED (product-fit defaults). Phase 2 may download data.  
**Stop-gate:** Phase 2 still stops for a data-audit confirmation before any training.

### Locked decisions (chosen for MediAI prediction, not for a detached Kaggle bake-off)

The app already collects Cleveland heart fields, ILPD liver fields, Pima-style diabetes labs, and a 4-lab kidney subset. Models that cannot take those inputs cannot replace the Hugging Face Gradio risk calls.

| # | Decision | Lock |
|---|---|---|
| 1 | Dataset matrix | **India first, then pool every compatible extra table** so each disease model is trained on multiple sources (still one model per disease, not one model across diseases). Heart: Indian hospital (Mendeley 10.17632/dzz48mvjht.1) + UCI Cleveland/Hungary/Switzerland/VA. Liver: ILPD (Andhra Pradesh) + HCV labs with ILPD-only fields left missing. Kidney: Tamil Nadu UCI 336 + Bangladesh UCI 857 (parse bins to midpoints; drop leakage cols `stage`/`grf`/`affected`). Diabetes: no public Indian *8-lab* table; Pima for the product form + Sylhet Bangladesh as a separate symptom-schema check (not pooled). NMB-2017 (7496 Indians) is the right India diabetes study but uses HbA1c/waist, not the app form, and the Mendeley file was not downloadable without a browser session. |
| 2 | Pima | **Train it**, with the ethics limitation written into the notebook (women ≥21, one named community, zeros-as-missing). |
| 3 | Labels | Binary for all four. |
| 4 | Phase 4 API schema | **Match the existing MediAI risk modal** so `/predict` can replace Gradio. Kidney trains on the full UCI 24-column table; serving accepts the 4 UI labs and treats the rest as missing (median/mode + missing indicators). |
| 5 | TabPFN | TabPFNv2. All four primaries are small (n ≤ 768), so no 8k subset rule is needed. |
| 6 | Optuna | 40 / 40 / 40 / 8 trials. |
| 7 | NHANES kidney | Skip. |
| 8 | Claims | Screening-style probability, not a diagnosis. |

This document is the Phase 1 deliverable: the shared algorithm-comparison protocol, plus three citable dataset options per disease with a primary and a secondary recommendation.

---

## 1. What this project is (and is not)

Four **separate** binary classifiers:

| Disease | Task |
|---|---|
| Heart | Presence vs absence of angiographic coronary disease |
| Liver | Liver-disease vs no liver-disease (lab panel) |
| Diabetes | Diabetes (or diabetes+prediabetes) vs not |
| Chronic kidney disease | CKD vs not CKD |

There is **no** combined multi-disease model. Each disease gets its own preprocessing, its own algorithm bake-off, its own Optuna search, its own winner, its own SHAP plots, and its own saved artifact.

These are academic classifiers on public tables. They are **not** diagnostic devices, not clinician-signed, and not a substitute for a visit. The mentor notebook and any later API will say that in those words.

Current MediAI risk UI already collects:

- diabetes: Pima-style labs (pregnancies, glucose, BP, skin, insulin, BMI, pedigree, age)
- heart: Cleveland 13 clinical features
- liver: ILPD-style liver panel
- kidney: creatinine, urea, hemoglobin, BP (a **subset** of the UCI CKD table)

That schema match is useful for a later demo, but it is **not** the same as “best public dataset.” Where those two conflict, this plan prefers the better-documented dataset and records the UI gap for Phase 4.

---

## 2. Phased stop-gates (unchanged)

| Phase | Work | Stop until |
|---|---|---|
| **1 — this document** | Algorithm protocol + 3 datasets/disease + primary/secondary pick | You approve the plan |
| **2** | Download raw files into `data/<disease>/raw/`, leave them untouched, write `data/README.md`, print row counts / columns / balance / missingness / data dictionary | You confirm the tables look right |
| **3** | Autonomous train/compare/tune/SHAP/MLflow + one mentor notebook | (no extra input; runs after you confirm Phase 2) |
| **4** | Package 4 winners behind FastAPI, deploy a live URL | Phase 3 artifacts exist |

Nothing below this line downloads or trains anything.

---

## 3. Algorithm comparison (identical for every disease)

### 3.1 Candidates

Every disease trains and compares **the same four families**:

| Algorithm | Why it is in the bake-off |
|---|---|
| **XGBoost** | Strong default on mixed numeric/ordinal clinical tables |
| **LightGBM** | Fast, leaf-wise boosting; often wins on small/medium tabular |
| **CatBoost** | Native categoricals (chest-pain type, thal, sex, yes/no labs) without one-hot leakage |
| **TabPFN** (open **TabPFNv2**, Prior Labs / Nature 2025) | Prior-data fitted network; often SOTA on **small** tables (hundreds to a few thousand rows). Official comfort zone: ~10k rows × 500 features. TabPFN-2.5 is larger but more restricted on license; this project will use the open v2 weights unless you later approve otherwise. |

Each disease’s winner can differ. A LightGBM win on CKD does not force LightGBM on heart.

### 3.2 Target and metrics

- **Primary task:** binary classification (explicit encodings in §5).
- **Leader metric for picking the winner:** mean **ROC-AUC** on stratified cross-validation (threshold-free, robust to imbalance).
- **Reported for every run:** accuracy, precision, recall, F1, ROC-AUC (positive class = disease present).
- **Tie-break order** if AUC is within 0.01: F1 → recall → Brier score (calibration) → training-time / model size.
- Accuracy is logged and shown. It is **not** used to pick the winner.

Imbalance handling is part of the shared pipeline, not a per-algorithm special case: class-weighted loss (`scale_pos_weight` / `class_weight` / CatBoost `auto_class_weights`). No SMOTE unless the Phase 2 audit shows a class below ~15% **and** you later approve synthetic oversampling. CDC diabetes is the likely case.

### 3.3 Split discipline (no test leakage)

For each **primary** dataset:

1. Stratified **80/20 train/holdout**. The 20% holdout is frozen until the winner is chosen.
2. On the 80%: **Optuna** maximizes mean ROC-AUC of **StratifiedKFold (k=5)** (k=3 if n < 250).
3. Trial counts (CPU cloud VM, no assumed GPU):
   - XGBoost / LightGBM / CatBoost: **40 trials** each
   - TabPFN: **8 trials** (few real knobs: `n_estimators`, softmax temperature / average settings). Defaults are already strong.
4. Refit the trial’s best params on the full 80%.
5. Score the frozen 20% **once**.
6. Score the **secondary** dataset **once**, using only the **intersecting feature set**, with preprocessing fit on the primary train split only.

If a secondary table does not share enough columns to be a fair test (diabetes is the awkward one), the notebook will say so and report secondary metrics as **domain-shift / schema-shift**, not as a leaderboard number.

### 3.4 TabPFN on the one large table

CDC BRFSS diabetes is ~253k rows. TabPFNv2 is not designed for that scale on a CPU cloud box.

**Rule:** trees may train on a stratified cap of **20,000** rows for Optuna (then the winning tree family is refit on the full 80% if memory allows). TabPFN is trained on a **stratified 8,000-row** subset of that same train split. The comparison table will label TabPFN as “8k subset” so the mentor can see it is not an identical-n bake-off on that one disease.

Heart, liver, and kidney primaries are all n ≤ 615. TabPFN runs on the full train split there.

### 3.5 Preprocessing (shared, fit on train only)

- Median impute numeric, mode impute categorical (indicators for “was missing” on CKD, which is heavily missing-at-random-looking).
- CatBoost: pass categoricals as strings/integers; no one-hot.
- XGBoost / LightGBM: ordinal encode low-cardinality cats; one-hot only if cardinality > 8.
- TabPFN: numeric + categoricals as supported by v2; IDs dropped.
- Zero-coded missings (classic Pima: glucose/BP/skin/insulin = 0) recoded to NaN **if** that dataset is used at all.
- No scaling required for trees; StandardScaler only if a linear baseline is added later (not in scope).

### 3.6 SHAP (winner only, per disease)

- Tree winners: `shap.TreeExplainer` — bar (mean |SHAP|), beeswarm, and two waterfall plots (one true-positive, one true-negative).
- TabPFN winner: SHAP KernelExplainer on a 200-row background, or TabPFN’s native feature-importance API if KernelExplainer is too slow on CPU. The notebook will state which.
- Plots saved under `ml/reports/<disease>/` and embedded in the notebook.

### 3.7 MLflow (every algorithm, every disease)

Local file store: `ml/mlruns/` (gitignored except a small `ml/mlruns/README.md`).

Every Optuna trial logs:

- `disease`, `algorithm`, `dataset_id`, `n_train`, `n_val_fold`
- params
- CV accuracy / precision / recall / F1 / ROC-AUC (mean and std)
- holdout metrics (best trial only)
- secondary-dataset metrics (winner only)
- runtime seconds

Parent runs: `disease=<name>` → child runs per algorithm → grandchild trials.

After Phase 3 you can run `mlflow ui --backend-store-uri ml/mlruns` and see the full grid, not just the four winners.

### 3.8 Mentor notebook (Phase 3 shape, not written yet)

One Jupyter notebook, four identical sections:

1. Why this dataset (citation, license, limitations)
2. Load raw → clean into `processed/` (raw never overwritten)
3. Compare the four algorithms (CV table + MLflow screenshot/table)
4. Tune the winner (Optuna history)
5. Holdout + secondary evaluation
6. SHAP: what the plots actually say, in mentor language

Closing summary table:

`disease | winning algorithm | accuracy | F1 | ROC-AUC | primary dataset | secondary AUC`

### 3.9 What will *not* be claimed

- Not “clinically validated.”
- Not comparable across diseases (different n, different labels, different prevalence).
- Secondary-dataset AUC is external validation **only** when the feature schemas overlap.

---

## 4. How datasets were chosen

Search order you specified: **UCI → PhysioNet → Mendeley Data → Hugging Face Datasets → data.gov / CDC**, Kaggle only as a mirror or last resort.

**PhysioNet** did not yield a simple *tabular* disease-present/absent table for these four tasks. MIMIC-IV is credentialed (CITI + PhysioNet) and is ICU EHR, not a 10-column classifier demo. It is out of scope unless you later want a fifth, access-gated track.

**Hugging Face Datasets** copies of these tables exist; they are not the citable originals. Phase 2 will pull from UCI/`ucimlrepo`, CDC, or OpenML and only use HF/Kaggle if the official file is unreachable.

**Rejected globally (do not use as primary or as “independent” secondary):**

| Dataset | Why not |
|---|---|
| UCI BUPA Liver Disorders (id 60) | UCI now states field 7 (`selector`) is a **train/test split flag**, not liver disease. Using it as a disease label is a known error. |
| UCI Diabetes 130-US Hospitals (id 296) | Label is **30-day readmission**, not “has diabetes.” Every row already has diabetes. |
| UCI Statlog Heart (id 145) | Same 13 features as Cleveland; it is a recoded subset, not a new population. |
| Mendeley `pthckzzh49` CKD (DOI 10.17632/pthckzzh49.1) | Author states it is a **cleaned 158-row derivative of the Kaggle/UCI 400-row CKD file**. Not independent. |
| IEEE DataPort CKD `10.21227/eqj5-bs60` | Re-upload of UCI CKD 336. |
| Random Kaggle “heart.csv” / “diabetes.csv” | Usually Cleveland or Pima with the citation stripped. |

---

## 5. Dataset options (3 per disease)

Sizes and licenses below are from the official repository pages as of this plan (UCI HTML, CDC/NCHS public-use documentation, OpenML/NIDDK provenance). Phase 2 will print *exact* row/column/missing counts from the downloaded files.

### 5.1 Heart disease

| # | Dataset | n / features | Original source | License / cite | Notes |
|---|---|---|---|---|---|
| **H1 — recommend primary** | **UCI Heart Disease — Cleveland subset** (UCI id 45) | 303 × 13 used features (+ target). Combined dump also has Hungary / Switzerland / VA files. | Hungarian Institute of Cardiology; University Hospital Zurich; University Hospital Basel; V.A. Medical Center Long Beach; Cleveland Clinic. Donated via Detrano et al. | **CC BY 4.0**. DOI **[10.24432/C52P4X](https://doi.org/10.24432/C52P4X)**. Paper: Detrano et al., *Am J Cardiol* 1989. | Standard 14-column ML subset. Target `num` is 0–4; **binarize as 0 = absence, 1–4 = presence** (the published protocol). Matches the current MediAI heart form. Missing values exist (`ca`, `thal`). |
| **H2 — recommend secondary** | **Same UCI id 45, non-Cleveland sites** (processed Hungarian + Switzerland + VA Long Beach) | ~294 + 123 + 200 ≈ **617** rows, **same 13 features** | Same consortium, different hospitals / countries | Same DOI / CC BY 4.0 | True **site-shift** validation. Hungary/Switzerland have more missing `ca`/`thal`. This is the only secondary in this list that is both independent *and* schema-compatible. |
| **H3** | **UCI Heart Failure Clinical Records** (id 519) | 299 × 12 | 299 heart-failure patients, follow-up; Chicco & Jurman | Dataset on UCI (typical UCI **CC BY 4.0**). Paper DOI **[10.1186/s12911-020-1023-5](https://doi.org/10.1186/s12911-020-1023-5)** | **Different task:** all patients already have heart failure; label is **death during follow-up**, and `time` is a leakage risk if used as a feature. Keep as a *third candidate* only if you want a mortality model, **not** as validation of H1. |

**CDC / data.gov note:** BRFSS has individual-level CVD questions (heart attack / CHD) at ~250k rows (2015 SAS on [cdc.gov/brfss](https://www.cdc.gov/brfss/annual_data/annual_2015.html), public US government work). Feature schema is survey lifestyle, not the Cleveland cath-lab panel, so it cannot validate H1. Kaggle “Heart Disease Health Indicators” is a cleaned BRFSS mirror — fallback only.

**PhysioNet note:** PTB-XL is 12-lead ECG waveforms, not this tabular task.

**Pick:** train **H1**, validate **H2**. Do not mix H3 into that comparison.

---

### 5.2 Liver disease

| # | Dataset | n / features | Original source | License / cite | Notes |
|---|---|---|---|---|---|
| **L1 — recommend primary** | **UCI ILPD (Indian Liver Patient Dataset)** (id 225) | **583** usable rows (UCI text also says 584 collected): 416 disease / 167 non-disease; 10 clinical + sex | NE Andhra Pradesh, India. Ramana & Venkateswarlu | **CC BY 4.0**. DOI **[10.24432/C5D02C](https://doi.org/10.24432/C5D02C)** | Matches the current MediAI liver form (bilirubin, ALP, ALT, AST, proteins, albumin, A/G). Class `Selector` 1 = disease, 2 = healthy (will recode). Mild missingness on A/G ratio. Male-heavy (441 / 142). |
| **L2 — recommend secondary** | **UCI HCV data** (id 571) | **615 × 12** labs + age/sex | Blood donors vs hepatitis C (hepatitis / fibrosis / cirrhosis), Hannover / Trillium labs. Lichtinghagen, Klawonn, Hoffmann | **CC BY 4.0**. DOI **[10.24432/C5D612](https://doi.org/10.24432/C5D612)** | **Binarize:** blood donor (and optionally drop 7 “suspect donors”) vs any HCV pathology. Overlap with ILPD is only partial (age, sex, ALP, ALT, AST, bilirubin, albumin/protein). Secondary metrics use the **intersection** only. Class imbalance is severe (~87% donors). |
| **L3** | **UCI HCC Survival** (id 423) | **165 × 49**, 10% missing | University Hospital, Portugal. Santos et al. 2015 | **CC BY 4.0**. DOI **[10.24432/C5TS4S](https://doi.org/10.24432/C5TS4S)** | **Different task:** 1-year **survival among already-diagnosed HCC**, not “has liver disease.” Rejected as ILPD validation. |

**Pick:** train **L1**, validate **L2** on shared labs. Do not use BUPA. Do not use L3 as secondary for L1.

---

### 5.3 Diabetes

| # | Dataset | n / features | Original source | License / cite | Notes |
|---|---|---|---|---|---|
| **D1 — recommend primary** | **UCI CDC Diabetes Health Indicators** (id 891), built from **CDC BRFSS** | **253,680** × 21 (UCI binary-target version). Lifestyle, BMI, BP, cholesterol, smoking, etc. | CDC Behavioral Risk Factor Surveillance System (UCI page links 2014; community copies are usually **2015** BRFSS — Phase 2 will record the year from the file itself) | UCI DOI **[10.24432/C53919](https://doi.org/10.24432/C53919)**. Underlying BRFSS microdata is **U.S. government work** (public domain) from [CDC BRFSS annual data](https://www.cdc.gov/brfss/annual_data/annual_2015.html). Cite both UCI and CDC. | Largest, best-documented, not a Kaggle-only table. Target `Diabetes_binary`: 0 vs (prediabetes **or** diabetes). Strong imbalance. **Does not match** the current MediAI Pima-style form. |
| **D2 — recommend secondary** | **UCI Early Stage Diabetes Risk Prediction** (id 529) | **520 × 16** questionnaire items (polyuria, polydipsia, …) | Sylhet Diabetes Hospital, Bangladesh. Islam et al. 2019/2020 | UCI page: [dataset 529](https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset) (CC BY 4.0 on UCI). Paper: Islam et al., Springer 2020, [doi:10.1007/978-981-13-8798-2_12](https://doi.org/10.1007/978-981-13-8798-2_12). IEEE DataPort mirror DOI 10.21227/k01r-x481 (same table). | Different schema (symptoms, not labs). Treat secondary AUC as **schema-shift**, not a clean replicate. TabPFN-friendly size. |
| **D3** | **Pima Indians Diabetes** (OpenML 37; historic UCI dump; NIDDK) | **768 × 8**, women ≥21, Gila River / Akimel O’odham heritage. 500 negative / 268 positive | NIDDK; Smith, Everhart, Dickson, Knowler, Johannes 1988 (*SCAMC*) | Historic UCI file; OpenML [dataset 37](https://www.openml.org/d/37). Kaggle copies are often labelled CC0, which is **not** a substitute for thinking about origin. | **This is the schema the MediAI diabetes form already uses.** It is also the dataset with the worst ethics story: a named Indigenous community, old collection, widely scraped, often used without context. I recommend **not** making it primary. Optional **compatibility-only** train if you insist Phase 4 must accept the current 8 lab fields. |

**Not used:** UCI 296 (readmission). NHANES glucose/HbA1c is a valid CDC alternative if you later want lab-based diabetes labels at population scale; it is more work (merge DEMO + GHB + GLU + DIQ). Flag only.

**Pick:** train **D1** (with the TabPFN 8k-subset rule). Secondary **D2** (honestly labelled as schema-shift). Keep **D3** off the default training path unless you override for UI compatibility.

---

### 5.4 Chronic kidney disease

| # | Dataset | n / features | Original source | License / cite | Notes |
|---|---|---|---|---|---|
| **K1 — recommend primary** | **UCI Chronic Kidney Disease** (id 336) | **400 × 24** + class (`ckd` / `notckd`). ~250 / 150 split in most descriptions. Heavy missingness. | Hospital near Karaikudi, Tamil Nadu (Apollo / Soundarapandian). Rubini, Soundarapandian, Eswaran 2015 | **CC BY 4.0**. DOI **[10.24432/C5G020](https://doi.org/10.24432/C5G020)** | Canonical CKD table. Current MediAI kidney form is a **4-column subset** (creatinine, urea, hemoglobin, BP). The model should train on the **full 24** and the API can accept a superset; missing UI fields get the train-set median/mode **and** that must be disclosed. Known issue: some published papers report near-perfect accuracy because missingness itself encodes the label — Phase 3 will test a **complete-case** vs **missing-indicator** variant and report both. |
| **K2 — recommend secondary** | **UCI Risk Factor Prediction of Chronic Kidney Disease** (id 857) | **200 × ~28** | Enam Medical College, Savar, Dhaka. Islam & Akter 2020/2023 | **CC BY 4.0**. DOI **[10.24432/C5WP64](https://doi.org/10.24432/C5WP64)** | Different hospital and country, overlapping labs (sg, al, sc, hemo, htn, dm, …). Needs preprocessing (UCI says it is not pre-processed). Use intersecting columns only. |
| **K3** | **CDC NHANES** public-use files (e.g. 2017–2018 DEMO + BIOPRO + ALB_CR + BPX + DIQ) | Thousands of adults after merge; we **derive** CKD as eGFR < 60 (CKD-EPI 2021, race-free) **or** albumin/creatinine ≥ 30 mg/g — the CDC surveillance definition (single-measure, so prevalence is overestimated vs clinical CKD ≥3 months) | CDC/NCHS [NHANES](https://wwwn.cdc.gov/nchs/nhanes/). Methods: [CDC CKD Surveillance](https://nccd.cdc.gov/CKD/) | NCHS public-use data; cite NCHS/NHANES and the data-use constraints. Not CC; free for research. | Scientifically the strongest **population** table, but the label is **constructed**, not a nephrologist’s `ckd` tag. Feature overlap with K1 is only the labs we can align (creatinine, urea, hemoglobin, BP, glucose). Heavier Phase 2 engineering. |

**PhysioNet:** no drop-in CKD classification table without MIMIC credentialing.

**Pick:** train **K1**, validate **K2**. Offer **K3** as an upgrade secondary if you want more work in Phase 2 (I will not start NHANES merges unless you say so).

---

## 6. Recommended matrix (the thing to approve)

| Disease | Primary (train + CV + holdout) | Secondary (frozen, no refit) | Binary label rule |
|---|---|---|---|
| Heart | UCI 45 Cleveland (H1) | UCI 45 Hungary+Switzerland+VA (H2) | `num > 0` |
| Liver | UCI ILPD 225 (L1) | UCI HCV 571 on shared labs (L2) | ILPD selector==1; HCV non-donor |
| Diabetes | UCI CDC/BRFSS 891 (D1) | UCI Early Stage 529 (D2), schema-shift | `Diabetes_binary == 1` |
| Kidney | UCI CKD 336 (K1) | UCI 857 (K2), intersecting columns | `class == ckd` |

All four primaries except CDC diabetes are TabPFN-sized. All have a DOI or a UCI/CDC page. Kaggle is not required.

---

## 7. Phase 2 folder layout (not created yet)

```
data/
  README.md          # URL, license, DOI, download date, sha256 per file
  heart/raw/         # cleveland + hungarian + switzerland + long-beach-va
  heart/processed/   # created only after you confirm raw tables
  liver/raw/
  liver/processed/
  diabetes/raw/
  diabetes/processed/
  kidney/raw/
  kidney/processed/
```

Raw files stay byte-identical. Cleaning only writes `processed/`.

Acquisition in Phase 2 (planned, not executed): `ucimlrepo.fetch_ucirepo` for UCI ids 45, 225, 571, 891, 529, 336, 857, plus the UCI legacy `processed.*.data` files for the extra heart sites if `ucimlrepo` returns Cleveland-only.

---

## 8. Phase 3 / 4 preview (not started)

- Code lives under `ml/` (training scripts + notebook). Existing `ml_service/main.py` Gradio clients stay until Phase 4 on purpose.
- Phase 4: FastAPI with `/predict/heart`, `/predict/liver`, `/predict/diabetes`, `/predict/kidney`, each returning `{probability, label, shap_top}` and a non-diagnosis disclaimer. Deploy to a **new** Hugging Face Space (needs a write token in that phase). Optional later: point MediAI `ml_service` at that URL.
- MLflow stays local unless you want DagsHub; not required for the mentor notebook.

---

## 9. Decisions I need from you (approve-as-defaults or change)

I will treat the **bold** option as approved if you just say “go Phase 2.”

1. **Dataset matrix** — use the table in §6.  
   *Override examples:* force Pima (D3) as diabetes primary for UI match; swap kidney secondary to NHANES (K3).

2. **Pima** — **do not train on it** unless you explicitly want the current 8-field form. The notebook will still *mention* it and why it was skipped.

3. **Binary vs multi-class** — **binary** for all four (heart 0 vs 1–4 collapsed; HCV donor vs disease; CDC binary diabetes).

4. **Phase 4 API schema** — **native features of the winning primary dataset**, not necessarily today’s MediAI form. We document the JSON. Wiring the existing modal is a follow-up.

5. **TabPFN** — **TabPFNv2** (open). CDC diabetes: 8k subset for TabPFN, 20k cap for tree Optuna.

6. **Optuna budget** — 40 / 40 / 40 / 8 trials as in §3.3.

7. **NHANES kidney (K3)** — **skip** in Phase 2 unless you ask for it.

8. **Claims language** — screening-style probability + “not a diagnosis,” same as the rest of MediAI.

---

## 10. Sources used for this plan

- UCI 45 Heart Disease — https://archive.ics.uci.edu/dataset/45/heart+disease — DOI 10.24432/C52P4X  
- UCI 519 Heart Failure Clinical Records — https://archive.ics.uci.edu/dataset/519/heart-failure-clinical-records — paper 10.1186/s12911-020-1023-5  
- UCI 145 Statlog Heart — https://archive.ics.uci.edu/dataset/145/statlog+heart (rejected as secondary)  
- UCI 225 ILPD — https://archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset — DOI 10.24432/C5D02C  
- UCI 571 HCV — https://archive.ics.uci.edu/dataset/571/hcv+data — DOI 10.24432/C5D612  
- UCI 423 HCC Survival — https://archive.ics.uci.edu/dataset/423/hcc+survival — DOI 10.24432/C5TS4S (rejected as secondary)  
- UCI 60 Liver Disorders — https://archive.ics.uci.edu/dataset/60/liver+disorders (rejected: selector is not disease)  
- UCI 891 CDC Diabetes Health Indicators — https://archive.ics.uci.edu/dataset/891/cdc+diabetes+health+indicators — DOI 10.24432/C53919  
- CDC BRFSS annual data — https://www.cdc.gov/brfss/annual_data/annual_2015.html  
- UCI 529 Early Stage Diabetes — https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset  
- OpenML 37 Pima / NIDDK — https://www.openml.org/d/37 — Smith et al. 1988  
- UCI 336 Chronic Kidney Disease — https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease — DOI 10.24432/C5G020  
- UCI 857 Risk Factor Prediction of CKD — https://archive.ics.uci.edu/dataset/857/risk+factor+prediction+of+chronic+kidney+disease — DOI 10.24432/C5WP64  
- NCHS NHANES — https://wwwn.cdc.gov/nchs/nhanes/  
- TabPFNv2 scale — Prior Labs model docs (comfort zone 10k × 500)

---

**Waiting on your approval of Phase 1 before any download.**
