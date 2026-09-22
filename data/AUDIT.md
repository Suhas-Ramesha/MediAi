# Phase 2 data audit — four disease tables

Generated (UTC): `2026-09-22T10:41:05Z`

No training has been run. Raw files are unmodified.

## Training plan these files support

Each disease still gets **one** deployed model. That model is trained on **all compatible rows**
(India first, then extra sites), with a site-stratified holdout and per-source metrics.
Incompatible schemas are stored but **not concatenated**.

| Disease | Pooled training rows (plan) | Held out / extra |
|---|---|---|
| Heart | Indian hospital + UCI 4 sites, aligned encodings | 20% stratified by source; also report India-only and Cleveland-only AUC |
| Liver | ILPD (India) as the full-schema core; HCV rows appended with ILPD-only labs set missing | HCV-only external score |
| Diabetes | Pima only for the product 8-lab model (no second India 8-lab table) | Sylhet early-stage as a separate symptom-schema check, not a pool |
| Kidney | Tamil Nadu UCI 336 + Bangladesh UCI 857 on intersecting columns | 20% stratified by source |

## Per-file audit

### heart — `processed.cleveland.data`

- rows: **303**
- geography: cleveland · india=False
- target: num (0=absence, 1-4=presence; binarize as num>0)
- class balance: `{'0': 164, '1': 55, '2': 36, '3': 35, '4': 13}`
- binary balance (disease present): `{'0': 164, '1': 139}`
- columns (14): `['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal', 'num']`
- missing (non-zero only): `{'ca': 4, 'thal': 2}`

### heart — `processed.hungarian.data`

- rows: **294**
- geography: hungarian · india=False
- target: num (0=absence, 1-4=presence; binarize as num>0)
- class balance: `{'0': 188, '1': 106}`
- binary balance (disease present): `{'0': 188, '1': 106}`
- columns (14): `['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal', 'num']`
- missing (non-zero only): `{'trestbps': 1, 'chol': 23, 'fbs': 8, 'restecg': 1, 'thalach': 1, 'exang': 1, 'slope': 190, 'ca': 291, 'thal': 266}`

### heart — `processed.switzerland.data`

- rows: **123**
- geography: switzerland · india=False
- target: num (0=absence, 1-4=presence; binarize as num>0)
- class balance: `{'1': 48, '2': 32, '3': 30, '0': 8, '4': 5}`
- binary balance (disease present): `{'1': 115, '0': 8}`
- columns (14): `['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal', 'num']`
- missing (non-zero only): `{'trestbps': 2, 'fbs': 75, 'restecg': 1, 'thalach': 1, 'exang': 1, 'oldpeak': 6, 'slope': 17, 'ca': 118, 'thal': 52}`

### heart — `processed.va_long_beach.data`

- rows: **200**
- geography: va_long_beach · india=False
- target: num (0=absence, 1-4=presence; binarize as num>0)
- class balance: `{'1': 56, '0': 51, '3': 42, '2': 41, '4': 10}`
- binary balance (disease present): `{'1': 149, '0': 51}`
- columns (14): `['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal', 'num']`
- missing (non-zero only): `{'trestbps': 56, 'chol': 7, 'fbs': 7, 'thalach': 53, 'exang': 53, 'oldpeak': 56, 'slope': 102, 'ca': 198, 'thal': 166}`

### heart — `india_mendeley_dzz48mvjht_Cardiovascular_Disease_Dataset.csv`

- rows: **1000**
- geography: India · india=True
- target: target (0=absence, 1=presence)
- class balance: `{'1': 580, '0': 420}`
- columns (14): `['patientid', 'age', 'gender', 'chestpain', 'restingBP', 'serumcholestrol', 'fastingbloodsugar', 'restingrelectro', 'maxheartrate', 'exerciseangia', 'oldpeak', 'slope', 'noofmajorvessels', 'target']`
- missing (pandas NA): none. **53 rows** have `serumcholestrol=0` (treat as missing). Other zeros are real codes (female, typical angina, no disease, etc.). The first auto-audit wrongly counted those as missing.

### liver — `ucimlrepo_id225_ilpd.csv`

- rows: **583**
- geography: Andhra Pradesh, India · india=True
- target: Selector (1=liver disease, 2=no disease)
- class balance: `{'1': 416, '2': 167}`
- columns (11): `['Age', 'Gender', 'TB', 'DB', 'Alkphos', 'Sgpt', 'Sgot', 'TP', 'ALB', 'A/G Ratio', 'Selector']`
- missing (non-zero only): `{'A/G Ratio': 4}`

### liver — `ucimlrepo_id571_hcv.csv`

- rows: **615**
- geography: Germany · india=False
- target: Category (blood donor vs hepatitis/fibrosis/cirrhosis)
- class balance: `{'0=Blood Donor': 533, '3=Cirrhosis': 30, '1=Hepatitis': 24, '2=Fibrosis': 21, '0s=suspect Blood Donor': 7}`
- columns (13): `['Age', 'Sex', 'ALB', 'ALP', 'AST', 'BIL', 'CHE', 'CHOL', 'CREA', 'CGT', 'PROT', 'ALT', 'Category']`
- missing (non-zero only): `{'ALB': 1, 'ALP': 18, 'CHOL': 10, 'PROT': 1, 'ALT': 1}`

### diabetes — `openml_37_pima_diabetes.csv`

