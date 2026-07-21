# GradeSight — AI-Powered Student Performance Prediction System

A full-stack application that predicts a student's final exam marks and pass/fail
outcome from academic and behavioral data, and returns personalized, actionable
suggestions. Built with **React**, **Flask**, **Scikit-learn**, and **SQLite/MySQL**.

---
## Screenshots

### HomePage
![HomePage](screenshot/homepage.png.png)

### Dashboard
![Dashboard](screenshot/dashboard.png.png)

### Progress
![Progress](screenshot/progress.png)


### Analytics
![Analytics](screenshot/analytics.png.png)

### Prediction
![Prediction](screenshot/predict.png.png)

### Report
![Report](screenshot/report.png.png)

### ModelPerformance
![ModelPerformance](screenshot/modelperformance.png)

### EmailSetting
![EmailSetting](screenshot/emailsetting.png)

### GradeSight - Student Performance Prediction System

An AI-powered web application that predicts student academic performance using Machine Learning. 
The system allows administrators to upload student data, train ML models, generate predictions, 
and manage student records through an interactive dashboard.

---

### Features

- 📂 Upload student data using CSV
- 👨‍🎓 Student management dashboard
- 🔍 Search students by Name or ID
- 📊 Student performance prediction
- 🤖 Train Machine Learning models
- 📈 Analytics dashboard
- 📄 Export student records to CSV
- 📑 Generate PDF reports
- 🔐 JWT Authentication (Admin Login)
- 📱 Responsive user interface

---

## Features

- **Auth & roles** — student/admin JWT login, registration, protected routes
- **Student CRUD** — roster with search, sorting, pagination
- **CSV import/export** — validated bulk import with a per-row error report and preview
- **ML prediction** — Linear Regression / Decision Tree / Random Forest (best auto-selected)
  + Logistic Regression pass/fail, with confidence %, weak/strong areas, and an
  estimated-improvement simulation
- **Model Performance dashboard** (admin) — accuracy, precision, recall, F1, MAE, RMSE, R²,
  confusion matrix, ROC curve, feature importance, model comparison — retrain from the same screen
- **Student Progress dashboard** — radar/bar/line charts, a performance gauge, and
  prediction-history trend for an individual student
- **AI study suggestions** — dynamic strengths/weaknesses/recommendations and estimated
  improvement, generated per-prediction from the student's own data
- **Email notifications** (admin-configurable SMTP) — auto-alerts a student when they're
  high risk, predicted to fail, or under an attendance threshold; includes a test-email tool
- **Analytics dashboard** — pass/fail, gender & attendance distributions, subject-wise
  averages with a heatmap strip, prediction-risk distribution, top/low performers
- **PDF reports** — downloadable per-student report via ReportLab
- **UI polish** — dark mode, toast notifications, skeleton loaders, sortable/paginated tables

### What was intentionally scoped out
To keep everything actually working end-to-end rather than padding the file count,
Teacher/Parent dashboards and in-app real-time notifications were **not** built.
Everything listed above is implemented and wired end-to-end (no placeholder code).

---

## Architecture

```
 ┌────────────────┐      HTTPS/JSON       ┌──────────────────┐      SQL      ┌──────────────┐
 │  React (Vite)  │  ───────────────────▶ │   Flask REST API │ ────────────▶ │ SQLite/MySQL │
 │  frontend/src  │  ◀─────────────────── │    backend/app.py│ ◀──────────── │              │
 └────────────────┘        JWT auth       └──────────────────┘               └──────────────┘
                                                    │
                                                    │ joblib.load
                                                    ▼
                                           ┌──────────────────┐
                                           │  model/*.pkl      │  (trained by model/train_model.py)
                                           │  metrics.json      │
                                           └──────────────────┘
                                                    │
                                                    ▼ (optional, if notifications enabled)
                                           ┌──────────────────┐
                                           │   SMTP server      │  (backend/email_utils.py)
                                           └──────────────────┘
```

The frontend never touches the ML artifacts directly — every prediction, metric, and
chart is served through the Flask API, which loads the trained model once (`PredictionEngine`
in `backend/ml_utils.py`) and reuses it across requests.

---

## Project structure

