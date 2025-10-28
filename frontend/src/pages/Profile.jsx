import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  accountType: 'person',
  shopName: '',
  shopAddress: ''
};

const createDefaultStats = () => ({
  listings: { total: 0, approved: 0, pending: 0, rejected: 0, disabled: 0 },
  engagement: { favoritesReceived: 0, commentsReceived: 0, favoritesSaved: 0 }
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return numberFormatter.format(parsed);
};

export default function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [shopLogoFile, setShopLogoFile] = useState(null);
  const [shopLogoPreview, setShopLogoPreview] = useState('');
  const [stats, setStats] = useState(() => createDefaultStats());
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  useEffect(
    () => () => {
      if (shopLogoPreview && shopLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopLogoPreview);
      }
    },
    [shopLogoPreview]
  );

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      accountType: user.accountType || 'person',
      shopName: user.shopName || '',
      shopAddress: user.shopAddress || ''
    }));
    setShopLogoPreview(user.shopLogo || '');
  }, [user]);

  useEffect(() => {
    if (!user) {
      setStats(createDefaultStats());
      setStatsError('');
      setStatsLoading(false);
      return;
    }

    let active = true;
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError('');
      try {
        const { data } = await api.get('/users/profile/stats');
        if (!active) return;
        const baseline = createDefaultStats();
        setStats({
          listings: { ...baseline.listings, ...(data?.listings || {}) },
          engagement: { ...baseline.engagement, ...(data?.engagement || {}) }
        });
      } catch (err) {
        if (!active) return;
        setStatsError(
          err.response?.data?.message || err.message || 'Impossible de charger les statistiques.'
        );
      } finally {
        if (active) {
          setStatsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      active = false;
    };
  }, [user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'accountType') {
      setForm((prev) => ({
        ...prev,
        accountType: value,
        shopName: value === 'shop' ? prev.shopName : '',
        shopAddress: value === 'shop' ? prev.shopAddress : ''
      }));
      if (value !== 'shop') {
        setShopLogoFile(null);
        setShopLogoPreview('');
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onLogoChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setShopLogoFile(file);
    if (file) {
      setShopLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    setFeedback('');
    try {
      if (form.accountType === 'shop' && (!form.shopName || !form.shopAddress)) {
        setError('Veuillez renseigner le nom et l\'adresse de votre boutique.');
        return;
      }

      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('phone', form.phone);
      payload.append('accountType', form.accountType);
      if (form.password) payload.append('password', form.password);
      if (form.accountType === 'shop') {
        payload.append('shopName', form.shopName);
        payload.append('shopAddress', form.shopAddress);
        if (shopLogoFile) {
          payload.append('shopLogo', shopLogoFile);
        }
      }

      const { data } = await api.put('/users/profile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(data);
      setFeedback('Profil mis à jour avec succès.');
      setForm((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        accountType: data.accountType || 'person',
        shopName: data.shopName || '',
        shopAddress: data.shopAddress || ''
      }));
      setShopLogoPreview(data.shopLogo || '');
      setShopLogoFile(null);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-4">
        <p className="text-sm text-gray-500">Vous devez être connecté pour accéder à votre profil.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500">Consultez et mettez à jour vos informations personnelles.</p>
      </header>

      <section className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Statistiques</h2>
            <p className="text-sm text-gray-500">Aperçu rapide des performances de vos annonces.</p>
          </div>
          {statsLoading && <span className="text-xs text-gray-400">Chargement…</span>}
        </div>
        {statsError ? (
          <p className="text-sm text-red-600">{statsError}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Annonces</h3>
              <dl className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <dt>Total</dt>
                  <dd className="text-xl font-bold text-gray-900">{formatNumber(stats.listings.total)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Approuvées</dt>
                  <dd>{formatNumber(stats.listings.approved)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>En attente</dt>
                  <dd>{formatNumber(stats.listings.pending)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Rejetées</dt>
                  <dd>{formatNumber(stats.listings.rejected)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Désactivées</dt>
                  <dd>{formatNumber(stats.listings.disabled)}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Engagement</h3>
              <dl className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <dt>Favoris reçus</dt>
                  <dd className="text-xl font-bold text-gray-900">
                    {formatNumber(stats.engagement.favoritesReceived)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Commentaires</dt>
                  <dd>{formatNumber(stats.engagement.commentsReceived)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Favoris enregistrés</dt>
                  <dd>{formatNumber(stats.engagement.favoritesSaved)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </section>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Nom complet
              <input
                className="mt-1 border rounded p-2"
                name="name"
                value={form.name}
                onChange={onChange}
                disabled={loading}
                required
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Adresse email
              <input
                className="mt-1 border rounded p-2"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                disabled={loading}
                required
              />
            </label>
          </div>
          <label className="flex flex-col text-sm font-medium text-gray-700">
            Téléphone
            <input
              className="mt-1 border rounded p-2"
              name="phone"
              value={form.phone}
              onChange={onChange}
              disabled={loading}
              required
            />
          </label>
          {user?.accountType === 'shop' ? (
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Type de compte
              <select
                className="mt-1 border rounded p-2"
                name="accountType"
                value={form.accountType}
                onChange={onChange}
                disabled={loading}
              >
                <option value="shop">Boutique</option>
                <option value="person">Particulier</option>
              </select>
            </label>
          ) : (
            <div className="space-y-1 text-sm text-gray-700">
              <div className="flex flex-col font-medium">
                Type de compte
                <input
                  className="mt-1 border rounded p-2 bg-gray-100 text-gray-600"
                  value="Particulier"
                  disabled
                  readOnly
                />
              </div>
              <p className="text-xs text-indigo-600">
                Pour être enregistré comme boutique, contactez l&apos;administrateur.
              </p>
            </div>
          )}
          {form.accountType === 'shop' && (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col text-sm font-medium text-gray-700">
                Nom de la boutique
                <input
                  className="mt-1 border rounded p-2"
                  name="shopName"
                  value={form.shopName}
                  onChange={onChange}
                  disabled={loading}
                  required
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-gray-700">
                Adresse de la boutique
                <input
                  className="mt-1 border rounded p-2"
                  name="shopAddress"
                  value={form.shopAddress}
                  onChange={onChange}
                  disabled={loading}
                  required
                />
              </label>
              <div className="md:col-span-2 flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Logo de la boutique</span>
                {shopLogoPreview && (
                  <img
                    src={shopLogoPreview}
                    alt="Logo boutique"
                    className="h-20 w-20 rounded object-cover border"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogoChange}
                  disabled={loading}
                  required={!shopLogoPreview}
                />
                <span className="text-xs text-gray-500">Formats acceptés: JPG, PNG. Taille recommandée 200x200.</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Nouveau mot de passe
              <input
                className="mt-1 border rounded p-2"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                disabled={loading}
                placeholder="Laisser vide pour conserver"
              />
            </label>
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Confirmer le mot de passe
              <input
                className="mt-1 border rounded p-2"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={onChange}
                disabled={loading}
                placeholder="Confirmez le mot de passe"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-green-600">{feedback}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
