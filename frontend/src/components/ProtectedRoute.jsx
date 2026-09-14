import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_HOME } from "../pages/Login";
import Loader from "./Loader";

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loader full label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={ROLE_HOME[user.role] || "/student"} replace />;
  }
  return children;
}
