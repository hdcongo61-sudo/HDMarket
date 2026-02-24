import React, { useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { hasAnyPermission } from '../utils/permissions';

export default function ProtectedRoute({ children, role, roles, permissions, allowAccess }) {
  const location = useLocation();
  const { user, loading } = useContext(AuthContext);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setLoadingTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm font-semibold text-gray-500">Chargement...</div>
      </div>
    );
  }
  if (loading && loadingTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Chargement plus long que prévu.</p>
          <p className="mt-1 text-xs text-slate-600">
            Vérifiez votre connexion puis réessayez.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
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
  const normalizedUserRole = String(user?.role || '').toLowerCase();
  const normalizedAllowedRoles = allowedRoles?.map((item) => String(item || '').toLowerCase()) || null;
  const founderAsAdminAllowed =
    normalizedUserRole === 'founder' && Array.isArray(normalizedAllowedRoles)
      ? normalizedAllowedRoles.includes('admin')
      : false;

  if (
    normalizedAllowedRoles &&
    !normalizedAllowedRoles.includes(normalizedUserRole) &&
    !founderAsAdminAllowed
  ) {
    return <Navigate to="/" replace />;
  }
  if (permissions && !hasAnyPermission(user, permissions)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
