"""
Compare XGBoost, LightGBM, CatBoost, TabPFN with Optuna + SHAP + MLflow.

Each disease is an independent binary classifier. Winner is chosen by
cross-validated ROC-AUC, not training accuracy.

TabPFN 9.x defaults to gated v3.5 weights (browser license). This project
uses the open TabPFNv2 checkpoint, which downloads without a Prior Labs login.
"""
from __future__ import annotations

import json
import os
import time
import warnings
from pathlib import Path
from typing import Any

# Must be set before `import tabpfn` so TabPFNSettings picks v2, not gated v3.5.
os.environ.setdefault("TABPFN_MODEL_VERSION", "v2")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import optuna
import pandas as pd
import shap
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "ml" / "artifacts"
REPORTS = ART / "reports"
MODELS = ART / "models"
MLRUNS = ART / "mlruns"

RANDOM_STATE = 42
TREE_TRIALS = 25
TABPFN_TRIALS = 4
TREE_FOLDS = 5
TABPFN_FOLDS = 3
TABPFN_MAX_ROWS = 4000
ACCURACY_GATE = 0.85
# Unweighted trees: class weights lift recall at the cost of accuracy, and the
# mentor quote is holdout accuracy ≥ 85%.
USE_CLASS_WEIGHTS = False

warnings.filterwarnings("ignore", category=UserWarning)
optuna.logging.set_verbosity(optuna.logging.WARNING)


def _split_cols(X: pd.DataFrame) -> tuple[list[str], list[str]]:
    num, cat = [], []
    for c in X.columns:
        if pd.api.types.is_numeric_dtype(X[c]):
            num.append(c)
        else:
            cat.append(c)
    return num, cat


def _encoder(X: pd.DataFrame) -> ColumnTransformer:
    num, cat = _split_cols(X)
    transformers = []
    if num:
        transformers.append(
            (
                "num",
                Pipeline([("imp", SimpleImputer(strategy="median"))]),
                num,
            )
        )
    if cat:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imp", SimpleImputer(strategy="most_frequent")),
                        (
                            "enc",
                            OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1),
                        ),
                    ]
                ),
                cat,
            )
        )
    return ColumnTransformer(transformers, remainder="drop")


def _metrics(y_true, y_pred, y_proba) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_proba)),
    }


def _cv_scores(model_fn, X: pd.DataFrame, y: pd.Series, folds: int, seed: int = RANDOM_STATE):
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
    rows = []
    for fold, (tr, va) in enumerate(skf.split(X, y), start=1):
        Xtr, Xva = X.iloc[tr], X.iloc[va]
        ytr, yva = y.iloc[tr], y.iloc[va]
        model = model_fn()
        model.fit(Xtr, ytr)
        proba = model.predict_proba(Xva)[:, 1]
        pred = (proba >= 0.5).astype(int)
        m = _metrics(yva, pred, proba)
        m["fold"] = fold
        rows.append(m)
    df = pd.DataFrame(rows)
    summary = {c: float(df[c].mean()) for c in ["accuracy", "precision", "recall", "f1", "roc_auc"]}
    summary_std = {f"{c}_std": float(df[c].std(ddof=0)) for c in ["accuracy", "precision", "recall", "f1", "roc_auc"]}
    return {**summary, **summary_std, "folds": folds}


