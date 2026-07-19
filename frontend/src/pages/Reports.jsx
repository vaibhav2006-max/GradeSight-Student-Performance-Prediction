import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Reports() {
  const { role, identity } = useAuth();
  const [students, setStudents] = useState([]);
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    client.get("/students").then((res) => setStudents(res.data));
  }, []);

  const visible = role === "student" ? students.filter((s) => s.student_id === identity) : students;

  const download = async (id) => {
    setDownloading(id);
    try {
      const res = await client.get(`/report/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}_report.pdf`;
      a.click();
    } finally {
      setDownloading("");
    }
  };

  return (
    <div className="container">
      <p className="eyebrow">Reports</p>
      <h2 className="section-title">Downloadable PDF reports</h2>
      <p className="section-sub">
        Includes academic details, latest prediction, and personalized suggestions.
      </p>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {visible.length === 0 ? (
          <p className="empty-state">No student records available yet.</p>
        ) : (
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Final marks</th><th></th></tr></thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.student_id}>
                  <td className="mono">{s.student_id}</td>
                  <td>{s.name}</td>
                  <td>{s.final_exam_marks ?? "—"}</td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: "6px 14px", fontSize: 12 }}
                      onClick={() => download(s.student_id)} disabled={downloading === s.student_id}>
                      {downloading === s.student_id ? "Preparing…" : "Download PDF"}
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
