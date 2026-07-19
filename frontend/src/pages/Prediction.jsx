import { useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const initial = {
  student_id: "",
  age: 20,
  attendance: 75,
  internal_marks: 60,
  assignment_marks: 60,
  quiz_marks: 60,
  study_hours_per_day: 3,
  previous_semester_marks: 60,
  gender: "Male",
  participation: "Medium",
  internet_access: "Yes",
  parent_education: "Graduate",
};

export default function Prediction() {
  const { identity } = useAuth();
  const [form, setForm] = useState({ ...initial, student_id: identity || "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => {
    const val = e.target.type === "number" ? parseFloat(e.target.value) : e.target.value;
    setForm({ ...form, [k]: val });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await client.post("/predict", form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const numberFields = [
    ["age", "Age"],
    ["attendance", "Attendance (%)"],
    ["internal_marks", "Internal marks"],
    ["assignment_marks", "Assignment marks"],
    ["quiz_marks", "Quiz marks"],
    ["study_hours_per_day", "Study hours / day"],
    ["previous_semester_marks", "Previous semester marks"],
  ];

  return (
    <div className="container">
      <p className="eyebrow">Prediction</p>
      <h2 className="section-title">Forecast a student's final marks</h2>
      <p className="section-sub">Enter current-term inputs to get a predicted outcome and tailored suggestions.</p>

      <div className="grid grid-2">
        <div className="card">
          <form onSubmit={submit}>
            <div className="field">
              <label>Student ID (optional — saves prediction to record)</label>
              <input value={form.student_id} onChange={set("student_id")} />
            </div>
            <div className="grid grid-2">
              {numberFields.map(([key, label]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input type="number" step="0.1" value={form[key]} onChange={set(key)} required />
                </div>
              ))}
              <div className="field">
                <label>Gender</label>
                <select value={form.gender} onChange={set("gender")}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div className="field">
                <label>Participation</label>
                <select value={form.participation} onChange={set("participation")}>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
              <div className="field">
                <label>Internet access</label>
                <select value={form.internet_access} onChange={set("internet_access")}>
                  <option>Yes</option><option>No</option>
                </select>
              </div>
              <div className="field">
                <label>Parent education</label>
                <select value={form.parent_education} onChange={set("parent_education")}>
                  <option>High School</option><option>Graduate</option>
                  <option>Post Graduate</option><option>Doctorate</option>
                </select>
              </div>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <button className="btn btn-block" disabled={loading}>
              {loading ? "Predicting…" : "Predict performance"}
            </button>
          </form>
        </div>

        <div>
          {!result && (
            <div className="card empty-state">Fill in the form to see a prediction here.</div>
          )}
          {result && (
            <div className="card">
              <div className="result-hero">
                <div className="grade-stamp" style={{ position: "static", transform: "rotate(-6deg)" }}>
                  {result.grade}
                </div>
                <div>
                  <div className="stat-value">{result.predicted_marks}</div>
                  <div className="stat-label">Predicted final marks</div>
                </div>
              </div>

              <div className="grid grid-3" style={{ marginBottom: 20 }}>
                <div>
                  <div className="stat-label">Result</div>
                  <span className={`badge ${result.pass_fail === "Pass" ? "badge-pass" : "badge-fail"}`}>
                    {result.pass_fail}
                  </span>
                </div>
                <div>
                  <div className="stat-label">Risk level</div>
                  <span className={`badge badge-risk-${result.risk_level.toLowerCase()}`}>{result.risk_level}</span>
                </div>
                <div>
                  <div className="stat-label">Recommended study hrs/day</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{result.recommended_study_hours}</div>
                </div>
              </div>

              <p className="eyebrow">Weak areas</p>
              <ul className="list-plain" style={{ marginBottom: 16 }}>
                {result.weak_areas.map((w) => <li key={w}>{w}</li>)}
              </ul>

              <p className="eyebrow">Strengths</p>
              <ul className="list-plain" style={{ marginBottom: 16 }}>
                {result.strengths.map((w) => <li key={w}>{w}</li>)}
              </ul>

              <p className="eyebrow">Suggestions</p>
              <ul className="list-plain">
                {result.suggestions.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
