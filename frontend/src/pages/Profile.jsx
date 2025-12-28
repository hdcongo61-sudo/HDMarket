import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { 
  User, Mail, Phone, Store, MapPin, Camera, Upload, 
  Save, Eye, EyeOff, BarChart3, Heart, MessageCircle, 
  Package, CheckCircle, Clock, XCircle, Shield, 
  TrendingUp, Users, Star, Award, Edit3, Image,
  Lock,
  Truck,
  ClipboardList
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  accountType: 'person',
  shopName: '',
  shopAddress: '',
  shopDescription: '',
  address: '',
  country: 'République du Congo',
  city: '',
  gender: ''
};

const createDefaultStats = () => ({
  listings: { total: 0, approved: 0, pending: 0, rejected: 0, disabled: 0 },
  engagement: { favoritesReceived: 0, commentsReceived: 0, favoritesSaved: 0 },
  performance: { views: 0, clicks: 0, conversion: 0 }
});

const ORDER_STATUS_LABELS = {
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée'
};

const ORDER_STATUS_STYLES = {
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800'
};

const ORDER_FLOW = [
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'Votre commande a été validée et sera préparée pour la livraison.',
    icon: Package
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le livreur est en route avec votre colis.',
    icon: Truck
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée et archivée par nos équipes.',
    icon: CheckCircle
  }
];

