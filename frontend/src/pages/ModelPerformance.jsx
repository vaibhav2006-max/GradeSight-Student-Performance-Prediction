import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
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

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const INK = "#1b2a4a";
const GOLD = "#c9962c";
const GREEN = "#2f6f4e";
const RED = "#a6403a";

const REGRESSOR_LABELS = {
  LinearRegression: "Linear Regression",
  DecisionTreeRegressor: "Decision Tree",
  RandomForestRegressor: "Random Forest",
};

function fmtPct(v) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

export default function ModelPerformance() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.get("/model-metrics");
      setMetrics(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load model metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const retrain = async () => {
    setTraining(true);
    setMessage("Retraining models — this may take a moment…");
    try {
      const res = await client.post("/train-model");
      setMetrics(res.data.metrics);
      setError("");
      setMessage(`Retrained. Best regressor: ${REGRESSOR_LABELS[res.data.metrics.best_regressor] || res.data.metrics.best_regressor}.`);
    } catch (err) {
      setMessage(err.response?.data?.error || "Training failed");
    } finally {
      setTraining(false);
    }
  };

  if (loading) return <div className="container"><p>Loading model metrics…</p></div>;

  if (error) {
    return (
      <div className="container">
        <p className="eyebrow">Admin</p>
        <h2 className="section-title">Model Performance</h2>
        <p className="empty-state">{error}</p>
        <button className="btn btn-gold" onClick={retrain} disabled={training}>
          {training ? "Training…" : "Train model now"}
        </button>
      </div>
    );
  }

  const clf = metrics.classification?.LogisticRegression || {};
  const bestName = metrics.best_regressor;
  const bestReg = metrics.regression?.[bestName] || {};
  const regNames = Object.keys(metrics.regression || {});

  const comparisonData = {
    labels: regNames.map((n) => REGRESSOR_LABELS[n] || n),
    datasets: [{
      label: "R² Score",
      data: regNames.map((n) => metrics.regression[n].r2),
      backgroundColor: regNames.map((n) => (n === bestName ? GOLD : "#c7cede")),
      borderRadius: 4,
    }],
  };

  const cm = clf.confusion_matrix?.matrix || [[0, 0], [0, 0]];
  const [[tn, fp], [fn, tp]] = cm;

  const roc = clf.roc_curve || { fpr: [], tpr: [] };
  const rocData = {
    labels: roc.fpr.map((v) => v.toFixed(2)),
    datasets: [
      {
        label: "ROC curve",
        data: roc.tpr,
        borderColor: GOLD,
        backgroundColor: "transparent",
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: "Random guess",
        data: roc.fpr,
        borderColor: "#c7cede",
        borderDash: [5, 5],
        backgroundColor: "transparent",
        pointRadius: 0,
      },
    ],
  };

  const importance = metrics.best_model_feature_importance || {};
  const importanceEntries = Object.entries(importance);
  const importanceData = {
    labels: importanceEntries.map(([k]) => k.replace(/_/g, " ")),
    datasets: [{
      label: "Importance",
      data: importanceEntries.map(([, v]) => v),
      backgroundColor: INK,
      borderRadius: 4,
    }],
  };

  return (
    <div className="container">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h2 className="section-title">Model Performance</h2>
          <p className="section-sub">
            Best regressor: <strong>{REGRESSOR_LABELS[bestName] || bestName}</strong>
            {metrics.trained_at && ` · trained ${new Date(metrics.trained_at).toLocaleString()}`}
          </p>
        </div>
        <button className="btn btn-gold" onClick={retrain} disabled={training}>
          {training ? "Training…" : "Retrain models"}
        </button>
      </div>

      {message && <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>{message}</div>}

      {/* Headline metrics */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="stat-label">Accuracy (pass/fail)</div>
          <div className="stat-value">{fmtPct(clf.accuracy)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Precision</div>
          <div className="stat-value">{fmtPct(clf.precision)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Recall</div>
          <div className="stat-value">{fmtPct(clf.recall)}</div>
        </div>
        <div className="card">
          <div className="stat-label">F1 Score</div>
          <div className="stat-value">{fmtPct(clf.f1)}</div>
        </div>
        <div className="card">
          <div className="stat-label">MAE ({REGRESSOR_LABELS[bestName] || bestName})</div>
          <div className="stat-value">{bestReg.mae ?? "—"}</div>
        </div>
        <div className="card">
          <div className="stat-label">RMSE ({REGRESSOR_LABELS[bestName] || bestName})</div>
          <div className="stat-value">{bestReg.rmse ?? "—"}</div>
        </div>
        <div className="card">
          <div className="stat-label">R² Score</div>
          <div className="stat-value" style={{ color: GOLD }}>{bestReg.r2 ?? "—"}</div>
        </div>
        <div className="card">
          <div className="stat-label">ROC AUC</div>
          <div className="stat-value" style={{ color: GOLD }}>{clf.roc_auc ?? "—"}</div>
        </div>
      </div>

      {/* Confusion matrix + ROC curve */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Confusion matrix</p>
          <table style={{ width: "100%", textAlign: "center", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th></th>
                <th style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, padding: 8 }}>Predicted Fail</th>
                <th style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, padding: 8 }}>Predicted Pass</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, padding: 8, textAlign: "right" }}>Actual Fail</th>
                <td style={{ padding: 18, background: "var(--green-soft)", borderRadius: 8, fontSize: 22, fontWeight: 700, color: GREEN }}>{tn}</td>
                <td style={{ padding: 18, background: "var(--red-soft)", borderRadius: 8, fontSize: 22, fontWeight: 700, color: RED }}>{fp}</td>
              </tr>
              <tr>
                <th style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, padding: 8, textAlign: "right" }}>Actual Pass</th>
                <td style={{ padding: 18, background: "var(--red-soft)", borderRadius: 8, fontSize: 22, fontWeight: 700, color: RED }}>{fn}</td>
                <td style={{ padding: 18, background: "var(--green-soft)", borderRadius: 8, fontSize: 22, fontWeight: 700, color: GREEN }}>{tp}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>ROC curve (AUC {clf.roc_auc ?? "—"})</p>
          <Line
            data={rocData}
            options={{
              scales: {
                x: { title: { display: true, text: "False positive rate" } },
                y: { title: { display: true, text: "True positive rate" }, min: 0, max: 1 },
              },
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      </div>

      {/* Model comparison + feature importance */}
      <div className="grid grid-2">
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Model comparison (R²)</p>
          <Bar data={comparisonData} options={{ plugins: { legend: { display: false } } }} />
          <table style={{ width: "100%", marginTop: 16, fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-soft)" }}>
                <th style={{ padding: "4px 0" }}>Model</th><th>R²</th><th>MAE</th><th>RMSE</th>
              </tr>
            </thead>
            <tbody>
              {regNames.map((n) => (
                <tr key={n} style={{ fontWeight: n === bestName ? 700 : 400 }}>
                  <td style={{ padding: "4px 0" }}>{REGRESSOR_LABELS[n] || n}{n === bestName && <span className="badge badge-pass" style={{ marginLeft: 8 }}>Best</span>}</td>
                  <td>{metrics.regression[n].r2}</td>
                  <td>{metrics.regression[n].mae}</td>
                  <td>{metrics.regression[n].rmse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Feature importance ({REGRESSOR_LABELS[bestName] || bestName})</p>
          <Bar
            data={importanceData}
            options={{
              indexAxis: "y",
              plugins: { legend: { display: false } },
              scales: { x: { title: { display: true, text: "Relative importance" } } },
            }}
          />
        </div>
      </div>
    </div>
  );
}
