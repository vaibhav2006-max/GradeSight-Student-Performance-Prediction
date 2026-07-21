import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { token, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const ThemeButton = () => (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );

  return (
    <div className="topbar">
      <NavLink to="/" className="brand">
        <span className="brand-mark">SP</span>
        GradeSight
      </NavLink>
      <div className="nav-links">
        {token ? (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/predict">Predict</NavLink>
            <NavLink to="/progress">Progress</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            <NavLink to="/reports">Reports</NavLink>
            {role === "admin" && <NavLink to="/model-performance">Model Performance</NavLink>}
            {role === "admin" && <NavLink to="/email-settings">Email Settings</NavLink>}
            <span className="chip">{role}</span>
            <ThemeButton />
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <ThemeButton />
            <NavLink to="/login/student">Student login</NavLink>
            <NavLink to="/login/admin">Admin login</NavLink>
          </>
        )}
      </div>
    </div>
  );
}
