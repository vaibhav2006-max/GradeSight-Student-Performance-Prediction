import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function Register() {
  const [form, setForm] = useState({ student_id: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/register", form);
      setDone(true);
      setTimeout(() => navigate("/login/student"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Create account</h2>
        <p className="auth-sub">Register to receive predictions on your own performance.</p>
        {error && <div className="error-banner">{error}</div>}
        {done ? (
          <p>Account created — redirecting to login…</p>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Student ID</label>
              <input value={form.student_id} onChange={set("student_id")} required />
            </div>
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={set("name")} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set("email")} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={set("password")} required />
            </div>
            <button className="btn btn-block" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
