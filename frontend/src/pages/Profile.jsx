import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
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
  ClipboardList, AlertTriangle, Paperclip, FileText,
  Bell,
  DollarSign,
  X,
  Search,
  Filter,
  LayoutGrid,
  List,
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { buildShopPath } from '../utils/links';
import useIsMobile from '../hooks/useIsMobile';
import { useAppSettings } from '../context/AppSettingsContext';

const STATS_PERIOD_OPTIONS = [
  { value: '7', label: '7j' },
  { value: '30', label: '30j' },
  { value: '90', label: '90j' },
  { value: '365', label: '1an' },
  { value: 'all', label: 'Tout' }
];

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

const buildOrderStatusDefaults = (extraFields = {}) => ({
  pending: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0, ...extraFields },
  confirmed: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0, ...extraFields },
  delivering: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0, ...extraFields },
  delivered: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0, ...extraFields },
  cancelled: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0, ...extraFields }
});

const buildSalesStatusDefaults = () => ({
  pending: { count: 0, totalAmount: 0 },
  confirmed: { count: 0, totalAmount: 0 },
  delivering: { count: 0, totalAmount: 0 },
  delivered: { count: 0, totalAmount: 0 },
  cancelled: { count: 0, totalAmount: 0 }
});

const createDefaultStats = () => ({
  listings: { total: 0, approved: 0, pending: 0, rejected: 0, disabled: 0 },
  engagement: { favoritesReceived: 0, commentsReceived: 0, favoritesSaved: 0 },
  performance: { views: 0, clicks: 0, conversion: 0 },
  orders: {
    purchases: {
      totalCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      totalItems: 0,
      byStatus: buildOrderStatusDefaults()
    },
    sales: {
      totalCount: 0,
      totalAmount: 0,
      byStatus: buildSalesStatusDefaults()
    }
  }
});

const ORDER_STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  cancelled: 'Commande annulée'
};

