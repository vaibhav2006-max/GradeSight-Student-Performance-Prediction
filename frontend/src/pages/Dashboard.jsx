import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { role, identity } = useAuth();
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [training, setTraining] = useState(false);
  const fileRef = useRef();

  const load = async (q = "") => {
    setLoading(true);
    try {
      const res = await client.get("/students", { params: q ? { q } : {} });
      setStudents(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSearch = (e) => {
    e.preventDefault();
    load(query);
  };

  const removeStudent = async (id) => {
    if (!confirm(`Delete student ${id}?`)) return;
    await client.delete(`/students/${id}`);
    load(query);
  };

  const uploadCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setMessage("Uploading…");
    try {
      const res = await client.post("/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(`Added ${res.data.added} students, skipped ${res.data.skipped} duplicates.`);
      load(query);
    } catch (err) {
      setMessage(err.response?.data?.error || "Upload failed");
    }
    fileRef.current.value = "";
  };

  const trainModel = async () => {
    setTraining(true);
    setMessage("Training models — this may take a moment…");
    try {
      const res = await client.post("/train-model");
      setMessage(`Trained. Best regressor: ${res.data.metrics.best_regressor} (R2=${res.data.metrics.best_regressor_r2})`);
    } catch (err) {
      setMessage(err.response?.data?.error || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  const exportCsv = async () => {
    const res = await client.get("/export-csv", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_export.csv";
    a.click();
  };

  if (role === "student") {
    const me = students.find((s) => s.student_id === identity);
    return (
      <div className="container">
        <p className="eyebrow">Your profile</p>
        <h2 className="section-title">{identity}</h2>
        {loading ? (
          <p>Loading…</p>
        ) : me ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="grid grid-3">
              {Object.entries(me).map(([k, v]) => (
                <div key={k}>
                  <div className="stat-label">{k.replace(/_/g, " ")}</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{v ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-state">Your admin hasn't added your academic record yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <p className="eyebrow">Admin dashboard</p>
      <h2 className="section-title">Student roster</h2>
      <p className="section-sub">{students.length} students on record</p>

      <div className="toolbar">
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
          <input
            className="search-input"
            placeholder="Search name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-outline">Search</button>
        </form>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={() => fileRef.current.click()}>Upload CSV</button>
          <input type="file" accept=".csv" ref={fileRef} onChange={uploadCsv} hidden />
          <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-gold" onClick={trainModel} disabled={training}>
            {training ? "Training…" : "Train model"}
          </button>
        </div>
      </div>

      {message && <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>{message}</div>}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {loading ? (
          <p style={{ padding: 24 }}>Loading…</p>
        ) : students.length === 0 ? (
          <p className="empty-state">No students yet. Upload a CSV or add one from the Predict page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Attendance</th><th>Final marks</th><th>Result</th><th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td className="mono">{s.student_id}</td>
                  <td>{s.name}</td>
                  <td>{s.attendance ?? "—"}</td>
                  <td>{s.final_exam_marks ?? "—"}</td>
                  <td>
                    {s.final_exam_marks != null && (
                      <span className={`badge ${s.final_exam_marks >= 40 ? "badge-pass" : "badge-fail"}`}>
                        {s.final_exam_marks >= 40 ? "Pass" : "Fail"}
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => removeStudent(s.student_id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
