import { useEffect, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import client from "../api/client";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const INK = "#1b2a4a";
const GOLD = "#c9962c";
const GREEN = "#2f6f4e";
const RED = "#a6403a";

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
          <div className="stat-value" style={{ color: GREEN }}>{data.pass_count}</div>
        </div>
        <div className="card">
          <div className="stat-label">At risk</div>
          <div className="stat-value" style={{ color: RED }}>{data.fail_count}</div>
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
