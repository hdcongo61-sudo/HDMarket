import React, { useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { PlusIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import ShoppingOrderCard from '../components/shopping/ShoppingOrderCard';

export default function BuyForMeOrders() {
  const { user } = useContext(AuthContext), { isFeatureEnabled } = useAppSettings();
  const location = useLocation();
  const [scope, setScope] = useState('active'), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ items: [], counts: {}, totalPages: 1 }), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let alive = true; setLoading(true); setError('');
    api.get('/buy-for-me/mine', { params: { scope, page, limit: 12 }, skipCache: true }).then(({ data }) => { if (alive) setResult(data); })
      .catch(err => { if (alive) setError(getApiErrorMessage(err, 'Impossible de charger vos achats.')); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, scope, page, refresh]);
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <div className="shop-stack"><div className="shop-row"><div><p className="shop-eyebrow">Tout votre suivi, au même endroit</p><h1 className="mt-2">Mes achats</h1></div>{isFeatureEnabled('enable_buy_for_me', { defaultValue: false }) ? <Link to="/buy-for-me/new" className="shop-button" aria-label="Nouvelle demande"><PlusIcon /><span>Nouveaux achats</span></Link> : null}</div>
    <div className="shop-tabs" aria-label="Filtrer les achats">{[['active', 'En cours'], ['history', 'Historique']].map(([value, label]) => <button key={value} aria-pressed={scope === value} onClick={() => { setScope(value); setPage(1); }}>{label} {result.counts?.[value] !== undefined ? '(' + result.counts[value] + ')' : ''}</button>)}</div>
    {error ? <div role="alert" className="shop-error">{error} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Réessayer</button></div> : loading ? <p role="status" className="shop-muted">Chargement de vos achats…</p> : result.items?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.items.map(order => <ShoppingOrderCard key={order._id} order={order} />)}</div> : <div className="shop-empty"><ShoppingBagIcon /><h2>{scope === 'active' ? 'Aucun achat en cours.' : 'Votre historique commence ici.'}</h2><p className="shop-muted mt-2">{scope === 'active' ? 'Vos demandes en cours et les décisions attendues apparaîtront ici.' : 'Vos achats terminés et annulés resteront disponibles avec leurs reçus.'}</p><Link to="/buy-for-me" className="shop-link mt-3">Retour à l’accueil du service</Link></div>}
    {!error && result.totalPages > 1 ? <div className="shop-row"><button className="shop-button shop-button--secondary" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Précédent</button><span className="shop-muted">Page {page} / {result.totalPages}</span><button className="shop-button shop-button--secondary" disabled={loading || page >= result.totalPages} onClick={() => setPage(value => value + 1)}>Suivant</button></div> : null}
  </div>;
}
