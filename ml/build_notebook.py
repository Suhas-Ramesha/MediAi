"""Write the mentor notebook, then execute it so cell outputs contain real training."""
from __future__ import annotations

import nbformat as nbf
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "four_disease_classifiers.ipynb"


def md(s: str):
    return new_markdown_cell(s)


def code(s: str):
    return new_code_cell(s)


def build() -> nbf.NotebookNode:
    cells = []
    cells.append(
        md(
            """# Four independent disease classifiers

Mentor notebook for MediAI. Each disease is its **own** binary model. There is no combined four-disease network.

**What this notebook actually does (not a sketch):** every training cell below **fits** XGBoost, LightGBM, CatBoost and TabPFN. Optuna trial lines are printed as they run (CV ROC-AUC, F1, accuracy, hyperparameters). The winning algorithm is refit, scored on a frozen holdout, explained with SHAP, and saved.

**Accuracy target:** quoted holdout accuracy must be **≥ 85%**, and that number has to beat the majority-class dummy (otherwise 85% is just class imbalance). Training uses **multiple same-schema datasets per disease**. Trees are **unweighted** so Optuna is not buying recall by spending accuracy.

TabPFN uses the **open TabPFNv2** checkpoint (Prior-Labs/TabPFN-v2-clf). TabPFN 9.x would otherwise default to gated v3.5 weights that need a Prior Labs login; that is not used here. On tables larger than 4000 train rows, TabPFN is fit on a stratified 4000-row cap; the trees still see the full pool.

These are screening-style classifiers on public tables. They are **not** diagnoses and not clinician-signed.

| Disease | Training rows (pooled) | Why this data |
|---|---|---|
| Heart | Indian hospital (n=1000) **plus** UCI Cleveland / Hungary / Switzerland / VA | India-first, same 13 clinical fields as the app; extra sites for pooling |
| Liver | ILPD Andhra Pradesh **plus** UCI HCV **plus** Mayo PBC (UCI 878) | ILPD matches the app form; HCV is donor vs hepatitis; Mayo adds confirmed liver-disease rows on overlapping labs |
| Diabetes | Pima 8-lab **plus** NHANES 2011–2023 adults (glucose, BMI, age, diastolic BP) | Pima matches the app form. NHANES supplies thousands of extra labeled adults. Negatives are subsampled to ~1.8× positives so prevalence stays ~Pima (≈35%) and 85% cannot be a dummy. |
| Kidney | UCI CKD Karaikudi, Tamil Nadu **plus** Bangladesh UCI 857 | India primary, leak-blocked impute. Bangladesh bins parsed to midpoints and pooled (BP left missing — 0/1 there vs mmHg here). |

**Protocol (identical for every disease):** stratified 80/20 holdout → Optuna on the 80% maximizing 5-fold (3-fold for TabPFN) **ROC-AUC** → among algorithms with CV accuracy ≥ 0.85, pick the best CV AUC (else best CV AUC overall) → score the 20% once at threshold 0.5 → SHAP on the winner. Holdout-by-source is printed so a high pooled number cannot hide a weak site.
"""
        )
    )
    cells.append(
        code(
            """import json, os, sys, time
from pathlib import Path
from IPython.display import display, Image, Markdown
import pandas as pd
import matplotlib
matplotlib.use("Agg")

os.environ.setdefault("TABPFN_MODEL_VERSION", "v2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")

ROOT = Path.cwd()
if not (ROOT / "ml" / "train_compare.py").exists():
    # notebook executed from notebooks/
    ROOT = Path.cwd().parent
sys.path.insert(0, str(ROOT))
print("project root:", ROOT)
print("python:", sys.version.split()[0])

from ml.data_prep import (
    feature_target, load_heart, load_liver, load_diabetes, load_kidney, load_diabetes_sylhet,
)
from ml.run_training import train_heart, train_liver, train_diabetes, train_kidney
from ml.train_compare import (
    TREE_TRIALS, TABPFN_TRIALS, TREE_FOLDS, TABPFN_FOLDS,
    ACCURACY_GATE, USE_CLASS_WEIGHTS, TABPFN_MAX_ROWS,
)

print(f"Optuna budget: trees {TREE_TRIALS} trials × {TREE_FOLDS}-fold; TabPFN {TABPFN_TRIALS} × {TABPFN_FOLDS}-fold")
print("TabPFN checkpoint: open v2 (TABPFN_MODEL_VERSION=v2)")
print(f"accuracy gate: {ACCURACY_GATE:.0%}  class_weights={USE_CLASS_WEIGHTS}  TabPFN cap={TABPFN_MAX_ROWS}")
RESULTS = {}
"""
        )
    )

    # HEART
    cells.append(md("""---
## 1. Heart disease

**Task.** Presence vs absence of heart disease (binary). UCI `num>0`; Indian `target`.

**Why these datasets.** The app already collects Cleveland-style fields (age, sex, chest pain, BP, cholesterol, ECG, max HR, ST depression, vessels). A 1000-row Indian hospital table (Mendeley DOI 10.17632/dzz48mvjht.1) uses the same panel (no `thal`). UCI Cleveland / Hungary / Switzerland / VA add extra sites with that schema. Chest-pain codes on the India table are 0–3 and are shifted to UCI’s 1–4 before pooling. The India file is not a Cleveland clone (0 overlapping rows on age+BP+cholesterol+max HR).

**Not a diagnosis.** Angiographic tables from the 1980s plus one Indian hospital dump.
"""))
    cells.append(
        code(
            """heart_pool, heart_india = load_heart()
print("pooled rows", len(heart_pool), "by source:\\n", heart_pool["source"].value_counts().to_string())
print("class balance (1=disease):")
print(heart_pool.groupby("source")["disease"].mean().round(3).to_string())
display(heart_pool.drop(columns=["source"]).head(8))
print("missing counts:\\n", heart_pool.isna().sum().to_string())
"""
        )
    )
    cells.append(
        md(
            """The next cell **trains** all four algorithms. Each printed `trial` line is a real cross-validated fit, not a placeholder."""
        )
    )
    cells.append(
        code(
            """t0 = time.time()
RESULTS["heart"] = train_heart()
print(f"\\nheart wall time: {time.time()-t0:.0f}s")
print("winner:", RESULTS["heart"]["winner"])
display(pd.DataFrame(RESULTS["heart"]["comparison"])[
    ["algorithm","cv_roc_auc","cv_f1","cv_accuracy","holdout_roc_auc","holdout_f1","holdout_accuracy","n_trials","seconds"]
].round(4))
"""
        )
    )
    cells.append(
        code(
            """h = RESULTS["heart"]
print("Why this winner:", h["winner"],
      "had the highest cross-validated ROC-AUC among the four tuned algorithms.")
print("CV:", {k: round(v,4) for k,v in h["winner_cv"].items() if k!="folds"})
print("Holdout:", {k: round(v,4) for k,v in h["winner_holdout"].items()})
print("Holdout by hospital source:", json.dumps(h.get("winner_holdout_by_source"), indent=2, default=str)[:1500])
print("Best hyperparameters:", h["winner_params"])
print("\\n--- Optuna trial logs (every algorithm that fitted) ---")
for algo, lines in h["trial_logs"].items():
    print(f"\\n[{algo}] {len(lines)} trials")
    for line in lines:
        print(line)
print("\\nSHAP: bar = mean |impact|; beeswarm = direction per patient on the train split.")
for p in h.get("shap") or []:
    path = Path(p)
    if path.exists():
        print(path)
        display(Image(filename=str(path)))
"""
        )
    )

    # LIVER
    cells.append(md("""---
## 2. Liver disease

**Task.** Liver-disease vs not. ILPD `Selector==1`; HCV non-donor vs blood donor (suspect donors dropped).

**Why these datasets.** ILPD (DOI 10.24432/C5D02C) is from north-east Andhra Pradesh and is exactly the bilirubin / ALP / ALT / AST / protein panel the app collects. The four missing A/G ratios were filled from albumin/(total protein−albumin), not median invention. UCI HCV (Germany) is concatenated on the overlapping labs; direct bilirubin and A/G are missing on those rows so the booster cannot fake ILPD-only tests. Mayo PBC (UCI 878, DOI 10.24432/C5R02G) adds confirmed liver-disease rows (Age, Sex, bilirubin, ALP, AST, albumin). `Status` / `Stage` / `Drug` are never features. Class-blind median impute fills Mayo's missing ALT — no missingness flag, so “ALT not measured” cannot become the label.

NHANES “ever told you had a liver condition” (MCQ160L) was **not** pooled: a smoke test dropped accuracy into the 60s because the questionnaire label is noisy relative to the labs.
"""))
    cells.append(
        code(
            """liver_pool, ilpd = load_liver()
print("pooled rows", len(liver_pool))
print(liver_pool.groupby("source")["disease"].agg(["size","mean"]))
display(ilpd.head(6))
print("ILPD A/G missing after cleaning:", int(ilpd["AG"].isna().sum()) if "AG" in ilpd.columns else int(ilpd.filter(like="AG").isna().sum().sum()))
"""
        )
    )
    cells.append(
        code(
            """t0 = time.time()
RESULTS["liver"] = train_liver()
print(f"\\nliver wall time: {time.time()-t0:.0f}s")
display(pd.DataFrame(RESULTS["liver"]["comparison"])[
    ["algorithm","cv_roc_auc","cv_f1","cv_accuracy","holdout_roc_auc","holdout_f1","holdout_accuracy","n_trials","seconds"]
].round(4))
"""
        )
    )
    cells.append(
        code(
            """h = RESULTS["liver"]
print("Winner", h["winner"], "selected by CV ROC-AUC.")
print("CV", {k: round(v,4) for k,v in h["winner_cv"].items() if k!="folds"})
print("Holdout", {k: round(v,4) for k,v in h["winner_holdout"].items()})
print("Holdout by source (ILPD vs HCV):", json.dumps(h.get("winner_holdout_by_source"), indent=2, default=str)[:1500])
print("Params", h["winner_params"])
print("\\n--- Optuna trial logs (every algorithm that fitted) ---")
for algo, lines in h["trial_logs"].items():
    print(f"\\n[{algo}] {len(lines)} trials")
    for line in lines:
        print(line)
print("\\nNote: ILPD-only holdout accuracy is expected to be lower than pooled accuracy. HCV donors vs hepatitis and Mayo PBC vs the rest are easier splits than ILPD's mixed liver panel. Quote the pooled holdout AND the ILPD-only row.")
for p in h.get("shap") or []:
    path = Path(p)
    if path.exists():
        display(Image(filename=str(path)))
"""
        )
    )

    # DIABETES
    cells.append(md("""---
## 3. Diabetes

**Task.** WHO-style diabetes present vs absent on the 8-lab form.

**Why these datasets.** The app asks for pregnancies, glucose, BP, skin fold, insulin, BMI, pedigree, age. That is the Pima table. It is **not** Indian (Gila River / Akimel O’odham women ≥21). Public Indian diabetes tables either use HbA1c/waist (NMB-2017) or a symptom questionnaire (Sylhet). Sylhet is shown below and is **not** concatenated.

A second **lab** source is pooled: CDC NHANES 2011–2023 adults (Zenodo DOI 10.5281/zenodo.20299025; cite CDC/NCHS). Overlap is glucose, BMI, age, diastolic BP. Pregnancies / skin / insulin / pedigree are missing on NHANES rows (median-imputed in the pipeline; they only get real signal from Pima). Label = DIQ010 diabetes vs no diabetes; prediabetes dropped. **Not used:** HbA1c, “taking insulin” (treatment leakage), filtering negatives by glucose (would bake the lab into the label).

NHANES natural prevalence is ~16% (dummy accuracy ~84%). Negatives are subsampled to 1.8× positives so the pool is ~35% positive (dummy ~65%) and an 85% number is a real lift.

**Cleaning that was required.** Zeros in Pima glucose, BP, skin, insulin, BMI are structurally missing, not true zeros. They are NA here. `pregnancies=0` is kept.
"""))
    cells.append(
        code(
            """dia = load_diabetes()
print("pooled rows", len(dia))
print(dia.groupby("source")["disease"].agg(["size","mean"]))
print("NA after zero-fix / NHANES missing labs:\\n", dia.isna().sum().to_string())
display(dia.head(8))
syl = load_diabetes_sylhet()
print("\\nSylhet early-stage (NOT pooled — different schema):", syl.shape, "positive rate", float(syl.disease.mean()))
print("Sylhet columns:", list(syl.columns))
print("majority-class dummy acc would be", round(max(dia.disease.mean(), 1-dia.disease.mean()), 4))
"""
        )
    )
    cells.append(
        code(
            """t0 = time.time()
RESULTS["diabetes"] = train_diabetes()
print(f"\\ndiabetes wall time: {time.time()-t0:.0f}s")
display(pd.DataFrame(RESULTS["diabetes"]["comparison"])[
    ["algorithm","cv_roc_auc","cv_f1","cv_accuracy","holdout_roc_auc","holdout_f1","holdout_accuracy","n_trials","seconds"]
].round(4))
"""
        )
    )
    cells.append(
        code(
            """h = RESULTS["diabetes"]
print("Winner", h["winner"], "— highest CV ROC-AUC among algorithms that meet the 85% CV-accuracy gate when any do.")
print("CV", {k: round(v,4) for k,v in h["winner_cv"].items() if k!="folds"})
print("Holdout", {k: round(v,4) for k,v in h["winner_holdout"].items()})
print("Params", h["winner_params"])
print("\\n--- Optuna trial logs (every algorithm that fitted) ---")
for algo, lines in h["trial_logs"].items():
    print(f"\\n[{algo}] {len(lines)} trials")
    for line in lines:
        print(line)
print("SHAP should highlight glucose, BMI, age, insulin if the model is using the labs the form collects.")
for p in h.get("shap") or []:
    path = Path(p)
    if path.exists():
        display(Image(filename=str(path)))
"""
        )
    )

    # KIDNEY
    cells.append(md("""---
## 4. Chronic kidney disease

**Task.** `ckd` vs `notckd`.

**Why this dataset.** UCI CKD (DOI 10.24432/C5G020) is from Apollo, Karaikudi, Tamil Nadu — the India table. Two dirty labels (`ckd\\t`) were stripped. Missingness was **not** left as a feature: `rbc` was missing in 57% of CKD vs 6% of not-CKD, so a tree could “diagnose” test-ordering. Processed data uses class-blind median/mode impute and no missing-flags.

Bangladesh UCI 857 is a second hospital. Labs are **binned** (and some Excel date artifacts) and are parsed to midpoints, then **pooled** with Tamil Nadu. `bp` is left missing on Bangladesh rows (0/1 there vs mmHg here). `stage` / `grf` / `affected` are never used (label leakage).
"""))
    cells.append(
        code(
            """kid_p, kid_s = load_kidney()
print("pooled", kid_p.shape, kid_p["source"].value_counts().to_dict())
print("class by source:\\n", kid_p.groupby("source")["disease"].agg(["size","mean"]))
print("Bangladesh-only view", kid_s.shape, kid_s["disease"].value_counts().to_dict())
display(kid_p.head(6))
print("Tamil Nadu missing cells (must be 0):", int(kid_p.loc[kid_p.source=="tamil_nadu"].drop(columns=["source"]).isna().sum().sum()))
"""
        )
    )
    cells.append(
        code(
            """t0 = time.time()
RESULTS["kidney"] = train_kidney()
print(f"\\nkidney wall time: {time.time()-t0:.0f}s")
display(pd.DataFrame(RESULTS["kidney"]["comparison"])[
    ["algorithm","cv_roc_auc","cv_f1","cv_accuracy","holdout_roc_auc","holdout_f1","holdout_accuracy","n_trials","seconds"]
].round(4))
"""
        )
    )
    cells.append(
        code(
            """h = RESULTS["kidney"]
print("Winner", h["winner"], "on pooled Tamil Nadu + Bangladesh CKD after leak-blocked impute.")
print("CV", {k: round(v,4) for k,v in h["winner_cv"].items() if k!="folds"})
print("Holdout", {k: round(v,4) for k,v in h["winner_holdout"].items()})
print("Secondary Bangladesh:", h.get("secondary"))
print("Params", h["winner_params"])
print("\\n--- Optuna trial logs (every algorithm that fitted) ---")
for algo, lines in h["trial_logs"].items():
    print(f"\\n[{algo}] {len(lines)} trials")
    for line in lines:
        print(line)
print("UCI CKD is unusually separable on hemoglobin / packed-cell volume / hypertension even after class-blind impute. Near-1.0 AUC is a known property of this table, not proof the model is clinically ready.")
print("If SHAP is dominated by a single lab that was heavily missing in the raw file, treat that with caution even after impute.")
for p in h.get("shap") or []:
    path = Path(p)
    if path.exists():
        display(Image(filename=str(path)))
"""
        )
    )

    cells.append(md("""---
## 5. Summary (mentor table)

Holdout metrics for the **winning algorithm per disease**. Accuracy is the number to quote to a mentor (≥ 85%). ROC-AUC was the Optuna objective. Majority-class dummy accuracy is printed in each training log so 85% cannot be a class-imbalance trick.
"""))
    cells.append(
        code(
            """rows = []
ds_used = {
    "heart": "India hospital + UCI 4 sites (Cleveland/Hungary/Switzerland/VA)",
    "liver": "ILPD Andhra Pradesh + UCI HCV + Mayo PBC",
    "diabetes": "Pima 8-lab + NHANES 2011–2023 (1.8× negative subsample); Sylhet not pooled",
    "kidney": "UCI CKD Tamil Nadu + Bangladesh UCI 857 (pooled)",
}
for disease, h in RESULTS.items():
    ho = h["winner_holdout"]
    dummy = h.get("majority_dummy_accuracy")
    rows.append({
        "disease": disease,
        "winning_algorithm": h["winner"],
        "accuracy": round(ho["accuracy"], 4),
        "F1": round(ho["f1"], 4),
        "ROC-AUC": round(ho["roc_auc"], 4),
        "dummy_acc": None if dummy is None else round(dummy, 4),
        "meets_85": ho["accuracy"] >= 0.85,
        "n_rows": h.get("n_rows"),
        "dataset_used": ds_used[disease],
    })
summary = pd.DataFrame(rows)
display(summary)
(ROOT / "ml" / "artifacts" / "summary.json").write_text(json.dumps(rows, indent=2))
print("models:")
for disease, h in RESULTS.items():
    print(" ", h["model_path"])
"""
        )
    )
    cells.append(
        md(
            """### How to read the SHAP plots

- **Bar:** mean |SHAP| — which fields moved the score most on the train split.
- **Beeswarm:** each dot is a patient. Color is the field value. Right of zero pushed risk **up**.

If two algorithms’ CV-AUC differ by less than ~0.01, the pick is a coin flip for this sample size. The holdout column is the number to quote; the trial log is the evidence that Optuna actually ran.

TabPFN has no TreeExplainer. If it wins, the beeswarm/bar plots are **median-ablation** attributions (Δ predicted probability when that field is replaced by its median) on 80 training rows — still a real fit, not a screenshot.

Not for clinical use.
"""
        )
    )
    nb = new_notebook(cells=cells, metadata={
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "pygments_lexer": "ipython3"},
    })
    return nb


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    nbf.write(build(), OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