const OrderProgress = ({ status }) => {
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="mt-4 border border-gray-100 rounded-2xl p-3 bg-gray-50">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suivi de l’avancement</p>
      <div className="space-y-4">
        {ORDER_FLOW.map((step, index) => {
          const Icon = step.icon;
          const reached = currentIndex >= index;
          const isCurrent = currentIndex === index;
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                  reached ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-gray-200 text-gray-400 bg-white'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.label}
                  {isCurrent && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      En cours
                    </span>
                  )}
                  {!isCurrent && reached && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Terminée
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return numberFormatter.format(parsed);
};

export default function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const { showToast } = useToast();
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
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const userShopLink = user?.accountType === 'shop' ? `/shop/${user?._id || user?.id}` : null;

  const mobileHighlights = [
    { label: 'Annonces', value: stats.listings?.total || 0 },
    { label: 'Favoris reçus', value: stats.engagement?.favoritesReceived || 0 },
    { label: 'Vues', value: stats.performance?.views || 0 },
    { label: 'WhatsApp', value: stats.performance?.clicks || 0 }
  ];

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
      shopAddress: user.shopAddress || '',
      shopDescription: user.shopDescription || '',
      address: user.address || '',
      country: user.country || 'République du Congo',
      city: user.city || '',
      gender: user.gender || ''
    }));
    setShopLogoPreview(user.shopLogo || '');
  }, [user]);

  useEffect(() => {
    if (!user) {
      setStats(createDefaultStats());
      setStatsError('');
      setStatsLoading(false);
      setOrders([]);
      setOrdersLoaded(false);
      setOrdersError('');
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
          engagement: { ...baseline.engagement, ...(data?.engagement || {}) },
          performance: { ...baseline.performance, ...(data?.performance || {}) }
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

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const { data } = await api.get('/orders?limit=50');
      const items = Array.isArray(data) ? data : data?.items || [];
      setOrders(items);
      setOrdersLoaded(true);
    } catch (err) {
      setOrdersError(err.response?.data?.message || err.message || 'Impossible de charger vos commandes.');
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'orders' && user && !ordersLoaded && !ordersLoading) {
      fetchOrders();
    }
  }, [activeTab, user, ordersLoaded, ordersLoading, fetchOrders]);

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'accountType') {
      setForm((prev) => ({
        ...prev,
        accountType: value,
        shopName: value === 'shop' ? prev.shopName : '',
        shopAddress: value === 'shop' ? prev.shopAddress : '',
        shopDescription: value === 'shop' ? prev.shopDescription : ''
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

  const removeLogo = () => {
    setShopLogoFile(null);
    setShopLogoPreview('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      const message = 'Les mots de passe ne correspondent pas.';
      setError(message);
      showToast(message, { variant: 'error' });
      return;
    }
    if (!form.city || !form.gender) {
      const message = 'Veuillez sélectionner votre ville et votre genre.';
      setError(message);
      showToast(message, { variant: 'error' });
      return;
    }
    if (!form.address.trim()) {
      const message = 'Veuillez renseigner votre adresse complète.';
      setError(message);
      showToast(message, { variant: 'error' });
      return;
    }
    setLoading(true);
    setError('');
    setFeedback('');
    try {
      if (
        form.accountType === 'shop' &&
        (!form.shopName || !form.shopAddress || !form.shopDescription.trim())
      ) {
        const message = 'Veuillez renseigner le nom, l’adresse et la description de votre boutique.';
        setError(message);
        showToast(message, { variant: 'error' });
        return;
      }

      const payload = new FormData();
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('phone', form.phone);
      payload.append('accountType', form.accountType);
      payload.append('city', form.city);
      payload.append('gender', form.gender);
      payload.append('address', form.address.trim());
      if (form.password) payload.append('password', form.password);
      if (form.accountType === 'shop') {
        payload.append('shopName', form.shopName);
        payload.append('shopAddress', form.shopAddress);
        payload.append('shopDescription', form.shopDescription.trim());
        if (shopLogoFile) {
          payload.append('shopLogo', shopLogoFile);
        }
      }

      const { data } = await api.put('/users/profile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(data);
      setFeedback('Profil mis à jour avec succès !');
      showToast('Profil mis à jour avec succès !', { variant: 'success' });
      setForm((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
        accountType: data.accountType || 'person',
        shopName: data.shopName || '',
        shopAddress: data.shopAddress || '',
        shopDescription: data.shopDescription || '',
        address: data.address || '',
        country: data.country || 'République du Congo',
        city: data.city || '',
        gender: data.gender || ''
      }));
      setShopLogoPreview(data.shopLogo || '');
      setShopLogoFile(null);
      
      // Redirection optionnelle après succès
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Une erreur est survenue.';
      setError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Vous devez être connecté pour accéder à votre profil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mon Profil</h1>
          <p className="text-gray-500">Gérez vos informations et consultez vos statistiques</p>
          {user?.address ? (
            <p className="mt-2 flex items-center justify-center text-sm text-gray-600 gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>{user.address}</span>
            </p>
          ) : null}
          {userShopLink && (
            <Link
              to={userShopLink}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl border border-indigo-200 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Store className="w-4 h-4" />
              Voir ma boutique publique
            </Link>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
            {mobileHighlights.map(({ label, value }) => (
              <div
                key={label}
                className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex flex-col"
              >
                <span className="text-[11px] uppercase tracking-wide text-gray-400">{label}</span>
                <span className="text-lg font-bold text-gray-900">{formatNumber(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation par onglets */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-1 bg-white rounded-2xl p-2 sm:p-1 shadow-sm border border-gray-100 mb-6">
          {[
            { id: 'profile', label: 'Profil', icon: User },
            { id: 'stats', label: 'Statistiques', icon: BarChart3 },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
            { id: 'orders', label: 'Mes commandes', icon: ClipboardList }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-medium transition-all flex-1 w-full text-left sm:text-center ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Profil */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h2 className="text-xl font-semibold text-gray-900">Informations personnelles</h2>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              {/* Informations de base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Nom complet *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      name="name"
                      value={form.name}
                      onChange={onChange}
                      disabled={loading}
                      required
                    />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    <span>Adresse email *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      name="email"
                      value={form.email}
                      onChange={onChange}
                      disabled={loading}
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>Téléphone *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      name="phone"
                      value={form.phone}
                      onChange={onChange}
                      disabled={loading}
                      required
                    />
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Pays *</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-gray-100 border border-gray-200 rounded-xl text-gray-500"
                      value="République du Congo"
                      readOnly
                      disabled
                    />
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Ville *</span>
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      name="city"
                      value={form.city}
                      onChange={onChange}
                      disabled={loading}
                      required
                    >
                      <option value="">Choisissez votre ville</option>
                      {['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'].map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Adresse complète *</span>
                  </label>
                  <div className="relative">
                    <textarea
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                      rows={2}
                      name="address"
                      value={form.address}
                      onChange={onChange}
                      disabled={loading}
                      placeholder="Quartier, rue, numéro de parcelle..."
                      required
                    />
                    <MapPin className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Genre *
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'homme', label: 'Homme' },
                      { value: 'femme', label: 'Femme' }
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                          form.gender === option.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={option.value}
                          checked={form.gender === option.value}
                          onChange={onChange}
                          className="sr-only"
                          disabled={loading}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Type de compte */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <span>Type de compte</span>
                  </label>
                  {user?.accountType === 'shop' ? (
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      name="accountType"
                      value={form.accountType}
                      onChange={onChange}
                      disabled={loading}
                    >
                      <option value="shop">Boutique</option>
                      <option value="person">Particulier</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600"
                        value="Particulier"
                        disabled
                        readOnly
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Basique
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section boutique conditionnelle */}
              {form.accountType === 'shop' && (
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                    <div className="w-2 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Informations de la boutique</h3>
                    <VerifiedBadge verified={Boolean(user?.shopVerified)} />
                    <span className="text-xs text-gray-500">
                      {user?.shopVerified
                        ? 'Boutique vérifiée par l’équipe HDMarket.'
                        : 'Contactez un administrateur pour faire vérifier votre boutique.'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                        <Store className="w-4 h-4 text-amber-500" />
                        <span>Nom de la boutique *</span>
                      </label>
                      <div className="relative">
                        <input
                          className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          name="shopName"
                          value={form.shopName}
                          onChange={onChange}
                          disabled={loading}
                          required
                        />
                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        <span>Adresse *</span>
                      </label>
                      <div className="relative">
                        <input
                          className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          name="shopAddress"
                          value={form.shopAddress}
                          onChange={onChange}
                          disabled={loading}
                          required
                        />
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                      <Edit3 className="w-4 h-4 text-amber-500" />
                      <span>À propos de la boutique *</span>
                    </label>
                    <textarea
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 text-sm"
                      rows={4}
                      name="shopDescription"
                      value={form.shopDescription}
                      onChange={onChange}
                      placeholder="Décrivez vos engagements, types de produits, services..."
                      disabled={loading}
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Ce texte s’affiche sur votre page publique pour rassurer vos clients.
                    </p>
                  </div>

                  {/* Logo boutique */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                      <Camera className="w-4 h-4 text-amber-500" />
                      <span>Logo de la boutique</span>
                    </label>
                    
                    <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group p-6">
                      {shopLogoPreview ? (
                        <div className="text-center">
                          <img
                            src={shopLogoPreview}
                            alt="Logo boutique"
                            className="w-24 h-24 rounded-2xl object-cover mx-auto mb-3 border-2 border-amber-200"
                          />
                          <p className="text-sm text-gray-600 mb-2">Logo actuel</p>
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="text-sm text-red-600 hover:text-red-500"
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : (
                        <label className="text-center cursor-pointer">
                          <Upload className="w-8 h-8 text-gray-400 group-hover:text-amber-500 transition-colors mb-2 mx-auto" />
                          <span className="text-sm text-gray-500">
                            <span className="text-amber-600 font-medium">Cliquez pour uploader</span>
                            <br />
                            <span className="text-xs">PNG, JPG - 200x200px recommandé</span>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onLogoChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mot de passe - CORRECTION ICI */}
              <div className="space-y-6 pt-6 border-t border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-900">Sécurité</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span>Nouveau mot de passe</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full px-4 py-3 pl-11 pr-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        name="password"
                        value={form.password}
                        onChange={onChange}
                        disabled={loading}
                        placeholder="Laisser vide pour conserver"
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span>Confirmer le mot de passe</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full px-4 py-3 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={onChange}
                        disabled={loading}
                        placeholder="Confirmez le mot de passe"
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                <label className="flex items-center space-x-2 text-sm text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Afficher les mots de passe</span>
                </label>
              </div>

              {/* Feedback et actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100">
                <div className="flex-1">
                  {error && (
                    <div className="flex items-center space-x-2 text-red-600">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}
                  {feedback && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{feedback}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2 shadow-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Sauvegarder les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Section Statistiques */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* En-tête statistiques */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
                <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                <h2 className="text-xl font-semibold text-gray-900">Vue d'ensemble</h2>
              </div>

              {statsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
              ) : statsError ? (
                <div className="text-center py-8 text-red-600">
                  <XCircle className="w-12 h-12 mx-auto mb-3" />
                  <p>{statsError}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Cartes de statistiques principales */}
                  {[
                    { 
                      label: 'Annonces totales', 
                      value: stats.listings.total, 
                      icon: Package,
                      color: 'from-blue-500 to-cyan-500'
                    },
                    { 
                      label: 'Favoris reçus', 
                      value: stats.engagement.favoritesReceived, 
                      icon: Heart,
                      color: 'from-pink-500 to-rose-500'
                    },
                    { 
                      label: 'Commentaires', 
                      value: stats.engagement.commentsReceived, 
                      icon: MessageCircle,
                      color: 'from-green-500 to-emerald-500'
                    },
                    { 
                      label: 'Vues totales', 
                      value: stats.performance.views, 
                      icon: TrendingUp,
                      color: 'from-purple-500 to-indigo-500'
                    }
                  ].map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div key={index} className={`bg-gradient-to-br ${stat.color} text-white rounded-2xl p-6 shadow-lg`}>
                        <div className="flex items-center justify-between mb-4">
                          <Icon className="w-8 h-8 text-white opacity-90" />
                          <span className="text-2xl font-bold">{formatNumber(stat.value)}</span>
                        </div>
                        <p className="text-white text-opacity-90 text-sm font-medium">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Détails des statistiques */}
            {!statsLoading && !statsError && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statistiques annonces */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Package className="w-5 h-5 text-blue-500" />
                    <span>Statut des annonces</span>
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Approuvées', value: stats.listings.approved, color: 'bg-green-500', icon: CheckCircle },
                      { label: 'En attente', value: stats.listings.pending, color: 'bg-yellow-500', icon: Clock },
                      { label: 'Rejetées', value: stats.listings.rejected, color: 'bg-red-500', icon: XCircle },
                      { label: 'Désactivées', value: stats.listings.disabled, color: 'bg-gray-500', icon: Package }
                    ].map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{formatNumber(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Engagement */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    <span>Engagement</span>
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Favoris enregistrés', value: stats.engagement.favoritesSaved, icon: Heart },
                      { label: 'Taux de conversion', value: `${stats.performance.conversion}%`, icon: TrendingUp },
                      { label: 'Clicks WhatsApp', value: stats.performance.clicks, icon: MessageCircle }
                    ].map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{item.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section Performance (Nouvelle fonctionnalité) */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
              <h2 className="text-xl font-semibold text-gray-900">Performance et Insights</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Insights de performance */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  <span>Vos performances</span>
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
                    <div>
                      <p className="text-sm font-medium text-purple-900">Score d'engagement</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round((stats.engagement.favoritesReceived + stats.engagement.commentsReceived) / Math.max(stats.listings.approved, 1))}
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-purple-500" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Taux d'approbation</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {stats.listings.total > 0 
                          ? `${Math.round((stats.listings.approved / stats.listings.total) * 100)}%`
                          : '0%'
                        }
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
              </div>

              {/* Recommandations */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  <span>Recommandations</span>
                </h3>

                <div className="space-y-3">
                  {stats.listings.pending > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <p className="text-sm text-amber-800">
                        Vous avez {stats.listings.pending} annonce(s) en attente de validation
                      </p>
                    </div>
                  )}

                  {stats.engagement.favoritesReceived === 0 && stats.listings.approved > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <Heart className="w-4 h-4 text-blue-600" />
                      <p className="text-sm text-blue-800">
                        Améliorez vos photos pour augmenter les favoris
                      </p>
                    </div>
                  )}

                  {stats.listings.approved > 5 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800">
                        Excellent ! Pensez à promouvoir vos meilleures annonces
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                  <ClipboardList className="w-4 h-4" />
                  Historique des commandes
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Mes commandes</h2>
                <p className="text-sm text-gray-500">Retrouvez toutes les commandes créées par l’administrateur.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Total : {orders.length}</span>
                <button
                  type="button"
                  onClick={fetchOrders}
                  disabled={ordersLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {ordersLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="#c7d2fe" strokeWidth="4" opacity="0.3" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Chargement…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582M20 20v-5h-.581M5 9a7 7 0 0114 0M19 15a7 7 0 01-14 0" />
                      </svg>
                      Actualiser
                    </>
                  )}
                </button>
              </div>
            </div>

            {ordersError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-6">
                {ordersError}
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <ClipboardList className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Aucune commande disponible</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Un gestionnaire enregistre vos commandes depuis l’admin. Dès qu’une commande est créée, elle s’affichera ici avec son statut.
                </p>
              </div>
            )}

            {(ordersLoading || orders.length > 0) && (
              <div className="space-y-4">
                {ordersLoading && orders.length === 0
                  ? Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="animate-pulse border border-gray-100 rounded-2xl p-5 bg-gray-50" />
                    ))
                  : orders.map((order) => {
                      const orderItems =
                        order.items && order.items.length
                          ? order.items
                          : order.productSnapshot
                          ? [{ snapshot: order.productSnapshot, quantity: 1 }]
                          : [];

                      return (
                        <div key={order._id} className="border border-gray-100 rounded-2xl p-5 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-gray-500">Commande #{order._id.slice(-6)}</p>
                              <div className="mt-1 space-y-1 text-sm text-gray-700">
                                {orderItems.map((item, idx) => (
                                  <div key={`${order._id}-${idx}`} className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                                    <span className="text-xs text-gray-500">
                                      x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()} FCFA
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                <span className="inline-flex items-center gap-1">
                                  <Shield className="w-3.5 h-3.5 text-indigo-500" />
                                  Gestionnaire : {order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket'}
                                </span>
                                <span className="hidden sm:block text-gray-300">•</span>
                                <span className="font-semibold text-gray-700">
                                  Statut : {ORDER_STATUS_LABELS[order.status] || 'Enregistrée'}
                                </span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                              ORDER_STATUS_STYLES[order.status] || 'border-gray-200 bg-gray-50 text-gray-600'
                            }`}>
                              {order.status === 'confirmed' && <Package size={14} />}
                              {order.status === 'delivering' && <Truck size={14} />}
                              {order.status === 'delivered' && <CheckCircle size={14} />}
                              {ORDER_STATUS_LABELS[order.status] || 'Statut inconnu'}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-gray-600">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-400">Adresse de livraison</p>
                              <p className="font-medium text-gray-900">{order.deliveryAddress}</p>
                              <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <MapPin size={13} />
                                {order.deliveryCity}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-400">Suivi</p>
                              {order.trackingNote ? (
                                <p>{order.trackingNote}</p>
                              ) : (
                                <p className="text-xs text-gray-500">Aucune note ajoutée pour le moment.</p>
                              )}
                            </div>
                          </div>

                          <OrderProgress status={order.status} />

                          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              Créée le {new Date(order.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {order.shippedAt && (
                              <span className="inline-flex items-center gap-1">
                                <Truck size={12} />
                                Expédiée le {new Date(order.shippedAt).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                            {order.deliveredAt && (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle size={12} />
                                Livrée le {new Date(order.deliveredAt).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