- rows: **768**
- geography: USA (Pima / Akimel O'odham women ≥21) · india=False
- target: class
- class balance: `{'tested_negative': 500, 'tested_positive': 268}`
- columns (9): `['preg', 'plas', 'pres', 'skin', 'insu', 'mass', 'pedi', 'age', 'class']`
- missing (non-zero only): `{}`
- zeros that may be missing: `{'plas': 5, 'pres': 35, 'skin': 227, 'insu': 374, 'mass': 11, 'pedi': 0, 'age': 0}`

### diabetes — `ucimlrepo_id529_early_stage_diabetes_sylhet.csv`

- rows: **520**
- geography: Bangladesh (Sylhet) · india=False
- target: class
- class balance: `{'Positive': 320, 'Negative': 200}`
- columns (17): `['age', 'gender', 'polyuria', 'polydipsia', 'sudden_weight_loss', 'weakness', 'polyphagia', 'genital_thrush', 'visual_blurring', 'itching', 'irritability', 'delayed_healing', 'partial_paresis', 'muscle_stiffness', 'alopecia', 'obesity', 'class']`
- missing (non-zero only): `{}`

### kidney — `ucimlrepo_id336_ckd_tamil_nadu.csv`

- rows: **400**
- geography: Tamil Nadu, India · india=True
- target: class
- class balance: `{'ckd': 248, 'notckd': 150, 'ckd\t': 2}`
- columns (25): `['age', 'bp', 'sg', 'al', 'su', 'rbc', 'pc', 'pcc', 'ba', 'bgr', 'bu', 'sc', 'sod', 'pot', 'hemo', 'pcv', 'wbcc', 'rbcc', 'htn', 'dm', 'cad', 'appet', 'pe', 'ane', 'class']`
- missing (non-zero only): `{'age': 9, 'bp': 12, 'sg': 47, 'al': 46, 'su': 49, 'rbc': 152, 'pc': 65, 'pcc': 4, 'ba': 4, 'bgr': 44, 'bu': 19, 'sc': 17, 'sod': 87, 'pot': 88, 'hemo': 52, 'pcv': 71, 'wbcc': 106, 'rbcc': 131, 'htn': 2, 'dm': 2, 'cad': 2, 'appet': 1, 'pe': 1, 'ane': 1}`

### kidney — `ucimlrepo_id857_ckd_bangladesh.csv`

- rows: **200**
- geography: Bangladesh · india=False
- target: class
- class balance: `{'ckd': 128, 'notckd': 72}`
- columns (29): `['bp (Diastolic)', 'bp limit', 'sg', 'al', 'rbc', 'su', 'pc', 'pcc', 'ba', 'bgr', 'bu', 'sod', 'sc', 'pot', 'hemo', 'pcv', 'rbcc', 'wbcc', 'htn', 'dm', 'cad', 'appet', 'pe', 'ane', 'grf', 'stage', 'affected', 'age', 'class']`
- missing (non-zero only): `{}`

## Data dictionaries

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


Indian hospital table uses 0-based chest-pain codes (0 typical … 3 asymptomatic) and has **no `thal`**.
`serumcholestrol` of 0 is treated as missing in the published description. Align encodings before pooling with UCI.


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

## Measurements from this download

- Indian heart vs UCI Cleveland: **0 exact matches** on (age, resting BP, cholesterol, max HR). It is not a row-clone of Cleveland. Age range 20–80 vs Cleveland ~29–77; 580/1000 disease-positive; 53 cholesterol zeros (treat as missing). `chestpain` is 0–3 (UCI `cp` is 1–4). No `thal`. `slope` includes 0 (UCI is 1–3).
- UCI heart sites: Cleveland 303 (164/139 absent/present), Hungary 294, Switzerland 123, VA 200. Pooled UCI ≈ 920 plus 1000 Indian ≈ **1920 heart rows** after encoding alignment.
- ILPD: 583 rows, 416 disease / 167 not, 4 missing A/G. HCV: 615 rows, 533 donors vs 75 pathology (+7 suspect). HCV `CGT` is GGT under a client typo.
- Pima: 768 rows, 268 positive / 500 negative. Zeros: insulin 374, skin 227, BP 35, glucose 5, BMI 11 (missing, not zero). **Not India.**
- Sylhet early-stage: 520 rows, 320 Positive / 200 Negative, 16 questionnaire features. Cannot concatenate onto Pima labs.
- Tamil Nadu CKD: 400 rows, 248 `ckd` + 2 dirty `ckd\\t` + 150 `notckd`. Heavy missingness (rbc 38%, rbcc 33%, wbcc 26%).
- Bangladesh CKD 857: 200 rows, 128/72, **already binned into string ranges** (`age < 12`, `sg 1.019 - 1.021`). Pooling requires midpoint decoding. Do **not** use `stage`, `grf`, or `affected` as features (label leakage).

## Caveats to confirm before Phase 3

1. Indian heart `chestpain` coding is 0–3; UCI `cp` is 1–4. Must remap before pooling.
2. Indian heart has no `thal`; product form has `thal` — keep as optional/missing.
3. Indian heart vs Cleveland: **0 overlapping rows** on age+BP+cholesterol+max HR (checked). Not a Cleveland clone.
4. Pima is **not** an Indian dataset. NMB-2017 (7496 Indians, DOI 10.17632/twp8xw6p25.1) exists but uses HbA1c/waist/self-report, not the 8 form labs, and Mendeley did not yield a file without a browser session.
5. Pabna Bangladesh (DOI 10.17632/vxnyysk9vc.2) is Pima-like and would be a valid extra pool if a raw file becomes available; it was not downloaded this run.
6. UCI CKD missingness may itself leak the label — Phase 3 must report complete-case vs missing-indicator.
7. These classifiers are not diagnoses.

