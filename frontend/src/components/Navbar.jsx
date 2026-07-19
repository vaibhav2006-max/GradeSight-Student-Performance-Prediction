import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { token, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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
            <NavLink to="/analytics">Analytics</NavLink>
            <NavLink to="/reports">Reports</NavLink>
            <span className="chip">{role}</span>
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <NavLink to="/login/student">Student login</NavLink>
            <NavLink to="/login/admin">Admin login</NavLink>
          </>
        )}
      </div>
    </div>
  );
}
