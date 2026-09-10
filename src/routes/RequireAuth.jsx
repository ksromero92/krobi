import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function RequireAuth({ children }) {
    const { loading, session } = useAuth();
    if (loading) return null; // o un spinner
    if (!session) return <Navigate to="/login" replace />;
    return children;
}
