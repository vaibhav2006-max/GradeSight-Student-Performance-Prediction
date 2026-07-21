import { useEffect, useState } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import client from "../api/client";

ChartJS.register(BarElement, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const INK = "#1b2a4a";
const GOLD = "#c9962c";
const GREEN = "#2f6f4e";
const RED = "#a6403a";
const PALETTE = [GOLD, INK, GREEN, RED, "#7c6fae", "#3b8ea5"];

function heatColor(value, max) {
  // Interpolates paper -> gold as value approaches max, for a lightweight heatmap row.
  const ratio = max ? Math.min(1, value / max) : 0;
  const r = Math.round(251 - (251 - 201) * ratio);
  const g = Math.round(250 - (250 - 150) * ratio);
  const b = Math.round(247 - (247 - 44) * ratio);
  return `rgb(${r},${g},${b})`;
}

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get("/analytics").then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="container"><p>Loading analytics…</p></div>;
  if (!data.count) return <div className="container"><p className="empty-state">No student data yet. Add students first.</p></div>;

  const barData = {
    labels: Object.keys(data.marks_distribution),
    datasets: [{
      label: "Students",
      data: Object.values(data.marks_distribution),
      backgroundColor: GOLD,
      borderRadius: 4,
    }],
  };

  const pieData = {
    labels: ["Pass", "Fail"],
    datasets: [{
      data: [data.pass_count, data.fail_count],
      backgroundColor: [GREEN, RED],
      borderWidth: 0,
    }],
  };

  const genderLabels = Object.keys(data.gender_distribution || {});
  const genderData = {
    labels: genderLabels,
    datasets: [{
      data: genderLabels.map((g) => data.gender_distribution[g]),
      backgroundColor: PALETTE,
      borderWidth: 0,
    }],
  };

  const attendanceData = {
    labels: Object.keys(data.attendance_distribution || {}),
    datasets: [{
      label: "Students",
      data: Object.values(data.attendance_distribution || {}),
      backgroundColor: INK,
      borderRadius: 4,
    }],
  };

  const subjectLabels = Object.keys(data.subject_wise_averages || {});
  const subjectValues = subjectLabels.map((k) => data.subject_wise_averages[k]);
  const subjectData = {
    labels: subjectLabels,
    datasets: [{
      label: "Cohort average",
      data: subjectValues,
      backgroundColor: subjectLabels.map((_, i) => PALETTE[i % PALETTE.length]),
      borderRadius: 4,
    }],
  };

  const riskLabels = Object.keys(data.prediction_risk_distribution || {});
  const riskData = {
    labels: riskLabels,
    datasets: [{
      data: riskLabels.map((k) => data.prediction_risk_distribution[k]),
      backgroundColor: [GREEN, GOLD, RED],
      borderWidth: 0,
    }],
  };

  const predMarksData = {
    labels: Object.keys(data.prediction_marks_distribution || {}),
    datasets: [{
      label: "Predicted students",
      data: Object.values(data.prediction_marks_distribution || {}),
      borderColor: GOLD,
      backgroundColor: "transparent",
      tension: 0.25,
    }],
  };

  const maxSubject = Math.max(...subjectValues.filter((v) => v != null));

  return (
    <div className="container">
      <p className="eyebrow">Analytics</p>
      <h2 className="section-title">Cohort performance</h2>
      <p className="section-sub">{data.count} students analyzed</p>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="stat-label">Average marks</div>
          <div className="stat-value">{data.average_marks}</div>
        </div>
        <div className="card">
          <div className="stat-label">Average attendance</div>
          <div className="stat-value">{data.average_attendance}%</div>
        </div>
        <div className="card">
          <div className="stat-label">Passing</div>
          <div className="stat-value" style={{ color: GREEN }}>{data.pass_count} ({data.pass_percent}%)</div>
        </div>
        <div className="card">
          <div className="stat-label">High risk students</div>
          <div className="stat-value" style={{ color: RED }}>{data.high_risk_count ?? 0}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Marks distribution</p>
          <Bar data={barData} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Pass vs fail</p>
          <Pie data={pieData} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Attendance distribution</p>
          <Bar data={attendanceData} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Gender distribution</p>
          <Pie data={genderData} />
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Subject-wise averages</p>
          <Bar data={subjectData} options={{ plugins: { legend: { display: false } } }} />
          <div style={{ display: "flex", marginTop: 16, borderRadius: 8, overflow: "hidden" }}>
            {subjectLabels.map((label, i) => (
              <div key={label} title={`${label}: ${subjectValues[i]}`} style={{
                flex: 1, padding: "10px 4px", textAlign: "center", fontSize: 11,
                background: heatColor(subjectValues[i] || 0, maxSubject), color: INK,
              }}>
                {subjectValues[i] ?? "—"}
              </div>
            ))}
          </div>
          <p className="stat-label" style={{ marginTop: 6, textAlign: "center" }}>Heatmap: darker gold = higher average</p>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Prediction risk distribution</p>
          {riskLabels.length ? (
            <Pie data={riskData} />
          ) : (
            <p className="empty-state">No predictions recorded yet.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 16 }}>Predicted-marks distribution (latest prediction per student)</p>
        <Line data={predMarksData} options={{ plugins: { legend: { display: false } } }} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 12 }}>Top performers</p>
          <ul className="list-plain">
            {data.top_students.map((s) => (
              <li key={s.student_id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{s.name}</span><span className="mono">{s.marks}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 12 }}>Needs attention</p>
          <ul className="list-plain">
            {data.low_performing_students.map((s) => (
              <li key={s.student_id} style={{ display: "flex", justifyContent: "space-between", borderLeftColor: RED }}>
                <span>{s.name}</span><span className="mono">{s.marks}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
