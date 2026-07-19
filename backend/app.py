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
from ml_utils import PredictionEngine
from models import Admin, Prediction, Student, db

app = Flask(__name__)
app.config.from_object(Config)
CORS(
    app,
    resources={r"/api/*": {"origins": "http://localhost:5173"}},
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
@app.post("/api/upload-csv")
@role_required("admin")
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    df = pd.read_csv(file)
    added, skipped = 0, 0
    for _, row in df.iterrows():
        sid = str(row.get("student_id", "")).strip()
        if not sid or Student.query.filter_by(student_id=sid).first():
            skipped += 1
            continue
        pw_hash = bcrypt.generate_password_hash("changeme123").decode("utf-8")
        s = Student(
            student_id=sid,
            name=row.get("name", sid),
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
        added += 1
    db.session.commit()
    return jsonify({"added": added, "skipped": skipped})


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

    return jsonify(result)


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

    return jsonify({
        "count": len(students),
        "average_marks": round(sum(marks) / len(marks), 2),
        "average_attendance": round(avg_attendance, 2),
        "pass_count": passed,
        "fail_count": failed,
        "marks_distribution": buckets,
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
