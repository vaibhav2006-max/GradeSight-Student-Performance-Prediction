import io
import os
import subprocess
import sys

import pandas as pd
from flask import Flask, jsonify, request, send_file
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from config import Config
from email_utils import EmailNotConfigured, risk_alert_html, send_email, should_notify
from ml_utils import PredictionEngine
from models import Admin, EmailSettings, Prediction, Student, db

app = Flask(__name__)
app.config.from_object(Config)
_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
CORS(
    app,
    resources={r"/api/*": {"origins": _cors_origins}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
db.init_app(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

engine = PredictionEngine(Config.MODEL_DIR)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def role_required(role):
    def decorator(fn):
        from functools import wraps

        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") != role:
                return jsonify({"error": "Unauthorized"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def seed_admin():
    if not Admin.query.filter_by(username="admin").first():
        pw = bcrypt.generate_password_hash("admin123").decode("utf-8")
        db.session.add(Admin(username="admin", password_hash=pw))
        db.session.commit()
        print("Seeded default admin -> username: admin / password: admin123")


with app.app_context():
    db.create_all()
    seed_admin()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/api/register")
def register():
    data = request.get_json(force=True)
    required = ["student_id", "name", "email", "password"]
    if not all(data.get(k) for k in required):
        return jsonify({"error": "student_id, name, email, password are required"}), 400
    if Student.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409
    if Student.query.filter_by(student_id=data["student_id"]).first():
        return jsonify({"error": "Student ID already exists"}), 409

    pw_hash = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
    student = Student(
        student_id=data["student_id"],
        name=data["name"],
        email=data["email"],
        password_hash=pw_hash,
        age=data.get("age"),
        gender=data.get("gender"),
    )
    db.session.add(student)
    db.session.commit()
    return jsonify({"message": "Registered successfully"}), 201


@app.post("/api/login/student")
def login_student():
    data = request.get_json(force=True)
    student = Student.query.filter_by(email=data.get("email")).first()
    if not student or not bcrypt.check_password_hash(student.password_hash, data.get("password", "")):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=student.student_id, additional_claims={"role": "student"})
    return jsonify({"access_token": token, "student": student.to_dict()})


@app.post("/api/login/admin")
def login_admin():
    data = request.get_json(force=True)
    admin = Admin.query.filter_by(username=data.get("username")).first()
    if not admin or not bcrypt.check_password_hash(admin.password_hash, data.get("password", "")):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_access_token(identity=admin.username, additional_claims={"role": "admin"})
    return jsonify({"access_token": token})


@app.get("/api/me")
@jwt_required()
def me():
    identity = get_jwt_identity()
    claims = get_jwt()
    return jsonify({"identity": identity, "role": claims.get("role")})


# ---------------------------------------------------------------------------
# Student CRUD (admin only for write ops)
# ---------------------------------------------------------------------------
@app.get("/api/students")
@jwt_required()
def list_students():
    q = request.args.get("q", "").strip()
    query = Student.query
    if q:
        query = query.filter(
            (Student.name.ilike(f"%{q}%")) | (Student.student_id.ilike(f"%{q}%"))
        )
    students = query.order_by(Student.final_exam_marks.desc().nullslast()).all()
    return jsonify([s.to_dict() for s in students])


@app.get("/api/students/<student_id>")
@jwt_required()
def get_student(student_id):
    s = Student.query.filter_by(student_id=student_id).first_or_404()
    return jsonify(s.to_dict())


@app.post("/api/students")
@role_required("admin")
def add_student():
    data = request.get_json(force=True)
    if Student.query.filter_by(student_id=data.get("student_id")).first():
        return jsonify({"error": "Student ID already exists"}), 409
    pw_hash = bcrypt.generate_password_hash(data.get("password", "changeme123")).decode("utf-8")
    s = Student(password_hash=pw_hash, **{
        k: v for k, v in data.items() if k not in ("password",) and hasattr(Student, k)
    })
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@app.put("/api/students/<student_id>")
@role_required("admin")
def update_student(student_id):
    s = Student.query.filter_by(student_id=student_id).first_or_404()
    data = request.get_json(force=True)
    for k, v in data.items():
        if hasattr(s, k) and k not in ("id", "password_hash"):
            setattr(s, k, v)
    db.session.commit()
    return jsonify(s.to_dict())


@app.delete("/api/students/<student_id>")
@role_required("admin")
def delete_student(student_id):
    s = Student.query.filter_by(student_id=student_id).first_or_404()
    db.session.delete(s)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ---------------------------------------------------------------------------
# CSV upload / export
# ---------------------------------------------------------------------------
REQUIRED_CSV_FIELDS = ["student_id", "name"]
NUMERIC_CSV_FIELDS = [
    "age", "attendance", "internal_marks", "assignment_marks", "quiz_marks",
    "study_hours_per_day", "previous_semester_marks", "final_exam_marks",
]


@app.post("/api/upload-csv")
@role_required("admin")
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    try:
        df = pd.read_csv(file)
    except Exception as e:
        return jsonify({"error": f"Could not parse CSV: {e}"}), 400

    added, duplicate_ids, invalid_rows, missing_fields_rows = [], [], [], []
    seen_in_file = set()

    for idx, row in df.iterrows():
        row_num = idx + 2  # +2 = header row + 1-indexing, matches what a user sees in Excel/Sheets
        sid = str(row.get("student_id", "")).strip()
        name = str(row.get("name", "")).strip()

        missing = [f for f in REQUIRED_CSV_FIELDS if not str(row.get(f, "")).strip()]
        if missing:
            missing_fields_rows.append({"row": row_num, "student_id": sid or None, "missing": missing})
            continue

        # Validate numeric fields are actually numeric (or blank).
        bad_numeric = []
        for f in NUMERIC_CSV_FIELDS:
            val = row.get(f)
            if val is not None and str(val).strip() != "" and not pd.notna(pd.to_numeric(pd.Series([val]), errors="coerce")).all():
                bad_numeric.append(f)
        if bad_numeric:
            invalid_rows.append({"row": row_num, "student_id": sid, "reason": f"Non-numeric value in: {', '.join(bad_numeric)}"})
            continue

        if sid in seen_in_file or Student.query.filter_by(student_id=sid).first():
            duplicate_ids.append({"row": row_num, "student_id": sid})
            continue
        seen_in_file.add(sid)

        pw_hash = bcrypt.generate_password_hash("changeme123").decode("utf-8")
        s = Student(
            student_id=sid,
            name=name,
            email=row.get("email") or f"{sid.lower()}@example.com",
            password_hash=pw_hash,
            age=row.get("age"),
            gender=row.get("gender"),
            attendance=row.get("attendance"),
            internal_marks=row.get("internal_marks"),
            assignment_marks=row.get("assignment_marks"),
            quiz_marks=row.get("quiz_marks"),
            study_hours_per_day=row.get("study_hours_per_day"),
            previous_semester_marks=row.get("previous_semester_marks"),
            participation=row.get("participation"),
            internet_access=row.get("internet_access"),
            parent_education=row.get("parent_education"),
            final_exam_marks=row.get("final_exam_marks"),
        )
        db.session.add(s)
        added.append(sid)

    db.session.commit()

    error_rows = (
        [{"row": r["row"], "student_id": r["student_id"], "issue": "Duplicate student_id"} for r in duplicate_ids]
        + [{"row": r["row"], "student_id": r["student_id"], "issue": r["reason"]} for r in invalid_rows]
        + [{"row": r["row"], "student_id": r["student_id"], "issue": f"Missing: {', '.join(r['missing'])}"} for r in missing_fields_rows]
    )
    error_report_csv = None
    if error_rows:
        err_df = pd.DataFrame(error_rows).sort_values("row")
        error_report_csv = err_df.to_csv(index=False)

    return jsonify({
        "added": len(added),
        "added_ids": added,
        "skipped": len(duplicate_ids) + len(invalid_rows) + len(missing_fields_rows),
        "duplicate_ids": duplicate_ids,
        "invalid_rows": invalid_rows,
        "missing_fields_rows": missing_fields_rows,
        "total_rows": len(df),
        "error_report_csv": error_report_csv,
        "preview": df.head(10).fillna("").to_dict(orient="records"),
    })


@app.get("/api/export-csv")
@jwt_required()
def export_csv():
    students = Student.query.all()
    df = pd.DataFrame([s.to_dict() for s in students])
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    mem = io.BytesIO(buf.getvalue().encode("utf-8"))
    return send_file(mem, mimetype="text/csv", as_attachment=True, download_name="students_export.csv")


# ---------------------------------------------------------------------------
# ML: train / predict
# ---------------------------------------------------------------------------
@app.post("/api/train-model")
@role_required("admin")
def train_model_endpoint():
    script = os.path.join(Config.MODEL_DIR, "train_model.py")
    result = subprocess.run([sys.executable, script], capture_output=True, text=True)
    if result.returncode != 0:
        return jsonify({"error": "Training failed", "detail": result.stderr}), 500
    engine.reload()
    import json as _json
    metrics_path = os.path.join(Config.MODEL_DIR, "metrics.json")
    metrics = {}
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = _json.load(f)
    return jsonify({"message": "Model trained successfully", "metrics": metrics})


@app.get("/api/model-metrics")
@role_required("admin")
def model_metrics():
    """Returns the last-trained model's evaluation metrics (accuracy, precision,
    recall, F1, MAE, RMSE, R2, confusion matrix, ROC curve, feature importance)
    without triggering a retrain. Used by the Model Performance dashboard."""
    import json as _json
    metrics_path = os.path.join(Config.MODEL_DIR, "metrics.json")
    if not os.path.exists(metrics_path):
        return jsonify({"error": "No trained model yet. Train a model first."}), 404
    with open(metrics_path) as f:
        metrics = _json.load(f)
    return jsonify(metrics)


@app.post("/api/predict")
@jwt_required()
def predict():
    data = request.get_json(force=True)
    try:
        result = engine.predict(data)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 400
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400

    student_id = data.get("student_id")
    if student_id:
        pred = Prediction(
            student_id=student_id,
            predicted_marks=result["predicted_marks"],
            pass_fail=result["pass_fail"],
            grade=result["grade"],
            risk_level=result["risk_level"],
            suggestions="|".join(result["suggestions"]),
        )
        db.session.add(pred)
        db.session.commit()
        _maybe_send_risk_alert(student_id, result)

    return jsonify(result)


def _maybe_send_risk_alert(student_id, result):
    """Fires an email to the student if notifications are on and the prediction
    is high-risk / failing / low-attendance. Failures are logged, never raised,
    so a broken SMTP config can't break the prediction response."""
    settings = EmailSettings.query.first()
    if not settings or not settings.notifications_enabled:
        return
    student = Student.query.filter_by(student_id=student_id).first()
    if not student or not student.email:
        return
    if not should_notify(result, student, settings.attendance_threshold or 75.0):
        return
    try:
        send_email(
            settings,
            student.email,
            subject=f"GradeSight alert — {student.name}, action recommended",
            html_body=risk_alert_html(student, result),
        )
    except EmailNotConfigured:
        pass
    except Exception as e:  # SMTP errors shouldn't break the predict response
        print(f"[email] failed to send risk alert to {student.email}: {e}")


# ---------------------------------------------------------------------------
# Email notifications (Admin-configurable SMTP settings)
# ---------------------------------------------------------------------------
def _get_or_create_email_settings():
    settings = EmailSettings.query.first()
    if not settings:
        settings = EmailSettings(id=1)
        db.session.add(settings)
        db.session.commit()
    return settings


@app.get("/api/email-settings")
@role_required("admin")
def get_email_settings():
    return jsonify(_get_or_create_email_settings().to_dict())


@app.put("/api/email-settings")
@role_required("admin")
def update_email_settings():
    settings = _get_or_create_email_settings()
    data = request.get_json(force=True)
    for field in ("smtp_host", "smtp_port", "smtp_username", "sender_email", "use_tls",
                  "notifications_enabled", "attendance_threshold"):
        if field in data:
            setattr(settings, field, data[field])
    # Only overwrite the password if a real (non-masked) value was sent.
    if data.get("smtp_password") and data["smtp_password"] != "********":
        settings.smtp_password = data["smtp_password"]
    db.session.commit()
    return jsonify(settings.to_dict())


@app.post("/api/email-settings/test")
@role_required("admin")
def test_email_settings():
    settings = _get_or_create_email_settings()
    data = request.get_json(force=True)
    to_address = data.get("to")
    if not to_address:
        return jsonify({"error": "Provide a 'to' address to send the test email to."}), 400
    try:
        send_email(
            settings,
            to_address,
            subject="GradeSight — test email",
            html_body="<p>This is a test email from your GradeSight Email Settings page. "
                       "If you received this, your SMTP configuration works.</p>",
        )
    except EmailNotConfigured as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to send: {e}"}), 502
    return jsonify({"message": f"Test email sent to {to_address}"})


# ---------------------------------------------------------------------------
# Student progress (single-student dashboard)
# ---------------------------------------------------------------------------
@app.get("/api/students/<student_id>/progress")
@jwt_required()
def student_progress(student_id):
    claims = get_jwt()
    if claims.get("role") == "student" and get_jwt_identity() != student_id:
        return jsonify({"error": "Unauthorized"}), 403

    student = Student.query.filter_by(student_id=student_id).first_or_404()
    history = (
        Prediction.query.filter_by(student_id=student_id)
        .order_by(Prediction.created_at.asc())
        .all()
    )
    latest = history[-1].to_dict() if history else None

    # Overall progress percentage: simple average of the normalized academic inputs.
    components = [
        student.attendance, student.internal_marks, student.assignment_marks,
        student.quiz_marks, student.previous_semester_marks,
    ]
    known = [c for c in components if c is not None]
    progress_percentage = round(sum(known) / len(known), 1) if known else None

    return jsonify({
        "student": student.to_dict(),
        "latest_prediction": latest,
        "prediction_history": [p.to_dict() for p in history],
        "progress_percentage": progress_percentage,
    })


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@app.get("/api/analytics")
@jwt_required()
def analytics():
    students = Student.query.all()
    marks = [s.final_exam_marks for s in students if s.final_exam_marks is not None]
    if not marks:
        return jsonify({"count": 0})

    passed = sum(1 for m in marks if m >= 40)
    failed = len(marks) - passed
    buckets = {"0-40": 0, "40-60": 0, "60-75": 0, "75-90": 0, "90-100": 0}
    for m in marks:
        if m < 40:
            buckets["0-40"] += 1
        elif m < 60:
            buckets["40-60"] += 1
        elif m < 75:
            buckets["60-75"] += 1
        elif m < 90:
            buckets["75-90"] += 1
        else:
            buckets["90-100"] += 1

    top = sorted(students, key=lambda s: (s.final_exam_marks or 0), reverse=True)[:5]
    low = sorted(students, key=lambda s: (s.final_exam_marks or 0))[:5]
    avg_attendance = sum((s.attendance or 0) for s in students) / len(students)

    # Gender distribution
    gender_dist = {}
    for s in students:
        g = s.gender or "Unspecified"
        gender_dist[g] = gender_dist.get(g, 0) + 1

    # Attendance distribution (bucketed, like marks)
    attendance_buckets = {"<60": 0, "60-75": 0, "75-85": 0, "85-95": 0, "95-100": 0}
    for s in students:
        a = s.attendance
        if a is None:
            continue
        if a < 60:
            attendance_buckets["<60"] += 1
        elif a < 75:
            attendance_buckets["60-75"] += 1
        elif a < 85:
            attendance_buckets["75-85"] += 1
        elif a < 95:
            attendance_buckets["85-95"] += 1
        else:
            attendance_buckets["95-100"] += 1

    # Subject-wise (component) averages — internal / assignment / quiz / previous semester
    def avg(attr):
        vals = [getattr(s, attr) for s in students if getattr(s, attr) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    subject_wise = {
        "Internal Marks": avg("internal_marks"),
        "Assignment Marks": avg("assignment_marks"),
        "Quiz Marks": avg("quiz_marks"),
        "Previous Semester": avg("previous_semester_marks"),
        "Final Exam": avg("final_exam_marks"),
    }

    # Latest prediction per student -> risk distribution + predicted-marks distribution
    latest_preds = {}
    for p in Prediction.query.order_by(Prediction.created_at.asc()).all():
        latest_preds[p.student_id] = p  # later rows overwrite earlier ones -> latest wins
    risk_dist = {"Low": 0, "Medium": 0, "High": 0}
    pred_buckets = {"0-40": 0, "40-60": 0, "60-75": 0, "75-90": 0, "90-100": 0}
    for p in latest_preds.values():
        if p.risk_level in risk_dist:
            risk_dist[p.risk_level] += 1
        pm = p.predicted_marks or 0
        if pm < 40:
            pred_buckets["0-40"] += 1
        elif pm < 60:
            pred_buckets["40-60"] += 1
        elif pm < 75:
            pred_buckets["60-75"] += 1
        elif pm < 90:
            pred_buckets["75-90"] += 1
        else:
            pred_buckets["90-100"] += 1
    high_risk_count = risk_dist["High"]

    return jsonify({
        "count": len(students),
        "average_marks": round(sum(marks) / len(marks), 2),
        "average_attendance": round(avg_attendance, 2),
        "pass_count": passed,
        "fail_count": failed,
        "pass_percent": round(passed / len(marks) * 100, 1),
        "fail_percent": round(failed / len(marks) * 100, 1),
        "high_risk_count": high_risk_count,
        "marks_distribution": buckets,
        "attendance_distribution": attendance_buckets,
        "gender_distribution": gender_dist,
        "subject_wise_averages": subject_wise,
        "prediction_risk_distribution": risk_dist,
        "prediction_marks_distribution": pred_buckets,
        "top_students": [{"name": s.name, "student_id": s.student_id, "marks": s.final_exam_marks} for s in top],
        "low_performing_students": [{"name": s.name, "student_id": s.student_id, "marks": s.final_exam_marks} for s in low],
    })


# ---------------------------------------------------------------------------
# PDF report
# ---------------------------------------------------------------------------
@app.get("/api/report/<student_id>")
@jwt_required()
def download_report(student_id):
    student = Student.query.filter_by(student_id=student_id).first_or_404()
    latest_pred = (
        Prediction.query.filter_by(student_id=student_id).order_by(Prediction.created_at.desc()).first()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Student Performance Report", styles["Title"]),
        Spacer(1, 12),
        Paragraph(f"Student: {student.name} ({student.student_id})", styles["Heading2"]),
        Spacer(1, 8),
    ]

    detail_rows = [
        ["Field", "Value"],
        ["Age", str(student.age)],
        ["Gender", str(student.gender)],
        ["Attendance", str(student.attendance)],
        ["Internal Marks", str(student.internal_marks)],
        ["Assignment Marks", str(student.assignment_marks)],
        ["Quiz Marks", str(student.quiz_marks)],
        ["Study Hours/Day", str(student.study_hours_per_day)],
        ["Previous Semester Marks", str(student.previous_semester_marks)],
        ["Final Exam Marks", str(student.final_exam_marks)],
    ]
    table = Table(detail_rows, colWidths=[200, 250])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements += [table, Spacer(1, 16)]

    if latest_pred:
        elements.append(Paragraph("Latest Prediction", styles["Heading2"]))
        pred_rows = [
            ["Predicted Marks", str(latest_pred.predicted_marks)],
            ["Pass / Fail", latest_pred.pass_fail],
            ["Grade", latest_pred.grade],
            ["Risk Level", latest_pred.risk_level],
        ]
        ptable = Table(pred_rows, colWidths=[200, 250])
        ptable.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        elements += [ptable, Spacer(1, 12)]
        elements.append(Paragraph("Suggestions:", styles["Heading3"]))
        for s in latest_pred.suggestions.split("|"):
            elements.append(Paragraph(f"- {s}", styles["Normal"]))
    else:
        elements.append(Paragraph("No prediction on record yet.", styles["Normal"]))

    doc.build(elements)
    buf.seek(0)
    return send_file(
        buf, mimetype="application/pdf", as_attachment=True,
        download_name=f"{student_id}_report.pdf",
    )


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "model_loaded": engine.loaded})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
