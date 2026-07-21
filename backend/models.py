from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Admin(db.Model):
    __tablename__ = "admins"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Student(db.Model):
    __tablename__ = "students"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    age = db.Column(db.Integer)
    gender = db.Column(db.String(20))
    attendance = db.Column(db.Float)
    internal_marks = db.Column(db.Float)
    assignment_marks = db.Column(db.Float)
    quiz_marks = db.Column(db.Float)
    study_hours_per_day = db.Column(db.Float)
    previous_semester_marks = db.Column(db.Float)
    participation = db.Column(db.String(20))
    internet_access = db.Column(db.String(10))
    parent_education = db.Column(db.String(50))
    final_exam_marks = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "student_id": self.student_id,
            "name": self.name,
            "email": self.email,
            "age": self.age,
            "gender": self.gender,
            "attendance": self.attendance,
            "internal_marks": self.internal_marks,
            "assignment_marks": self.assignment_marks,
            "quiz_marks": self.quiz_marks,
            "study_hours_per_day": self.study_hours_per_day,
            "previous_semester_marks": self.previous_semester_marks,
            "participation": self.participation,
            "internet_access": self.internet_access,
            "parent_education": self.parent_education,
            "final_exam_marks": self.final_exam_marks,
        }


class Prediction(db.Model):
    __tablename__ = "predictions"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), nullable=False)
    predicted_marks = db.Column(db.Float)
    pass_fail = db.Column(db.String(10))
    grade = db.Column(db.String(5))
    risk_level = db.Column(db.String(20))
    suggestions = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "student_id": self.student_id,
            "predicted_marks": self.predicted_marks,
            "pass_fail": self.pass_fail,
            "grade": self.grade,
            "risk_level": self.risk_level,
            "suggestions": self.suggestions.split("|") if self.suggestions else [],
            "created_at": self.created_at.isoformat(),
        }


class EmailSettings(db.Model):
    """Singleton-style table (always id=1) holding the admin's SMTP config.
    Password is stored as given; for a real production deploy this should be
    moved to a secrets manager per the README security notes."""
    __tablename__ = "email_settings"
    id = db.Column(db.Integer, primary_key=True)
    smtp_host = db.Column(db.String(255))
    smtp_port = db.Column(db.Integer, default=587)
    smtp_username = db.Column(db.String(255))
    smtp_password = db.Column(db.String(255))
    sender_email = db.Column(db.String(255))
    use_tls = db.Column(db.Boolean, default=True)
    notifications_enabled = db.Column(db.Boolean, default=False)
    attendance_threshold = db.Column(db.Float, default=75.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, mask_password=True):
        return {
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "smtp_username": self.smtp_username,
            "smtp_password": "********" if (mask_password and self.smtp_password) else self.smtp_password,
            "sender_email": self.sender_email,
            "use_tls": self.use_tls,
            "notifications_enabled": self.notifications_enabled,
            "attendance_threshold": self.attendance_threshold,
            "configured": bool(self.smtp_host and self.smtp_username and self.smtp_password),
        }
