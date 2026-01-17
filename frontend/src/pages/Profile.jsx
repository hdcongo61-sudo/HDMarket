import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  ClipboardList, AlertTriangle, Paperclip, FileText
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { buildShopPath } from '../utils/links';

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
  pending: 'En attente',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée'
};

const ORDER_STATUS_STYLES = {
  pending: 'border-gray-200 bg-gray-50 text-gray-700',
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800'
};

const ORDER_FLOW = [
  {
    id: 'pending',
    label: 'Commande en attente',
    description: 'Votre commande est enregistrée et en attente de validation.',
    icon: Clock
  },
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
                      {step.id === 'pending'
                        ? 'En attente'
                        : step.id === 'delivered'
                        ? 'Terminée'
                        : 'En cours'}
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

const formatComplaintDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

const SHOP_HOUR_DAY_DEFINITIONS = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' }
];

const createDefaultShopHours = () =>
  SHOP_HOUR_DAY_DEFINITIONS.map((day) => ({
    day: day.key,
    label: day.label,
    open: '',
    close: '',
    closed: true
  }));

const hydrateShopHoursFromUser = (value) => {
  if (!Array.isArray(value) || !value.length) {
    return createDefaultShopHours();
  }
  const map = new Map();
  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const dayKey = typeof item.day === 'string' ? item.day : '';
    const definition = SHOP_HOUR_DAY_DEFINITIONS.find((entry) => entry.key === dayKey);
    if (!definition) return;
    const closed =
      typeof item.closed === 'boolean'
        ? item.closed
        : item.closed === 'true' || item.closed === '1' || item.closed === 1;
    map.set(dayKey, {
      day: dayKey,
      label: definition.label,
      open: typeof item.open === 'string' ? item.open : '',
      close: typeof item.close === 'string' ? item.close : '',
      closed
    });
  });
  return SHOP_HOUR_DAY_DEFINITIONS.map((definition) => {
    const saved = map.get(definition.key);
    if (saved) {
      return { ...saved, label: definition.label };
    }
    return {
      day: definition.key,
      label: definition.label,
      open: '',
      close: '',
      closed: true
    };
  });
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
  const [shopBannerFile, setShopBannerFile] = useState(null);
  const [shopBannerPreview, setShopBannerPreview] = useState('');
  const [appLogoDesktopFile, setAppLogoDesktopFile] = useState(null);
  const [appLogoDesktopPreview, setAppLogoDesktopPreview] = useState('');
  const [appLogoDesktopSaving, setAppLogoDesktopSaving] = useState(false);
  const [appLogoDesktopError, setAppLogoDesktopError] = useState('');
  const [appLogoDesktopSuccess, setAppLogoDesktopSuccess] = useState('');
  const [appLogoMobileFile, setAppLogoMobileFile] = useState(null);
  const [appLogoMobilePreview, setAppLogoMobilePreview] = useState('');
  const [appLogoMobileSaving, setAppLogoMobileSaving] = useState(false);
  const [appLogoMobileError, setAppLogoMobileError] = useState('');
  const [appLogoMobileSuccess, setAppLogoMobileSuccess] = useState('');
  const [heroBannerFile, setHeroBannerFile] = useState(null);
  const [heroBannerPreview, setHeroBannerPreview] = useState('');
  const [heroBannerSaving, setHeroBannerSaving] = useState(false);
  const [heroBannerError, setHeroBannerError] = useState('');
  const [heroBannerSuccess, setHeroBannerSuccess] = useState('');
  const [promoBannerFile, setPromoBannerFile] = useState(null);
  const [promoBannerPreview, setPromoBannerPreview] = useState('');
  const [promoBannerMobileFile, setPromoBannerMobileFile] = useState(null);
  const [promoBannerMobilePreview, setPromoBannerMobilePreview] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoBannerSaving, setPromoBannerSaving] = useState(false);
  const [promoBannerError, setPromoBannerError] = useState('');
  const [promoBannerSuccess, setPromoBannerSuccess] = useState('');
  const [shopHours, setShopHours] = useState(() => createDefaultShopHours());
  const [stats, setStats] = useState(() => createDefaultStats());
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCode, setPasswordCode] = useState('');
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordCodeSending, setPasswordCodeSending] = useState(false);
  const [passwordCodeError, setPasswordCodeError] = useState('');
  const [passwordCodeMessage, setPasswordCodeMessage] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintFiles, setComplaintFiles] = useState([]);
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [complaintFeedback, setComplaintFeedback] = useState('');
  const [myComplaints, setMyComplaints] = useState([]);
  const [complaintListLoading, setComplaintListLoading] = useState(false);
  const [complaintListError, setComplaintListError] = useState('');
  const userShopLink = user?.accountType === 'shop' ? buildShopPath(user) : null;

  const mobileHighlights = [
    { label: 'Annonces', value: stats.listings?.total || 0 },
    { label: 'Favoris reçus', value: stats.engagement?.favoritesReceived || 0 },
    { label: 'Vues', value: stats.performance?.views || 0 },
    { label: 'WhatsApp', value: stats.performance?.clicks || 0 }
  ];

  const userComplaintStatusLabels = {
    pending: 'En attente',
    in_review: 'En cours',
    resolved: 'Résolue'
  };

  const userComplaintStatusStyles = {
    pending: 'bg-orange-100 text-orange-700',
    in_review: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-700'
  };

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return '';
      const cleaned = url.replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) {
        return cleaned;
      }
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const formatDateInput = useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }, []);

  useEffect(
    () => () => {
      if (shopLogoPreview && shopLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopLogoPreview);
      }
      if (shopBannerPreview && shopBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopBannerPreview);
      }
      if (heroBannerPreview && heroBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(heroBannerPreview);
      }
      if (appLogoDesktopPreview && appLogoDesktopPreview.startsWith('blob:')) {
        URL.revokeObjectURL(appLogoDesktopPreview);
      }
      if (appLogoMobilePreview && appLogoMobilePreview.startsWith('blob:')) {
        URL.revokeObjectURL(appLogoMobilePreview);
      }
      if (promoBannerPreview && promoBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(promoBannerPreview);
      }
      if (promoBannerMobilePreview && promoBannerMobilePreview.startsWith('blob:')) {
        URL.revokeObjectURL(promoBannerMobilePreview);
      }
    },
    [
      shopLogoPreview,
      shopBannerPreview,
      heroBannerPreview,
      appLogoDesktopPreview,
      appLogoMobilePreview,
      promoBannerPreview,
      promoBannerMobilePreview
    ]
  );

  useEffect(() => {
    if (!user) {
      setShopHours(createDefaultShopHours());
      return;
    }
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
    setShopBannerPreview(user.shopBanner || '');
    setShopHours(hydrateShopHoursFromUser(user.shopHours));
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setHeroBannerPreview('');
      setHeroBannerFile(null);
      setAppLogoDesktopPreview('');
      setAppLogoDesktopFile(null);
      setAppLogoMobilePreview('');
      setAppLogoMobileFile(null);
      setPromoBannerPreview('');
      setPromoBannerFile(null);
      setPromoBannerMobilePreview('');
      setPromoBannerMobileFile(null);
      setPromoBannerLink('');
      setPromoBannerStartAt('');
      setPromoBannerEndAt('');
      return;
    }
    let active = true;
    const loadHeroBanner = async () => {
      setHeroBannerError('');
      try {
        const { data } = await api.get('/settings/hero-banner');
        if (!active) return;
        setHeroBannerPreview(data?.heroBanner || '');
      } catch (err) {
        if (!active) return;
        setHeroBannerError(
          err.response?.data?.message || 'Impossible de charger la bannière du hero.'
        );
      }
    };
    const loadAppLogo = async () => {
      setAppLogoDesktopError('');
      setAppLogoMobileError('');
      try {
        const { data } = await api.get('/settings/app-logo');
        if (!active) return;
        setAppLogoDesktopPreview(data?.appLogoDesktop || '');
        setAppLogoMobilePreview(data?.appLogoMobile || '');
      } catch (err) {
        if (!active) return;
        const message =
          err.response?.data?.message || "Impossible de charger les logos de l'application.";
        setAppLogoDesktopError(message);
        setAppLogoMobileError(message);
      }
    };
    const loadPromoBanner = async () => {
      setPromoBannerError('');
      try {
        const { data } = await api.get('/settings/promo-banner');
        if (!active) return;
        setPromoBannerPreview(data?.promoBanner || '');
        setPromoBannerMobilePreview(data?.promoBannerMobile || '');
        setPromoBannerLink(data?.promoBannerLink || '');
        setPromoBannerStartAt(formatDateInput(data?.promoBannerStartAt));
        setPromoBannerEndAt(formatDateInput(data?.promoBannerEndAt));
      } catch (err) {
        if (!active) return;
        setPromoBannerError(
          err.response?.data?.message || "Impossible de charger la bannière publicitaire."
        );
      }
    };
    loadHeroBanner();
    loadAppLogo();
    loadPromoBanner();
    return () => {
      active = false;
    };
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

  const loadUserComplaints = useCallback(async () => {
    if (!user) {
      setMyComplaints([]);
      setComplaintListError('');
      return;
    }
    setComplaintListLoading(true);
    setComplaintListError('');
    try {
      const { data } = await api.get('/users/complaints');
      const normalized = Array.isArray(data)
        ? data.map((complaint) => ({
            ...complaint,
            attachments: (Array.isArray(complaint.attachments) ? complaint.attachments : []).map(
              (attachment) => ({
                ...attachment,
                url: normalizeUrl(attachment.path || attachment.url || '')
              })
            )
          }))
        : [];
      setMyComplaints(normalized);
    } catch (err) {
      setComplaintListError(
        err.response?.data?.message || err.message || 'Impossible de charger vos réclamations.'
      );
    } finally {
      setComplaintListLoading(false);
    }
  }, [normalizeUrl, user]);

  useEffect(() => {
    loadUserComplaints();
  }, [loadUserComplaints]);

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
        setShopBannerFile(null);
        setShopBannerPreview('');
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onLogoChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setShopLogoFile(file);
    if (file) {
      if (shopLogoPreview && shopLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopLogoPreview);
      }
      setShopLogoPreview(URL.createObjectURL(file));
    }
  };

  const removeLogo = () => {
    setShopLogoFile(null);
    setShopLogoPreview('');
  };

  const onBannerChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setShopBannerFile(file);
    if (file) {
      if (shopBannerPreview && shopBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopBannerPreview);
      }
      setShopBannerPreview(URL.createObjectURL(file));
    }
  };

  const removeBanner = () => {
    setShopBannerFile(null);
    setShopBannerPreview('');
  };

  const onAppLogoDesktopChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setAppLogoDesktopFile(file);
    setAppLogoDesktopError('');
    setAppLogoDesktopSuccess('');
    if (file) {
      if (appLogoDesktopPreview && appLogoDesktopPreview.startsWith('blob:')) {
        URL.revokeObjectURL(appLogoDesktopPreview);
      }
      setAppLogoDesktopPreview(URL.createObjectURL(file));
    }
  };

  const onAppLogoMobileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setAppLogoMobileFile(file);
    setAppLogoMobileError('');
    setAppLogoMobileSuccess('');
    if (file) {
      if (appLogoMobilePreview && appLogoMobilePreview.startsWith('blob:')) {
        URL.revokeObjectURL(appLogoMobilePreview);
      }
      setAppLogoMobilePreview(URL.createObjectURL(file));
    }
  };

  const onHeroBannerChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setHeroBannerFile(file);
    setHeroBannerError('');
    setHeroBannerSuccess('');
    if (file) {
      if (heroBannerPreview && heroBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(heroBannerPreview);
      }
      setHeroBannerPreview(URL.createObjectURL(file));
    }
  };

  const onPromoBannerChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setPromoBannerFile(file);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    if (file) {
      if (promoBannerPreview && promoBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(promoBannerPreview);
      }
      setPromoBannerPreview(URL.createObjectURL(file));
    }
  };

  const onPromoBannerMobileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setPromoBannerMobileFile(file);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    if (file) {
      if (promoBannerMobilePreview && promoBannerMobilePreview.startsWith('blob:')) {
        URL.revokeObjectURL(promoBannerMobilePreview);
      }
      setPromoBannerMobilePreview(URL.createObjectURL(file));
    }
  };

  const saveHeroBanner = async () => {
    if (!heroBannerFile) {
      setHeroBannerError('Veuillez sélectionner une image pour la bannière.');
      return;
    }
    setHeroBannerSaving(true);
    setHeroBannerError('');
    setHeroBannerSuccess('');
    try {
      const payload = new FormData();
      payload.append('heroBanner', heroBannerFile);
      const { data } = await api.put('/admin/hero-banner', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setHeroBannerPreview(data?.heroBanner || heroBannerPreview);
      setHeroBannerFile(null);
      setHeroBannerSuccess('Bannière mise à jour avec succès.');
      showToast('Bannière mise à jour.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || "Impossible d'enregistrer la bannière.";
      setHeroBannerError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setHeroBannerSaving(false);
    }
  };

  const savePromoBanner = async () => {
    if (promoBannerStartAt && promoBannerEndAt) {
      const startDate = new Date(promoBannerStartAt);
      const endDate = new Date(promoBannerEndAt);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setPromoBannerError('Dates de bannière invalides.');
        return;
      }
      if (endDate < startDate) {
        setPromoBannerError('La date de fin doit être après la date de début.');
        return;
      }
    }
    setPromoBannerSaving(true);
    setPromoBannerError('');
    setPromoBannerSuccess('');
    try {
      const payload = new FormData();
      if (promoBannerFile) {
        payload.append('promoBanner', promoBannerFile);
      }
      if (promoBannerMobileFile) {
        payload.append('promoBannerMobile', promoBannerMobileFile);
      }
      payload.append('promoBannerLink', promoBannerLink.trim());
      payload.append('promoBannerStartAt', promoBannerStartAt);
      payload.append('promoBannerEndAt', promoBannerEndAt);
      const { data } = await api.put('/admin/promo-banner', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPromoBannerPreview(data?.promoBanner || promoBannerPreview);
      setPromoBannerMobilePreview(data?.promoBannerMobile || promoBannerMobilePreview);
      setPromoBannerLink(data?.promoBannerLink || promoBannerLink);
      setPromoBannerStartAt(formatDateInput(data?.promoBannerStartAt));
      setPromoBannerEndAt(formatDateInput(data?.promoBannerEndAt));
      setPromoBannerFile(null);
      setPromoBannerMobileFile(null);
      setPromoBannerSuccess('Bannière publicitaire mise à jour avec succès.');
      showToast('Bannière publicitaire mise à jour.', { variant: 'success' });
    } catch (err) {
      const message =
        err.response?.data?.message || "Impossible d'enregistrer la bannière publicitaire.";
      setPromoBannerError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setPromoBannerSaving(false);
    }
  };

  const saveAppLogoDesktop = async () => {
    if (!appLogoDesktopFile) {
      setAppLogoDesktopError('Veuillez sélectionner un logo desktop.');
      return;
    }
    setAppLogoDesktopSaving(true);
    setAppLogoDesktopError('');
    setAppLogoDesktopSuccess('');
    try {
      const payload = new FormData();
      payload.append('appLogoDesktop', appLogoDesktopFile);
      const { data } = await api.put('/admin/app-logo/desktop', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAppLogoDesktopPreview(data?.appLogoDesktop || appLogoDesktopPreview);
      setAppLogoDesktopFile(null);
      setAppLogoDesktopSuccess('Logo desktop mis à jour avec succès.');
      showToast('Logo desktop mis à jour.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || "Impossible d'enregistrer le logo desktop.";
      setAppLogoDesktopError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setAppLogoDesktopSaving(false);
    }
  };

  const saveAppLogoMobile = async () => {
    if (!appLogoMobileFile) {
      setAppLogoMobileError('Veuillez sélectionner un logo mobile.');
      return;
    }
    setAppLogoMobileSaving(true);
    setAppLogoMobileError('');
    setAppLogoMobileSuccess('');
    try {
      const payload = new FormData();
      payload.append('appLogoMobile', appLogoMobileFile);
      const { data } = await api.put('/admin/app-logo/mobile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAppLogoMobilePreview(data?.appLogoMobile || appLogoMobilePreview);
      setAppLogoMobileFile(null);
      setAppLogoMobileSuccess('Logo mobile mis à jour avec succès.');
      showToast('Logo mobile mis à jour.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || "Impossible d'enregistrer le logo mobile.";
      setAppLogoMobileError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setAppLogoMobileSaving(false);
    }
  };

  const resetShopHours = () => {
    setShopHours(createDefaultShopHours());
  };

  const updateShopHour = (day, changes) => {
    setShopHours((prev) =>
      prev.map((entry) => (entry.day === day ? { ...entry, ...changes } : entry))
    );
  };

  const handleShopTimeChange = (day, field) => (event) => {
    updateShopHour(day, { [field]: event.target.value });
  };

  const toggleShopHourClosed = (day, closed) => {
    updateShopHour(day, { closed });
  };

  const handleComplaintFilesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const remainingSlots = Math.max(0, 2 - complaintFiles.length);
    const allowedFiles = selectedFiles.slice(0, remainingSlots);
    if (!allowedFiles.length) {
      setComplaintError('Vous pouvez ajouter au maximum 2 fichiers.');
      event.target.value = '';
      return;
    }
    if (selectedFiles.length > allowedFiles.length) {
      setComplaintError('Maximum 2 fichiers autorisés, seuls les premiers ont été ajoutés.');
    } else {
      setComplaintError('');
    }
    setComplaintFiles((prev) => [...prev, ...allowedFiles]);
    event.target.value = '';
  };

  const removeComplaintFile = (index) => {
    setComplaintFiles((prev) => prev.filter((_, i) => i !== index));
    setComplaintError('');
  };

  const sendPasswordChangeCode = async () => {
    setPasswordCodeSending(true);
    setPasswordCodeError('');
    setPasswordCodeMessage('');
    try {
      await api.post('/users/password/send-code');
      setPasswordCodeSent(true);
      setPasswordCodeMessage('Code envoyé par SMS.');
      showToast('Code envoyé par SMS.', { variant: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Impossible d’envoyer le code.';
      setPasswordCodeError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setPasswordCodeSending(false);
    }
  };

  const applyPasswordChange = async () => {
    if (!form.password) return true;
    if (!passwordCode.trim()) {
      const message = 'Veuillez saisir le code SMS avant de modifier le mot de passe.';
      setPasswordCodeError(message);
      showToast(message, { variant: 'error' });
      return false;
    }
    try {
      await api.post('/users/password/change', {
        verificationCode: passwordCode.trim(),
        newPassword: form.password
      });
      setPasswordCode('');
      setPasswordCodeSent(false);
      setPasswordCodeError('');
      setPasswordCodeMessage('Mot de passe mis à jour.');
      showToast('Mot de passe mis à jour.', { variant: 'success' });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Impossible de modifier le mot de passe.';
      setPasswordCodeError(message);
      showToast(message, { variant: 'error' });
      return false;
    }
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
      if (form.password) {
        const passwordUpdated = await applyPasswordChange();
        if (!passwordUpdated) return;
      }
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
      const normalizedShopHours = shopHours.map((entry) => ({
        day: entry.day,
        closed: Boolean(entry.closed),
        open: entry.closed ? '' : entry.open || '',
        close: entry.closed ? '' : entry.close || ''
      }));
      payload.append('name', form.name);
      payload.append('email', form.email);
      payload.append('accountType', form.accountType);
      payload.append('city', form.city);
      payload.append('gender', form.gender);
      payload.append('address', form.address.trim());
      if (form.accountType === 'shop') {
        payload.append('shopName', form.shopName);
        payload.append('shopAddress', form.shopAddress);
        payload.append('shopDescription', form.shopDescription.trim());
        if (shopLogoFile) {
          payload.append('shopLogo', shopLogoFile);
        }
        if (user?.shopVerified && shopBannerFile) {
          payload.append('shopBanner', shopBannerFile);
        }
        payload.append('shopHours', JSON.stringify(normalizedShopHours));
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
      setShopBannerPreview(data.shopBanner || '');
      setShopBannerFile(null);
      setPasswordCode('');
      setPasswordCodeSent(false);
      setPasswordCodeError('');
      setPasswordCodeMessage('');
      
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

  const submitComplaint = async (event) => {
    event.preventDefault();
    setComplaintError('');
    setComplaintFeedback('');
    if (!complaintMessage.trim()) {
      setComplaintError('Veuillez détailler votre réclamation.');
      return;
    }
    setComplaintLoading(true);
    try {
      const payload = new FormData();
      payload.append('subject', complaintSubject.trim());
      payload.append('message', complaintMessage.trim());
      complaintFiles.forEach((file) => payload.append('attachments', file));
      await api.post('/users/complaints', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setComplaintFeedback('Votre réclamation a bien été envoyée.');
      setComplaintSubject('');
      setComplaintMessage('');
      setComplaintFiles([]);
      showToast('Réclamation envoyée', { variant: 'success' });
      await loadUserComplaints();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Une erreur est survenue.';
      setComplaintError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setComplaintLoading(false);
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
          <>
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
                <span>Téléphone</span>
              </label>
              <div className="relative">
                <input
                  className="w-full px-4 py-3 pl-11 bg-gray-100 border border-gray-200 rounded-xl text-gray-600"
                  value={form.phone}
                  readOnly
                  disabled
                />
                <span className="absolute top-2 right-3 text-[11px] text-gray-500">Non modifiable</span>
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>Horaires d'ouverture</span>
                      </div>
                      <button
                        type="button"
                        onClick={resetShopHours}
                        disabled={loading}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        Réinitialiser
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Ces horaires sont indiqués aux acheteurs sur votre boutique publique.
                    </p>
                    <div className="space-y-2">
                      {shopHours.map((entry) => (
                        <div
                          key={entry.day}
                          className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{entry.label}</p>
                            <p className="text-xs text-gray-500">
                              {entry.closed
                                ? 'Fermé'
                                : entry.open && entry.close
                                ? `${entry.open} – ${entry.close}`
                                : 'Horaires partiels'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <input
                              type="time"
                              value={entry.open}
                              onChange={handleShopTimeChange(entry.day, 'open')}
                              disabled={entry.closed || loading}
                              className="h-10 w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <span className="text-xs text-gray-400">à</span>
                            <input
                              type="time"
                              value={entry.close}
                              onChange={handleShopTimeChange(entry.day, 'close')}
                              disabled={entry.closed || loading}
                              className="h-10 w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              <input
                                type="checkbox"
                                checked={entry.closed}
                                onChange={(event) => toggleShopHourClosed(entry.day, event.target.checked)}
                                disabled={loading}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>Fermé</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Laissez un jour en fermée si vous n’êtes pas disponible ou si aucun horaire n’est défini.
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

                  {user?.shopVerified ? (
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                        <Image className="w-4 h-4 text-indigo-500" />
                        <span>Bannière de la boutique</span>
                      </label>
                      <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group p-6">
                        {shopBannerPreview ? (
                          <div className="text-center w-full">
                            <img
                              src={shopBannerPreview}
                              alt="Bannière boutique"
                              className="h-32 w-full rounded-2xl object-cover mx-auto mb-3 border-2 border-indigo-200"
                            />
                            <p className="text-sm text-gray-600 mb-2">Bannière actuelle</p>
                            <button
                              type="button"
                              onClick={removeBanner}
                              className="text-sm text-red-600 hover:text-red-500"
                            >
                              Supprimer
                            </button>
                          </div>
                        ) : (
                          <label className="text-center cursor-pointer">
                            <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                            <span className="text-sm text-gray-500">
                              <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                              <br />
                              <span className="text-xs">PNG, JPG - 1200x400px recommandé</span>
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={onBannerChange}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-700">
                      La bannière est disponible uniquement pour les boutiques certifiées.
                    </div>
                  )}
                </div>
              )}

              {user?.role === 'admin' && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Logos de l’application</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Deux versions sont utilisées dans la barre de navigation. Chaque logo sera converti en PNG.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">Logo desktop</p>
                        <span className="text-xs text-gray-500">Largeur recommandée</span>
                      </div>
                      {appLogoDesktopError && (
                        <p className="text-sm text-red-600">{appLogoDesktopError}</p>
                      )}
                      {appLogoDesktopSuccess && (
                        <p className="text-sm text-emerald-600">{appLogoDesktopSuccess}</p>
                      )}
                      <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-white hover:bg-gray-50 transition-colors group p-6">
                        {appLogoDesktopPreview ? (
                          <div className="text-center w-full">
                            <img
                              src={appLogoDesktopPreview}
                              alt="Logo desktop"
                              className="h-16 w-auto max-w-full object-contain mx-auto mb-3"
                            />
                            <p className="text-sm text-gray-600 mb-2">Logo actuel</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Aucun logo défini.</p>
                        )}
                        <label className="text-center cursor-pointer">
                          <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                          <span className="text-sm text-gray-500">
                            <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                            <br />
                            <span className="text-xs">PNG, JPG, WEBP - format horizontal</span>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onAppLogoDesktopChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={saveAppLogoDesktop}
                        disabled={appLogoDesktopSaving || !appLogoDesktopFile}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {appLogoDesktopSaving ? 'Mise à jour…' : 'Enregistrer le logo desktop'}
                      </button>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">Logo mobile</p>
                        <span className="text-xs text-gray-500">Carré recommandé</span>
                      </div>
                      {appLogoMobileError && (
                        <p className="text-sm text-red-600">{appLogoMobileError}</p>
                      )}
                      {appLogoMobileSuccess && (
                        <p className="text-sm text-emerald-600">{appLogoMobileSuccess}</p>
                      )}
                      <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-white hover:bg-gray-50 transition-colors group p-6">
                        {appLogoMobilePreview ? (
                          <div className="text-center w-full">
                            <img
                              src={appLogoMobilePreview}
                              alt="Logo mobile"
                              className="h-16 w-16 rounded-2xl object-contain mx-auto mb-3 border border-gray-200 bg-white"
                            />
                            <p className="text-sm text-gray-600 mb-2">Logo actuel</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Aucun logo défini.</p>
                        )}
                        <label className="text-center cursor-pointer">
                          <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                          <span className="text-sm text-gray-500">
                            <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                            <br />
                            <span className="text-xs">PNG, JPG, WEBP - format carré</span>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onAppLogoMobileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={saveAppLogoMobile}
                        disabled={appLogoMobileSaving || !appLogoMobileFile}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {appLogoMobileSaving ? 'Mise à jour…' : 'Enregistrer le logo mobile'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {user?.role === 'admin' && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-6 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Bannière publicitaire</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Cette bannière apparaît sur la page d’accueil. Ajoutez un lien pour rediriger les visiteurs.
                  </p>
                  {promoBannerError && <p className="text-sm text-red-600">{promoBannerError}</p>}
                  {promoBannerSuccess && (
                    <p className="text-sm text-emerald-600">{promoBannerSuccess}</p>
                  )}
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">Lien du banner</label>
                    <input
                      type="text"
                      value={promoBannerLink}
                      onChange={(e) => setPromoBannerLink(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="https://exemple.com/promo ou /products"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-gray-500">Date de début</label>
                      <input
                        type="date"
                        value={promoBannerStartAt}
                        onChange={(e) => setPromoBannerStartAt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-gray-500">Date de fin</label>
                      <input
                        type="date"
                        value={promoBannerEndAt}
                        onChange={(e) => setPromoBannerEndAt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    En dehors de cette période, la bannière par défaut sera affichée.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group p-6">
                      {promoBannerPreview ? (
                        <div className="text-center w-full">
                          <img
                            src={promoBannerPreview}
                            alt="Bannière publicitaire"
                            className="h-28 w-full rounded-2xl object-cover mx-auto mb-3 border border-gray-200"
                          />
                          <p className="text-sm text-gray-600 mb-2">Bannière desktop</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucune bannière desktop définie.</p>
                      )}
                      <label className="text-center cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                        <span className="text-sm text-gray-500">
                          <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                          <br />
                          <span className="text-xs">PNG, JPG - format large recommandé</span>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onPromoBannerChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group p-6">
                      {promoBannerMobilePreview ? (
                        <div className="text-center w-full">
                          <img
                            src={promoBannerMobilePreview}
                            alt="Bannière publicitaire mobile"
                            className="h-28 w-full rounded-2xl object-cover mx-auto mb-3 border border-gray-200"
                          />
                          <p className="text-sm text-gray-600 mb-2">Bannière mobile</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucune bannière mobile définie.</p>
                      )}
                      <label className="text-center cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                        <span className="text-sm text-gray-500">
                          <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                          <br />
                          <span className="text-xs">PNG, JPG - format mobile recommandé</span>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onPromoBannerMobileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={savePromoBanner}
                    disabled={promoBannerSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {promoBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière'}
                  </button>
                </div>
              )}

              {user?.role === 'admin' && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Bannière du HERO (Accueil)</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Cette image s’affiche en arrière-plan du HERO sur la page d’accueil.
                  </p>
                  {heroBannerError && (
                    <p className="text-sm text-red-600">{heroBannerError}</p>
                  )}
                  {heroBannerSuccess && (
                    <p className="text-sm text-emerald-600">{heroBannerSuccess}</p>
                  )}
                  <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group p-6">
                    {heroBannerPreview ? (
                      <div className="text-center w-full">
                        <img
                          src={heroBannerPreview}
                          alt="Bannière HERO"
                          className="h-32 w-full rounded-2xl object-cover mx-auto mb-3 border-2 border-indigo-200"
                        />
                        <p className="text-sm text-gray-600 mb-2">Bannière actuelle</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucune bannière définie pour le moment.</p>
                    )}
                    <label className="text-center cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 mx-auto" />
                      <span className="text-sm text-gray-500">
                        <span className="text-indigo-600 font-medium">Cliquez pour uploader</span>
                        <br />
                        <span className="text-xs">PNG, JPG - 1600x600px recommandé</span>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onHeroBannerChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={saveHeroBanner}
                    disabled={heroBannerSaving || !heroBannerFile}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {heroBannerSaving ? 'Mise à jour…' : 'Enregistrer la bannière'}
                  </button>
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

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Code SMS de sécurité</p>
                      <p className="text-xs text-gray-500">
                        Un code est requis pour confirmer la modification du mot de passe.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={sendPasswordChangeCode}
                      disabled={passwordCodeSending || loading}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordCodeSending
                        ? 'Envoi...'
                        : passwordCodeSent
                        ? 'Renvoyer le code'
                        : 'Envoyer le code'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full px-4 py-3 pl-11 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="Code reçu par SMS"
                      value={passwordCode}
                      onChange={(e) => setPasswordCode(e.target.value)}
                      disabled={loading}
                    />
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  {passwordCodeError && <p className="text-sm text-red-600">{passwordCodeError}</p>}
                  {passwordCodeMessage && <p className="text-sm text-emerald-600">{passwordCodeMessage}</p>}
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
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                <span>Suivi de mes réclamations</span>
                {complaintListLoading && (
                  <span className="text-xs font-normal text-gray-500">Chargement…</span>
                )}
              </div>
              {complaintListLoading ? (
                <p className="text-xs text-gray-500">Chargement des réclamations en cours…</p>
              ) : complaintListError ? (
                <p className="text-xs text-red-600">{complaintListError}</p>
              ) : myComplaints.length ? (
                <ul className="space-y-3">
                  {myComplaints.map((complaint) => (
                    <li
                      key={complaint._id}
                      className="space-y-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-gray-900">{complaint.subject || 'Sans objet'}</p>
                          <p className="text-[11px] text-gray-500">
                            {formatComplaintDate(complaint.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            userComplaintStatusStyles[complaint.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {userComplaintStatusLabels[complaint.status] || complaint.status}
                        </span>
                      </div>
                      <p className="text-gray-600 whitespace-pre-line break-words">{complaint.message}</p>
                      {complaint.attachments?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {complaint.attachments
                            .filter((attachment) => attachment.url)
                            .map((attachment, index) => (
                              <a
                                key={`${attachment.filename}-${index}`}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:border-rose-200"
                              >
                                <Paperclip className="w-3 h-3" />
                                {attachment.originalName || attachment.filename}
                              </a>
                            ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Vous n’avez encore déposé aucune réclamation.</p>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mt-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full"></div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Réclamations</h2>
                <p className="text-sm text-gray-500">
                  Signalez un problème ou partagez une capture d’écran : vous pouvez joindre deux fichiers.
                </p>
              </div>
            </div>
            <form onSubmit={submitComplaint} className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Objet (facultatif)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                    placeholder="Ex : Annonce non conforme"
                    value={complaintSubject}
                    onChange={(e) => {
                      setComplaintSubject(e.target.value);
                      if (complaintError) setComplaintError('');
                    }}
                    disabled={complaintLoading}
                    maxLength={150}
                  />
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <MessageCircle className="w-4 h-4 text-rose-500" />
                  <span>Description *</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all placeholder-gray-400"
                  rows={4}
                  value={complaintMessage}
                  onChange={(event) => {
                    setComplaintMessage(event.target.value);
                    if (complaintError) setComplaintError('');
                  }}
                  placeholder="Expliquez en détail votre problème pour que nos équipes puissent investiguer."
                  disabled={complaintLoading}
                  required
                  maxLength={1500}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Paperclip className="w-4 h-4 text-rose-500" />
                  <span>Fichiers (max 2)</span>
                </label>
                <label className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 hover:border-rose-300 hover:bg-rose-50 cursor-pointer">
                  <span>Ajouter un fichier</span>
                  <span className="text-[11px] text-gray-400">PNG, JPG, PDF</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleComplaintFilesChange}
                    disabled={complaintLoading}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Les pièces jointes sont visibles uniquement par nos modérateurs.
                </p>
              </div>
              {complaintFiles.length > 0 && (
                <div className="space-y-2">
                  {complaintFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeComplaintFile(index)}
                        disabled={complaintLoading}
                        className="text-xs font-semibold text-red-600 hover:text-red-500"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(complaintError || complaintFeedback) && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    complaintError ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {complaintError ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>{complaintError || complaintFeedback}</span>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={complaintLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-rose-600 hover:to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {complaintLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Réclamation...</span>
                    </div>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Envoyer la réclamation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
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
                                  <div key={`${order._id}-${idx}`} className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">
                                        {item.snapshot?.title || 'Produit'}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()} FCFA
                                      </span>
                                    </div>
                                    {item.snapshot?.confirmationNumber && (
                                      <span className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wide">
                                        Code produit : {item.snapshot.confirmationNumber}
                                      </span>
                                    )}
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
                              {order.status === 'pending' && <Clock size={14} />}
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