const ORDER_STATUS_STYLES = {
  pending: 'border-gray-200 bg-gray-50 text-gray-700',
  confirmed: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  delivering: 'border-blue-200 bg-blue-50 text-blue-800',
  delivered: 'border-green-200 bg-green-50 text-green-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800'
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

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

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
  const { cities } = useAppSettings();
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
  const [shopHours, setShopHours] = useState(() => createDefaultShopHours());
  const [stats, setStats] = useState(() => createDefaultStats());
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [statsPeriod, setStatsPeriod] = useState('all'); // '7' | '30' | '90' | '365' | 'all' — proposal §4
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
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersFilterStatus, setOrdersFilterStatus] = useState('all');
  const [ordersSortBy, setOrdersSortBy] = useState('date_desc');
  const [ordersViewMode, setOrdersViewMode] = useState('list');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [ordersDateFrom, setOrdersDateFrom] = useState('');
  const [ordersDateTo, setOrdersDateTo] = useState('');
  const [ordersAmountMin, setOrdersAmountMin] = useState('');
  const [ordersAmountMax, setOrdersAmountMax] = useState('');
  const [ordersShowFilters, setOrdersShowFilters] = useState(false);
  const userShopLink = user?.accountType === 'shop' ? buildShopPath(user) : null;
  const isMobile = useIsMobile(768);

  const mobileTabs = useMemo(() => {
    const base = [
      { id: 'profile', label: 'Profil', icon: User },
      { id: 'stats', label: 'Statistiques', icon: BarChart3 },
      { id: 'performance', label: 'Performance', icon: TrendingUp },
      { id: 'orders', label: 'Commandes', icon: ClipboardList }
    ];
    if (user?.accountType === 'shop') {
      base.push({ id: 'shop', label: 'Boutique', icon: Store });
    }
    base.push(
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'security', label: 'Sécurité', icon: Lock }
    );
    return base;
  }, [user?.accountType]);

  const profileCompletionPercent = useMemo(() => {
    let filled = 0;
    let total = 4;
    if (form.name?.trim()) filled++;
    if (form.email?.trim()) filled++;
    if (form.phone?.trim()) filled++;
    if (user?.accountType === 'shop') {
      total = 5;
      if (form.shopName?.trim()) filled++;
    } else {
      filled++; // non-shop counts as "complete" for 4th field
    }
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [form.name, form.email, form.phone, form.shopName, user?.accountType]);

  const mobileHighlights = [
    { label: 'Annonces', value: stats.listings?.total || 0 },
    { label: 'Favoris reçus', value: stats.engagement?.favoritesReceived || 0 },
    { label: 'Vues', value: stats.performance?.views || 0 },
    { label: 'WhatsApp', value: stats.performance?.clicks || 0 }
  ];
  const cityOptions = useMemo(
    () =>
      Array.isArray(cities) && cities.length
        ? cities.map((item) => item.name).filter(Boolean)
        : ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
    [cities]
  );

  useEffect(
    () => () => {
      if (shopLogoPreview && shopLogoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopLogoPreview);
      }
      if (shopBannerPreview && shopBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(shopBannerPreview);
      }
    },
    [shopLogoPreview, shopBannerPreview]
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
        const purchases = data?.orders?.purchases || {};
        const sales = data?.orders?.sales || {};
        setStats({
          listings: { ...baseline.listings, ...(data?.listings || {}) },
          engagement: { ...baseline.engagement, ...(data?.engagement || {}) },
          performance: { ...baseline.performance, ...(data?.performance || {}) },
          orders: {
            purchases: {
              ...baseline.orders.purchases,
              ...purchases,
              byStatus: {
                ...baseline.orders.purchases.byStatus,
                ...(purchases.byStatus || {})
              }
            },
            sales: {
              ...baseline.orders.sales,
              ...sales,
              byStatus: {
                ...baseline.orders.sales.byStatus,
                ...(sales.byStatus || {})
              }
            }
          }
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
      const { data } = await api.get('/orders?limit=200');
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

  useEffect(() => {
    if (!showOrdersModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowOrdersModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOrdersModal]);

  useEffect(() => {
    if (!selectedOrderDetail) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedOrderDetail(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrderDetail]);

  // Filtered & sorted orders for Section Commandes
  const filteredOrders = useMemo(() => {
    let list = [...orders];
    const q = (ordersSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const id = String(o._id || '').toLowerCase();
        const addr = String(o.deliveryAddress || '').toLowerCase();
        const city = String(o.deliveryCity || '').toLowerCase();
        const createdByName = String(o.createdBy?.name || '').toLowerCase();
        const createdByEmail = String(o.createdBy?.email || '').toLowerCase();
        const items = o.items || (o.productSnapshot ? [{ snapshot: o.productSnapshot }] : []);
        const productTitles = items.map((i) => String(i.snapshot?.title || '').toLowerCase()).join(' ');
        return id.includes(q) || addr.includes(q) || city.includes(q) || createdByName.includes(q) || createdByEmail.includes(q) || productTitles.includes(q);
      });
    }
    if (ordersFilterStatus && ordersFilterStatus !== 'all') {
      list = list.filter((o) => (o.status || 'pending') === ordersFilterStatus);
    }
    if (ordersDateFrom) {
      const from = new Date(ordersDateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((o) => new Date(o.createdAt) >= from);
    }
    if (ordersDateTo) {
      const to = new Date(ordersDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.createdAt) <= to);
    }
    const minAmt = Number(ordersAmountMin);
    const maxAmt = Number(ordersAmountMax);
    if (!Number.isNaN(minAmt) && minAmt > 0) {
      list = list.filter((o) => {
        const amt = o.totalAmount ?? (o.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        return amt >= minAmt;
      });
    }
    if (!Number.isNaN(maxAmt) && maxAmt > 0) {
      list = list.filter((o) => {
        const amt = o.totalAmount ?? (o.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        return amt <= maxAmt;
      });
    }
    if (ordersSortBy === 'date_desc') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (ordersSortBy === 'date_asc') list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (ordersSortBy === 'amount_desc') {
      list.sort((a, b) => {
        const amtA = a.totalAmount ?? (a.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        const amtB = b.totalAmount ?? (b.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        return amtB - amtA;
      });
    } else if (ordersSortBy === 'amount_asc') {
      list.sort((a, b) => {
        const amtA = a.totalAmount ?? (a.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        const amtB = b.totalAmount ?? (b.items || []).reduce((s, i) => s + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
        return amtA - amtB;
      });
    } else if (ordersSortBy === 'status') {
      const order = ['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'];
      list.sort((a, b) => order.indexOf(a.status || 'pending') - order.indexOf(b.status || 'pending'));
    }
    return list;
  }, [orders, ordersSearch, ordersFilterStatus, ordersSortBy, ordersDateFrom, ordersDateTo, ordersAmountMin, ordersAmountMax]);

  const exportOrdersCSV = useCallback(() => {
    const list = filteredOrders;
    if (list.length === 0) {
      showToast?.('Aucune commande à exporter.', { variant: 'warning' });
      return;
    }
    const headers = ['N°', 'Date', 'Statut', 'Montant', 'Adresse', 'Ville', 'Produits'];
    const rows = list.map((o, i) => {
      const amt = o.totalAmount ?? (o.items || []).reduce((s, it) => s + Number(it.snapshot?.price || 0) * Number(it.quantity || 1), 0);
      const items = o.items || (o.productSnapshot ? [{ snapshot: o.productSnapshot, quantity: 1 }] : []);
      const products = items.map((it) => `${it.snapshot?.title || 'Produit'} x${it.quantity || 1}`).join('; ');
      return [i + 1, new Date(o.createdAt).toLocaleDateString('fr-FR'), ORDER_STATUS_LABELS[o.status] || o.status, amt, o.deliveryAddress || '', o.deliveryCity || '', products];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('Export CSV réussi.', { variant: 'success' });
  }, [filteredOrders, showToast]);

  const exportOrdersPDF = useCallback(async () => {
    const list = filteredOrders;
    if (list.length === 0) {
      showToast?.('Aucune commande à exporter.', { variant: 'warning' });
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Mes commandes', 14, 20);
      doc.setFontSize(10);
      doc.text(`Export du ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);
      const tableData = list.map((o) => {
        const amt = o.totalAmount ?? (o.items || []).reduce((s, it) => s + Number(it.snapshot?.price || 0) * Number(it.quantity || 1), 0);
        return [String(o._id).slice(-6), new Date(o.createdAt).toLocaleDateString('fr-FR'), ORDER_STATUS_LABELS[o.status] || o.status, formatCurrency(amt), o.deliveryCity || ''];
      });
      autoTable(doc, {
        startY: 34,
        head: [['N°', 'Date', 'Statut', 'Montant', 'Ville']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });
      doc.save(`commandes_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast?.('Export PDF réussi.', { variant: 'success' });
    } catch (err) {
      console.error(err);
      showToast?.('Erreur lors de l\'export PDF.', { variant: 'error' });
    }
  }, [filteredOrders, showToast]);

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

  const sendPasswordChangeCode = async () => {
    setPasswordCodeSending(true);
    setPasswordCodeError('');
    setPasswordCodeMessage('');
    try {
      await api.post('/users/password/send-code');
      setPasswordCodeSent(true);
      setPasswordCodeMessage('Code envoyé par email.');
      showToast('Code envoyé par email.', { variant: 'success' });
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
      const message = 'Veuillez saisir le code reçu par email avant de modifier le mot de passe.';
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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

        {/* Navigation par onglets — mobile: sticky horizontal avec indicateur animé + progression */}
        {isMobile ? (
          <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 mb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 shadow-sm">
            {/* Barre de progression du profil */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-gray-500 dark:text-gray-400">Profil complété</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{profileCompletionPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${profileCompletionPercent}%` }}
                />
              </div>
            </div>
            {/* Onglets horizontaux scrollables */}
            <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1 -mx-1">
              {mobileTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all touch-manipulation min-h-[44px] ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
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
        )}

        {/* Section Profil */}
        {activeTab === 'profile' && (
          <>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
              <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
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
                      {cityOptions.map((city) => (
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
                    <span className="text-[11px] text-gray-500">Non modifiable</span>
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'homme', label: 'Homme' },
                      { value: 'femme', label: 'Femme' }
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                          form.gender === option.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={option.value}
                          checked={form.gender === option.value}
                          className="sr-only"
                          disabled
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
                    <div className="w-2 h-6 bg-amber-600 rounded-full"></div>
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

              {/* Mot de passe - CORRECTION ICI */}
              <div className="space-y-6 pt-6 border-t border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-6 bg-emerald-600 rounded-full"></div>
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
                      <p className="text-sm font-semibold text-gray-700">Code de vérification email</p>
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
                      placeholder="Code reçu par email"
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
                  className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2 shadow-lg"
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
        </>
        )}

        {/* Section Statistiques - Dashboard Analytique (proposal §4) */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-blue-600 rounded-full" />
                  <h2 className="text-xl font-semibold text-gray-900">Vue d'ensemble</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500">Période :</span>
                  {STATS_PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatsPeriod(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        statsPeriod === opt.value
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {statsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : statsError ? (
                <div className="text-center py-8 text-red-600">
                  <XCircle className="w-12 h-12 mx-auto mb-3" />
                  <p>{statsError}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrdersModal(true);
                        if (!ordersLoaded && !ordersLoading) fetchOrders();
                      }}
                      className="bg-indigo-600 text-white rounded-2xl p-5 shadow-lg text-left hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <ClipboardList className="w-7 h-7 opacity-90" />
                        <span className="text-xl font-bold">{formatNumber(stats.orders?.purchases?.totalCount || 0)}</span>
                      </div>
                      <p className="text-white/90 text-sm font-medium">Commandes</p>
                      <p className="text-white/70 text-xs mt-1">Attente: {formatNumber(stats.orders?.purchases?.byStatus?.pending?.count || 0)} · Livrées: {formatNumber(stats.orders?.purchases?.byStatus?.delivered?.count || 0)}</p>
                    </button>
                    {user?.accountType === 'shop' ? (
                      <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                          <DollarSign className="w-7 h-7 opacity-90" />
                          <span className="text-lg font-bold truncate ml-1">{formatNumber((stats.orders?.sales?.totalAmount || 0) / 1000)}k</span>
                        </div>
                        <p className="text-white/90 text-sm font-medium">Revenus</p>
                        <p className="text-white/70 text-xs mt-1">{formatCurrency(stats.orders?.sales?.totalAmount || 0)}</p>
                      </div>
                    ) : (
                      <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                          <DollarSign className="w-7 h-7 opacity-90" />
                          <span className="text-lg font-bold truncate ml-1">{formatNumber((stats.orders?.purchases?.totalAmount || 0) / 1000)}k</span>
                        </div>
                        <p className="text-white/90 text-sm font-medium">Montant achats</p>
                        <p className="text-white/70 text-xs mt-1">{formatCurrency(stats.orders?.purchases?.totalAmount || 0)}</p>
                      </div>
                    )}
                    <Link
                      to="/my"
                      className="bg-blue-600 text-white rounded-2xl p-5 shadow-lg block hover:bg-blue-700 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Package className="w-7 h-7 opacity-90" />
                        <span className="text-xl font-bold">{formatNumber(stats.listings.total)}</span>
                      </div>
                      <p className="text-white/90 text-sm font-medium">Produits</p>
                      <p className="text-white/70 text-xs mt-1">Actifs: {formatNumber(stats.listings.approved)} · Attente: {formatNumber(stats.listings.pending)}</p>
                    </Link>
                    <div className="bg-purple-600 text-white rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <TrendingUp className="w-7 h-7 opacity-90" />
                        <span className="text-xl font-bold">{formatNumber(stats.performance.views)}</span>
                      </div>
                      <p className="text-white/90 text-sm font-medium">Vues</p>
                      <p className="text-white/70 text-xs mt-1">Vues totales</p>
                    </div>
                    <div className="bg-pink-600 text-white rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Heart className="w-7 h-7 opacity-90" />
                        <span className="text-xl font-bold">{formatNumber(stats.engagement.favoritesReceived)}</span>
                      </div>
                      <p className="text-white/90 text-sm font-medium">Engagement</p>
                      <p className="text-white/70 text-xs mt-1">Favoris · WhatsApp: {formatNumber(stats.performance.clicks)}</p>
                    </div>
                    <div className="bg-amber-600 text-white rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Award className="w-7 h-7 opacity-90" />
                        <span className="text-xl font-bold">
                          {stats.listings.approved > 0
                            ? Math.round((stats.engagement.favoritesReceived + stats.engagement.commentsReceived) / stats.listings.approved)
                            : '0'}
                        </span>
                      </div>
                      <p className="text-white/90 text-sm font-medium">Score</p>
                      <p className="text-white/70 text-xs mt-1">Conversion: {stats.performance.conversion ?? 0}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        Évolution des revenus
                      </h3>
                      {user?.accountType === 'shop' && (stats.orders?.sales?.totalAmount || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart
                            data={[
                              { label: 'Période', revenue: stats.orders?.sales?.totalAmount || 0 }
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => [formatCurrency(value), 'Revenus']} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenus" dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">Aucune donnée de revenus sur la période</div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                        Commandes par statut
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[
                            { label: 'En attente', count: stats.orders?.purchases?.byStatus?.pending?.count || 0, fill: '#f59e0b' },
                            { label: 'Confirmées', count: stats.orders?.purchases?.byStatus?.confirmed?.count || 0, fill: '#3b82f6' },
                            { label: 'Livraison', count: stats.orders?.purchases?.byStatus?.delivering?.count || 0, fill: '#8b5cf6' },
                            { label: 'Livrées', count: stats.orders?.purchases?.byStatus?.delivered?.count || 0, fill: '#10b981' },
                            { label: 'Annulées', count: stats.orders?.purchases?.byStatus?.cancelled?.count || 0, fill: '#ef4444' }
                          ]}
                          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                          <YAxis stroke="#6b7280" fontSize={12} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} formatter={(value) => [formatNumber(value), 'Commandes']} />
                          <Bar dataKey="count" name="Commandes" radius={[6, 6, 0, 0]}>
                            {[
                              { fill: '#f59e0b' },
                              { fill: '#3b82f6' },
                              { fill: '#8b5cf6' },
                              { fill: '#10b981' },
                              { fill: '#ef4444' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        Répartition des produits
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[
                            { label: 'Approuvées', count: stats.listings.approved, fill: '#10b981' },
                            { label: 'En attente', count: stats.listings.pending, fill: '#f59e0b' },
                            { label: 'Rejetées', count: stats.listings.rejected, fill: '#ef4444' },
                            { label: 'Désactivées', count: stats.listings.disabled, fill: '#6b7280' }
                          ]}
                          layout="vertical"
                          margin={{ top: 8, right: 24, left: 60, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                          <XAxis type="number" stroke="#6b7280" fontSize={12} />
                          <YAxis type="category" dataKey="label" stroke="#6b7280" fontSize={11} width={56} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} formatter={(value) => [formatNumber(value), '']} />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                            {[
                              { fill: '#10b981' },
                              { fill: '#f59e0b' },
                              { fill: '#ef4444' },
                              { fill: '#6b7280' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        Activité par jour
                      </h3>
                      <div className="h-[220px] flex items-center justify-center rounded-xl bg-white border border-gray-100">
                        <div className="text-center text-gray-500 text-sm">
                          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                          <p>Données d'activité par jour à venir</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Section Performance (Nouvelle fonctionnalité) */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
              <div className="w-2 h-6 bg-purple-600 rounded-full"></div>
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
                  <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border border-purple-100">
                    <div>
                      <p className="text-sm font-medium text-purple-900">Score d'engagement</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round((stats.engagement.favoritesReceived + stats.engagement.commentsReceived) / Math.max(stats.listings.approved, 1))}
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-purple-500" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 border border-blue-100">
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

        {/* Orders modal — opened from Commandes card in stats */}
        {showOrdersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowOrdersModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  Mes commandes
                </h3>
                <button
                  type="button"
                  onClick={() => setShowOrdersModal(false)}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {ordersError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-4">
                    {ordersError}
                  </div>
                )}
                {ordersLoading && orders.length === 0 ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="animate-pulse border border-gray-100 rounded-2xl p-5 bg-gray-50 h-28" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-700">Aucune commande</p>
                    <p className="text-sm">Vos commandes apparaîtront ici.</p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-2">
                    {orders.map((order) => {
                      const orderItems =
                        order.items && order.items.length
                          ? order.items
                          : order.productSnapshot
                            ? [{ snapshot: order.productSnapshot, quantity: 1 }]
                            : [];
                      return (
                        <div key={order._id} className="border border-gray-100 rounded-2xl p-5 shadow-sm bg-gray-50/50">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm text-gray-500">Commande #{order._id.slice(-6)}</p>
                              <div className="mt-1 space-y-1 text-sm text-gray-700">
                                {orderItems.map((item, idx) => (
                                  <div key={`${order._id}-${idx}`}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                                      <span className="text-xs text-gray-500">
                                        x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                Statut : {ORDER_STATUS_LABELS[order.status] || 'Enregistrée'}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${ORDER_STATUS_STYLES[order.status] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                              {order.status === 'pending' && <Clock size={14} />}
                              {order.status === 'confirmed' && <Package size={14} />}
                              {order.status === 'delivering' && <Truck size={14} />}
                              {order.status === 'delivered' && <CheckCircle size={14} />}
                              {ORDER_STATUS_LABELS[order.status] || 'Statut inconnu'}
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-gray-500">
                            Créée le {new Date(order.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                <Link
                  to="/profile"
                  onClick={() => setShowOrdersModal(false)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Voir tout l'historique →
                </Link>
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
                  Gestion des commandes
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Mes commandes</h2>
                <p className="text-sm text-gray-500">Filtres, recherche, tri et export.</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  Page complète
                </Link>
                <Link
                  to="/orders/draft"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 text-sm font-semibold hover:from-amber-100 hover:to-orange-100 transition-all duration-200 active:scale-95 shadow-sm"
                >
                  <Clock className="w-4 h-4" />
                  Brouillons
                </Link>
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

            {/* Chips de filtres statut */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'pending', label: 'En attente' },
                { key: 'confirmed', label: 'Confirmées' },
                { key: 'delivering', label: 'En livraison' },
                { key: 'delivered', label: 'Livrées' },
                { key: 'cancelled', label: 'Annulées' }
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setOrdersFilterStatus(chip.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    ordersFilterStatus === chip.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Recherche, tri, vue, export */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par n° commande, produit, client..."
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOrdersShowFilters(!ordersShowFilters)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${
                    ordersShowFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtres
                </button>
                <select
                  value={ordersSortBy}
                  onChange={(e) => setOrdersSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date_desc">Date ▼</option>
                  <option value="date_asc">Date ▲</option>
                  <option value="amount_desc">Montant ▼</option>
                  <option value="amount_asc">Montant ▲</option>
                  <option value="status">Statut</option>
                </select>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOrdersViewMode('list')}
                    className={`p-2 ${ordersViewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    title="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersViewMode('grid')}
                    className={`p-2 ${ordersViewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    title="Vue grille"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
                <button type="button" onClick={exportOrdersCSV} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50" title="Export CSV">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button type="button" onClick={exportOrdersPDF} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50" title="Export PDF">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            {/* Filtres avancés */}
            {ordersShowFilters && (
              <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date début</label>
                  <input type="date" value={ordersDateFrom} onChange={(e) => setOrdersDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date fin</label>
                  <input type="date" value={ordersDateTo} onChange={(e) => setOrdersDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Montant min</label>
                  <input type="number" placeholder="0" value={ordersAmountMin} onChange={(e) => setOrdersAmountMin(e.target.value)} min={0} className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-32" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Montant max</label>
                  <input type="number" placeholder="—" value={ordersAmountMax} onChange={(e) => setOrdersAmountMax(e.target.value)} min={0} className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-32" />
                </div>
                <button type="button" onClick={() => { setOrdersDateFrom(''); setOrdersDateTo(''); setOrdersAmountMin(''); setOrdersAmountMax(''); }} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200">
                  Réinitialiser
                </button>
              </div>
            )}

            {ordersError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-6">
                {ordersError}
              </div>
            )}

            {/* Statistiques commandes */}
            {!ordersLoading && orders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Affichées</p>
                  <p className="text-xl font-bold text-indigo-900">{filteredOrders.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total montant</p>
                  <p className="text-lg font-bold text-emerald-900">
                    {formatCurrency(
                      filteredOrders.reduce((s, o) => {
                        const amt = o.totalAmount ?? (o.items || []).reduce((sum, i) => sum + Number(i.snapshot?.price || 0) * Number(i.quantity || 1), 0);
                        return s + amt;
                      }, 0)
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">En attente</p>
                  <p className="text-xl font-bold text-amber-900">{filteredOrders.filter((o) => (o.status || 'pending') === 'pending').length}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Livrées</p>
                  <p className="text-xl font-bold text-green-900">{filteredOrders.filter((o) => (o.status || 'pending') === 'delivered').length}</p>
                </div>
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

            {(ordersLoading || filteredOrders.length > 0) && (
              <div className={ordersViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
                {ordersLoading && filteredOrders.length === 0
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="animate-pulse border border-gray-100 rounded-2xl p-5 bg-gray-50" />
                    ))
                  : filteredOrders.map((order) => {
                      const orderItems =
                        order.items && order.items.length
                          ? order.items
                          : order.productSnapshot
                          ? [{ snapshot: order.productSnapshot, quantity: 1 }]
                          : [];

                      return (
                        <div key={order._id} className="border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col">
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
                                        x{item.quantity} · {formatCurrency(item.snapshot?.price || 0)}
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
                              {order.status === 'cancelled' && <XCircle size={14} />}
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
                          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetail(order)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                            >
                              <Package size={14} />
                              Voir détails
                            </button>
                            <Link
                              to="/orders/messages"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 border border-gray-200"
                            >
                              <MessageCircle size={14} />
                              Messages
                            </Link>
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}

            {/* Modal Détails commande avec timeline */}
            {selectedOrderDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedOrderDetail(null)}>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-indigo-600" />
                      Commande #{selectedOrderDetail._id?.slice(-6)}
                    </h3>
                    <button type="button" onClick={() => setSelectedOrderDetail(null)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100" aria-label="Fermer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Statut</p>
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${ORDER_STATUS_STYLES[selectedOrderDetail.status] || 'border-gray-200 bg-gray-50'}`}>
                        {selectedOrderDetail.status === 'pending' && <Clock size={16} />}
                        {selectedOrderDetail.status === 'confirmed' && <Package size={16} />}
                        {selectedOrderDetail.status === 'delivering' && <Truck size={16} />}
                        {selectedOrderDetail.status === 'delivered' && <CheckCircle size={16} />}
                        {selectedOrderDetail.status === 'cancelled' && <XCircle size={16} />}
                        {ORDER_STATUS_LABELS[selectedOrderDetail.status] || 'Inconnu'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produits</p>
                      <div className="space-y-2">
                        {(selectedOrderDetail.items || (selectedOrderDetail.productSnapshot ? [{ snapshot: selectedOrderDetail.productSnapshot, quantity: 1 }] : [])).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                            <span className="font-medium text-gray-900">{item.snapshot?.title || 'Produit'}</span>
                            <span className="text-sm text-gray-600">x{item.quantity} · {formatCurrency(item.snapshot?.price || 0)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-gray-900">
                        Total : {formatCurrency(selectedOrderDetail.totalAmount ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adresse de livraison</p>
                      <p className="text-gray-900">{selectedOrderDetail.deliveryAddress}</p>
                      <p className="flex items-center gap-1 text-sm text-gray-500 mt-1"><MapPin size={14} /> {selectedOrderDetail.deliveryCity}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Créée</p>
                            <p className="text-sm text-gray-500">{selectedOrderDetail.createdAt ? new Date(selectedOrderDetail.createdAt).toLocaleString('fr-FR') : '—'}</p>
                          </div>
                        </div>
                        {selectedOrderDetail.shippedAt && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Truck className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Expédiée</p>
                              <p className="text-sm text-gray-500">{new Date(selectedOrderDetail.shippedAt).toLocaleString('fr-FR')}</p>
                            </div>
                          </div>
                        )}
                        {selectedOrderDetail.deliveredAt && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Livrée</p>
                              <p className="text-sm text-gray-500">{new Date(selectedOrderDetail.deliveredAt).toLocaleString('fr-FR')}</p>
                            </div>
                          </div>
                        )}
                        {selectedOrderDetail.cancelledAt && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <XCircle className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Annulée</p>
                              <p className="text-sm text-gray-500">{new Date(selectedOrderDetail.cancelledAt).toLocaleString('fr-FR')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <Link
                      to="/orders/messages"
                      onClick={() => setSelectedOrderDetail(null)}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-medium hover:bg-indigo-50"
                    >
                      Messages
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setSelectedOrderDetail(null)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                    >
                      Page commandes
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Onglet Boutique — Section Boutique (proposal §7) */}
        {activeTab === 'shop' && user?.accountType === 'shop' && (
          <div className="space-y-6">
            {/* Prévisualisation — Aperçu de la boutique publique */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Prévisualisation</h3>
                <p className="text-xs text-gray-500">Aperçu de votre boutique telle qu’elle apparaît aux acheteurs.</p>
              </div>
              <div className="p-4">
                <a
                  href={userShopLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-xl border-2 border-gray-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                >
                  {(shopLogoPreview || user?.shopLogo) ? (
                    <img
                      src={shopLogoPreview || user?.shopLogo}
                      alt="Logo"
                      className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Store className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{form.shopName || 'Ma boutique'}</p>
                    <p className="text-xs text-gray-500 truncate">{form.shopAddress || 'Adresse non renseignée'}</p>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 flex-shrink-0">Voir l’aperçu public →</span>
                </a>
              </div>
            </div>

            {/* Informations de la boutique */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Informations de la boutique</h3>
              <p className="text-xs text-gray-500 mb-3">Nom, adresse, description.</p>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Nom</dt>
                  <dd className="font-medium text-gray-900">{form.shopName || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Adresse</dt>
                  <dd className="font-medium text-gray-900">{form.shopAddress || '—'}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Modifier dans l’onglet Profil
              </button>
            </div>

            {/* Logo et bannière — Galerie */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Logo et bannière</h3>
              <p className="text-xs text-gray-500 mb-3">Upload avec preview. Gestion dans l’onglet Profil.</p>
              <div className="flex gap-3">
                {(shopLogoPreview || user?.shopLogo) ? (
                  <img
                    src={shopLogoPreview || user?.shopLogo}
                    alt="Logo"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                {user?.shopVerified && (shopBannerPreview || user?.shopBanner) ? (
                  <img
                    src={shopBannerPreview || user?.shopBanner}
                    alt="Bannière"
                    className="h-16 flex-1 max-w-[120px] rounded-xl object-cover border border-gray-200"
                  />
                ) : user?.shopVerified ? (
                  <div className="h-16 flex-1 max-w-[120px] rounded-xl bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-400" />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Gérer dans l’onglet Profil
              </button>
            </div>

            {/* Horaires d'ouverture */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Horaires d’ouverture
              </h3>
              <p className="text-xs text-gray-500 mb-3">Gestion des horaires par jour.</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {shopHours.slice(0, 5).map((entry) => (
                  <li key={entry.day} className="flex justify-between">
                    <span>{entry.label}</span>
                    <span className="text-gray-500">
                      {entry.closed ? 'Fermé' : entry.open && entry.close ? `${entry.open} – ${entry.close}` : '—'}
                    </span>
                  </li>
                ))}
                {shopHours.length > 5 && (
                  <li className="text-gray-500">+ {shopHours.length - 5} autre(s) jour(s)</li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Modifier dans l’onglet Profil
              </button>
            </div>

            {/* Statistiques de la boutique (placeholder) */}
            {stats && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Statistiques de la boutique</h3>
                <p className="text-xs text-gray-500 mb-3">Vues, favoris, produits.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{stats?.listings?.total ?? 0}</p>
                    <p className="text-xs text-gray-500">Annonces</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{stats?.engagement?.favoritesReceived ?? 0}</p>
                    <p className="text-xs text-gray-500">Favoris reçus</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{stats?.performance?.views ?? 0}</p>
                    <p className="text-xs text-gray-500">Vues</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Voir tout dans l’onglet Statistiques
                </button>
              </div>
            )}

            <Link
              to={userShopLink || '/profile'}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Store className="w-4 h-4" />
              Voir ma boutique publique
            </Link>
          </div>
        )}

        {/* Onglet Notifications (mobile) */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                <Bell className="w-4 h-4" />
                Préférences de notifications
              </div>
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Choisissez les types de notifications que vous souhaitez recevoir.</p>
            </div>
            <Link
              to="/notifications"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Bell className="w-4 h-4" />
              Gérer les préférences
            </Link>
          </div>
        )}

        {/* Onglet Sécurité (mobile) */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 mb-6">
              <div className="w-2 h-6 bg-emerald-600 rounded-full" />
              <h2 className="text-xl font-semibold text-gray-900">Mot de passe et authentification</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Lock className="w-4 h-4 text-green-500" />
                    <span>Nouveau mot de passe</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
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
                      type={showPassword ? 'text' : 'password'}
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
                    <p className="text-sm font-semibold text-gray-700">Code de vérification email</p>
                    <p className="text-xs text-gray-500">Un code est requis pour confirmer la modification du mot de passe.</p>
                  </div>
                  <button
                    type="button"
                    onClick={sendPasswordChangeCode}
                    disabled={passwordCodeSending || loading}
                    className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordCodeSending ? 'Envoi...' : passwordCodeSent ? 'Renvoyer le code' : 'Envoyer le code'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 pl-11 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Code reçu par email"
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
              <button
                type="button"
                onClick={async () => {
                  const ok = await applyPasswordChange();
                  if (ok) showToast('Mot de passe mis à jour.', { variant: 'success' });
                }}
                disabled={loading || !form.password || form.password !== form.confirmPassword || !passwordCode.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                Mettre à jour le mot de passe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