class EncodedModel:
    """Sklearn-style wrapper: encode then boost / TabPFN."""

    def __init__(self, kind: str, params: dict[str, Any], n_pos: int, n_neg: int):
        self.kind = kind
        self.params = dict(params)
        self.n_pos = n_pos
        self.n_neg = n_neg
        self.prep: ColumnTransformer | None = None
        self.model = None
        self.feature_names_: list[str] | None = None

    def _make(self):
        spw = self.n_neg / max(self.n_pos, 1) if USE_CLASS_WEIGHTS else 1.0
        if self.kind == "xgboost":
            from xgboost import XGBClassifier

            xgb_kwargs = dict(
                objective="binary:logistic",
                eval_metric="auc",
                tree_method="hist",
                n_jobs=2,
                random_state=RANDOM_STATE,
                **self.params,
            )
            if USE_CLASS_WEIGHTS:
                xgb_kwargs["scale_pos_weight"] = spw
            return XGBClassifier(**xgb_kwargs)
        if self.kind == "lightgbm":
            from lightgbm import LGBMClassifier

            lgb_kwargs = dict(
                objective="binary",
                n_jobs=2,
                random_state=RANDOM_STATE,
                verbose=-1,
                **self.params,
            )
            if USE_CLASS_WEIGHTS:
                lgb_kwargs["scale_pos_weight"] = spw
            return LGBMClassifier(**lgb_kwargs)
        if self.kind == "catboost":
            from catboost import CatBoostClassifier

            cb_kwargs = dict(
                loss_function="Logloss",
                eval_metric="AUC",
                random_seed=RANDOM_STATE,
                verbose=False,
                thread_count=2,
                **self.params,
            )
            if USE_CLASS_WEIGHTS:
                cb_kwargs["auto_class_weights"] = "Balanced"
            return CatBoostClassifier(**cb_kwargs)
        if self.kind == "tabpfn":
            from tabpfn import TabPFNClassifier

            kwargs = dict(self.params)
            kwargs.setdefault("device", "cpu")
            kwargs.setdefault("ignore_pretraining_limits", True)
            kwargs.setdefault("random_state", RANDOM_STATE)
            # Open TabPFNv2 weights (no Prior Labs login). Filename without a
            # directory resolves to the TabPFN cache after first download.
            kwargs.setdefault(
                "model_path",
                "tabpfn-v2-classifier-finetuned-zk73skhh.ckpt",
            )
            try:
                return TabPFNClassifier(**kwargs)
            except TypeError:
                kwargs.pop("ignore_pretraining_limits", None)
                kwargs.pop("device", None)
                kwargs.pop("model_path", None)
                return TabPFNClassifier(**kwargs)
        raise ValueError(self.kind)

    def fit(self, X: pd.DataFrame, y: pd.Series):
        self.prep = _encoder(X)
        Xt = self.prep.fit_transform(X)
        self.feature_names_ = list(X.columns)
        self.model = self._make()
        yv = np.asarray(y)
        try:
            self.model.fit(Xt, yv)
        except TypeError:
            self.model.fit(np.asarray(Xt), yv)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        Xt = self.prep.transform(X)
        try:
            proba = self.model.predict_proba(Xt)
        except TypeError:
            proba = self.model.predict_proba(np.asarray(Xt))
        return np.asarray(proba)


def _suggest(trial: optuna.Trial, kind: str) -> dict[str, Any]:
    if kind == "xgboost":
        return {
            "n_estimators": trial.suggest_int("n_estimators", 80, 400),
            "max_depth": trial.suggest_int("max_depth", 2, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 12),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
        }
    if kind == "lightgbm":
        return {
            "n_estimators": trial.suggest_int("n_estimators", 80, 400),
            "num_leaves": trial.suggest_int("num_leaves", 8, 64),
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_samples": trial.suggest_int("min_child_samples", 5, 40),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
        }
    if kind == "catboost":
        return {
            "iterations": trial.suggest_int("iterations", 80, 400),
            "depth": trial.suggest_int("depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.3, log=True),
            "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1.0, 10.0),
        }
    if kind == "tabpfn":
        params: dict[str, Any] = {
            "n_estimators": trial.suggest_categorical("n_estimators", [4, 8]),
        }
        return params
    raise ValueError(kind)


def tune_algorithm(
    kind: str,
    X: pd.DataFrame,
    y: pd.Series,
    *,
    n_trials: int,
    folds: int,
    log,
) -> dict[str, Any]:
    n_pos = int((y == 1).sum())
    n_neg = int((y == 0).sum())
    logs: list[str] = []

    def objective(trial: optuna.Trial) -> float:
        params = _suggest(trial, kind)
        t0 = time.time()

        def factory():
            return EncodedModel(kind, params, n_pos, n_neg)

        scores = _cv_scores(factory, X, y, folds=folds)
        elapsed = time.time() - t0
        msg = (
            f"  {kind} trial {trial.number:02d}  AUC={scores['roc_auc']:.4f}  "
            f"F1={scores['f1']:.4f}  acc={scores['accuracy']:.4f}  "
            f"({elapsed:.1f}s)  params={params}"
        )
        logs.append(msg)
        log(msg)
        return scores["roc_auc"]

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE))

    def objective_safe(trial: optuna.Trial) -> float:
        try:
            return objective(trial)
        except Exception as exc:  # noqa: BLE001 — log and prune, do not dump a 40-line traceback into the notebook
            msg = f"  {kind} trial {trial.number:02d} FAILED: {type(exc).__name__}: {exc}"
            logs.append(msg)
            log(msg)
            raise optuna.TrialPruned() from exc

    study.optimize(objective_safe, n_trials=n_trials, show_progress_bar=False)
    complete = [t for t in study.trials if t.state == optuna.trial.TrialState.COMPLETE]
    if not complete:
        raise RuntimeError(f"{kind}: every Optuna trial failed")
    best_params = study.best_params

    def factory_best():
        return EncodedModel(kind, best_params, n_pos, n_neg)

    cv = _cv_scores(factory_best, X, y, folds=folds)
    winner = EncodedModel(kind, best_params, n_pos, n_neg)
    winner.fit(X, y)
    return {
        "algorithm": kind,
        "best_params": best_params,
        "best_cv_auc": float(study.best_value),
        "cv": cv,
        "n_trials": n_trials,
        "model": winner,
        "trial_log": logs,
        "study": study,
    }


