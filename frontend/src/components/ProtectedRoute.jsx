import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

export default function ProtectedRoute({ children, role, roles, allowAccess }) {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // If custom allowAccess function is provided, use it
  if (allowAccess && typeof allowAccess === 'function') {
    if (!allowAccess(user)) {
      return <Navigate to="/" replace />;
    }
    return children;
  }

  // Otherwise, check roles
  const allowedRoles =
    (Array.isArray(roles) && roles.length ? roles : null) || (role ? [role] : null);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