```
Student-Performance/
├── dataset/
│   ├── generate_dataset.py     # creates students.csv (1200 synthetic records)
│   └── students.csv
├── model/
│   ├── train_model.py          # trains + compares models, saves best via joblib
│   ├── best_model.pkl / classifier.pkl / scaler.pkl / encoders.pkl
│   ├── feature_columns.json
│   └── metrics.json            # regression + classification metrics, ROC curve, feature importance
├── backend/
│   ├── app.py                  # Flask REST API
│   ├── config.py
│   ├── models.py                # SQLAlchemy models (Student, Admin, Prediction, EmailSettings)
│   ├── ml_utils.py              # inference + AI suggestion engine
│   ├── email_utils.py           # SMTP notification helper
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # React app (Vite)
│   ├── src/
│   │   ├── pages/                # Landing, Dashboard, Prediction, StudentProgress,
│   │   │                         # Analytics, ModelPerformance, EmailSettings, Reports, ...
│   │   ├── components/           # Navbar, ProtectedRoute, Pagination, SkeletonRows
│   │   ├── context/              # AuthContext, ThemeContext, ToastContext
│   │   └── api/client.js
│   ├── vercel.json
│   └── .env.example
├── database.sql                 # MySQL schema (optional — SQLite is default)
├── render.yaml                  # Render deployment config for the backend
└── README.md
```

---

## Author

**Vaibhav Mishra**

GitHub:
https://github.com/vaibhav2006-max

## 1. Generate the dataset

```bash
cd dataset
pip install pandas numpy
python generate_dataset.py
```

Creates `dataset/students.csv` with 1,200 rows.

## 2. Train the models

```bash
cd ../model
pip install scikit-learn joblib pandas numpy
python train_model.py
```

Trains Linear Regression, Decision Tree Regressor, and Random Forest Regressor
(compared by R²) plus a Logistic Regression pass/fail classifier. Saves the best
regressor, the classifier, the scaler, and the encoders as `.pkl` files, and
writes `metrics.json` with evaluation metrics: R², MAE, RMSE, accuracy, precision,
recall, F1, a confusion matrix, an ROC curve + AUC, and per-model feature importance.

You can also retrain later from the Admin **Dashboard** or **Model Performance** page's
"Train model" / "Retrain models" button — it runs this same script via the API.

## 3. Run the backend

```bash
cd ../backend
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env   # then edit JWT_SECRET_KEY etc. and load it into your shell/host
python app.py
```

The API runs at `http://127.0.0.1:5000`. On first run it creates the SQLite
database and seeds a default admin account:

```
username: admin
password: admin123
```

**To use MySQL instead of SQLite:**
1. `mysql -u root -p < ../database.sql` to create the schema.
2. `pip install pymysql`
3. Set an environment variable before starting the server:
   ```bash
   export DATABASE_URL="mysql+pymysql://root:yourpassword@localhost:3306/student_performance"
   python app.py
   ```

**To enable email notifications:** log in as admin, open **Email Settings**, fill in your
SMTP host/port/username/password/sender address, send yourself a test email, then flip on
"Enable automatic notifications". Nothing is sent until that toggle is on.

## 4. Run the frontend

```bash
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. The frontend calls the API at the URL set in
`frontend/.env` (`VITE_API_URL`, defaults to `http://127.0.0.1:5000/api`).

To build for production:
```bash
npm run build
```

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | — | Student self-registration |
| POST | `/api/login/student` | — | Student login → JWT |
| POST | `/api/login/admin` | — | Admin login → JWT |
| GET | `/api/me` | JWT | Current identity/role |
| GET | `/api/students` | JWT | List/search students |
| GET | `/api/students/<id>` | JWT | Get one student |
| GET | `/api/students/<id>/progress` | JWT | Progress-dashboard data: profile, latest prediction, prediction history, progress % |
| POST | `/api/students` | Admin | Add a student |
| PUT | `/api/students/<id>` | Admin | Update a student |
| DELETE | `/api/students/<id>` | Admin | Delete a student |
| POST | `/api/upload-csv` | Admin | Bulk import with per-row validation, duplicate/invalid/missing breakdown, preview, and error report |
| GET | `/api/export-csv` | JWT | Export all students to CSV |
| POST | `/api/train-model` | Admin | Retrain and reload the ML pipeline |
| GET | `/api/model-metrics` | Admin | Accuracy/precision/recall/F1/MAE/RMSE/R², confusion matrix, ROC curve, feature importance, model comparison — without retraining |
| POST | `/api/predict` | JWT | Predict marks / pass-fail / suggestions / confidence / estimated improvement |
| GET | `/api/analytics` | JWT | Cohort-level stats for the Analytics page |
| GET | `/api/email-settings` | Admin | Current SMTP settings (password masked) |
| PUT | `/api/email-settings` | Admin | Update SMTP settings / notification toggle / attendance threshold |
| POST | `/api/email-settings/test` | Admin | Send a test email to verify SMTP config |
| GET | `/api/report/<id>` | JWT | Download a PDF report |
| GET | `/api/health` | — | Health check |

### Example: predict

```bash
curl -X POST http://127.0.0.1:5000/api/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "student_id": "STU9001", "age": 20, "attendance": 82,
    "internal_marks": 70, "assignment_marks": 65, "quiz_marks": 60,
    "study_hours_per_day": 2.5, "previous_semester_marks": 68,
    "gender": "Male", "participation": "Medium",
    "internet_access": "Yes", "parent_education": "Graduate"
  }'
```

