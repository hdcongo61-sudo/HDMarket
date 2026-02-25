import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Plus, Save, Edit3, Trash2, Phone, Truck, Search, Users, UserPlus, UserMinus, AlertCircle, Loader2 } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';

export default function AdminDeliveryGuys() {
  const { user } = useContext(AuthContext);
  const { cities, communes } = useAppSettings();
  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    active: true,
    cityId: '',
    communes: [],
    vehicleType: '',
    notes: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [cityFilter, setCityFilter] = useState('');
  const [communeFilter, setCommuneFilter] = useState('');
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);
  const [managerMessage, setManagerMessage] = useState('');
  const [managerBusyId, setManagerBusyId] = useState('');

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.active) acc.active += 1;
      const stats = item.stats || {};
      acc.assigned += Number(stats.totalAssigned || 0);
      acc.delivering += Number(stats.delivering || 0);
      acc.delivered += Number(stats.delivered || 0);
      return acc;
    },
    { total: 0, active: 0, assigned: 0, delivering: 0, delivered: 0 }
  );
  summary.inactive = Math.max(0, summary.total - summary.active);

  const cityOptions = useMemo(
    () =>
      (Array.isArray(cities) ? cities : [])
        .filter((entry) => entry?.isActive !== false)
        .map((entry) => ({ id: entry._id, name: entry.name })),
    [cities]
  );
  const communeOptions = useMemo(() => {
    const activeCommunes = (Array.isArray(communes) ? communes : []).filter((entry) => entry?.isActive !== false);
    if (!formState.cityId) return activeCommunes;
    return activeCommunes.filter((entry) => String(entry.cityId?._id || entry.cityId || '') === String(formState.cityId));
  }, [communes, formState.cityId]);
  const listCommuneOptions = useMemo(() => {
    const activeCommunes = (Array.isArray(communes) ? communes : []).filter((entry) => entry?.isActive !== false);
    if (!cityFilter) return activeCommunes;
    return activeCommunes.filter((entry) => String(entry.cityId?._id || entry.cityId || '') === String(cityFilter));
  }, [communes, cityFilter]);

  const loadDeliveryGuys = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 12);
      if (searchValue) params.set('search', searchValue);
      if (cityFilter) params.set('cityId', cityFilter);
      if (communeFilter) params.set('communeId', communeFilter);
      const { data } = await api.get(`/admin/delivery-guys?${params.toString()}`);
      const list = Array.isArray(data) ? data : data?.items || [];
      setItems(list);
      setMeta({
        total: data?.total ?? list.length,
        totalPages: data?.totalPages ?? 1
      });
      if (data?.page && data.page !== page) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les livreurs.');
      setMeta({ total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveryGuys();
  }, [page, searchValue, cityFilter, communeFilter]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchValue(searchDraft.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, cityFilter, communeFilter]);

  useEffect(() => {
    if (!managerMessage) return;
    const timer = setTimeout(() => setManagerMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [managerMessage]);

  const managerIds = useMemo(() => new Set(managers.map((m) => String(m.id || m._id))), [managers]);

  const loadManagers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingManagers(true);
    try {
      const { data } = await api.get('/admin/delivery-managers');
      setManagers(Array.isArray(data?.managers) ? data.managers : []);
    } catch (err) {
      console.error('Load delivery managers error:', err);
      setManagers([]);
    } finally {
      setLoadingManagers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadManagers();
  }, [loadManagers]);

  const resetForm = () => {
    setFormState({ name: '', phone: '', active: true, cityId: '', communes: [], vehicleType: '', notes: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formState.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.patch(`/admin/delivery-guys/${editingId}`, {
          fullName: formState.name.trim(),
          phone: formState.phone.trim(),
          active: formState.active,
          cityId: formState.cityId || null,
          communes: formState.communes,
          vehicleType: formState.vehicleType || '',
          notes: formState.notes || ''
        });
      } else {
        await api.post('/admin/delivery-guys', {
          fullName: formState.name.trim(),
          phone: formState.phone.trim(),
          active: formState.active,
          cityId: formState.cityId || null,
          communes: formState.communes,
          vehicleType: formState.vehicleType || '',
          notes: formState.notes || ''
        });
      }
      await loadDeliveryGuys();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Impossible d'enregistrer le livreur.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (deliveryGuy) => {
    setEditingId(deliveryGuy._id);
    setFormState({
      name: deliveryGuy.fullName || deliveryGuy.name || '',
      phone: deliveryGuy.phone || '',
      active: Boolean(deliveryGuy.isActive ?? deliveryGuy.active),
      cityId: deliveryGuy.cityId?._id || deliveryGuy.cityId || '',
      communes: Array.isArray(deliveryGuy.communes)
        ? deliveryGuy.communes.map((entry) => entry?._id || entry).filter(Boolean)
        : [],
      vehicleType: deliveryGuy.vehicleType || '',
      notes: deliveryGuy.notes || ''
    });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/admin/delivery-guys/${id}`);
      await loadDeliveryGuys();
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de supprimer le livreur.');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(
        `/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`
      );
      const users = Array.isArray(data) ? data.filter((u) => u.role !== 'admin' && u.role !== 'founder') : [];
      setFoundUsers(users);
    } catch (err) {
      console.error('Search users error:', err);
      setFoundUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleToggleManager = async (userId) => {
    if (!userId || typeof userId !== 'string') return;
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      setManagerMessage('Identifiant utilisateur invalide.');
      return;
    }
    setManagerBusyId(userId);
    try {
      const { data } = await api.patch(`/admin/delivery-managers/${userId}/toggle`);
      setManagerMessage(data?.message || 'Statut mis à jour.');
      await loadManagers();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (err) {
      setManagerMessage(err.response?.data?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setManagerBusyId('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
          <Truck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestion des livreurs</h1>
          <p className="text-sm text-gray-500">Ajoutez, modifiez et activez les livreurs disponibles.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400">Livreurs</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">Total enregistrés</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-500">Actifs</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">{summary.active}</p>
          <p className="text-xs text-emerald-700">{summary.inactive} inactif(s)</p>
        </div>
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/40 p-4">
          <p className="text-xs font-semibold uppercase text-neutral-500">Commandes assignées</p>
          <p className="mt-2 text-2xl font-semibold text-neutral-800">{summary.assigned}</p>
          <p className="text-xs text-neutral-700">Toutes périodes</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
          <p className="text-xs font-semibold uppercase text-amber-500">En livraison</p>
          <p className="mt-2 text-2xl font-semibold text-amber-800">{summary.delivering}</p>
          <p className="text-xs text-amber-700">{summary.delivered} livrée(s)</p>
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Accès gestion des livreurs
              </h2>
              <p className="text-xs text-gray-500">
                Autorisez un utilisateur à gérer la page des livreurs.
              </p>
            </div>
          </div>

          {managerMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle size={16} />
              {managerMessage}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Rechercher un utilisateur (nom, email, téléphone)..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleSearchUsers}
              disabled={searchingUsers || !userSearchQuery.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <Search size={14} />
              Rechercher
            </button>
          </div>

          {foundUsers.length > 0 && (
            <div className="space-y-2">
              {foundUsers.map((userItem) => {
                const id = userItem._id || userItem.id;
                const isManagerUser = managerIds.has(String(id));
                const isBusy = managerBusyId === String(id);
                return (
                  <div
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userItem.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {userItem.email} · {userItem.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleManager(String(id))}
                      disabled={isBusy}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-70 ${
                        isManagerUser
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isManagerUser ? (
                        <UserMinus size={14} />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      {isBusy ? 'Traitement...' : isManagerUser ? 'Retirer' : 'Ajouter'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Gestionnaires actuels ({managers.length})
            </p>
            {loadingManagers ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : managers.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun gestionnaire pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {managers.map((manager) => (
                  <div
                    key={manager.id || manager._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{manager.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {manager.email} · {manager.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleManager(String(manager.id || manager._id))}
                      disabled={managerBusyId === String(manager.id || manager._id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                    >
                      {managerBusyId === String(manager.id || manager._id) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserMinus size={14} />
                      )}
                      {managerBusyId === String(manager.id || manager._id) ? 'Traitement...' : 'Retirer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {editingId ? 'Modifier un livreur' : 'Ajouter un livreur'}
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr_auto]" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Nom</label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              placeholder="Ex: Jean K."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Téléphone</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-neutral-500">
              <Phone size={14} className="text-gray-400" />
              <input
                type="text"
                value={formState.phone}
                onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full border-none p-0 text-sm focus:outline-none"
                placeholder="06 000 00 00"
              />
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={formState.active}
                onChange={(e) => setFormState((prev) => ({ ...prev, active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
              />
              Actif
            </label>
            <button
              type="submit"
              disabled={saving || !formState.name.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-600 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
          <div className="md:col-span-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Ville</label>
              <select
                value={formState.cityId}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormState((prev) => ({ ...prev, cityId: value, communes: [] }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {cityOptions.map((city) => (
                  <option key={city.id || city.name} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Type véhicule</label>
              <select
                value={formState.vehicleType}
                onChange={(e) => setFormState((prev) => ({ ...prev, vehicleType: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Non précisé</option>
                <option value="bike">Vélo</option>
                <option value="motorcycle">Moto</option>
                <option value="car">Voiture</option>
                <option value="van">Fourgonnette</option>
                <option value="truck">Camion</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Communes assignées</label>
              <select
                multiple
                value={formState.communes}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions || []).map((opt) => opt.value);
                  setFormState((prev) => ({ ...prev, communes: values }));
                }}
                className="mt-1 h-28 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {communeOptions.map((commune) => (
                  <option key={commune._id} value={commune._id}>
                    {commune.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Notes</label>
              <textarea
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Instructions opérationnelles"
              />
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Livreurs</h2>
          <div className="flex items-center gap-3">
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setCommuneFilter('');
              }}
              className="rounded-xl border border-gray-200 py-2 px-3 text-xs"
            >
              <option value="">Ville (toutes)</option>
              {cityOptions.map((city) => (
                <option key={`filter-${city.id || city.name}`} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <select
              value={communeFilter}
              onChange={(e) => setCommuneFilter(e.target.value)}
              className="rounded-xl border border-gray-200 py-2 px-3 text-xs"
            >
              <option value="">Commune (toutes)</option>
              {listCommuneOptions.map((commune) => (
                <option key={`filter-commune-${commune._id}`} value={commune._id}>
                  {commune.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="w-56 rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                placeholder="Rechercher un livreur"
              />
            </div>
            <span className="text-xs text-gray-400">{meta.total} enregistré(s)</span>
          </div>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-gray-500">Chargement des livreurs…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucun livreur enregistré pour le moment.</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100">
            {items.map((deliveryGuy) => (
              <div
                key={deliveryGuy._id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{deliveryGuy.fullName || deliveryGuy.name}</p>
                  <p className="text-xs text-gray-500">{deliveryGuy.phone || 'Téléphone non renseigné'}</p>
                  <p className="text-xs text-gray-500">
                    {deliveryGuy.cityId?.name || 'Ville non assignée'}
                    {Array.isArray(deliveryGuy.communes) && deliveryGuy.communes.length > 0
                      ? ` · ${deliveryGuy.communes
                          .map((entry) => entry?.name || '')
                          .filter(Boolean)
                          .join(', ')}`
                      : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      Assignées: {deliveryGuy.stats?.totalAssigned || 0}
                    </span>
                    <span className="rounded-full bg-neutral-100/70 px-2 py-0.5 text-neutral-700">
                      En cours: {deliveryGuy.stats?.delivering || 0}
                    </span>
                    <span className="rounded-full bg-emerald-100/70 px-2 py-0.5 text-emerald-700">
                      Livrées: {deliveryGuy.stats?.delivered || 0}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      (deliveryGuy.isActive ?? deliveryGuy.active) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {(deliveryGuy.isActive ?? deliveryGuy.active) ? 'Actif' : 'Inactif'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEdit(deliveryGuy)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Edit3 size={14} />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deliveryGuy._id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Page {page} sur {meta.totalPages} — {meta.total} livreur{meta.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-full border border-gray-300 px-3 py-1 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-full border border-gray-300 px-3 py-1 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
