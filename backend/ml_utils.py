import json
import os

import joblib
import numpy as np
import pandas as pd

NUMERIC_COLS = [
    "age",
    "attendance",
    "internal_marks",
    "assignment_marks",
    "quiz_marks",
    "study_hours_per_day",
    "previous_semester_marks",
]
CATEGORICAL_COLS = ["gender", "participation", "internet_access", "parent_education"]
PASS_THRESHOLD = 40


class PredictionEngine:
    """Loads trained artifacts once and serves predictions."""

    def __init__(self, model_dir):
        self.model_dir = model_dir
        self.loaded = False
        self._try_load()

    def _try_load(self):
        try:
            self.model = joblib.load(os.path.join(self.model_dir, "best_model.pkl"))
            self.classifier = joblib.load(os.path.join(self.model_dir, "classifier.pkl"))
            self.scaler = joblib.load(os.path.join(self.model_dir, "scaler.pkl"))
            self.encoders = joblib.load(os.path.join(self.model_dir, "encoders.pkl"))
            with open(os.path.join(self.model_dir, "feature_columns.json")) as f:
                self.feature_cols = json.load(f)
            self.loaded = True
        except FileNotFoundError:
            self.loaded = False

    def reload(self):
        self._try_load()

    @staticmethod
    def _grade(marks):
        if marks >= 90:
            return "A+"
        if marks >= 80:
            return "A"
        if marks >= 70:
            return "B"
        if marks >= 60:
            return "C"
        if marks >= 40:
            return "D"
        return "F"

    @staticmethod
    def _risk_level(marks, pass_fail):
        if pass_fail == "Fail":
            return "High"
        if marks < 55:
            return "Medium"
        return "Low"

    def _weak_and_strengths(self, payload):
        areas = {
            "Attendance": payload["attendance"],
            "Internal Marks": payload["internal_marks"],
            "Assignment Marks": payload["assignment_marks"],
            "Quiz Marks": payload["quiz_marks"],
            "Study Hours": payload["study_hours_per_day"] * 10,  # normalize roughly to /100
            "Previous Semester Marks": payload["previous_semester_marks"],
        }
        sorted_areas = sorted(areas.items(), key=lambda kv: kv[1])
        weak = [name for name, val in sorted_areas if val < 60][:3]
        strong = [name for name, val in sorted_areas[::-1] if val >= 70][:3]
        if not weak:
            weak = ["No significant weak areas"]
        if not strong:
            strong = ["Keep building consistency"]
        return weak, strong

    def _suggestions(self, payload, weak_areas):
        tips = []
        if payload["study_hours_per_day"] < 3:
            tips.append("Increase study hours to at least 3-4 hours per day.")
        if payload["attendance"] < 75:
            tips.append("Improve attendance; aim for at least 85%.")
        if payload["quiz_marks"] < 60:
            tips.append("Focus more on quizzes and short assessments.")
        if payload["assignment_marks"] < 60:
            tips.append("Improve assignment submission quality and timeliness.")
        if payload["internal_marks"] < 60:
            tips.append("Practice previous year papers to strengthen internals.")
        if payload["participation"] == "Low":
            tips.append("Participate more actively in class and extracurricular activities.")
        if not tips:
            tips.append("Great work — maintain current study habits and consistency.")
        return tips

    def _encode_row(self, row):
        """row: dict of the 11 model inputs -> scaled feature array ready for .predict()."""
        df = pd.DataFrame([row])
        for col in CATEGORICAL_COLS:
            le = self.encoders[col]
            val = str(df.at[0, col])
            if val not in le.classes_:
                val = le.classes_[0]
            df[col] = le.transform([val])
        X = df[self.feature_cols]
        return self.scaler.transform(X)

    def _predict_marks(self, row):
        X_scaled = self._encode_row(row)
        marks = float(np.clip(self.model.predict(X_scaled)[0], 0, 100))
        return marks, X_scaled

    def _estimate_improvement(self, payload, current_marks):
        """Simulates a student acting on the suggestions (better attendance,
        +1.5 study hrs/day, stronger quiz/assignment scores) and re-runs the
        model to estimate how many marks that could realistically add."""
        improved = dict(payload)
        improved["attendance"] = min(100, max(payload["attendance"], 85))
        improved["study_hours_per_day"] = round(payload["study_hours_per_day"] + 1.5, 1)
        improved["quiz_marks"] = min(100, payload["quiz_marks"] + 10)
        improved["assignment_marks"] = min(100, payload["assignment_marks"] + 10)
        improved["internal_marks"] = min(100, payload["internal_marks"] + 5)
        row = {col: improved[col] for col in NUMERIC_COLS + CATEGORICAL_COLS}
        improved_marks, _ = self._predict_marks(row)
        return round(max(0, improved_marks - current_marks), 1)

    def predict(self, payload):
        """payload: dict with the 9 prediction inputs (student_id/name not required)."""
        if not self.loaded:
            raise RuntimeError(
                "Model not trained yet. Call /api/train-model or run model/train_model.py first."
            )

        row = {col: payload[col] for col in NUMERIC_COLS + CATEGORICAL_COLS}
        predicted_marks, X_scaled = self._predict_marks(row)

        pass_fail_pred = self.classifier.predict(X_scaled)[0]
        pass_fail = "Pass" if pass_fail_pred == 1 or predicted_marks >= PASS_THRESHOLD else "Fail"

        # Confidence: how sure the classifier is about the pass/fail call.
        # predict_proba gives [P(fail), P(pass)]; confidence is the winning class's probability.
        if hasattr(self.classifier, "predict_proba"):
            proba = self.classifier.predict_proba(X_scaled)[0]
            confidence_percent = round(float(max(proba)) * 100, 1)
        else:
            confidence_percent = None

        grade = self._grade(predicted_marks)
        risk = self._risk_level(predicted_marks, pass_fail)
        weak, strong = self._weak_and_strengths(payload)
        suggestions = self._suggestions(payload, weak)
        estimated_improvement = self._estimate_improvement(payload, predicted_marks)

        recommended_hours = round(max(payload["study_hours_per_day"], 2) + (2 if pass_fail == "Fail" else 0.5), 1)

        return {
            "predicted_marks": round(predicted_marks, 2),
            "pass_fail": pass_fail,
            "grade": grade,
            "performance_percentage": round(predicted_marks, 2),
            "confidence_percent": confidence_percent,
            "weak_areas": weak,
            "strengths": strong,
            "suggestions": suggestions,
            "risk_level": risk,
            "recommended_study_hours": recommended_hours,
            "estimated_improvement": estimated_improvement,
        }
