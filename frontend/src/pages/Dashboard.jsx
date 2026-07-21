import { useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import Pagination from "../components/Pagination";
import SkeletonRows from "../components/SkeletonRows";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { role, identity } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const fileRef = useRef();

  // CSV upload results (Feature: better CSV upload)
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Table sorting + pagination
  const [sortKey, setSortKey] = useState("final_exam_marks");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const load = async (q = "") => {
    setLoading(true);
    try {
      const res = await client.get("/students", { params: q ? { q } : {} });
      setStudents(res.data);
    } catch {
      toast.error("Could not load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(query);
  };

  const removeStudent = async (id) => {
    if (!confirm(`Delete student ${id}?`)) return;
    try {
      await client.delete(`/students/${id}`);
      toast.success(`Deleted ${id}.`);
      load(query);
    } catch {
      toast.error("Delete failed.");
    }
  };

  const uploadCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await client.post("/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResult(res.data);
      toast.success(`Added ${res.data.added} of ${res.data.total_rows} rows.`);
      load(query);
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      fileRef.current.value = "";
    }
  };

  const downloadErrorReport = () => {
    if (!uploadResult?.error_report_csv) return;
    const blob = new Blob([uploadResult.error_report_csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "csv_upload_errors.csv";
    a.click();
  };

  const trainModel = async () => {
    setTraining(true);
    try {
      const res = await client.post("/train-model");
      toast.success(`Trained. Best regressor: ${res.data.metrics.best_regressor} (R²=${res.data.metrics.best_regressor_r2})`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Training failed");
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

  const sortBy = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    const copy = [...students];
    copy.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [students, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortHeader = ({ label, field }) => (
    <th className="sortable" onClick={() => sortBy(field)}>
      {label}
      {sortKey === field && <span className="arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

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
          <button className="btn btn-outline" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload CSV"}
          </button>
          <input type="file" accept=".csv" ref={fileRef} onChange={uploadCsv} hidden />
          <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-gold" onClick={trainModel} disabled={training}>
            {training ? "Training…" : "Train model"}
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <p className="eyebrow" style={{ margin: 0 }}>CSV upload results</p>
            <button className="btn btn-outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setUploadResult(null)}>Dismiss</button>
          </div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div>
              <div className="stat-label">Total rows</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{uploadResult.total_rows}</div>
            </div>
            <div>
              <div className="stat-label">Added</div>
              <div className="stat-value" style={{ fontSize: 22, color: "var(--green)" }}>{uploadResult.added}</div>
            </div>
            <div>
              <div className="stat-label">Duplicate IDs</div>
              <div className="stat-value" style={{ fontSize: 22, color: "var(--gold)" }}>{uploadResult.duplicate_ids.length}</div>
            </div>
            <div>
              <div className="stat-label">Invalid / missing</div>
              <div className="stat-value" style={{ fontSize: 22, color: "var(--red)" }}>
                {uploadResult.invalid_rows.length + uploadResult.missing_fields_rows.length}
              </div>
            </div>
          </div>
          {uploadResult.error_report_csv && (
            <button className="btn btn-outline" style={{ marginBottom: 16 }} onClick={downloadErrorReport}>
              Download error report (CSV)
            </button>
          )}
          {uploadResult.preview?.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Preview (first {uploadResult.preview.length} rows)</p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      {Object.keys(uploadResult.preview[0]).map((k) => <th key={k}>{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => <td key={j}>{String(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {!loading && students.length === 0 ? (
          <p className="empty-state">No students yet. Upload a CSV or add one from the Predict page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortHeader label="ID" field="student_id" />
                <SortHeader label="Name" field="name" />
                <SortHeader label="Attendance" field="attendance" />
                <SortHeader label="Final marks" field="final_exam_marks" />
                <th>Result</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={6} cols={6} />
              ) : (
                paged.map((s) => (
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
                ))
              )}
            </tbody>
          </table>
        )}
        {!loading && students.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
    </div>
  );
}
