import React from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeftIcon, BookmarkSquareIcon, HomeIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline';
import './shopping.css';

const links = [
  ['/buy-for-me', 'Accueil', HomeIcon, true],
  ['/buy-for-me/orders', 'Mes achats', TruckIcon, false],
  ['/buy-for-me/lists', 'Mes listes', BookmarkSquareIcon, false]
];

export default function ShoppingLayout() {
  const { pathname } = useLocation();
  const creating = pathname === '/buy-for-me/new';
  return <div className={`shopping-app ${creating ? 'shopping-app--creating' : ''}`}>
    <header className="shopping-header">
      <div className="shopping-header-inner">
        <Link to={creating ? '/buy-for-me' : '/'} className="shopping-back" aria-label={creating ? 'Retour à Acheter pour moi' : 'Retour à HDMarket'}><ArrowLeftIcon /></Link>
        <Link to="/buy-for-me" className="shopping-brand"><span className="shopping-brand-icon"><ShoppingBagIcon /></span><span><small>UN SERVICE HDMARKET</small><strong>Acheter pour moi</strong></span></Link>
        <Link to="/" className="shopping-market-link">Le marché <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
    {!creating ? <nav aria-label="Navigation Acheter pour moi" className="shopping-nav"><div>{links.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon /><span>{label}</span></NavLink>)}</div></nav> : null}
    <div className="shopping-content"><Outlet /></div>
  </div>;
}
