import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login/student" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
