"""
Trains regression models (predict final marks) and a classification model
(predict pass/fail), picks the best regressor by R2 score, and saves
everything needed for inference with joblib.

Run: python train_model.py
Requires: ../dataset/students.csv
Outputs (in this folder): best_model.pkl, scaler.pkl, encoders.pkl,
                           metrics.json, feature_columns.json
"""
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeRegressor

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "students.csv")
PASS_THRESHOLD = 40  # marks >= 40 => Pass

CATEGORICAL_COLS = ["gender", "participation", "internet_access", "parent_education"]
NUMERIC_COLS = [
    "age",
    "attendance",
    "internal_marks",
    "assignment_marks",
    "quiz_marks",
    "study_hours_per_day",
    "previous_semester_marks",
]
TARGET = "final_exam_marks"


def load_and_clean(path):
    df = pd.read_csv(path)
    # Missing value handling: numeric -> median, categorical -> mode
    for col in NUMERIC_COLS + [TARGET]:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())
    for col in CATEGORICAL_COLS:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].mode()[0])
    return df


def encode_features(df, encoders=None, fit=True):
    df = df.copy()
    if encoders is None:
        encoders = {}
    for col in CATEGORICAL_COLS:
        if fit:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
        else:
            le = encoders[col]
            df[col] = df[col].astype(str).map(
                lambda v: v if v in le.classes_ else le.classes_[0]
            )
            df[col] = le.transform(df[col])
    return df, encoders


def get_feature_importance(model, feature_cols):
    """Returns a {feature: normalized_importance} dict, works for both
    tree-based models (feature_importances_) and linear models (coef_)."""
    if hasattr(model, "feature_importances_"):
        raw = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        raw = np.abs(np.asarray(model.coef_, dtype=float)).ravel()
    else:
        return {}
    total = raw.sum()
    normalized = raw / total if total else raw
    pairs = sorted(zip(feature_cols, normalized.tolist()), key=lambda kv: kv[1], reverse=True)
    return {name: round(val, 4) for name, val in pairs}


def main():
    df = load_and_clean(DATA_PATH)
    df["pass_fail"] = (df[TARGET] >= PASS_THRESHOLD).astype(int)

    feature_cols = NUMERIC_COLS + CATEGORICAL_COLS
    df_enc, encoders = encode_features(df, fit=True)

    X = df_enc[feature_cols]
    y_reg = df_enc[TARGET]
    y_clf = df_enc["pass_fail"]

    X_train, X_test, yreg_train, yreg_test, yclf_train, yclf_test = train_test_split(
        X, y_reg, y_clf, test_size=0.2, random_state=42
    )

    # Feature scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # --- Regression models ---
    regressors = {
        "LinearRegression": LinearRegression(),
        "DecisionTreeRegressor": DecisionTreeRegressor(max_depth=8, random_state=42),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=200, max_depth=10, random_state=42
        ),
    }

    metrics = {"regression": {}, "classification": {}}
    best_name, best_model, best_r2 = None, None, -np.inf

    for name, model in regressors.items():
        model.fit(X_train_scaled, yreg_train)
        preds = model.predict(X_test_scaled)
        r2 = r2_score(yreg_test, preds)
        mae = mean_absolute_error(yreg_test, preds)
        rmse = mean_squared_error(yreg_test, preds) ** 0.5
        metrics["regression"][name] = {"r2": round(r2, 4), "mae": round(mae, 3), "rmse": round(rmse, 3)}
        if r2 > best_r2:
            best_name, best_model, best_r2 = name, model, r2

    # --- Classification model (pass/fail) ---
    clf = LogisticRegression(max_iter=1000)
    clf.fit(X_train_scaled, yclf_train)
    clf_preds = clf.predict(X_test_scaled)
    clf_proba = clf.predict_proba(X_test_scaled)[:, 1]

    clf_acc = accuracy_score(yclf_test, clf_preds)
    clf_precision = precision_score(yclf_test, clf_preds, zero_division=0)
    clf_recall = recall_score(yclf_test, clf_preds, zero_division=0)
    clf_f1 = f1_score(yclf_test, clf_preds, zero_division=0)
    cm = confusion_matrix(yclf_test, clf_preds, labels=[0, 1])
    fpr, tpr, _ = roc_curve(yclf_test, clf_proba)
    roc_auc = roc_auc_score(yclf_test, clf_proba)

    # Downsample the ROC curve to at most 60 points so metrics.json stays small.
    if len(fpr) > 60:
        idx = np.linspace(0, len(fpr) - 1, 60).astype(int)
        fpr, tpr = fpr[idx], tpr[idx]

    metrics["classification"]["LogisticRegression"] = {
        "accuracy": round(clf_acc, 4),
        "precision": round(clf_precision, 4),
        "recall": round(clf_recall, 4),
        "f1": round(clf_f1, 4),
        "confusion_matrix": {
            "labels": ["Fail", "Pass"],
            # rows = actual, cols = predicted -> [[TN, FP], [FN, TP]]
            "matrix": cm.tolist(),
        },
        "roc_curve": {
            "fpr": [round(v, 4) for v in fpr.tolist()],
            "tpr": [round(v, 4) for v in tpr.tolist()],
        },
        "roc_auc": round(float(roc_auc), 4),
    }

    metrics["best_regressor"] = best_name
    metrics["best_regressor_r2"] = round(best_r2, 4)
    metrics["feature_columns"] = feature_cols
    metrics["feature_importance"] = {
        name: get_feature_importance(model, feature_cols) for name, model in regressors.items()
    }
    metrics["best_model_feature_importance"] = metrics["feature_importance"][best_name]
    metrics["trained_at"] = datetime.now(timezone.utc).isoformat()

    out_dir = os.path.dirname(__file__)
    joblib.dump(best_model, os.path.join(out_dir, "best_model.pkl"))
    joblib.dump(clf, os.path.join(out_dir, "classifier.pkl"))
    joblib.dump(scaler, os.path.join(out_dir, "scaler.pkl"))
    joblib.dump(encoders, os.path.join(out_dir, "encoders.pkl"))

    with open(os.path.join(out_dir, "feature_columns.json"), "w") as f:
        json.dump(feature_cols, f)
    with open(os.path.join(out_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete.")
    print(json.dumps(metrics, indent=2))
    print(f"Best regressor: {best_name} (R2={best_r2:.4f}) saved to best_model.pkl")


if __name__ == "__main__":
    main()
