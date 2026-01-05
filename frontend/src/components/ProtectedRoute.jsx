import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

export default function ProtectedRoute({ children, role, roles }) {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  const allowedRoles =
    (Array.isArray(roles) && roles.length ? roles : null) || (role ? [role] : null);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
