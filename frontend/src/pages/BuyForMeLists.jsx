import React, { useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { BookmarkSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { useAppSettings } from '../context/AppSettingsContext';

export default function BuyForMeLists() {
  const { user } = useContext(AuthContext), { country } = useCountry(), { isFeatureEnabled } = useAppSettings();
  const enabled = isFeatureEnabled('enable_buy_for_me', { defaultValue: false }), location = useLocation();
  const [lists, setLists] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [deleting, setDeleting] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true; setLoading(true); setError('');
    api.get('/buy-for-me/lists', { skipCache: true }).then(({ data }) => { if (alive) setLists(data.items || []); }).catch(err => { if (alive) setError(getApiErrorMessage(err, 'Vos listes sont indisponibles.')); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, country?.id, country?._id, refresh]);
  const remove = async id => { setBusy(true); setError(''); try { await api.delete(`/buy-for-me/lists/${id}`); setLists(previous => previous.filter(item => item._id !== id)); setDeleting(''); } catch (err) { setError(getApiErrorMessage(err, 'Suppression impossible.')); } finally { setBusy(false); } };
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <div className="shop-stack"><div className="shop-row"><div><p className="shop-eyebrow">Vos habitudes, à portée de main</p><h1 className="mt-2">Mes listes</h1><p className="shop-muted mt-2">Réutilisez une liste, ajustez-la et vérifiez le nouveau prix.</p></div>{enabled ? <Link to="/buy-for-me/new" className="shop-button"><PlusIcon /><span>Créer</span></Link> : null}</div>
    {error ? <div role="alert" className="shop-error">{error} <button onClick={() => setRefresh(value => value + 1)} className="underline">Réessayer</button></div> : null}
    {loading ? <p role="status" className="shop-muted">Chargement des listes…</p> : !error && !lists.length ? <div className="shop-empty"><BookmarkSquareIcon /><h2>Vos essentiels, sans tout ressaisir.</h2><p className="shop-muted mt-2">Enregistrez votre liste pendant la préparation d’un achat. Elle vous attendra ici, même sur un autre appareil.</p>{enabled ? <Link to="/buy-for-me/new" className="shop-button mt-5">Préparer ma première liste</Link> : null}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.map(list => <article key={list._id} className="shop-card"><span className="shop-badge">{list.items.length} article{list.items.length > 1 ? 's' : ''}</span><h2 className="mt-3">{list.name}</h2><p className="shop-muted mt-2">{list.items.slice(0, 4).map(item => item.name).join(', ')}{list.items.length > 4 ? '…' : ''}</p><div className="shop-row mt-4">{enabled ? <Link to={`/buy-for-me/new?list=${list._id}`} className="shop-link">Utiliser cette liste →</Link> : <span className="shop-muted">Liste conservée</span>}<button aria-label={`Supprimer ${list.name}`} onClick={() => setDeleting(list._id)} className="p-3"><TrashIcon /></button></div>{deleting === list._id ? <div className="shop-note mt-2"><p>Supprimer cette liste ? Vos achats passés restent conservés.</p><div className="flex gap-3 mt-2"><button disabled={busy} onClick={() => remove(list._id)} className="shop-link">Confirmer</button><button onClick={() => setDeleting('')} className="shop-muted">Garder</button></div></div> : null}</article>)}</div>}
  </div>;
}
