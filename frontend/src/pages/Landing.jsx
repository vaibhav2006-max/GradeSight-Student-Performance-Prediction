import { Link } from "react-router-dom";

const features = [
  {
    title: "Multi-model prediction engine",
    body: "Linear Regression, Decision Tree, and Random Forest are trained and compared automatically; the strongest performer is promoted for live predictions.",
  },
  {
    title: "Pass/fail risk scoring",
    body: "A Logistic Regression classifier flags risk level early, alongside a predicted grade and percentage.",
  },
  {
    title: "Personalized suggestions",
    body: "Every prediction returns weak areas, strengths, and concrete next steps — like recommended study hours.",
  },
  {
    title: "Reports built to share",
    body: "Download a clean PDF report per student, or export the full roster to CSV for the registrar.",
  },
];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Student Performance Prediction</p>
          <h1>
            Read the semester
            <br />
            before it's graded.
          </h1>
          <p className="lead">
            GradeSight studies attendance, coursework, and habits to forecast final marks,
            flag at-risk students early, and hand teachers a plan — not just a number.
          </p>
          <div className="hero-actions">
            <Link to="/login/student" className="btn">Student login</Link>
            <Link to="/login/admin" className="btn btn-outline">Admin login</Link>
          </div>
        </div>

        <div className="ledger-card">
          <div className="grade-stamp">B+</div>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Sample forecast</p>
          <div className="ledger-row"><span className="name">Attendance</span><span className="marks">86%</span></div>
          <div className="ledger-row"><span className="name">Internal marks</span><span className="marks">74 / 100</span></div>
          <div className="ledger-row"><span className="name">Study hours / day</span><span className="marks">3.5</span></div>
          <div className="ledger-row"><span className="name">Predicted final</span><span className="marks">78.2</span></div>
          <div className="ledger-row"><span className="name">Risk level</span><span className="marks">Low</span></div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 0 }}>
        <h2 className="section-title">What it does</h2>
        <p className="section-sub">Four moving parts, one clear picture of where a student stands.</p>
        {features.map((f, i) => (
          <div className="feature-row" key={f.title}>
            <span className="feature-num">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
