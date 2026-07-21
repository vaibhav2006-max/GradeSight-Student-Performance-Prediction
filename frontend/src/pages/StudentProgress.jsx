import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Bar, Line, Radar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

ChartJS.register(
  BarElement, LineElement, PointElement, CategoryScale, LinearScale, RadialLinearScale, Filler, Tooltip, Legend
);

const GOLD = "#c9962c";
const INK = "#1b2a4a";
const GREEN = "#2f6f4e";
const RED = "#a6403a";

function riskColor(level) {
  if (level === "High") return RED;
  if (level === "Medium") return GOLD;
  return GREEN;
}

/** Simple semi-circle SVG gauge, 0-100. */
function Gauge({ value = 0, label }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const angle = (clamped / 100) * 180;
  const rad = (Math.PI / 180) * angle;
  const cx = 100, cy = 100, r = 80;
  const x = cx - r * Math.cos(rad);
  const y = cy - r * Math.sin(rad);
  const color = clamped >= 70 ? GREEN : clamped >= 40 ? GOLD : RED;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 110" width="220">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--paper-line)" strokeWidth="14" strokeLinecap="round" />
        <path
          d={`M 20 100 A 80 80 0 0 1 180 100`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 251.2} 251.2`}
        />
        <circle cx={x} cy={y} r="6" fill={color} />
        <text x="100" y="95" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">{Math.round(clamped)}</text>
      </svg>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function StudentProgress() {
  const { studentId: paramId } = useParams();
  const { role, identity } = useAuth();
  const toast = useToast();
  const [roster, setRoster] = useState([]);
  const [selectedId, setSelectedId] = useState(paramId || (role === "student" ? identity : ""));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === "admin") {
      client.get("/students").then((res) => setRoster(res.data)).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    client.get(`/students/${selectedId}/progress`)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.error || "Could not load progress"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const s = data?.student;
  const latest = data?.latest_prediction;

  const radarData = useMemo(() => {
    if (!s) return null;
    return {
      labels: ["Attendance", "Internal", "Assignment", "Quiz", "Previous Sem", "Predicted Final"],
      datasets: [{
        label: s.name,
        data: [
          s.attendance ?? 0, s.internal_marks ?? 0, s.assignment_marks ?? 0,
          s.quiz_marks ?? 0, s.previous_semester_marks ?? 0, latest?.predicted_marks ?? s.final_exam_marks ?? 0,
        ],
        backgroundColor: "rgba(201,150,44,0.25)",
        borderColor: GOLD,
        pointBackgroundColor: GOLD,
      }],
    };
  }, [s, latest]);

  const barData = useMemo(() => {
    if (!s) return null;
    return {
      labels: ["Attendance", "Internal", "Assignment", "Quiz", "Previous Sem", "Study Hrs ×10"],
      datasets: [{
        label: "Score",
        data: [
          s.attendance ?? 0, s.internal_marks ?? 0, s.assignment_marks ?? 0,
          s.quiz_marks ?? 0, s.previous_semester_marks ?? 0, (s.study_hours_per_day ?? 0) * 10,
        ],
        backgroundColor: INK,
        borderRadius: 4,
      }],
    };
  }, [s]);

  const trendData = useMemo(() => {
    const history = data?.prediction_history || [];
    if (history.length === 0) return null;
    return {
      labels: history.map((p) => new Date(p.created_at).toLocaleDateString()),
      datasets: [{
        label: "Predicted marks over time",
        data: history.map((p) => p.predicted_marks),
        borderColor: GOLD,
        backgroundColor: "transparent",
        tension: 0.2,
      }],
    };
  }, [data]);

  return (
    <div className="container">
      <p className="eyebrow">Progress</p>
      <h2 className="section-title">Student Progress</h2>
      <p className="section-sub">
        Attendance, marks, study hours, and prediction trend for an individual student.
      </p>

      {role === "admin" && (
        <div className="field" style={{ maxWidth: 320, marginBottom: 24 }}>
          <label>Select student</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">— choose —</option>
            {roster.map((r) => (
              <option key={r.student_id} value={r.student_id}>{r.name} ({r.student_id})</option>
            ))}
          </select>
        </div>
      )}

      {!selectedId && <p className="empty-state">Select a student to view their progress.</p>}
      {loading && <p>Loading…</p>}

      {!loading && s && (
        <>
          <div className="grid grid-3" style={{ marginBottom: 24, alignItems: "stretch" }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Gauge value={data.progress_percentage} label="Overall progress" />
            </div>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Gauge value={latest?.predicted_marks ?? s.final_exam_marks} label="Predicted final marks" />
            </div>
            <div className="card">
              <div className="stat-label">Risk level</div>
              {latest ? (
                <span className={`badge badge-risk-${latest.risk_level?.toLowerCase()}`} style={{ fontSize: 16, padding: "6px 14px", marginTop: 8, display: "inline-block" }}>
                  {latest.risk_level}
                </span>
              ) : (
                <p className="empty-state" style={{ padding: "20px 0" }}>No prediction yet</p>
              )}
              <div style={{ marginTop: 16 }}>
                <div className="stat-label">Study hours / day</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{s.study_hours_per_day ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <p className="eyebrow" style={{ marginBottom: 16 }}>Skill radar</p>
              {radarData && <Radar data={radarData} options={{ scales: { r: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }} />}
            </div>
            <div className="card">
              <p className="eyebrow" style={{ marginBottom: 16 }}>Component breakdown</p>
              {barData && <Bar data={barData} options={{ plugins: { legend: { display: false } } }} />}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 16 }}>Predicted-marks trend</p>
            {trendData ? (
              <Line data={trendData} options={{ scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }} />
            ) : (
              <p className="empty-state">No prediction history yet — run a prediction from the Predict page to start tracking trend.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
