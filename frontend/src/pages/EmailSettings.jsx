import { useEffect, useState } from "react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";

const empty = {
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  sender_email: "",
  use_tls: true,
  notifications_enabled: false,
  attendance_threshold: 75,
};

export default function EmailSettings() {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);

  const load = () => {
    setLoading(true);
    client.get("/email-settings")
      .then((res) => {
        setForm({ ...empty, ...res.data, smtp_password: "" });
        setConfigured(res.data.configured);
      })
      .catch(() => toast.error("Could not load email settings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked
      : e.target.type === "number" ? parseFloat(e.target.value)
      : e.target.value;
    setForm({ ...form, [k]: val });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.smtp_password) delete payload.smtp_password; // don't overwrite with blank
      const res = await client.put("/email-settings", payload);
      setConfigured(res.data.configured);
      toast.success("Email settings saved.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo) {
      toast.error("Enter an address to send the test email to.");
      return;
    }
    setTesting(true);
    try {
      const res = await client.post("/email-settings/test", { to: testTo });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || "Test email failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="container"><p>Loading email settings…</p></div>;

  return (
    <div className="container">
      <p className="eyebrow">Admin</p>
      <h2 className="section-title">Email Settings</h2>
      <p className="section-sub">
        Configure SMTP so GradeSight can automatically notify a student when they're flagged
        high risk, predicted to fail, or below your attendance threshold.
        {configured && <span className="badge badge-pass" style={{ marginLeft: 10 }}>Configured</span>}
      </p>

      <div className="grid grid-2">
        <div className="card">
          <form onSubmit={save}>
            <div className="field">
              <label>SMTP host</label>
              <input value={form.smtp_host || ""} onChange={set("smtp_host")} placeholder="smtp.gmail.com" />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>Port</label>
                <input type="number" value={form.smtp_port ?? 587} onChange={set("smtp_port")} />
              </div>
              <div className="field">
                <label>Use TLS</label>
                <select value={form.use_tls ? "yes" : "no"} onChange={(e) => setForm({ ...form, use_tls: e.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>SMTP username</label>
              <input value={form.smtp_username || ""} onChange={set("smtp_username")} />
            </div>
            <div className="field">
              <label>SMTP password {configured && "(leave blank to keep current)"}</label>
              <input type="password" value={form.smtp_password || ""} onChange={set("smtp_password")} placeholder={configured ? "••••••••" : ""} />
            </div>
            <div className="field">
              <label>Sender email</label>
              <input type="email" value={form.sender_email || ""} onChange={set("sender_email")} />
            </div>
            <div className="field">
              <label>Attendance alert threshold (%)</label>
              <input type="number" value={form.attendance_threshold ?? 75} onChange={set("attendance_threshold")} />
            </div>
            <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="notif" checked={!!form.notifications_enabled} onChange={set("notifications_enabled")} style={{ width: 16, height: 16 }} />
              <label htmlFor="notif" style={{ margin: 0 }}>Enable automatic notifications</label>
            </div>
            <button className="btn btn-block" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
          </form>
        </div>

        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 12 }}>Send a test email</p>
          <p className="section-sub" style={{ marginBottom: 16 }}>
            Verify your SMTP settings work before enabling automatic notifications.
          </p>
          <div className="field">
            <label>Send test email to</label>
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn btn-outline btn-block" onClick={sendTest} disabled={testing}>
            {testing ? "Sending…" : "Send test email"}
          </button>

          <div style={{ marginTop: 28 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>When emails are sent</p>
            <ul className="list-plain">
              <li>Student is predicted High risk</li>
              <li>Prediction is below the pass mark</li>
              <li>Attendance is below your threshold</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