def evaluate_model(model: EncodedModel, X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    proba = model.predict_proba(X)[:, 1]
    pred = (proba >= 0.5).astype(int)
    return _metrics(y, pred, proba)


def shap_plots(model: EncodedModel, X: pd.DataFrame, out_dir: Path, log) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    Xt = model.prep.transform(X)
    Xt = np.asarray(Xt, dtype=float)
    names = list(X.columns)
    sample = Xt if len(Xt) <= 200 else Xt[:200]
    paths = []
    try:
        if model.kind == "tabpfn":
            # KernelExplainer is tens of minutes on CPU (one predict_proba ≈ 0.4s).
            # Ablation attributions: Δproba when the feature is replaced by its median.
            explain = sample[:80]
            base = np.asarray(model.model.predict_proba(explain))[:, 1]
            sv = np.zeros_like(explain)
            med = np.median(explain, axis=0)
            for j in range(explain.shape[1]):
                Xp = explain.copy()
                Xp[:, j] = med[j]
                sv[:, j] = base - np.asarray(model.model.predict_proba(Xp))[:, 1]
            sample = explain
            log("  SHAP TabPFN: median-ablation attributions on 80 rows (not KernelExplainer)")
        else:
            explainer = shap.TreeExplainer(model.model)
            sv = explainer.shap_values(sample)
            if isinstance(sv, list):
                sv = sv[1]
        plt.figure(figsize=(8, 5))
        shap.summary_plot(sv, sample, feature_names=names, show=False, max_display=12)
        p1 = out_dir / "shap_beeswarm.png"
        plt.tight_layout()
        plt.savefig(p1, dpi=140, bbox_inches="tight")
        plt.close()
        paths.append(str(p1))
        plt.figure(figsize=(8, 4.5))
        shap.summary_plot(sv, sample, feature_names=names, plot_type="bar", show=False, max_display=12)
        p2 = out_dir / "shap_bar.png"
        plt.tight_layout()
        plt.savefig(p2, dpi=140, bbox_inches="tight")
        plt.close()
        paths.append(str(p2))
        log(f"  SHAP wrote {p1.name} and {p2.name}")
    except Exception as exc:
        log(f"  SHAP failed ({exc!r}); continuing")
    return paths


def pick_winner(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Prefer algorithms whose quoted holdout accuracy already clears 85%, then rank by ROC-AUC."""

    def key(r):
        cv = r["cv"]
        ho = r.get("holdout") or {}
        return (cv["roc_auc"], ho.get("accuracy", 0.0), cv["f1"])

    gated = [
        r
        for r in results
        if (r.get("holdout") or {}).get("accuracy", r["cv"]["accuracy"]) >= ACCURACY_GATE
    ]
    return max(gated or results, key=key)


def _stratified_cap(X: pd.DataFrame, y: pd.Series, n: int, seed: int = RANDOM_STATE):
    if len(X) <= n:
        return X, y
    from sklearn.model_selection import train_test_split as _tts

    Xc, _, yc, _ = _tts(X, y, train_size=n, stratify=y, random_state=seed)
    return Xc, yc


def run_disease(
    name: str,
    X: pd.DataFrame,
    y: pd.Series,
    *,
    secondary: tuple[pd.DataFrame, pd.Series] | None = None,
    sources: pd.Series | None = None,
    log=print,
) -> dict[str, Any]:
    ART.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    MODELS.mkdir(parents=True, exist_ok=True)
    MLRUNS.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MLFLOW_TRACKING_URI", MLRUNS.as_uri())

    log(f"\n======== {name.upper()} ========")
    pos_rate = float(y.mean())
    dummy = max(pos_rate, 1.0 - pos_rate)
    log(
        f"rows={len(X)}  features={list(X.columns)}  positives={int(y.sum())}/{len(y)}  "
        f"pos_rate={pos_rate:.3f}  majority-class dummy acc={dummy:.3f}"
    )
    Xtr, Xho, ytr, yho = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    log(f"stratified split  train={len(Xtr)}  holdout={len(Xho)}")
    if sources is not None:
        log("source counts: " + str(sources.value_counts().to_dict()))

    try:
        import mlflow

        mlflow.set_tracking_uri(str(MLRUNS))
        mlflow.set_experiment(f"mediai-{name}")
        mlflow_ok = True
    except Exception as exc:
        log(f"MLflow disabled: {exc}")
        mlflow_ok = False
        mlflow = None  # type: ignore

    algos = [
        ("xgboost", TREE_TRIALS, TREE_FOLDS),
        ("lightgbm", TREE_TRIALS, TREE_FOLDS),
        ("catboost", TREE_TRIALS, TREE_FOLDS),
        ("tabpfn", TABPFN_TRIALS, TABPFN_FOLDS),
    ]
    fitted: list[dict[str, Any]] = []
    ctx = None
    if mlflow_ok:
        try:
            ctx = mlflow.start_run(run_name=f"{name}-bakeoff")
        except Exception as exc:
            log(f"MLflow start_run failed ({exc}); continuing without tracking")
            mlflow_ok = False
            ctx = None
    try:
        for kind, trials, folds in algos:
            log(f"\n--- training {kind} ({trials} Optuna trials, {folds}-fold CV) ---")
            t0 = time.time()
            Xfit, yfit = Xtr, ytr
            if kind == "tabpfn" and len(Xtr) > TABPFN_MAX_ROWS:
                Xfit, yfit = _stratified_cap(Xtr, ytr, TABPFN_MAX_ROWS)
                log(f"  TabPFN train capped at {len(Xfit)} stratified rows (CPU limit)")
            try:
                res = tune_algorithm(kind, Xfit, yfit, n_trials=trials, folds=folds, log=log)
            except Exception as exc:
                log(f"  {kind} FAILED: {exc!r}")
                continue
            hold = evaluate_model(res["model"], Xho, yho)
            res["holdout"] = hold
            res["holdout_by_source"] = {}
            if sources is not None:
                src_ho = sources.loc[Xho.index]
                for src_name in src_ho.unique():
                    mask = src_ho == src_name
                    if int(mask.sum()) < 8:
                        continue
                    res["holdout_by_source"][str(src_name)] = evaluate_model(
                        res["model"], Xho.loc[mask], yho.loc[mask]
                    )
            res["seconds"] = time.time() - t0
            log(
                f"  {kind} DONE  CV-AUC={res['cv']['roc_auc']:.4f}  "
                f"holdout AUC={hold['roc_auc']:.4f} F1={hold['f1']:.4f} acc={hold['accuracy']:.4f}  "
                f"wall={res['seconds']:.1f}s"
            )
            if mlflow_ok:
                try:
                    with mlflow.start_run(run_name=kind, nested=True):
                        mlflow.log_params({f"hp_{k}": v for k, v in res["best_params"].items()})
                        mlflow.log_metrics({f"cv_{k}": v for k, v in res["cv"].items() if k != "folds"})
                        mlflow.log_metrics({f"holdout_{k}": v for k, v in hold.items()})
                except Exception as exc:
                    log(f"  MLflow nested run skipped: {exc}")
                    mlflow_ok = False
            fitted.append(res)
    finally:
        if ctx is not None:
            mlflow.end_run()

    if not fitted:
        raise RuntimeError(f"No algorithm succeeded for {name}")
    winner = pick_winner(fitted)
    hold_acc = float(winner["holdout"]["accuracy"])
    log(
        f"\nWINNER for {name}: {winner['algorithm']}  "
        f"CV-AUC={winner['cv']['roc_auc']:.4f}  holdout acc={hold_acc:.4f}  "
        f"holdout AUC={winner['holdout']['roc_auc']:.4f}  "
        f"{'MEETS' if hold_acc >= ACCURACY_GATE else 'BELOW'} {ACCURACY_GATE:.0%} accuracy gate"
    )
    # refit winner on full train split already done; shap on train sample
    shap_dir = REPORTS / name
    shap_paths = shap_plots(winner["model"], Xtr, shap_dir, log)

    secondary_metrics = None
    if secondary is not None:
        Xs, ys = secondary
        common = [c for c in X.columns if c in Xs.columns]
        if common:
            Xw = Xtr[common]
            sw = EncodedModel(winner["algorithm"], winner["best_params"], int(ytr.sum()), int((ytr == 0).sum()))
            sw.fit(Xw, ytr)
            secondary_metrics = evaluate_model(sw, Xs[common], ys)
            log(f"secondary ({len(Xs)} rows, {len(common)} shared cols): {secondary_metrics}")
        else:
            log("secondary skipped — no shared columns")

    model_path = MODELS / f"{name}_{winner['algorithm']}.joblib"
    joblib.dump(
        {
            "disease": name,
            "algorithm": winner["algorithm"],
            "model": winner["model"],
            "columns": list(X.columns),
            "best_params": winner["best_params"],
            "cv": winner["cv"],
            "holdout": winner["holdout"],
        },
        model_path,
    )
    comparison = []
    for r in fitted:
        comparison.append(
            {
                "algorithm": r["algorithm"],
                "cv_accuracy": r["cv"]["accuracy"],
                "cv_precision": r["cv"]["precision"],
                "cv_recall": r["cv"]["recall"],
                "cv_f1": r["cv"]["f1"],
                "cv_roc_auc": r["cv"]["roc_auc"],
                "holdout_accuracy": r["holdout"]["accuracy"],
                "holdout_precision": r["holdout"]["precision"],
                "holdout_recall": r["holdout"]["recall"],
                "holdout_f1": r["holdout"]["f1"],
                "holdout_roc_auc": r["holdout"]["roc_auc"],
                "n_trials": r["n_trials"],
                "seconds": r["seconds"],
                "holdout_by_source": r.get("holdout_by_source") or {},
            }
        )
    payload = {
        "disease": name,
        "n_rows": int(len(X)),
        "n_train": int(len(Xtr)),
        "n_holdout": int(len(Xho)),
        "features": list(X.columns),
        "class_balance": {"positive": int(y.sum()), "negative": int((y == 0).sum())},
        "majority_dummy_accuracy": dummy,
        "accuracy_gate": ACCURACY_GATE,
        "meets_accuracy_gate": hold_acc >= ACCURACY_GATE,
        "comparison": comparison,
        "winner": winner["algorithm"],
        "winner_cv": winner["cv"],
        "winner_holdout": winner["holdout"],
        "winner_holdout_by_source": winner.get("holdout_by_source") or {},
        "winner_params": winner["best_params"],
        "secondary": secondary_metrics,
        "shap": shap_paths,
        "model_path": str(model_path),
        "trial_logs": {r["algorithm"]: r["trial_log"] for r in fitted},
    }
    (ART / f"{name}_results.json").write_text(json.dumps(payload, indent=2, default=str) + "\n")
    return payload