Response includes `predicted_marks`, `pass_fail`, `grade`, `performance_percentage`,
`confidence_percent`, `weak_areas`, `strengths`, `suggestions`, `risk_level`,
`recommended_study_hours`, and `estimated_improvement`.

---

## Notes on data preprocessing (in `model/train_model.py`)

- **Missing values:** numeric columns filled with median, categorical with mode.
- **Encoding:** categorical fields (gender, participation, internet access, parent
  education) label-encoded; encoders saved and reused at inference time, with
  unseen categories safely mapped to a fallback class.
- **Scaling:** all features standardized with `StandardScaler` before training.
- **Split:** 80/20 train/test split, `random_state=42` for reproducibility.
- **Model selection:** the regressor with the highest R² on the held-out test
  set is automatically promoted as `best_model.pkl`.
- **Evaluation metrics:** `model/metrics.json` also stores precision/recall/F1,
  a confusion matrix, and a downsampled ROC curve + AUC for the pass/fail
  classifier, plus per-model feature importance (`feature_importances_` for
  the tree models, `abs(coef_)` for Linear Regression). The Admin-only
  **Model Performance** page reads this via `GET /api/model-metrics` and lets
  you retrain from the same screen.
- **Estimated improvement:** at prediction time, `ml_utils.py` simulates a student
  acting on the generated suggestions (attendance ≥85%, +1.5 study hrs/day, +10 on
  quiz/assignment, +5 on internals) and re-runs the model to report a realistic
  marks delta, rather than a made-up constant.

---

## Screenshots

Not included in this repo — after running the app locally (`npm run dev` +
`python app.py`), the key screens to capture for a portfolio/README are: Landing,
Dashboard (roster), Prediction result, Student Progress, Model Performance, and
Analytics. Drop PNGs into a `docs/screenshots/` folder and reference them here,
e.g. `![Dashboard](docs/screenshots/dashboard.png)`.

---

## Deployment

### Frontend → Vercel
1. Push this repo to GitHub.
2. In Vercel, "Import Project" → select the repo → set **Root Directory** to `frontend`.
3. Vercel auto-detects `vercel.json` (build command `npm run build`, output `dist`).
4. Add an environment variable `VITE_API_URL` pointing at your deployed backend,
   e.g. `https://gradesight-api.onrender.com/api`.

### Backend → Render
1. In Render, "New" → "Blueprint" → point at this repo; it will read `render.yaml`.
   (Or manually: New Web Service, root directory `backend`, build command
   `pip install -r requirements.txt`, start command `gunicorn app:app --bind 0.0.0.0:$PORT`.)
2. Set environment variables: `JWT_SECRET_KEY` (Render can auto-generate it),
   `CORS_ORIGINS` = your Vercel URL (e.g. `https://gradesight.vercel.app`), and
   optionally `DATABASE_URL` if using MySQL instead of the default SQLite file.
3. SQLite on Render's free tier is **ephemeral** (resets on redeploy) — use MySQL
   (e.g. PlanetScale, Railway, or Render's managed Postgres via a MySQL-compatible
   driver swap) for anything you need to persist.
4. After the first deploy, SSH/shell in (or hit any endpoint once) to confirm
   `db.create_all()` seeded the default admin, then change that password immediately.

### Environment variables summary

| Var | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | frontend | Base URL of the deployed API |
| `JWT_SECRET_KEY` | backend | Signs JWTs — must be a real secret in production |
| `DATABASE_URL` | backend | Optional MySQL connection string (else SQLite file) |
| `CORS_ORIGINS` | backend | Comma-separated list of allowed frontend origins |

---

## Security notes for production use

This is a learning/demo-grade build. Before deploying publicly:
- Replace `JWT_SECRET_KEY` and the default admin password.
- Turn off Flask debug mode and run behind a production WSGI server — already
  wired up via `gunicorn` in `render.yaml` / `requirements.txt`.
- Add HTTPS, rate limiting, and input validation hardening.
- Move secrets (including SMTP credentials) out of the database/`config.py` into
  environment variables or a secrets manager for anything beyond a class project.
- Restrict `CORS_ORIGINS` to your real frontend domain(s) only.

---

## Future scope

- Teacher and parent dashboards with scoped visibility
- In-app real-time notifications (websocket) alongside email
- Excel (.xlsx) import/export in addition to CSV
- Multi-semester history and true time-series attendance/marks trends
  (current Progress trend charts predicted-marks history from stored predictions;
  a dedicated per-term snapshot table would let attendance/marks themselves be
  plotted over time too)
- Role-based fine-grained permissions (e.g. teaching assistants)
- Automated CI (lint + a smoke-test suite hitting the Flask test client)
