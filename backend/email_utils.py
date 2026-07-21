"""Lightweight SMTP mailer for GradeSight.

Uses the standard-library smtplib/email packages rather than Flask-Mail so no
new dependency is required. Settings are read from the EmailSettings table
(configured on the Admin -> Email Settings page) rather than from
environment variables, so an admin can update them at runtime.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


class EmailNotConfigured(Exception):
    pass


def _build_message(sender, to, subject, html_body):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    return msg


def send_email(settings, to_address, subject, html_body):
    """settings: an EmailSettings row (or any object with the same attrs).
    Raises EmailNotConfigured or smtplib exceptions on failure."""
    if not (settings and settings.smtp_host and settings.smtp_username and settings.smtp_password and settings.sender_email):
        raise EmailNotConfigured("SMTP settings are incomplete. Configure them on the Email Settings page.")

    msg = _build_message(settings.sender_email, to_address, subject, html_body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port or 587, timeout=15) as server:
        if settings.use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.sender_email, [to_address], msg.as_string())


def risk_alert_html(student, prediction_result):
    """Builds the notification body for a high-risk / failing / low-attendance student."""
    suggestions = "".join(f"<li>{s}</li>" for s in prediction_result.get("suggestions", []))
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2 style="color:#a6403a;">Performance Alert — {student.name} ({student.student_id})</h2>
      <p>This is an automated notice from GradeSight. The latest prediction flagged this
      student for attention:</p>
      <table cellpadding="6" style="border-collapse: collapse;">
        <tr><td><strong>Predicted marks</strong></td><td>{prediction_result.get('predicted_marks')}</td></tr>
        <tr><td><strong>Pass / Fail</strong></td><td>{prediction_result.get('pass_fail')}</td></tr>
        <tr><td><strong>Risk level</strong></td><td>{prediction_result.get('risk_level')}</td></tr>
        <tr><td><strong>Recommended study hours/day</strong></td><td>{prediction_result.get('recommended_study_hours')}</td></tr>
      </table>
      <p><strong>Suggestions:</strong></p>
      <ul>{suggestions}</ul>
      <p style="color:#445070; font-size: 12px;">Sent automatically by GradeSight based on your Email Settings thresholds.</p>
    </div>
    """


def should_notify(prediction_result, student, threshold_attendance):
    """Returns True if this prediction/student combination should trigger an email,
    per the spec: high risk, prediction below pass marks, or attendance below threshold."""
    if prediction_result.get("risk_level") == "High":
        return True
    if prediction_result.get("pass_fail") == "Fail":
        return True
    if student.attendance is not None and student.attendance < threshold_attendance:
        return True
    return False
