import { Navigate } from "react-router-dom";

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/ingresar" replace />;
  }

  return children;
}

export default ProtectedRoute;
