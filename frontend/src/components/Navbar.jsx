import React, { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import useAdminCounts from '../hooks/useAdminCounts';
import useUserNotifications from '../hooks/useUserNotifications';

const BellIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const cartCount = cart?.totals?.quantity || 0;
  const { counts } = useAdminCounts(user?.role === 'admin');
  const waitingPayments = counts.waitingPayments || 0;
  const { counts: userNotifications } = useUserNotifications(Boolean(user));
  const commentAlerts = userNotifications.commentAlerts || 0;
  const hasAlerts = commentAlerts > 0;
  return (
    <nav className="bg-indigo-600 text-white">
      <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
        <Link to="/" className="font-bold text-xl">HDMarket</Link>
        <div className="flex items-center gap-4">
          <NavLink to="/" className="hover:underline">Accueil</NavLink>
          {user && <NavLink to="/my">Mes annonces</NavLink>}
          {user && <NavLink to="/profile" className="hover:underline">Profil</NavLink>}
          {user && (
            <NavLink to="/notifications" className="relative hover:underline inline-flex items-center gap-1">
              <span>Notifications</span>
              {hasAlerts && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5">
                  {commentAlerts}
                </span>
              )}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="relative hover:underline inline-flex items-center gap-1">
              <span>Admin</span>
              <BellIcon className="h-4 w-4" />
              {waitingPayments > 0 && (
                <span className="ml-1 inline-flex items-center justify-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5">
                  {waitingPayments}
                </span>
              )}
            </NavLink>
          )}
          <NavLink to="/cart" className="relative hover:underline">
            Panier
            {cartCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-white text-indigo-600 text-[10px] font-semibold px-1.5 py-0.5">
                {cartCount}
              </span>
            )}
          </NavLink>
          {!user ? (
            <>
              <NavLink to="/login">Connexion</NavLink>
              <NavLink to="/register">Inscription</NavLink>
            </>
          ) : (
            <button onClick={logout} className="bg-white text-indigo-600 px-3 py-1 rounded">Déconnexion</button>
          )}
        </div>
      </div>
    </nav>
  );
}
