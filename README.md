## Screenshots

### HomePage
![HomePage](screenshots/homepage.png.png)

### Dashboard
![Dashboard](screenshots/dashboard.png.png)

### Analytics
![Analytics](screenshots/analytics.png.png)

### Prediction
![Prediction](screenshots/predict.png.png)

### Report
![Report](screenshots/report.png.png)

# GradeSight — AI-Powered Student Performance Prediction System

A full-stack application that predicts a student's final exam marks and pass/fail
outcome from academic and behavioral data, and returns personalized, actionable
suggestions. Built with **React**, **Flask**, **Scikit-learn**, and **SQLite/MySQL**.

---

## What's included

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite, React Router, Axios, Chart.js | Custom design system (see `frontend/src/index.css`) |
| Backend | Flask, Flask-JWT-Extended, Flask-Bcrypt, Flask-SQLAlchemy | REST API, JWT auth, PDF generation via ReportLab |
| ML | Scikit-learn, Pandas, NumPy, Joblib | Linear Regression, Decision Tree, Random Forest (best auto-selected) + Logistic Regression for pass/fail |
| Database | SQLite (default) / MySQL (optional) | Schema in `database.sql`; SQLite needs zero setup |

### Pages
Landing · Student Login · Admin Login · Register · Dashboard (roster / student profile)
· Prediction · Analytics (Chart.js) · Reports (PDF download)

### What was intentionally scoped out
To keep everything actually working end-to-end rather than padding the file count,
the following extras from a "kitchen sink" spec were **not** built: Teacher/Parent
dashboards, dark mode, in-app notifications, emailed reports, and Excel export.
Everything else — auth, CRUD, CSV import/export, model training, prediction,
analytics charts, and PDF reports — is fully implemented and tested.

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
│   └── metrics.json
├── backend/
│   ├── app.py                  # Flask REST API
│   ├── config.py
│   ├── models.py                # SQLAlchemy models
│   ├── ml_utils.py              # inference + suggestion engine
│   └── requirements.txt
├── frontend/                    # React app (Vite)
│   └── src/...
├── database.sql                 # MySQL schema (optional — SQLite is default)
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
writes `metrics.json` with evaluation metrics (R², MAE, RMSE, accuracy).

You can also retrain later from the Admin Dashboard's **"Train model"** button —
it runs this same script via the API.

## 3. Run the backend

```bash
cd ../backend
python -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
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
| POST | `/api/students` | Admin | Add a student |
| PUT | `/api/students/<id>` | Admin | Update a student |
| DELETE | `/api/students/<id>` | Admin | Delete a student |
| POST | `/api/upload-csv` | Admin | Bulk import students from CSV |
| GET | `/api/export-csv` | JWT | Export all students to CSV |
| POST | `/api/train-model` | Admin | Retrain and reload the ML pipeline |
| POST | `/api/predict` | JWT | Predict marks / pass-fail / suggestions |
| GET | `/api/analytics` | JWT | Cohort-level stats for the Analytics page |
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
`weak_areas`, `strengths`, `suggestions`, `risk_level`, and `recommended_study_hours`.

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

---

## Security notes for production use

This is a learning/demo-grade build. Before deploying publicly:
- Replace `JWT_SECRET_KEY` and the default admin password.
- Turn off Flask debug mode and run behind a production WSGI server (gunicorn/uwsgi).
- Add HTTPS, rate limiting, and input validation hardening.
- Move secrets out of `config.py` into environment variables / a secrets manager.
