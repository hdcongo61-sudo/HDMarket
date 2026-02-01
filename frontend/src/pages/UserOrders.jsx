import React, { useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  ClipboardList,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  ShieldCheck,
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Download,
  Eye,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Info,
  CreditCard,
  Receipt,
  Store,
  Sparkles,
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  LayoutGrid,
  List,
  RefreshCw,
  Wifi,
  WifiOff,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import CancellationTimer from '../components/CancellationTimer';
import EditAddressModal from '../components/EditAddressModal';
import OrderChat from '../components/OrderChat';
import CartContext from '../context/CartContext';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Commande confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Commande terminée',
  cancelled: 'Commande annulée'
};

const STATUS_STYLES = {
  pending: { header: 'bg-gray-600', card: 'bg-gray-50 border-gray-200 text-gray-700' },
  confirmed: { header: 'bg-amber-600', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  delivering: { header: 'bg-blue-600', card: 'bg-blue-50 border-blue-200 text-blue-800' },
  delivered: { header: 'bg-emerald-600', card: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  cancelled: { header: 'bg-red-600', card: 'bg-red-50 border-red-200 text-red-800' }
};

const STATUS_ICONS = {
  pending: Clock,
  confirmed: Package,
  delivering: Truck,
  delivered: CheckCircle,
  cancelled: X
};

const STATUS_TABS = [
  { key: 'all', label: 'Toutes', icon: ClipboardList, count: null },
  { key: 'pending', label: 'En attente', icon: Clock, count: null },
  { key: 'confirmed', label: 'Confirmées', icon: Package, count: null },
  { key: 'delivering', label: 'En livraison', icon: Truck, count: null },
  { key: 'delivered', label: 'Livrées', icon: CheckCircle, count: null },
  { key: 'cancelled', label: 'Annulées', icon: X, count: null }
];

const PAGE_SIZE = 6;

const ORDER_FLOW = [
  {
    id: 'pending',
    label: 'Commande en attente',
    description: 'Votre commande est enregistrée et en attente de validation par nos équipes.',
    icon: Clock,
    color: 'gray'
  },
  {
    id: 'confirmed',
    label: 'Commande confirmée',
    description: 'Un gestionnaire a validé votre commande et prépare l\'expédition.',
    icon: Package,
    color: 'amber'
  },
  {
    id: 'delivering',
    label: 'En cours de livraison',
    description: 'Le colis est pris en charge par le livreur et se dirige vers votre adresse.',
    icon: Truck,
    color: 'blue'
  },
  {
    id: 'delivered',
    label: 'Commande terminée',
    description: 'La commande est livrée avec succès et archivée par nos équipes.',
    icon: CheckCircle,
    color: 'emerald'
  },
  {
    id: 'cancelled',
    label: 'Commande annulée',
    description: 'Cette commande a été annulée et ne sera pas livrée.',
    icon: X,
    color: 'red'
  }
];

const formatOrderTimestamp = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const OrderProgress = ({ status }) => {
  const currentIndexRaw = ORDER_FLOW.findIndex((step) => step.id === status);
  const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-600">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Suivi de commande</h3>
      </div>
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200">
          <div
            className="absolute top-0 left-0 w-full bg-indigo-600 transition-all duration-500"
            style={{ height: `${(currentIndex / (ORDER_FLOW.length - 1)) * 100}%` }}
          />
        </div>
        
        <div className="space-y-6 relative">
          {ORDER_FLOW.map((step, index) => {
            const Icon = step.icon;
            const reached = currentIndex >= index;
            const isCurrent = currentIndex === index;
            const colorClasses = {
              gray: 'bg-gray-600',
              amber: 'bg-amber-600',
              blue: 'bg-blue-600',
              emerald: 'bg-emerald-600'
            };
            
            return (
              <div key={step.id} className="flex items-start gap-4 relative">
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  reached
                    ? `${colorClasses[step.color]} border-transparent text-white shadow-lg scale-110`
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}>
                  <Icon size={16} />
                  {isCurrent && (
                    <div className={`absolute inset-0 rounded-full ${colorClasses[step.color]} animate-ping opacity-75`} />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${reached ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClasses[step.color]} text-white`}>
                        En cours
                      </span>
                    )}
                    {!isCurrent && reached && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        Terminé
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${reached ? 'text-gray-600' : 'text-gray-400'}`}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function UserOrders() {
  const externalLinkProps = useDesktopExternalLink();
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, byStatus: {} });
  const [statsLoading, setStatsLoading] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [skipLoadingId, setSkipLoadingId] = useState(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    shopName: ''
  });
  const [availableShops, setAvailableShops] = useState([]);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [swipedOrderId, setSwipedOrderId] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const pullStartY = useRef(0);
  const pullMoveY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const { status: statusParam } = useParams();
  const { addItem } = useContext(CartContext);
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  const activeStatus = useMemo(() => {
    if (!statusParam) return 'all';
    return Object.keys(STATUS_LABELS).includes(statusParam) ? statusParam : 'all';
  }, [statusParam]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache orders for offline access
  useEffect(() => {
    if (orders.length > 0 && isOnline) {
      try {
        localStorage.setItem('cached_orders', JSON.stringify({
          orders,
          timestamp: Date.now(),
          status: activeStatus
        }));
      } catch (e) {
        console.warn('Failed to cache orders:', e);
      }
    }
  }, [orders, isOnline, activeStatus]);

  // Load cached orders when offline
  useEffect(() => {
    if (!isOnline && orders.length === 0) {
      try {
        const cached = localStorage.getItem('cached_orders');
        if (cached) {
          const { orders: cachedOrders } = JSON.parse(cached);
          setOrders(cachedOrders);
        }
      } catch (e) {
        console.warn('Failed to load cached orders:', e);
      }
    }
  }, [isOnline, orders.length]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (pullStartY.current === 0) return;
    pullMoveY.current = e.touches[0].clientY;
    const distance = pullMoveY.current - pullStartY.current;
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 80 && !isRefreshing && isOnline) {
      setIsRefreshing(true);
      try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', PAGE_SIZE);
        if (activeStatus !== 'all') {
          params.set('status', activeStatus);
        }
        const { data } = await api.get(`/orders?${params.toString()}`);
        const items = Array.isArray(data) ? data : data?.items || [];
        setOrders(items);
        setMeta({
          total: data?.total ?? items.length,
          totalPages: Math.max(1, Number(data?.totalPages) || 1)
        });
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        setIsRefreshing(false);
      }
    }
    pullStartY.current = 0;
    pullMoveY.current = 0;
    setPullDistance(0);
  }, [pullDistance, isRefreshing, isOnline, page, activeStatus]);

  // Swipe action handlers
  const minSwipeDistance = 50;

  const onSwipeStart = (e, orderId) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipedOrderId(orderId);
  };

  const onSwipeMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onSwipeEnd = (order) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && order.cancellationWindow?.isActive && order.status !== 'cancelled') {
      // Show cancel confirmation
      if (confirm('Annuler cette commande ?')) {
        handleCancelOrder(order._id);
      }
    }

    setSwipedOrderId(null);
    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    setPage(1);
  }, [activeStatus]);

  // Load order statistics and available shops
  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data } = await api.get('/orders?limit=1000');
        if (!active) return;
        const allOrders = Array.isArray(data) ? data : data?.items || [];
        const total = allOrders.length;
        const totalAmount = allOrders.reduce((sum, order) => {
          const items = order.items || (order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1 }] : []);
          const computed = items.reduce(
            (s, item) => s + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
            0
          );
          return sum + Number(order.totalAmount ?? computed);
        }, 0);
        const byStatus = allOrders.reduce((acc, order) => {
          const status = order.status || 'pending';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        setStats({ total, totalAmount, byStatus });

        // Extract unique shop names from all orders
        const shopsSet = new Set();
        allOrders.forEach((order) => {
          const items = order.items || (order.productSnapshot ? [{ snapshot: order.productSnapshot }] : []);
          items.forEach((item) => {
            if (item.snapshot?.shopName) {
              shopsSet.add(item.snapshot.shopName);
            }
          });
        });
        setAvailableShops(Array.from(shopsSet).sort());
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    loadStats();
    return () => { active = false; };
  }, []);

  const loadUnreadCounts = async (orderIds) => {
    if (!orderIds || orderIds.length === 0 || !user?._id) return {};
    try {
      const counts = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const { data } = await api.get(`/orders/${orderId}/messages`);
            const unread = Array.isArray(data) ? data.filter(
              (msg) => String(msg.recipient?._id) === String(user._id) && !msg.readAt
            ) : [];
            return { orderId, count: unread.length };
          } catch {
            return { orderId, count: 0 };
          }
        })
      );
      return counts.reduce((acc, { orderId, count }) => {
        acc[orderId] = count;
        return acc;
      }, {});
    } catch {
      return {};
    }
  };

  const initialLoadDone = useRef(false);
  useEffect(() => {
    const loadOrders = async () => {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', PAGE_SIZE);
        if (activeStatus !== 'all') {
          params.set('status', activeStatus);
        }
        if (searchValue.trim()) {
          params.set('search', searchValue.trim());
        }
        const { data } = await api.get(`/orders?${params.toString()}`);
        const items = Array.isArray(data) ? data : data?.items || [];
        const totalPages = Math.max(1, Number(data?.totalPages) || 1);
        setOrders(items);
        
        // Load unread message counts
        const orderIds = items.map((order) => order._id);
        const unreadCounts = await loadUnreadCounts(orderIds);
        setOrderUnreadCounts(unreadCounts);
        
        setMeta({
          total: data?.total ?? items.length,
          totalPages
        });
        const incomingPage = Number(data?.page);
        if (Number.isFinite(incomingPage) && incomingPage > 0 && incomingPage !== page) {
          setPage(incomingPage);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Impossible de charger vos commandes.');
        setOrders([]);
        setMeta({ total: 0, totalPages: 1 });
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };
    loadOrders();
  }, [activeStatus, page, searchValue, user?._id]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchValue(searchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  // Reset to page 1 when search or status changes
  useEffect(() => {
    setPage(1);
  }, [activeStatus, searchValue]);

  // Filter orders based on multiple criteria
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Date filter
      if (filters.dateFrom) {
        const orderDate = new Date(order.createdAt);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (orderDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const orderDate = new Date(order.createdAt);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate) return false;
      }

      // Amount filter
      const orderItems = order.items || (order.productSnapshot ? [{ snapshot: order.productSnapshot, quantity: 1 }] : []);
      const computedTotal = orderItems.reduce(
        (sum, item) => sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
        0
      );
      const totalAmount = Number(order.totalAmount ?? computedTotal);

      if (filters.amountMin && totalAmount < Number(filters.amountMin)) return false;
      if (filters.amountMax && totalAmount > Number(filters.amountMax)) return false;

      // Shop filter
      if (filters.shopName) {
        const items = order.items || (order.productSnapshot ? [{ snapshot: order.productSnapshot }] : []);
        const hasShop = items.some((item) =>
          item.snapshot?.shopName?.toLowerCase().includes(filters.shopName.toLowerCase())
        );
        if (!hasShop) return false;
      }

      return true;
    });
  }, [orders, filters]);

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.amountMin || filters.amountMax || filters.shopName;

  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      shopName: ''
    });
  };

  const emptyMessage = hasActiveFilters
    ? 'Aucune commande ne correspond à vos critères de filtrage.'
    : activeStatus === 'all'
      ? 'Vous n\'avez pas encore de commande.'
      : `Aucune commande ${STATUS_LABELS[activeStatus].toLowerCase()} pour le moment.`;

  const handleSkipCancellationWindow = async (orderId) => {
    if (!confirm('En confirmant, vous autorisez le vendeur à traiter immédiatement cette commande. Vous ne pourrez plus l\'annuler.')) {
      return;
    }

    setSkipLoadingId(orderId);
    try {
      const { data } = await api.post(`/orders/${orderId}/skip-cancellation-window`);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data : o)));
    } catch (err) {
      alert(err.response?.data?.message || 'Impossible de lever le délai d\'annulation.');
    } finally {
      setSkipLoadingId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette commande ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { data } = await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? data : o)));
    } catch (err) {
      alert(err.response?.data?.message || 'Impossible d\'annuler la commande.');
    }
  };

  const handleEditAddress = (order) => {
    setSelectedOrderForEdit(order);
    setEditAddressModalOpen(true);
  };

  const handleSaveAddress = async (addressData) => {
    if (!selectedOrderForEdit) return;
    
    try {
      const { data } = await api.patch(`/orders/${selectedOrderForEdit._id}/address`, addressData);
      setOrders((prev) => prev.map((o) => (o._id === selectedOrderForEdit._id ? data : o)));
      setEditAddressModalOpen(false);
      setSelectedOrderForEdit(null);
    } catch (err) {
      throw err; // Let the modal handle the error
    }
  };

  const handleReorder = async (order) => {
    if (!order || !order.items || order.items.length === 0) return;
    
    setReordering(true);
    const addedItems = [];
    const failedItems = [];
    
    try {
      // Add each item from the order to the cart
      for (const item of order.items) {
        const productId = item.product?._id || item.product;
        const quantity = item.quantity || 1;
        
        if (!productId) {
          failedItems.push(item.snapshot?.title || 'Produit inconnu');
          continue;
        }
        
        try {
          await addItem(productId, quantity);
          addedItems.push(item.snapshot?.title || 'Produit');
        } catch (err) {
          // Product might be unavailable or removed
          failedItems.push(item.snapshot?.title || 'Produit inconnu');
        }
      }
      
      // Show feedback
      if (addedItems.length > 0) {
        const message = failedItems.length > 0
          ? `${addedItems.length} article(s) ajouté(s) au panier. ${failedItems.length} article(s) non disponible(s).`
          : 'Tous les articles ont été ajoutés au panier !';
        alert(message);
        
        // Navigate to cart if items were added
        if (addedItems.length > 0) {
          navigate('/cart');
        }
      } else if (failedItems.length > 0) {
        alert('Aucun article n\'a pu être ajouté au panier. Les produits peuvent être indisponibles ou supprimés.');
      }
    } catch (err) {
      alert('Erreur lors de l\'ajout des articles au panier. Veuillez réessayer.');
    } finally {
      setReordering(false);
    }
  };

  const openOrderPdf = (order) => {
    const orderItems = order.items && order.items.length
      ? order.items
      : order.productSnapshot
      ? [{ snapshot: order.productSnapshot, quantity: 1 }]
      : [];
    
    const computedTotal = orderItems.reduce((sum, item) => {
      const price = Number(item.snapshot?.price || 0);
      const qty = Number(item.quantity || 1);
      return sum + price * qty;
    }, 0);
    const orderTotal = Number(order.totalAmount ?? computedTotal);
    const paidAmount = Number(order.paidAmount || 0);
    const remainingAmount = Number(order.remainingAmount ?? Math.max(0, orderTotal - paidAmount));
    
    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rowsHtml = orderItems
      .map((item, index) => {
        const title = escapeHtml(item.snapshot?.title || 'Produit');
        const shopName = escapeHtml(item.snapshot?.shopName || '');
        const confirmation = escapeHtml(item.snapshot?.confirmationNumber || '');
        const qty = Number(item.quantity || 1);
        const price = formatCurrency(item.snapshot?.price || 0);
        const lineTotal = formatCurrency((item.snapshot?.price || 0) * qty);
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <div class="title">${title}</div>
              ${shopName ? `<div class="meta">Boutique: ${shopName}</div>` : ''}
              ${confirmation ? `<div class="meta">Code: ${confirmation}</div>` : ''}
            </td>
            <td class="right">x${qty}</td>
            <td class="right">${price}</td>
            <td class="right">${lineTotal}</td>
          </tr>
        `;
      })
      .join('');

    const orderRef = escapeHtml(order._id || '');
    const orderShort = escapeHtml(order._id?.slice(-6) || '');
    const logoUrl = `${window.location.origin}/favicon.svg`;
    const html = `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Bon de commande ${orderShort}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 32px; color: #111827; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e5e7eb; padding: 6px; }
            .title { font-size: 22px; font-weight: 700; }
            .badge { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; }
            .right { text-align: right; }
            .total-row td { font-weight: 700; border-top: 2px solid #111827; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img src="${logoUrl}" alt="HDMarket" class="logo" />
              <div>
                <div class="title">Bon de commande</div>
                <div class="badge">HDMarket</div>
              </div>
            </div>
            <div class="right">
              <div class="badge">Commande #${orderShort}</div>
              <div>${escapeHtml(new Date(order.createdAt).toLocaleDateString('fr-FR'))}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Article</th>
                <th class="right">Qté</th>
                <th class="right">Prix</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="4" class="right">Total commande</td>
                <td class="right">${formatCurrency(orderTotal)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return;
    }
    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
    pdfWindow.focus();
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="space-y-8">
            <div className="h-8 bg-gray-200 rounded-xl w-64 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-indigo-600 text-white transition-all duration-200"
          style={{ height: Math.min(pullDistance, 80) }}
        >
          <RefreshCw
            className={`w-5 h-5 transition-transform ${pullDistance > 80 ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 2}deg)` }}
          />
          <span className="ml-2 text-sm font-medium">
            {pullDistance > 80 ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}
          </span>
        </div>
      )}

      {/* Refreshing Indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-indigo-600 text-white py-3">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="ml-2 text-sm font-medium">Actualisation...</span>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white py-2 px-4">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Mode hors ligne - Données en cache</span>
        </div>
      )}

      {/* Header Section - Compact on mobile */}
      <div className={`bg-indigo-600 text-white ${!isOnline ? 'mt-10' : ''}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-6 safe-area-top' : 'py-12'}`}>
          <div className="flex flex-col gap-4 sm:gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl bg-white/20 backdrop-blur-sm ${isMobile ? 'p-2' : 'p-3'}`}>
                  <ClipboardList className={isMobile ? 'w-5 h-5' : 'w-6 h-6'} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white/80 uppercase tracking-wide">Mes commandes</p>
                  <h1 className={isMobile ? 'text-xl font-bold' : 'text-3xl font-bold'}>Suivi de vos commandes</h1>
                </div>
              </div>
              {!isMobile && (
                <p className="text-white/90 text-sm max-w-2xl">
                  Consultez l'état de vos commandes, suivez les livraisons et accédez à tous les détails de vos achats.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-white/20 transition-all active:scale-[0.98]"
              >
                <ArrowLeft className="w-4 h-4" />
                Accueil
              </Link>
              <Link
                to="/my/stats"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-600 px-4 py-2.5 min-h-[44px] text-sm font-semibold hover:bg-white/90 transition-all shadow-lg active:scale-[0.98]"
              >
                <TrendingUp className="w-4 h-4" />
                Statistiques
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? '-mt-4 pb-6' : '-mt-8 pb-12'} pb-[env(safe-area-inset-bottom)]`}>
        {/* Statistics Cards - Horizontal scroll on mobile */}
        {!statsLoading && stats.total > 0 && (
          <div className={`mb-6 sm:mb-8 ${isMobile ? 'overflow-x-auto -mx-4 px-4 hide-scrollbar' : ''}`}>
            {isMobile ? (
              <div className="flex gap-3 pb-2" style={{ minWidth: 'min-content' }}>
                <div className="flex-shrink-0 w-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-600">
                      <ClipboardList className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">{stats.total}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 truncate">Total</p>
                </div>
                <div className="flex-shrink-0 w-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-emerald-600">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-gray-900 truncate" title={formatCurrency(stats.totalAmount)}>{formatCurrency(stats.totalAmount).replace(/\sFCFA$/, '')}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 truncate">Dépensé</p>
                </div>
                <div className="flex-shrink-0 w-[140px] bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-amber-600">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">{stats.byStatus.pending || 0}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 truncate">En attente</p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-indigo-600">
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total commandes</p>
              <p className="text-xs text-gray-500 mt-1">Toutes vos commandes</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-600">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total dépensé</p>
              <p className="text-xs text-gray-500 mt-1">Montant total de vos achats</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-600">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stats.byStatus.pending || 0}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">En attente</p>
              <p className="text-xs text-gray-500 mt-1">Commandes en cours de traitement</p>
            </div>
            </div>
            )}
          </div>
        )}

        {/* Search and Status Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 sm:mb-8 space-y-4">
          {/* Search Bar and Filter Toggle */}
          <div className={`flex items-center gap-2 sm:gap-3 ${isMobile ? 'flex-col' : ''}`}>
            <div className={`relative w-full ${isMobile ? '' : 'flex-1 max-w-md'}`}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par produit, boutique, adresse..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                title="Rechercher par nom de produit, nom de boutique, adresse de livraison ou code de livraison"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => setSearchDraft('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] ${
                showFilters || hasActiveFilters
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              } ${isMobile ? 'flex-1' : ''}`}
            >
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/20">
                  {[filters.dateFrom || filters.dateTo, filters.amountMin || filters.amountMax, filters.shopName].filter(Boolean).length}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* View Mode Toggle - Hidden on mobile (card view is default and best) */}
            {!isMobile && (
            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === 'card'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vue carte"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Carte</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Vue liste"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Liste</span>
              </button>
            </div>
            )}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range Filter */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Calendar className="w-3.5 h-3.5" />
                    Période
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Du"
                      />
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-gray-500">Du</span>
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Au"
                      />
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-gray-500">Au</span>
                    </div>
                  </div>
                </div>

                {/* Amount Range Filter */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <DollarSign className="w-3.5 h-3.5" />
                    Montant (FCFA)
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={filters.amountMin}
                        onChange={(e) => setFilters((prev) => ({ ...prev, amountMin: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Minimum"
                        min="0"
                      />
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-gray-500">Min</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={filters.amountMax}
                        onChange={(e) => setFilters((prev) => ({ ...prev, amountMax: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Maximum"
                        min="0"
                      />
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[10px] text-gray-500">Max</span>
                    </div>
                  </div>
                </div>

                {/* Shop Filter */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
                    <Store className="w-3.5 h-3.5" />
                    Vendeur/Boutique
                  </label>
                  <select
                    value={filters.shopName}
                    onChange={(e) => setFilters((prev) => ({ ...prev, shopName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                  >
                    <option value="">Toutes les boutiques</option>
                    {availableShops.map((shop) => (
                      <option key={shop} value={shop}>{shop}</option>
                    ))}
                  </select>
                </div>

                {/* Reset Filters Button */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-transparent">Actions</label>
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                </div>
              </div>

              {/* Active Filters Summary */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">Filtres actifs:</span>
                  {(filters.dateFrom || filters.dateTo) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700">
                      <Calendar className="w-3 h-3" />
                      {filters.dateFrom && filters.dateTo
                        ? `${new Date(filters.dateFrom).toLocaleDateString('fr-FR')} - ${new Date(filters.dateTo).toLocaleDateString('fr-FR')}`
                        : filters.dateFrom
                        ? `Depuis ${new Date(filters.dateFrom).toLocaleDateString('fr-FR')}`
                        : `Jusqu'au ${new Date(filters.dateTo).toLocaleDateString('fr-FR')}`}
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' }))}
                        className="ml-1 hover:text-indigo-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filters.amountMin || filters.amountMax) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                      <DollarSign className="w-3 h-3" />
                      {filters.amountMin && filters.amountMax
                        ? `${Number(filters.amountMin).toLocaleString('fr-FR')} - ${Number(filters.amountMax).toLocaleString('fr-FR')} FCFA`
                        : filters.amountMin
                        ? `Min ${Number(filters.amountMin).toLocaleString('fr-FR')} FCFA`
                        : `Max ${Number(filters.amountMax).toLocaleString('fr-FR')} FCFA`}
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, amountMin: '', amountMax: '' }))}
                        className="ml-1 hover:text-emerald-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filters.shopName && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                      <Store className="w-3 h-3" />
                      {filters.shopName}
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, shopName: '' }))}
                        className="ml-1 hover:text-amber-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status Tabs - Horizontal scroll on mobile with snap */}
          <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-2 -mx-1 px-1 hide-scrollbar snap-x snap-mandatory' : 'flex-wrap'}`} style={isMobile ? { WebkitOverflowScrolling: 'touch' } : undefined}>
            {STATUS_TABS.map((tab) => {
              const isActive = tab.key === activeStatus;
              const to = tab.key === 'all' ? '/orders' : `/orders/${tab.key}`;
              const Icon = tab.icon;
              const count = tab.key === 'all' ? stats.total : stats.byStatus[tab.key] || 0;

              return (
                <Link
                  key={tab.key}
                  to={to}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] flex-shrink-0 snap-start ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Orders List */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Erreur de chargement</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              {hasActiveFilters ? (
                <Filter className="w-10 h-10 text-gray-400" />
              ) : (
                <ClipboardList className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {hasActiveFilters ? 'Aucun résultat' : 'Aucune commande'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">{emptyMessage}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser les filtres
                </button>
              )}
              <Link
                to="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                Découvrir nos produits
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* List View - Hidden on mobile (card view is better for touch) */}
            {viewMode === 'list' && !isMobile && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* List Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <div className="col-span-1">N°</div>
                  <div className="col-span-3">Produit(s)</div>
                  <div className="col-span-2">Boutique</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Montant</div>
                  <div className="col-span-2">Statut</div>
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const orderItems =
                      order.items && order.items.length
                        ? order.items
                        : order.productSnapshot
                        ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }]
                        : [];
                    const computedTotal = orderItems.reduce(
                      (sum, item) =>
                        sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
                      0
                    );
                    const totalAmount = Number(order.totalAmount ?? computedTotal);
                    const StatusIcon = STATUS_ICONS[order.status] || Clock;
                    const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                    const firstItem = orderItems[0];
                    const shopName = firstItem?.snapshot?.shopName || 'N/A';
                    const productTitle = firstItem?.snapshot?.title || 'Produit';
                    const itemCount = orderItems.length;

                    return (
                      <Link
                        key={order._id}
                        to={`/orders/${order.status}`}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors items-center"
                      >
                        {/* Order Number */}
                        <div className="col-span-1 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">N°:</span>
                          <span className="font-bold text-gray-900 text-sm">#{order._id.slice(-6)}</span>
                        </div>

                        {/* Product */}
                        <div className="col-span-3 flex items-center gap-3">
                          {firstItem?.snapshot?.image ? (
                            <img
                              src={firstItem.snapshot.image}
                              alt={productTitle}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{productTitle}</p>
                            {itemCount > 1 && (
                              <p className="text-xs text-gray-500">+{itemCount - 1} autre{itemCount > 2 ? 's' : ''}</p>
                            )}
                          </div>
                        </div>

                        {/* Shop */}
                        <div className="col-span-2 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">Boutique:</span>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{shopName}</span>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="col-span-2 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">Date:</span>
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="col-span-2 flex items-center gap-2 md:block">
                          <span className="md:hidden text-xs font-medium text-gray-500">Montant:</span>
                          <span className="font-bold text-gray-900 text-sm">{formatCurrency(totalAmount)}</span>
                        </div>

                        {/* Status */}
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="md:hidden text-xs font-medium text-gray-500">Statut:</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyle.card}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {STATUS_LABELS[order.status]}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card View - Default on mobile */}
            {(viewMode === 'card' || isMobile) && (
            <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'pb-4' : ''}`}>
              {filteredOrders.map((order) => {
                const orderItems =
                  order.items && order.items.length
                    ? order.items
                    : order.productSnapshot
                    ? [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }]
                    : [];
                const computedTotal = orderItems.reduce(
                  (sum, item) =>
                    sum + Number(item.snapshot?.price || 0) * Number(item.quantity || 1),
                  0
                );
                const totalAmount = Number(order.totalAmount ?? computedTotal);
                const paidAmount = Number(order.paidAmount || 0);
                const remainingAmount = Number(
                  order.remainingAmount ?? Math.max(0, totalAmount - paidAmount)
                );
                const showPayment = Boolean(
                  paidAmount || order.paymentTransactionCode || order.paymentName
                );
                const createdBySelf =
                  order.createdBy?._id && order.customer?._id
                    ? order.createdBy._id === order.customer._id
                    : false;
                const createdByLabel = createdBySelf
                  ? 'Vous'
                  : order.createdBy?.name || order.createdBy?.email || 'Admin HDMarket';
                const StatusIcon = STATUS_ICONS[order.status] || Clock;
                const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;

                const isSwiped = swipedOrderId === order._id && touchStart && touchEnd;
                const swipeDistance = isSwiped ? touchStart - touchEnd : 0;
                const canCancel = order.cancellationWindow?.isActive && order.status !== 'cancelled';

                return (
                  <div
                    key={order._id}
                    className="relative overflow-hidden"
                  >
                    {/* Swipe Action Background (Cancel) - Only on mobile */}
                    {canCancel && (
                      <div className="md:hidden absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
                        <div className="flex flex-col items-center text-white">
                          <Trash2 className="w-5 h-5" />
                          <span className="text-xs mt-1 font-medium">Annuler</span>
                        </div>
                      </div>
                    )}

                    <div
                      className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden relative"
                      style={{
                        transform: swipeDistance > 0 ? `translateX(-${Math.min(swipeDistance, 100)}px)` : 'translateX(0)',
                        transition: isSwiped ? 'none' : 'transform 0.3s ease'
                      }}
                      onTouchStart={(e) => canCancel && onSwipeStart(e, order._id)}
                      onTouchMove={canCancel ? onSwipeMove : undefined}
                      onTouchEnd={() => canCancel && onSwipeEnd(order)}
                    >
                    {/* Order Header */}
                    <div className={`${statusStyle.header} text-white px-6 py-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Commande</p>
                            <h3 className="text-lg font-bold">#{order._id.slice(-6)}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wide">
                            {STATUS_LABELS[order.status]}
                          </span>
                          <button
                            type="button"
                            onClick={() => openOrderPdf(order)}
                            className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all"
                            title="Télécharger le bon de commande"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Cancellation Timer & Cancel Button */}
                      {order.cancellationWindow?.isActive && order.status !== 'cancelled' && (
                        <div className="space-y-3">
                          <CancellationTimer
                            deadline={order.cancellationWindow.deadline}
                            remainingMs={order.cancellationWindow.remainingMs}
                            isActive={order.cancellationWindow.isActive}
                            onExpire={() => {
                              // Update order in state when timer expires (no page reload)
                              setOrders((prev) =>
                                prev.map((o) =>
                                  o._id === order._id
                                    ? {
                                        ...o,
                                        cancellationWindow: {
                                          ...o.cancellationWindow,
                                          isActive: false,
                                          remainingMs: 0
                                        }
                                      }
                                    : o
                                )
                              );
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSkipCancellationWindow(order._id)}
                            disabled={skipLoadingId === order._id}
                            className="w-full px-6 py-3 min-h-[48px] rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
                          >
                            <ShieldCheck className="w-5 h-5" />
                            {skipLoadingId === order._id ? 'En cours...' : 'Autoriser le vendeur à traiter'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order._id)}
                            className="w-full px-6 py-3 min-h-[48px] rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            <X className="w-5 h-5" />
                            Annuler la commande
                          </button>
                          <p className="text-xs text-gray-500 text-center">
                            Vous pouvez annuler cette commande dans les 30 minutes suivant sa création. Si vous confirmez, le vendeur pourra traiter immédiatement.
                          </p>
                        </div>
                      )}

                      {/* Products List */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Package className="w-4 h-4 text-gray-500" />
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Articles commandés</h4>
                        </div>
                        <div className="space-y-3">
                          {orderItems.map((item, index) => (
                            <div
                              key={`${order._id}-${item.product || item.snapshot?.title || index}`}
                              className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                            >
                              {item.snapshot?.image || item.product?.images?.[0] ? (
                                <img
                                  src={item.snapshot?.image || item.product?.images?.[0]}
                                  alt={item.snapshot?.title || 'Produit'}
                                  className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-indigo-600" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  {item.product ? (
                                    <Link
                                      to={buildProductPath(item.product)}
                                      {...externalLinkProps}
                                      className="font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate"
                                    >
                                      {item.snapshot?.title || 'Produit'}
                                    </Link>
                                  ) : (
                                    <span className="font-bold text-gray-900">
                                      {item.snapshot?.title || 'Produit'}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                                    {formatCurrency((item.snapshot?.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                  <span>Quantité: {item.quantity || 1}</span>
                                  <span>•</span>
                                  <span>Prix unitaire: {formatCurrency(item.snapshot?.price || 0)}</span>
                                </div>
                                {item.snapshot?.shopName && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Store className="w-3 h-3" />
                                    <span>{item.snapshot.shopName}</span>
                                  </div>
                                )}
                                {item.snapshot?.confirmationNumber && (
                                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                                      Code: {item.snapshot.confirmationNumber}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Delivery Information */}
                        <div className="space-y-4">
                          {/* Delivery Code */}
                          {order.deliveryCode && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Code de livraison</h4>
                              </div>
                              <div className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Présentez ce code au livreur</p>
                                <div className="flex items-center justify-center">
                                  <span className="text-4xl font-black text-indigo-900 tracking-wider font-mono">
                                    {order.deliveryCode}
                                  </span>
                                </div>
                                <p className="text-xs text-indigo-600 mt-3 text-center">
                                  Ce code est requis pour recevoir votre commande
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Adresse de livraison</h4>
                            </div>
                            {(order.status === 'pending' || order.status === 'confirmed') && (
                              <button
                                type="button"
                                onClick={() => handleEditAddress(order)}
                                className="px-4 py-2 min-h-[40px] rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-all active:scale-[0.98]"
                              >
                                Modifier
                              </button>
                            )}
                          </div>
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                            <p className="text-sm font-semibold text-gray-900">{order.deliveryAddress || 'Non renseignée'}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="w-3 h-3" />
                              <span>{order.deliveryCity || 'Ville non renseignée'}</span>
                            </div>
                            {order.deliveryGuy && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-xs">
                                  <Truck className="w-3 h-3 text-blue-600" />
                                  <span className="font-semibold text-gray-700">Livreur:</span>
                                  <span className="text-gray-600">{order.deliveryGuy.name || 'Non assigné'}</span>
                                  {order.deliveryGuy.phone && (
                                    <>
                                      <span>•</span>
                                      <span className="text-gray-600">{order.deliveryGuy.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {order.trackingNote && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-gray-500" />
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Note de suivi</h4>
                              </div>
                              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                                <p className="text-sm text-gray-700">{order.trackingNote}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Payment & Order Info */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCard className="w-4 h-4 text-gray-500" />
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Informations de paiement</h4>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Total commande</span>
                              <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
                            </div>
                            {showPayment && (
                              <>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                  <span className="text-sm text-gray-600">Acompte versé</span>
                                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(paidAmount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Reste à payer</span>
                                  <span className="text-sm font-semibold text-amber-700">{formatCurrency(remainingAmount)}</span>
                                </div>
                                {(order.paymentName || order.paymentTransactionCode) && (
                                  <div className="pt-2 border-t border-gray-200 space-y-1 text-xs text-gray-500">
                                    {order.paymentName && (
                                      <div className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        <span>Payeur: {order.paymentName}</span>
                                      </div>
                                    )}
                                    {order.paymentTransactionCode && (
                                      <div className="flex items-center gap-1">
                                        <Receipt className="w-3 h-3" />
                                        <span>Transaction: {order.paymentTransactionCode}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="w-4 h-4 text-gray-500" />
                              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Gestionnaire</h4>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                              <p className="text-sm font-semibold text-gray-900">{createdByLabel}</p>
                              {order.createdBy?.email && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {order.createdBy.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cancellation Info */}
                      {order.status === 'cancelled' && (
                        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-sm font-bold text-red-800">Commande annulée</p>
                          </div>
                          {order.cancellationReason && (
                            <p className="text-sm text-red-700">Raison: {order.cancellationReason}</p>
                          )}
                          {order.cancelledAt && (
                            <p className="text-xs text-red-600">
                              Annulée le {formatOrderTimestamp(order.cancelledAt)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Progress Timeline - Only show if not cancelled */}
                      {order.status !== 'cancelled' && <OrderProgress status={order.status} />}

                      {/* Chat and Reorder Buttons */}
                      <div className="mt-4 space-y-3">
                        {/* Chat Button - Always visible */}
                        <OrderChat 
                          order={order} 
                          buttonText="Contacter le vendeur"
                          unreadCount={orderUnreadCounts[order._id] || 0}
                        />

                        {/* Reorder Button for Delivered Orders */}
                        {order.status === 'delivered' && order.items && order.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleReorder(order)}
                            disabled={reordering}
                            className="w-full px-6 py-3 min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                          >
                            {reordering ? (
                              <>
                                <Clock className="w-5 h-5 animate-spin" />
                                <span>Ajout au panier...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-5 h-5" />
                                <span>Commander à nouveau</span>
                              </>
                            )}
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <p className="text-xs text-gray-500 text-center">
                            Ajoute tous les articles de cette commande à votre panier
                          </p>
                        )}
                      </div>

                      {/* Timestamps */}
                      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span className="font-semibold">Créée:</span>
                          <span>{formatOrderTimestamp(order.createdAt)}</span>
                        </div>
                        {order.shippedAt && (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3 h-3" />
                            <span className="font-semibold">Expédiée:</span>
                            <span>{formatOrderTimestamp(order.shippedAt)}</span>
                          </div>
                        )}
                        {order.deliveredAt && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3" />
                            <span className="font-semibold">Livrée:</span>
                            <span>{formatOrderTimestamp(order.deliveredAt)}</span>
                          </div>
                        )}
                        {order.cancelledAt && (
                          <div className="flex items-center gap-1.5">
                            <X className="w-3 h-3" />
                            <span className="font-semibold">Annulée:</span>
                            <span>{formatOrderTimestamp(order.cancelledAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <p className="text-sm text-gray-600">
                  Page <span className="font-bold text-gray-900">{page}</span> sur{' '}
                  <span className="font-bold text-gray-900">{meta.totalPages}</span> —{' '}
                  <span className="font-bold text-gray-900">{meta.total}</span> commande{meta.total > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit Address Modal */}
        <EditAddressModal
          isOpen={editAddressModalOpen}
          onClose={() => {
            setEditAddressModalOpen(false);
            setSelectedOrderForEdit(null);
          }}
          order={selectedOrderForEdit}
          onSave={handleSaveAddress}
        />
      </div>
    </div>
  );
}
