"""
Generates a synthetic student performance dataset.
Run: python generate_dataset.py
Output: students.csv (1200 rows) in this same folder.
"""
import numpy as np
import pandas as pd

np.random.seed(42)
N = 1200

genders = np.random.choice(["Male", "Female"], N)
internet = np.random.choice(["Yes", "No"], N, p=[0.8, 0.2])
parent_edu = np.random.choice(
    ["High School", "Graduate", "Post Graduate", "Doctorate"], N, p=[0.35, 0.35, 0.22, 0.08]
)
participation = np.random.choice(["Low", "Medium", "High"], N, p=[0.3, 0.45, 0.25])

age = np.random.randint(17, 23, N)
attendance = np.clip(np.random.normal(78, 12, N), 40, 100).round(1)
study_hours = np.clip(np.random.normal(3.2, 1.5, N), 0, 10).round(1)
previous_marks = np.clip(np.random.normal(65, 15, N), 20, 100).round(1)

# Correlated features: internal/assignment/quiz marks depend loosely on study habits
internal = np.clip(
    0.4 * previous_marks + 3 * study_hours + np.random.normal(0, 8, N), 0, 100
).round(1)
assignment = np.clip(
    0.35 * previous_marks + 2.5 * study_hours + np.random.normal(0, 10, N), 0, 100
).round(1)
quiz = np.clip(
    0.3 * previous_marks + 4 * study_hours + np.random.normal(0, 9, N), 0, 100
).round(1)

participation_bonus = pd.Series(participation).map({"Low": 0, "Medium": 3, "High": 6}).values
internet_bonus = pd.Series(internet).map({"Yes": 2, "No": 0}).values
parent_bonus = pd.Series(parent_edu).map(
    {"High School": 0, "Graduate": 2, "Post Graduate": 4, "Doctorate": 5}
).values

final_marks = (
    0.20 * internal
    + 0.15 * assignment
    + 0.15 * quiz
    + 0.25 * previous_marks
    + 0.10 * attendance
    + 2.0 * study_hours
    + participation_bonus
    + internet_bonus
    + parent_bonus
    + np.random.normal(0, 6, N)
)
final_marks = np.clip(final_marks, 0, 100).round(1)

df = pd.DataFrame({
    "student_id": [f"STU{1000+i}" for i in range(N)],
    "name": [f"Student_{i+1}" for i in range(N)],
    "age": age,
    "gender": genders,
    "attendance": attendance,
    "internal_marks": internal,
    "assignment_marks": assignment,
    "quiz_marks": quiz,
    "study_hours_per_day": study_hours,
    "previous_semester_marks": previous_marks,
    "participation": participation,
    "internet_access": internet,
    "parent_education": parent_edu,
    "final_exam_marks": final_marks,
})

# introduce a small amount of realistic missingness
for col in ["attendance", "internal_marks", "assignment_marks", "study_hours_per_day"]:
    idx = df.sample(frac=0.01, random_state=1).index
    df.loc[idx, col] = np.nan

df.to_csv("students.csv", index=False)
print(f"Generated students.csv with {len(df)} records.")
print(df.head())
