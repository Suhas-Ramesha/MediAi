# Processed-table fixes (raw files unchanged)

Written (UTC): `2026-09-22T10:46:51Z`

These three problems are **fixed in `data/<disease>/processed/`**. Raw downloads are still the originals.

## ILPD — 4 missing A/G Ratio

Filled from the definition **albumin / globulin**, with globulin = total protein − albumin.
That matches recorded A/G at correlation ~0.85 on the other 579 rows. No rows dropped.
Class remains 416 disease / 167 not.

File: `data/liver/processed/ilpd_cleaned.csv`

Derived values for the four rows: `[1.4444, 0.9118, 1.08, 1.2973]`
Missing A/G after: **0**

## Pima — zeros that are not zeros

`glucose` (plas), `bp` (pres), `skin`, `insulin` (insu), `bmi` (mass): every `0` is now **NA**.
`pregnancies=0` is a real count and was left alone.
Class remains 268 positive / 500 negative.

Zeros recoded: `{'plas': 5, 'pres': 35, 'skin': 227, 'insu': 374, 'mass': 11}`

File: `data/diabetes/processed/pima_cleaned.csv`  
Columns renamed to the MediAI form: pregnancies, glucose, bp, skin, insulin, bmi, pedigree, age, disease.

## Tamil Nadu CKD — missing labs leaked the label

Before cleaning, `rbc` was missing in **57% of CKD** vs **6% of not-CKD** (same pattern on rbcc/wbcc/sodium/potassium/PCV). A tree that splits on “is this lab missing?” is diagnosing the hospital’s test-ordering, not the patient.

Fixes applied:

1. `ckd\t` → `ckd` (2 rows) and `\tno` → `no` on diabetes mellitus.
2. Class-blind median (numeric) / mode (categorical) impute. **No missingness flags.**
3. After impute, missing cells: **0**. Balance **250 / 150**.

File: `data/kidney/processed/ckd_tamil_nadu_cleaned.csv`

Missingness-by-class *before* impute (evidence for the leak): `{'rbc': {'ckd_pct': 57.2, 'notckd_pct': 6.0}, 'rbcc': {'ckd_pct': 49.6, 'notckd_pct': 4.7}, 'wbcc': {'ckd_pct': 39.6, 'notckd_pct': 4.7}, 'sod': {'ckd_pct': 32.8, 'notckd_pct': 3.3}, 'pot': {'ckd_pct': 33.2, 'notckd_pct': 3.3}, 'pcv': {'ckd_pct': 26.8, 'notckd_pct': 2.7}}`
