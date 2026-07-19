import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AdminLogin from "./pages/AdminLogin";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Prediction from "./pages/Prediction";
import Register from "./pages/Register";
import Reports from "./pages/Reports";
import StudentLogin from "./pages/StudentLogin";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-shell">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login/student" element={<StudentLogin />} />
            <Route path="/login/admin" element={<AdminLogin />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
              path="/predict"
              element={<ProtectedRoute><Prediction /></ProtectedRoute>}
            />
            <Route
              path="/analytics"
              element={<ProtectedRoute><Analytics /></ProtectedRoute>}
            />
            <Route
              path="/reports"
              element={<ProtectedRoute><Reports /></ProtectedRoute>}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
