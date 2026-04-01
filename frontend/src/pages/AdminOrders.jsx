import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath, buildShopPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { CheckCircle, Search, Package, User, MapPin, Truck, Clock, ClipboardList, Plus, RefreshCcw, ArrowLeft, X, AlertCircle, ShieldCheck, FileSpreadsheet, Trash2 } from 'lucide-react';
import OrderChat from '../components/OrderChat';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import BaseModal from '../components/modals/BaseModal';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';
import { appAlert } from '../utils/appDialog';

const STATUS_LABELS = {
  pending_payment: 'Paiement',
  paid: 'Payées',
  ready_for_pickup: 'Prêtes au retrait',
  picked_up_confirmed: 'Retraits confirmés',
  ready_for_delivery: 'Prêtes à livrer',
  out_for_delivery: 'En livraison',
  delivery_proof_submitted: 'Preuve soumise',
  confirmed_by_client: 'Confirmées client',
  pending: 'En attente',
  pending_installment: 'Vente à confirmer',
  installment_active: 'Tranches actives',
  overdue_installment: 'Tranches en retard',
  dispute_opened: 'Litige ouvert',
  confirmed: 'Confirmées',
  delivering: 'En livraison',
  delivered: 'Livrées',
  completed: 'Paiement terminé',
  cancelled: 'Annulées'
};

const STATUS_CLASSES = {
  pending_payment: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  ready_for_pickup: 'bg-sky-100 text-sky-800',
  picked_up_confirmed: 'bg-cyan-100 text-cyan-800',
  ready_for_delivery: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-blue-100 text-blue-800',
  delivery_proof_submitted: 'bg-violet-100 text-violet-800',
  confirmed_by_client: 'bg-teal-100 text-teal-800',
  pending: 'bg-gray-100 text-gray-700',
  pending_installment: 'bg-orange-100 text-orange-800',
  installment_active: 'bg-lime-100 text-lime-800',
  overdue_installment: 'bg-rose-100 text-rose-800',
  dispute_opened: 'bg-fuchsia-100 text-fuchsia-800',
  confirmed: 'bg-yellow-100 text-yellow-800',
  delivering: 'bg-neutral-100 text-neutral-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
};

const ORDERS_PER_PAGE = 12;
const ALERT_PRIORITY_CLASSES = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800'
};
const ADMIN_ONLY_ACTIONS = new Set(['force_mark_delivered', 'force_delivered', 'force_close_order', 'force_close']);
const ALERT_TYPE_LABELS = {
  delayed_order: 'Retard',
  high_value_at_risk: 'Montant élevé',
  repeated_seller_delay: 'Risque vendeur',
  repeated_buyer_no_confirmation: 'Risque acheteur',
  status_stuck: 'Statut bloqué'
};
const STATUS_TABS = [
  { key: 'all', label: 'Toutes', icon: ClipboardList },
  { key: 'pending_payment', label: 'Paiement', icon: Clock },
  { key: 'paid', label: 'Payées', icon: CheckCircle },
  { key: 'ready_for_pickup', label: 'Prêtes au retrait', icon: Package },
  { key: 'picked_up_confirmed', label: 'Retraits confirmés', icon: CheckCircle },
  { key: 'ready_for_delivery', label: 'Prêtes à livrer', icon: Truck },
  { key: 'out_for_delivery', label: 'En livraison', icon: Truck },
  { key: 'delivery_proof_submitted', label: 'Preuve soumise', icon: ShieldCheck },
  { key: 'confirmed_by_client', label: 'Confirmées client', icon: CheckCircle },
  { key: 'pending', label: 'En attente', icon: Clock },
  { key: 'pending_installment', label: 'Vente à confirmer', icon: Clock },
  { key: 'installment_active', label: 'Tranches actives', icon: Package },
  { key: 'overdue_installment', label: 'Tranches en retard', icon: AlertCircle },
  { key: 'dispute_opened', label: 'Litige ouvert', icon: AlertCircle },
  { key: 'confirmed', label: 'Confirmées', icon: Package },
  { key: 'delivering', label: 'En livraison', icon: Truck },
  { key: 'delivered', label: 'Livrées', icon: CheckCircle },
  { key: 'completed', label: 'Paiement terminé', icon: CheckCircle },
  { key: 'cancelled', label: 'Annulées', icon: X }
];
const MOBILE_QUICK_STATUS_KEYS = ['all', 'pending_payment', 'paid', 'out_for_delivery', 'delivered', 'cancelled'];

const getOrderId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value._id || '');
  return String(value);
};

const normalizeOrderForUi = (order) => {
  if (!order || typeof order !== 'object') return null;
  const normalizedId = getOrderId(order);
  if (!normalizedId) return null;
  return {
    ...order,
    _id: normalizedId
  };
};

const dedupeOrdersById = (list = []) => {
  const map = new Map();
  list.forEach((entry) => {
    const normalized = normalizeOrderForUi(entry);
    if (!normalized) return;
    if (!map.has(normalized._id)) {
      map.set(normalized._id, normalized);
    }
  });
  return Array.from(map.values());
};

const extractOrderSellers = (order) => {
  const items = Array.isArray(order?.items)
    ? order.items
    : order?.productSnapshot
    ? [{ snapshot: order.productSnapshot, product: order.product }]
    : [];

  const sellers = new Map();
  items.forEach((item, index) => {
    const rawSellerId =
      item?.snapshot?.shopId ||
      item?.product?.user?._id ||
      item?.product?.user ||
      '';
    const sellerId = rawSellerId ? String(rawSellerId) : '';
    const sellerName =
      item?.snapshot?.shopName ||
      item?.product?.user?.shopName ||
      item?.product?.user?.name ||
      `Boutique ${index + 1}`;
    const sellerKey = sellerId || `${sellerName}-${index}`;
    if (!sellers.has(sellerKey)) {
      sellers.set(sellerKey, { sellerId, sellerName });
    }
  });
  return Array.from(sellers.values());
};

export default function AdminOrders() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { cities: configuredCities } = useAppSettings();
  const isAdminUser = user?.role === 'admin' || user?.role === 'founder';
  const cityOptions = useMemo(() => {
    const names = Array.isArray(configuredCities)
      ? configuredCities
          .map((entry) => String(entry?.name || '').trim())
          .filter(Boolean)
      : [];
    return Array.from(new Set(names));
  }, [configuredCities]);
  const defaultDeliveryCity = cityOptions[0] || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get('orderId') || '';
  const externalLinkProps = useDesktopExternalLink();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [deliveryModeFilter, setDeliveryModeFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [commandCenter, setCommandCenter] = useState(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(false);
  const [alertsData, setAlertsData] = useState({
    total: 0,
    byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    items: []
  });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineOrder, setTimelineOrder] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionOrder, setActionOrder] = useState(null);
  const [actionType, setActionType] = useState('add_admin_note');
  const [actionNote, setActionNote] = useState('');
  const [actionReminderType, setActionReminderType] = useState('manual');
  const [actionDelaySeverity, setActionDelaySeverity] = useState('none');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [viewOrderOpen, setViewOrderOpen] = useState(false);
  const [viewOrderData, setViewOrderData] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [viewOrderError, setViewOrderError] = useState('');

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOrder, setAssignOrder] = useState(null);
  const [assignDeliveryGuyId, setAssignDeliveryGuyId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [deleteOrder, setDeleteOrder] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [deliveryGuys, setDeliveryGuys] = useState([]);
  const [deliveryGuysLoading, setDeliveryGuysLoading] = useState(false);
  const [deliveryGuysError, setDeliveryGuysError] = useState('');
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});

  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [productResults, setProductResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [newOrder, setNewOrder] = useState({
    deliveryAddress: '',
    deliveryCity: defaultDeliveryCity,
    trackingNote: ''
  });
  const orderCityOptions = useMemo(() => {
    const options = [...cityOptions];
    const selectedCustomerCity = String(selectedCustomer?.city || '').trim();
    const currentDeliveryCity = String(newOrder.deliveryCity || '').trim();
    if (selectedCustomerCity && !options.includes(selectedCustomerCity)) options.push(selectedCustomerCity);
    if (currentDeliveryCity && !options.includes(currentDeliveryCity)) options.push(currentDeliveryCity);
    return options;
  }, [cityOptions, newOrder.deliveryCity, selectedCustomer?.city]);
  const filterCityOptions = useMemo(() => {
    if (!cityFilter) return cityOptions;
    if (cityOptions.includes(cityFilter)) return cityOptions;
    return [...cityOptions, cityFilter];
  }, [cityFilter, cityOptions]);

  const openCreateModal = useCallback(() => {
    setStatusUpdateInfo(null);
    setAssignOpen(false);
    setCreateOpen(true);
  }, []);

  const openAssignModal = useCallback((order) => {
    if (!order) return;
    setStatusUpdateInfo(null);
    setCreateOpen(false);
    setAssignOrder(order);
    setAssignDeliveryGuyId(order.deliveryGuy?._id || '');
    setAssignError('');
    setAssignOpen(true);
  }, []);

  const closeAssignModal = useCallback(() => {
    setAssignOpen(false);
    setAssignOrder(null);
    setAssignDeliveryGuyId('');
    setAssignError('');
  }, []);

  const formatCurrency = (value) => formatPriceWithStoredSettings(value);

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const buildAdminQueryParams = useCallback(
    ({ includePagination = false, maxLimit = null, includeOrderId = false } = {}) => {
      const params = new URLSearchParams();
      if (includePagination) {
        params.set('page', String(page));
        params.set('limit', String(maxLimit || ORDERS_PER_PAGE));
      }
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchValue) params.set('search', searchValue);
      if (includeOrderId && orderIdFromUrl) params.set('orderId', orderIdFromUrl);
      if (cityFilter) params.set('city', cityFilter);
      if (shopFilter.trim()) params.set('shop', shopFilter.trim());
      if (dateFromFilter) params.set('dateFrom', dateFromFilter);
      if (dateToFilter) params.set('dateTo', dateToFilter);
      if (deliveryModeFilter) params.set('deliveryMode', deliveryModeFilter);
      if (paymentTypeFilter) params.set('paymentType', paymentTypeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (delayedOnly) params.set('delayed', 'true');
      return params;
    },
    [
      page,
      statusFilter,
      searchValue,
      orderIdFromUrl,
      cityFilter,
      shopFilter,
      dateFromFilter,
      dateToFilter,
      deliveryModeFilter,
      paymentTypeFilter,
      priorityFilter,
      delayedOnly
    ]
  );

  const exportToExcel = async () => {
    try {
      // Dynamically import xlsx library
      let XLSX;
      try {
        // @ts-ignore - Dynamic import for optional dependency
        XLSX = (await import('xlsx')).default || await import('xlsx');
      } catch (importError) {
        appAlert('Veuillez installer la bibliothèque xlsx: npm install xlsx');
        console.error('xlsx library not found:', importError);
        return;
      }
      
      if (!XLSX || !XLSX.utils) {
        appAlert('La bibliothèque xlsx n\'est pas correctement installée.');
        return;
      }
      
      // Fetch all orders (without pagination)
      const params = buildAdminQueryParams({ includePagination: true, maxLimit: 10000 });
      params.set('page', '1');
      
      const { data } = await api.get(`/orders/admin?${params.toString()}`);
      const allOrders = dedupeOrdersById(Array.isArray(data) ? data : data?.items || []);

      // Prepare data for Excel
      const excelData = allOrders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsList = items.map((item) => {
          const title = item.snapshot?.title || item.product?.title || 'Produit';
          const qty = Number(item.quantity || 1);
          const price = Number(item.snapshot?.price || item.product?.price || 0);
          return `${title} (x${qty} - ${formatCurrency(price)})`;
        }).join('; ');

        return {
          'ID Commande': String(order._id || '').slice(-8),
          'Date': order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '',
          'Statut': STATUS_LABELS[order.status] || order.status || '',
          'Client': order.customer?.name || '',
          'Email': order.customer?.email || '',
          'Téléphone': order.customer?.phone || '',
          'Adresse': order.deliveryAddress || '',
          'Ville': order.deliveryCity || '',
          'Articles': itemsList,
          'Nombre d\'articles': items.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
          'Total': formatCurrency(order.totalAmount || 0),
          'Acompte': formatCurrency(order.paidAmount || 0),
          'Reste à payer': formatCurrency(order.remainingAmount || 0),
          'Payeur': order.paymentName || '',
          'Code transaction': order.paymentTransactionCode || '',
          'Code livraison': order.deliveryCode || '',
          'Livreur': order.deliveryGuy?.name || '',
          'Téléphone livreur': order.deliveryGuy?.phone || '',
          'Note': order.trackingNote || '',
          'Créé par': order.createdBy?.name || '',
          'Date livraison': order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('fr-FR') : '',
          'Date expédition': order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('fr-FR') : ''
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Commandes');

      // Set column widths
      const colWidths = [
        { wch: 12 }, // ID Commande
        { wch: 18 }, // Date
        { wch: 15 }, // Statut
        { wch: 20 }, // Client
        { wch: 25 }, // Email
        { wch: 15 }, // Téléphone
        { wch: 30 }, // Adresse
        { wch: 15 }, // Ville
        { wch: 50 }, // Articles
        { wch: 15 }, // Nombre d'articles
        { wch: 15 }, // Total
        { wch: 15 }, // Acompte
        { wch: 15 }, // Reste à payer
        { wch: 20 }, // Payeur
        { wch: 18 }, // Code transaction
        { wch: 15 }, // Code livraison
        { wch: 20 }, // Livreur
        { wch: 18 }, // Téléphone livreur
        { wch: 30 }, // Note
        { wch: 20 }, // Créé par
        { wch: 15 }, // Date livraison
        { wch: 15 }  // Date expédition
      ];
      worksheet['!cols'] = colWidths;

      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `commandes_${statusFilter !== 'all' ? statusFilter + '_' : ''}${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Erreur export Excel:', error);
      if (error?.message?.includes('Failed to fetch dynamically imported module') || 
          error?.message?.includes('Cannot find module')) {
        appAlert('Veuillez installer la bibliothèque xlsx: npm install xlsx');
      } else {
        appAlert('Impossible d\'exporter vers Excel. ' + (error?.message || ''));
      }
    }
  };

  const getOrderItems = (order) => {
    if (order.items && order.items.length) return order.items;
    if (order.productSnapshot) {
      return [
        {
          snapshot: order.productSnapshot,
          quantity: 1,
          product: order.product?._id
        }
      ];
    }
    return [];
  };

  const openOrderPdf = (order) => {
    const orderItems = getOrderItems(order);
    const deliveryGuyName = escapeHtml(order.deliveryGuy?.name || '');
    const deliveryGuyPhone = escapeHtml(order.deliveryGuy?.phone || '');
    const computedTotal = orderItems.reduce((sum, item) => {
      const price = Number(item.snapshot?.price || item.product?.price || 0);
      const qty = Number(item.quantity || 1);
      return sum + price * qty;
    }, 0);
    const orderTotal = Number(order.totalAmount ?? computedTotal);
    const paidAmount = Number(order.paidAmount || 0);
    const remainingAmount =
      order.remainingAmount != null
        ? Number(order.remainingAmount)
        : Math.max(0, orderTotal - paidAmount);
    const paymentName = escapeHtml(order.paymentName || 'Non renseigné');
    const paymentTransactionCode = escapeHtml(
      order.paymentTransactionCode || 'Non renseigné'
    );
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
          <title>Bon de commande et de livraison</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 32px; color: #111827; }
            .page { position: relative; z-index: 1; }
            .watermark {
              position: fixed;
              top: 45%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-18deg);
              font-size: 40px;
              letter-spacing: 0.4em;
              text-transform: uppercase;
              color: rgba(15, 23, 42, 0.08);
              white-space: nowrap;
              pointer-events: none;
              z-index: 0;
            }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e5e7eb; padding: 6px; }
            .title { font-size: 22px; font-weight: 700; }
            .badge { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
            .meta-box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; }
            .meta-box h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: #6b7280; }
            .meta-box p { margin: 4px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 13px; vertical-align: top; }
            th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #6b7280; }
            .right { text-align: right; }
            .total-row td { font-weight: 700; border-top: 2px solid #111827; }
            .signature { margin-top: 32px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
            .signature-box { border: 1px dashed #cbd5f5; border-radius: 12px; padding: 16px; min-height: 90px; }
            .signature-box h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: #6b7280; }
            .signature-line { margin-top: 24px; border-bottom: 1px solid #9ca3af; height: 1px; }
            .notes { margin-top: 20px; font-size: 12px; color: #6b7280; }
            .print-actions { margin-top: 24px; display: flex; justify-content: flex-end; }
            .print-btn { padding: 10px 16px; border-radius: 999px; border: 1px solid #111827; background: #111827; color: #fff; font-weight: 600; cursor: pointer; }
            .security { margin-top: 12px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.2em; }
            @media print {
              body { margin: 0; }
              .print-actions { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="watermark">HDMarket • Document Officiel</div>
          <div class="page">
            <div class="header">
              <div class="brand">
                <img src="${logoUrl}" alt="HDMarket" class="logo" />
                <div>
                  <div class="title">Bon de commande et de livraison</div>
                  <div class="badge">HDMarket</div>
                </div>
              </div>
              <div class="right">
                <div class="badge">Commande #${orderShort}</div>
                <div>${escapeHtml(new Date(order.createdAt).toLocaleDateString('fr-FR'))}</div>
                <div class="security">Réf: ${orderRef}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-box">
                <h4>Client</h4>
                <p>${escapeHtml(order.customer?.name || 'Client')}</p>
                <p>${escapeHtml(order.customer?.phone || '')}</p>
                <p>${escapeHtml(order.customer?.email || '')}</p>
              </div>
            <div class="meta-box">
              <h4>Livraison</h4>
              <p>${escapeHtml(order.deliveryAddress || '')}</p>
              <p>${escapeHtml(order.deliveryCity || '')}</p>
              ${order.trackingNote ? `<p>${escapeHtml(order.trackingNote)}</p>` : ''}
              ${deliveryGuyName ? `<p>Livreur: ${deliveryGuyName}${deliveryGuyPhone ? ` · ${deliveryGuyPhone}` : ''}</p>` : ''}
            </div>
            <div class="meta-box">
              <h4>Paiement</h4>
              <p>Acompte versé: ${formatCurrency(paidAmount)}</p>
              <p>Reste à payer: ${formatCurrency(remainingAmount)}</p>
              <p>Nom du payeur: ${paymentName}</p>
              <p>Transaction: ${paymentTransactionCode}</p>
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

            <div class="signature">
              <div class="signature-box">
                <h4>Signature client</h4>
                <div class="signature-line"></div>
                <p class="notes">Nom & signature à la livraison.</p>
              </div>
              <div class="signature-box">
                <h4>Signature livreur</h4>
                <div class="signature-line"></div>
                <p class="notes">Nom & signature.</p>
              </div>
            </div>

            <p class="notes">
              Ce document fait foi de bon de commande et de livraison. Merci de vérifier les articles avant signature.
              Toute copie doit comporter la référence unique ${orderRef}.
            </p>

            <div class="print-actions">
              <button class="print-btn" id="print-btn">Imprimer / PDF</button>
            </div>

            <script>
              document.getElementById('print-btn').addEventListener('click', () => window.print());
            </script>
          </div>
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

  const addProductToSelection = (product) => {
    setSelectedProducts((prev) => {
      if (prev.some((item) => item.product._id === product._id)) {
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeProductFromSelection = (productId) => {
    setSelectedProducts((prev) => prev.filter((item) => item.product._id !== productId));
  };

  const updateSelectedProductQuantity = (productId, quantity) => {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    setSelectedProducts((prev) =>
      prev.map((item) =>
        item.product._id === productId ? { ...item, quantity: safeQuantity } : item
      )
    );
  };

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = Object.fromEntries(buildAdminQueryParams().entries());
      const { data } = await api.get('/orders/admin/stats', { params });
      setStats(data);
    } catch (error) {
      console.error('Erreur stats commandes:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [buildAdminQueryParams]);

  const loadCommandCenter = useCallback(async () => {
    setCommandCenterLoading(true);
    try {
      const params = Object.fromEntries(buildAdminQueryParams().entries());
      const { data } = await api.get('/orders/admin/command-center', { params });
      setCommandCenter(data || null);
    } catch (error) {
      console.error('Erreur centre de commande:', error);
      setCommandCenter(null);
    } finally {
      setCommandCenterLoading(false);
    }
  }, [buildAdminQueryParams]);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const params = Object.fromEntries(buildAdminQueryParams().entries());
      const { data } = await api.get('/orders/admin/alerts', { params });
      setAlertsData({
        total: Number(data?.total || 0),
        byPriority: data?.byPriority || { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        items: Array.isArray(data?.items) ? data.items : []
      });
    } catch (error) {
      console.error('Erreur alertes commandes:', error);
      setAlertsData({
        total: 0,
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        items: []
      });
    } finally {
      setAlertsLoading(false);
    }
  }, [buildAdminQueryParams]);

  const loadDeliveryGuys = useCallback(async () => {
    setDeliveryGuysLoading(true);
    setDeliveryGuysError('');
    try {
      const { data } = await api.get('/admin/delivery-guys?limit=100');
      const list = Array.isArray(data) ? data : data?.items || [];
      setDeliveryGuys(list);
    } catch (error) {
      setDeliveryGuysError(error.response?.data?.message || 'Impossible de charger les livreurs.');
      setDeliveryGuys([]);
    } finally {
      setDeliveryGuysLoading(false);
    }
  }, []);

  const loadUnreadCounts = useCallback(async (orderIds) => {
    if (!orderIds || orderIds.length === 0 || !user?._id) return {};
    try {
      // Load unread counts for all orders in parallel
      const counts = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const { data } = await api.get(`/orders/${orderId}/messages`);
            // Count unread messages for current user
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
  }, [user?._id]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const params = buildAdminQueryParams({ includePagination: true, includeOrderId: true });
      const { data } = await api.get(`/orders/admin?${params.toString()}`);
      const rawItems = Array.isArray(data) ? data : data?.items || [];
      const uniqueOrders = dedupeOrdersById(rawItems);
      setOrders(uniqueOrders);

      // Load unread message counts
      const orderIds = uniqueOrders.map((order) => order._id);
      const unreadCounts = await loadUnreadCounts(orderIds);
      setOrderUnreadCounts(unreadCounts);

      setMeta({
        total: data?.total ?? uniqueOrders.length,
        totalPages: data?.totalPages ?? 1
      });
      if (data?.page && data.page !== page) {
        setPage(data.page);
      }
    } catch (error) {
      setOrdersError(error.response?.data?.message || error.message || 'Impossible de charger les commandes.');
      setOrders([]);
      setMeta({ total: 0, totalPages: 1 });
    } finally {
      setOrdersLoading(false);
    }
  }, [page, loadUnreadCounts, buildAdminQueryParams]);

  const loadCustomers = useCallback(
    async (query = '') => {
      try {
        const { data } = await api.get(
          query.trim() ? `/orders/admin/customers?search=${encodeURIComponent(query.trim())}` : '/orders/admin/customers'
        );
        setCustomerResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erreur chargement clients', error);
      }
    },
    []
  );

  const loadProducts = useCallback(
    async (query = '') => {
      try {
        const { data } = await api.get(
          query.trim() ? `/orders/admin/products?search=${encodeURIComponent(query.trim())}` : '/orders/admin/products'
        );
        setProductResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erreur chargement produits', error);
      }
    },
    []
  );

  const refreshCommandCenterData = useCallback(async () => {
    await Promise.all([loadOrders(), loadStats(), loadCommandCenter(), loadAlerts()]);
  }, [loadOrders, loadStats, loadCommandCenter, loadAlerts]);

  const focusOrder = useCallback(
    (orderId) => {
      const normalized = getOrderId(orderId);
      if (!normalized) return;
      if (searchParams.get('orderId') === normalized) return;
      setPage(1);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('orderId', normalized);
          return next;
        },
        { replace: true }
      );
    },
    [searchParams, setSearchParams]
  );

  const openOrderPreviewModal = useCallback(
    async (order) => {
      const targetOrderId = getOrderId(order?._id || order);
      if (!targetOrderId) return;

      setViewOrderOpen(true);
      setViewOrderError('');

      const existing = orders.find((entry) => getOrderId(entry) === targetOrderId) || null;
      if (existing) {
        setViewOrderData(existing);
        setViewOrderLoading(false);
        return;
      }

      setViewOrderData(null);
      setViewOrderLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('orderId', targetOrderId);
        params.set('page', '1');
        params.set('limit', '1');
        const { data } = await api.get(`/orders/admin?${params.toString()}`);
        const found = dedupeOrdersById(Array.isArray(data) ? data : data?.items || [])[0] || null;
        if (!found) {
          setViewOrderError('Commande introuvable.');
          return;
        }
        setViewOrderData(found);
      } catch (error) {
        setViewOrderError(error.response?.data?.message || 'Impossible de charger cette commande.');
      } finally {
        setViewOrderLoading(false);
      }
    },
    [orders]
  );

  const openTimelineDrawer = useCallback(async (order) => {
    const targetOrderId = getOrderId(order?._id || order);
    if (!targetOrderId) return;
    setTimelineOpen(true);
    setTimelineOrder(order && typeof order === 'object' ? order : null);
    setTimelineError('');
    setTimelineLoading(true);
    try {
      const { data } = await api.get(`/orders/admin/${targetOrderId}/timeline`);
      setTimelineData(data || null);
    } catch (error) {
      setTimelineData(null);
      setTimelineError(error.response?.data?.message || 'Impossible de charger la timeline.');
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const openActionModal = useCallback(
    (order, presetAction = 'add_admin_note') => {
      if (!order?._id) return;
      setActionOrder(order);
      setActionType(presetAction);
      setActionNote('');
      setActionReminderType('manual');
      setActionDelaySeverity('none');
      setActionError('');
      setActionModalOpen(true);
    },
    []
  );

  const submitAdminAction = useCallback(
    async (event) => {
      event.preventDefault();
      if (!actionOrder?._id) return;
      if (!isAdminUser && ADMIN_ONLY_ACTIONS.has(actionType)) {
        setActionError('Seuls les administrateurs peuvent forcer la livraison ou la fermeture.');
        return;
      }
      setActionSaving(true);
      setActionError('');
      try {
        await api.post(`/orders/admin/${actionOrder._id}/actions`, {
          action: actionType,
          note: actionNote.trim(),
          reminderType: actionReminderType,
          delaySeverity: actionDelaySeverity
        });
        showToast('Action admin appliquée.', { variant: 'success' });
        setActionModalOpen(false);
        await refreshCommandCenterData();
        if (timelineOpen) {
          await openTimelineDrawer(actionOrder);
        }
      } catch (error) {
        const message = error.response?.data?.message || 'Impossible d’appliquer cette action.';
        setActionError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setActionSaving(false);
      }
    },
    [
      actionOrder,
      actionType,
      actionNote,
      actionReminderType,
      actionDelaySeverity,
      isAdminUser,
      showToast,
      refreshCommandCenterData,
      timelineOpen,
      openTimelineDrawer
    ]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCommandCenter();
  }, [loadCommandCenter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    loadCustomers();
    loadProducts();
    loadDeliveryGuys();
  }, [loadCustomers, loadProducts, loadDeliveryGuys]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (ordersLoading || !orderIdFromUrl) return;
    const found = orders.some((o) => getOrderId(o) === orderIdFromUrl);
    if (!found) return;
    const el = document.getElementById(`order-${orderIdFromUrl}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('orderId');
        return next;
      }, { replace: true });
    }
  }, [ordersLoading, orderIdFromUrl, orders, setSearchParams]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchValue(searchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    searchValue,
    cityFilter,
    shopFilter,
    dateFromFilter,
    dateToFilter,
    deliveryModeFilter,
    paymentTypeFilter,
    priorityFilter,
    delayedOnly
  ]);

  const handleUpdateOrder = async (orderId, payload) => {
    const targetOrderId = getOrderId(orderId);
    const currentOrder = orders.find((order) => getOrderId(order) === targetOrderId);
    try {
      const { data } = await api.patch(`/orders/admin/${targetOrderId}`, payload);
      const updatedOrder = normalizeOrderForUi(data);
      if (!updatedOrder) return null;
      const previousStatus = currentOrder?.status;
      const nextStatus = updatedOrder?.status || previousStatus;
      const removeFromView = statusFilter !== 'all' && nextStatus && statusFilter !== nextStatus;

      setOrders((prev) => {
        if (!Array.isArray(prev)) return prev;
        if (removeFromView) {
          return prev.filter((order) => getOrderId(order) !== targetOrderId);
        }
        const merged = prev.map((order) =>
          getOrderId(order) === targetOrderId ? { ...order, ...updatedOrder } : order
        );
        return dedupeOrdersById(merged);
      });

      if (removeFromView) {
        const nextTotal = Math.max(0, (meta.total || 0) - 1);
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / ORDERS_PER_PAGE));
        setMeta((prev) => ({
          ...prev,
          total: nextTotal,
          totalPages: nextTotalPages
        }));
        if (page > nextTotalPages) {
          setPage(nextTotalPages);
        }
      }

      if (previousStatus && nextStatus && previousStatus !== nextStatus) {
        setStats((prev) => {
          if (!prev?.statusCounts) return prev;
          return {
            ...prev,
            statusCounts: {
              ...prev.statusCounts,
              [previousStatus]: Math.max(0, (prev.statusCounts[previousStatus] || 0) - 1),
              [nextStatus]: (prev.statusCounts[nextStatus] || 0) + 1
            }
          };
        });
        setStatusUpdateInfo({
          orderId: targetOrderId,
          status: nextStatus
        });
      }
      if (payload?.status || payload?.deliveryGuyId) {
        void loadCommandCenter();
        void loadAlerts();
      }
      return updatedOrder;
    } catch (error) {
      appAlert(error.response?.data?.message || 'Impossible de mettre à jour la commande.');
      return null;
    }
  };

  const handleDeleteOrder = async (orderId) => {
    const targetOrderId = getOrderId(orderId);
    if (!targetOrderId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/orders/admin/${targetOrderId}`);
      setOrders((prev) => prev.filter((o) => getOrderId(o) !== targetOrderId));
      setMeta((prev) => ({
        ...prev,
        total: Math.max(0, (prev.total || 0) - 1),
        totalPages: Math.max(1, Math.ceil(Math.max(0, (prev.total || 0) - 1) / ORDERS_PER_PAGE))
      }));
      const deletedOrder = orders.find((o) => getOrderId(o) === targetOrderId);
      if (deletedOrder?.status && stats?.statusCounts) {
        setStats((prev) => ({
          ...prev,
          statusCounts: {
            ...prev?.statusCounts,
            [deletedOrder.status]: Math.max(0, (prev?.statusCounts?.[deletedOrder.status] || 0) - 1)
          }
        }));
      }
      setDeleteOrder(null);
      await Promise.all([loadStats(), loadCommandCenter(), loadAlerts()]);
    } catch (error) {
      appAlert(error.response?.data?.message || 'Impossible de supprimer la commande.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || selectedProducts.length === 0) return;
    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      await api.post('/orders/admin', {
        customerId: selectedCustomer._id,
        deliveryAddress: newOrder.deliveryAddress.trim(),
        deliveryCity: newOrder.deliveryCity,
        trackingNote: newOrder.trackingNote.trim(),
        items: selectedProducts.map(({ product, quantity }) => ({
          productId: product._id,
          quantity
        }))
      });
      setCreateSuccess('Commande créée avec succès.');
      setSelectedCustomer(null);
      setSelectedProducts([]);
      setNewOrder({
        deliveryAddress: '',
        deliveryCity: defaultDeliveryCity,
        trackingNote: ''
      });
      setCreateOpen(false);
      await refreshCommandCenterData();
    } catch (error) {
      setCreateError(error.response?.data?.message || "Impossible de créer la commande.");
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomer) return;
    setNewOrder((prev) => ({
      ...prev,
      deliveryAddress: selectedCustomer.address || prev.deliveryAddress || '',
      deliveryCity: selectedCustomer.city || prev.deliveryCity || defaultDeliveryCity
    }));
  }, [defaultDeliveryCity, selectedCustomer]);

  useEffect(() => {
    if (!cityOptions.length) return;
    setNewOrder((prev) => {
      if (prev.deliveryCity && cityOptions.includes(prev.deliveryCity)) return prev;
      return { ...prev, deliveryCity: defaultDeliveryCity };
    });
  }, [cityOptions, defaultDeliveryCity]);

  useEffect(() => {
    if (!createOpen) {
      setCreateError('');
      setCreateSuccess('');
    }
  }, [createOpen]);

  useEffect(() => {
    if (!assignOpen) {
      setAssignError('');
      setAssignSaving(false);
    }
  }, [assignOpen]);

  useEffect(() => {
    if (!actionModalOpen) {
      setActionSaving(false);
      setActionError('');
    }
  }, [actionModalOpen]);

  useEffect(() => {
    if (!viewOrderOpen) {
      setViewOrderLoading(false);
      setViewOrderError('');
    }
  }, [viewOrderOpen]);

  useEffect(() => {
    if (!deleteOrder) return;
  }, [deleteOrder]);

  const renderStatusTabs = () => (
    <div
      className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 md:flex-wrap md:overflow-visible md:pb-0 md:mx-0 md:px-0"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {STATUS_TABS.map((tab) => {
        const key = tab.key;
        const isActive = statusFilter === key;
        const Icon = tab.icon;
        const count = key === 'all' ? (stats?.total || 0) : (stats?.statusCounts?.[key] || 0);
        return (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] flex-shrink-0 ${
              isActive
                ? 'bg-neutral-900 text-white shadow-lg scale-[1.02]'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderMobileStatusPicker = () => (
    <div className="space-y-2 md:hidden">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Statut des commandes
        </p>
        <span className="text-xs font-semibold text-gray-500">
          {statusFilter === 'all'
            ? 'Toutes'
            : STATUS_LABELS[statusFilter] || statusFilter}
        </span>
      </div>
      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-neutral-500 focus:border-transparent min-h-[44px]"
      >
        {STATUS_TABS.map((tab) => {
          const count = tab.key === 'all' ? (stats?.total || 0) : (stats?.statusCounts?.[tab.key] || 0);
          return (
            <option key={`mobile-status-${tab.key}`} value={tab.key}>
              {tab.label} ({count})
            </option>
          );
        })}
      </select>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {MOBILE_QUICK_STATUS_KEYS.map((key) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={`mobile-quick-${key}`}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`inline-flex min-h-[36px] items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {key === 'all' ? 'Toutes' : STATUS_LABELS[key] || key}
            </button>
          );
        })}
      </div>
    </div>
  );

  const previewOrderItems = viewOrderData ? getOrderItems(viewOrderData) : [];
  const previewComputedTotal = previewOrderItems.reduce((sum, item) => {
    const price = Number(item.snapshot?.price || item.product?.price || 0);
    const qty = Number(item.quantity || 1);
    return sum + price * qty;
  }, 0);
  const previewOrderTotal = Number(viewOrderData?.totalAmount ?? previewComputedTotal);
  const previewPaidAmount = Number(viewOrderData?.paidAmount || 0);
  const previewRemainingAmount =
    viewOrderData?.remainingAmount != null
      ? Number(viewOrderData.remainingAmount)
      : Math.max(0, previewOrderTotal - previewPaidAmount);

  const availableAdminActions = [
    { value: 'add_admin_note', label: 'Ajouter une note admin' },
    { value: 'trigger_manual_reminder', label: 'Déclencher un rappel manuel' },
    { value: 'override_delay_status', label: 'Override statut de retard' },
    ...(isAdminUser
      ? [
          { value: 'force_mark_delivered', label: 'Forcer marquage livré' },
          { value: 'force_close_order', label: 'Forcer clôture commande' }
        ]
      : [])
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
        <section className="ui-card ui-card-interactive ui-card-fade-in p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-neutral-700" />
                Gestion des commandes
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Suivi global, affectation des livreurs et mise à jour des statuts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4" />
                Créer une commande
              </button>
              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </button>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour admin
              </Link>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'].map((key) => {
            const count = statsLoading ? 0 : stats?.statusCounts?.[key] || 0;
            const iconColors = {
              pending: 'text-gray-600',
              confirmed: 'text-amber-600',
              delivering: 'text-neutral-600',
              delivered: 'text-emerald-600',
              cancelled: 'text-red-600'
            };
            return (
              <div key={key} className="ui-card ui-card-interactive ui-card-fade-in p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center">
                    {key === 'pending' && <Clock className={`w-5 h-5 ${iconColors[key]}`} />}
                    {key === 'confirmed' && <Package className={`w-5 h-5 ${iconColors[key]}`} />}
                    {key === 'delivering' && <Truck className={`w-5 h-5 ${iconColors[key]}`} />}
                    {key === 'delivered' && <CheckCircle className={`w-5 h-5 ${iconColors[key]}`} />}
                    {key === 'cancelled' && <X className={`w-5 h-5 ${iconColors[key]}`} />}
                  </div>
                </div>
                <p className="text-xs uppercase font-semibold text-gray-500 mb-1 tracking-wide">
                  {STATUS_LABELS[key]}
                </p>
                <p className={`text-3xl font-bold ${iconColors[key]}`}>
                  {statsLoading ? '...' : count.toLocaleString('fr-FR')}
                </p>
              </div>
            );
          })}
        </div>

        <section className="ui-card ui-card-interactive ui-card-fade-in p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Command Center</h2>
              <p className="text-sm text-gray-500">Vue globale des opérations, retards et risques.</p>
            </div>
            <button
              type="button"
              onClick={refreshCommandCenterData}
              disabled={ordersLoading || statsLoading || commandCenterLoading || alertsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${(ordersLoading || commandCenterLoading || alertsLoading) ? 'animate-spin' : ''}`} />
              Rafraîchir le centre
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { key: 'total', label: 'Total', value: commandCenter?.metrics?.total },
              { key: 'totalActive', label: 'Actives', value: commandCenter?.metrics?.totalActive },
              { key: 'inProgress', label: 'En cours', value: commandCenter?.metrics?.inProgress },
              { key: 'delayed', label: 'Retard', value: commandCenter?.metrics?.delayed },
              { key: 'pendingConfirmation', label: 'En attente client', value: commandCenter?.metrics?.pendingConfirmation },
              { key: 'awaitingReview', label: 'Sans avis', value: commandCenter?.metrics?.awaitingReview },
              { key: 'delivered', label: 'Livrées', value: commandCenter?.metrics?.delivered },
              { key: 'cancelled', label: 'Annulées', value: commandCenter?.metrics?.cancelled },
              { key: 'dispute', label: 'Litiges', value: commandCenter?.metrics?.dispute },
              { key: 'criticalAlerts', label: 'Alertes critiques', value: alertsData?.byPriority?.CRITICAL }
            ].map((metric) => (
              <div key={metric.key} className="rounded-2xl border border-gray-100 bg-white/95 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{metric.label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {commandCenterLoading && metric.key !== 'criticalAlerts'
                    ? '...'
                    : Number(metric.value || 0).toLocaleString('fr-FR')}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-card ui-card-interactive ui-card-fade-in p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Alertes opérationnelles
              </h2>
              <p className="text-sm text-gray-500">
                {alertsData.total} alerte{alertsData.total > 1 ? 's' : ''} détectée{alertsData.total > 1 ? 's' : ''}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => (
                <span key={level} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ALERT_PRIORITY_CLASSES[level]}`}>
                  {level}: {Number(alertsData?.byPriority?.[level] || 0)}
                </span>
              ))}
            </div>
          </div>
          {alertsLoading ? (
            <p className="text-sm text-gray-500">Chargement des alertes…</p>
          ) : alertsData.items.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune alerte pour les filtres actuels.</p>
          ) : (
            <div className="space-y-2">
              {alertsData.items.slice(0, 8).map((alertItem) => (
                <div key={alertItem.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ALERT_PRIORITY_CLASSES[String(alertItem.priority || 'LOW').toUpperCase()] || ALERT_PRIORITY_CLASSES.LOW}`}>
                          {String(alertItem.priority || 'LOW').toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                          {ALERT_TYPE_LABELS[alertItem.type] || 'Alerte'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{alertItem.title}</p>
                      <p className="text-xs text-gray-600">{alertItem.message}</p>
                    </div>
                    {alertItem.orderId ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openOrderPreviewModal(alertItem.orderId)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Voir commande
                        </button>
                        <button
                          type="button"
                          onClick={() => openTimelineDrawer(alertItem.orderId)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Timeline
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      {createOpen && (
        <BaseModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          size="full"
          panelClassName="ui-card ui-card-lg max-h-[85dvh] overflow-auto p-4 shadow-xl sm:max-w-5xl sm:p-6"
          ariaLabel="Créer une commande"
        >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-gray-900 font-semibold text-lg">
                <Plus className="w-5 h-5 text-green-600" />
                Créer une commande
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                aria-label="Fermer"
              >
                X
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateOrder}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <User size={16} />
                    Client
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      placeholder="Recherche client"
                      value={customerQuery}
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        loadCustomers(e.target.value);
                      }}
                    />
                  </div>
                  <div className="max-h-40 overflow-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                    {customerResults.map((customer) => (
                      <button
                        type="button"
                        key={customer._id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`w-full text-left px-3 py-2 text-sm flex flex-col ${
                          selectedCustomer?._id === customer._id ? 'bg-neutral-50 text-neutral-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-semibold">{customer.name}</span>
                        <span className="text-xs text-gray-500">{customer.email}</span>
                        <span className="text-xs text-gray-500">{customer.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Package size={16} />
                    Produit
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      placeholder="Recherche produit"
                      value={productQuery}
                      onChange={(e) => {
                        setProductQuery(e.target.value);
                        loadProducts(e.target.value);
                      }}
                    />
                  </div>
                  <div className="max-h-40 overflow-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                    {productResults.map((product) => {
                      const alreadySelected = selectedProducts.some((item) => item.product._id === product._id);
                      return (
                        <div
                          key={product._id}
                          className="px-3 py-2 text-sm flex flex-col gap-1 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-gray-900">{product.title}</span>
                              <span className="block text-xs text-gray-500">
                                {formatCurrency(product.price || 0)} •{' '}
                                {product.user?.shopName || product.user?.name || 'Boutique'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => addProductToSelection(product)}
                              disabled={alreadySelected}
                              className={`px-2 py-1 text-xs rounded-full border ${
                                alreadySelected
                                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                              }`}
                            >
                              {alreadySelected ? 'Ajouté' : 'Ajouter'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedProducts.length > 0 && (
                    <div className="ui-card-soft-separator mt-4 space-y-2 rounded-2xl border border-gray-100 p-3">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Produits sélectionnés
                      </p>
                      {selectedProducts.map(({ product, quantity }) => (
                        <div
                          key={product._id}
                          className="ui-card-soft-separator flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{product.title}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(product.price || 0)}
                            </p>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => updateSelectedProductQuantity(product._id, e.target.value)}
                            className="ui-input w-16 rounded-lg px-2 py-1 text-center text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeProductFromSelection(product._id)}
                            className="text-xs text-red-600 hover:text-red-500"
                          >
                            Retirer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MapPin size={16} />
                    Adresse de livraison *
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    rows={3}
                    value={newOrder.deliveryAddress}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Truck size={16} />
                    Ville de livraison *
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    value={newOrder.deliveryCity}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, deliveryCity: e.target.value }))}
                  >
                    {orderCityOptions.length === 0 && (
                      <option value="">Aucune ville configurée</option>
                    )}
                    {orderCityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <RefreshCcw size={16} />
                    Note de suivi
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    rows={2}
                    value={newOrder.trackingNote}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, trackingNote: e.target.value }))}
                  />
                </div>
              </div>

              {createError && <p className="text-sm text-red-600">{createError}</p>}
              {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}

              <button
                type="submit"
                disabled={
                  createLoading ||
                  !selectedCustomer ||
                  selectedProducts.length === 0 ||
                  !newOrder.deliveryAddress.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-600 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50"
              >
                <Plus size={16} />
                Ajouter la commande
              </button>
            </form>
        </BaseModal>
      )}

      {assignOpen && (
        <BaseModal
          isOpen={assignOpen}
          onClose={closeAssignModal}
          size="sm"
          panelClassName="ui-card ui-card-lg p-6 shadow-xl sm:max-w-md"
          ariaLabel="Assigner un livreur"
        >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Assigner un livreur</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Commande #{assignOrder?._id?.slice(-6)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                aria-label="Fermer"
              >
                X
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Truck size={16} />
                  Livreur
                </label>
                <select
                  value={assignDeliveryGuyId}
                  onChange={(e) => setAssignDeliveryGuyId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  disabled={deliveryGuysLoading || assignSaving}
                >
                  <option value="">Assigner un livreur</option>
                  {deliveryGuys.map((deliveryGuy) => (
                    <option key={deliveryGuy._id} value={deliveryGuy._id}>
                      {deliveryGuy.fullName || deliveryGuy.name}
                    </option>
                  ))}
                </select>
                {deliveryGuysError && (
                  <p className="mt-2 text-xs text-red-500">{deliveryGuysError}</p>
                )}
                {assignDeliveryGuyId ? (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                    {(() => {
                      const selectedDeliveryGuy = deliveryGuys.find(
                        (entry) => String(entry._id) === String(assignDeliveryGuyId)
                      );
                      if (!selectedDeliveryGuy) return null;
                      return (
                        <>
                          <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-200">
                            {resolveDeliveryGuyProfileImage(selectedDeliveryGuy) ? (
                              <img
                                src={resolveDeliveryGuyProfileImage(selectedDeliveryGuy)}
                                alt={selectedDeliveryGuy.name || selectedDeliveryGuy.fullName || 'Livreur'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-600">
                                {String(selectedDeliveryGuy.name || selectedDeliveryGuy.fullName || 'L')
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-700">
                            {selectedDeliveryGuy.name || selectedDeliveryGuy.fullName || 'Livreur'}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
                {assignError && <p className="mt-2 text-xs text-red-500">{assignError}</p>}
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!assignOrder?._id) return;
                  setAssignSaving(true);
                  setAssignError('');
                  const updated = await handleUpdateOrder(assignOrder._id, {
                    deliveryGuyId: assignDeliveryGuyId
                  });
                  if (updated) {
                    closeAssignModal();
                  } else {
                    setAssignError('Impossible de mettre à jour le livreur.');
                    setAssignSaving(false);
                  }
                }}
                disabled={assignSaving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-600 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50"
              >
                {assignSaving ? 'Mise à jour...' : 'Enregistrer'}
              </button>
            </div>
        </BaseModal>
      )}

      {statusUpdateInfo && (
        <BaseModal
          isOpen={Boolean(statusUpdateInfo)}
          onClose={() => setStatusUpdateInfo(null)}
          size="sm"
          panelClassName="ui-card ui-card-lg p-6 text-center shadow-xl sm:max-w-sm"
          ariaLabel="Statut de commande mis à jour"
        >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Statut mis à jour</h3>
            <p className="mt-1 text-sm text-gray-600">
              Commande #{statusUpdateInfo.orderId.slice(-6)} — {STATUS_LABELS[statusUpdateInfo.status]}
            </p>
            <button
              type="button"
              onClick={() => setStatusUpdateInfo(null)}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
            >
              OK
            </button>
        </BaseModal>
      )}

      {viewOrderOpen && (
        <BaseModal
          isOpen={viewOrderOpen}
          onClose={() => setViewOrderOpen(false)}
          size="lg"
          panelClassName="ui-card ui-card-lg max-h-[85dvh] overflow-auto p-4 shadow-xl sm:max-w-2xl sm:p-6"
          ariaLabel="Aperçu commande"
        >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Aperçu commande</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewOrderData?._id ? `#${viewOrderData._id.slice(-6)}` : 'Chargement...'}
                </h3>
                {viewOrderData?.status && (
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSES[viewOrderData.status] || STATUS_CLASSES.pending}`}>
                    {STATUS_LABELS[viewOrderData.status] || viewOrderData.status}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewOrderOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                aria-label="Fermer aperçu commande"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {viewOrderLoading ? (
              <p className="text-sm text-gray-500">Chargement de la commande…</p>
            ) : viewOrderError ? (
              <p className="text-sm text-red-600">{viewOrderError}</p>
            ) : !viewOrderData ? (
              <p className="text-sm text-gray-500">Aucune donnée de commande.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Client</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{viewOrderData.customer?.name || 'Client'}</p>
                    <p className="text-xs text-gray-600">{viewOrderData.customer?.phone || '—'}</p>
                    <p className="text-xs text-gray-600">{viewOrderData.customer?.email || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Livraison</p>
                    <p className="mt-1 text-sm text-gray-800">{viewOrderData.deliveryAddress || 'Adresse non renseignée'}</p>
                    <p className="text-xs text-gray-600">{viewOrderData.deliveryCity || 'Ville non renseignée'}</p>
                    {viewOrderData.deliveryCode ? (
                      <p className="mt-1 text-xs font-semibold text-neutral-700">Code: {viewOrderData.deliveryCode}</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Articles</p>
                  <div className="mt-2 space-y-2">
                    {previewOrderItems.map((item, index) => (
                      <div
                        key={`${viewOrderData._id}-${item.product || item.snapshot?.title || index}`}
                        className="rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">{item.snapshot?.title || 'Produit'}</p>
                          <p className="text-xs text-gray-600">
                            x{Number(item.quantity || 1)} · {formatCurrency(item.snapshot?.price || 0)}
                          </p>
                        </div>
                        <SelectedAttributesList
                          selectedAttributes={item.selectedAttributes}
                          compact
                          className="mt-1"
                        />
                      </div>
                    ))}
                    {previewOrderItems.length === 0 && (
                      <p className="text-xs text-gray-500">Aucun article sur cette commande.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                  <p>
                    Total: <span className="font-semibold text-gray-900">{formatCurrency(previewOrderTotal)}</span>
                  </p>
                  <p>
                    Acompte: <span className="font-semibold text-gray-900">{formatCurrency(previewPaidAmount)}</span>
                  </p>
                  <p>
                    Reste: <span className="font-semibold text-gray-900">{formatCurrency(previewRemainingAmount)}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Créée le{' '}
                    {viewOrderData.createdAt
                      ? new Date(viewOrderData.createdAt).toLocaleString('fr-FR')
                      : 'Date inconnue'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      focusOrder(viewOrderData._id);
                      setViewOrderOpen(false);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Aller dans la liste
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await openTimelineDrawer(viewOrderData);
                      setViewOrderOpen(false);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Ouvrir timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openActionModal(viewOrderData);
                      setViewOrderOpen(false);
                    }}
                    className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Action admin
                  </button>
                </div>
              </div>
            )}
        </BaseModal>
      )}

      {deleteOrder && (
        <BaseModal
          isOpen={Boolean(deleteOrder)}
          onClose={() => {
            if (!deleteLoading) setDeleteOrder(null);
          }}
          closeOnBackdrop={!deleteLoading}
          size="sm"
          panelClassName="ui-card ui-card-lg p-6 shadow-xl sm:max-w-sm"
          ariaLabel="Supprimer la commande"
        >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900">Supprimer la commande</h3>
                <p className="text-sm text-gray-600">
                  Commande #{deleteOrder._id?.slice(-6)} — {deleteOrder.customer?.name || 'Client'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Cette action est irréversible. La commande et ses messages seront définitivement supprimés.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteOrder(null)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOrder(deleteOrder._id)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
        </BaseModal>
      )}

      {actionModalOpen && (
        <BaseModal
          isOpen={actionModalOpen}
          onClose={() => {
            if (!actionSaving) setActionModalOpen(false);
          }}
          closeOnBackdrop={!actionSaving}
          size="md"
          panelClassName="ui-card ui-card-lg p-5 shadow-xl sm:max-w-lg sm:p-6"
          ariaLabel="Action administrative commande"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Action admin</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Commande #{actionOrder?._id?.slice(-6)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !actionSaving && setActionModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!isAdminUser && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Compte manager: actions de forçage désactivées.
              </div>
            )}
            <form className="space-y-3" onSubmit={submitAdminAction}>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type d’action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  disabled={actionSaving}
                >
                  {availableAdminActions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {actionType === 'trigger_manual_reminder' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type de rappel</label>
                  <select
                    value={actionReminderType}
                    onChange={(e) => setActionReminderType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    disabled={actionSaving}
                  >
                    <option value="manual">Manual</option>
                    <option value="seller">Seller</option>
                    <option value="buyer_confirmation">Buyer confirmation</option>
                    <option value="review">Review</option>
                    <option value="experience">Experience</option>
                    <option value="escalation">Escalation</option>
                  </select>
                </div>
              )}
              {actionType === 'override_delay_status' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sévérité retard</label>
                  <select
                    value={actionDelaySeverity}
                    onChange={(e) => setActionDelaySeverity(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    disabled={actionSaving}
                  >
                    <option value="none">none</option>
                    <option value="slight">slight</option>
                    <option value="moderate">moderate</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Note (optionnel)</label>
                <textarea
                  rows={3}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  placeholder="Contexte de l’action"
                  disabled={actionSaving}
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !actionSaving && setActionModalOpen(false)}
                  disabled={actionSaving}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionSaving}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {actionSaving ? 'Application...' : 'Appliquer'}
                </button>
              </div>
            </form>
        </BaseModal>
      )}

      {timelineOpen && (
        <BaseModal
          isOpen={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          mobileSheet={false}
          size="full"
          rootClassName="z-[125] items-stretch justify-end p-0"
          panelClassName="h-full w-full max-h-none max-w-xl overflow-y-auto rounded-none border-l border-gray-200 bg-white p-4 shadow-2xl sm:p-6 sm:rounded-none"
          ariaLabel="Timeline commande"
        >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline commande</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  #{(timelineData?.orderId || timelineOrder?._id || '').slice(-6)}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Statut: {timelineData?.status || timelineOrder?.status || '—'} · Retard: {timelineData?.delaySeverity || 'none'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTimelineOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                aria-label="Fermer timeline"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openActionModal(timelineOrder || { _id: timelineData?.orderId }, 'add_admin_note')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ajouter note
              </button>
              <button
                type="button"
                onClick={() => openActionModal(timelineOrder || { _id: timelineData?.orderId }, 'trigger_manual_reminder')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Rappel manuel
              </button>
              <button
                type="button"
                onClick={() => openActionModal(timelineOrder || { _id: timelineData?.orderId }, 'override_delay_status')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Override retard
              </button>
              <button
                type="button"
                disabled={!isAdminUser}
                onClick={() => openActionModal(timelineOrder || { _id: timelineData?.orderId }, 'force_close_order')}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                title={!isAdminUser ? 'Action réservée aux admins.' : ''}
              >
                Forcer clôture
              </button>
            </div>
            {timelineLoading ? (
              <p className="text-sm text-gray-500">Chargement timeline…</p>
            ) : timelineError ? (
              <p className="text-sm text-red-600">{timelineError}</p>
            ) : (
              <div className="space-y-3">
                {(timelineData?.events || []).map((eventItem) => (
                  <div key={eventItem.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{eventItem.label}</p>
                      <span className="text-[11px] text-gray-500">
                        {new Date(eventItem.at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{eventItem.type}</p>
                  </div>
                ))}
                {Array.isArray(timelineData?.adminNotes) && timelineData.adminNotes.length > 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes admin</p>
                    <div className="space-y-2">
                      {timelineData.adminNotes
                        .slice()
                        .reverse()
                        .slice(0, 8)
                        .map((noteItem, index) => (
                          <div key={`note-${index}`} className="rounded-xl border border-gray-100 px-3 py-2">
                            <p className="text-sm text-gray-800">{noteItem.note}</p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {noteItem.createdAt ? new Date(noteItem.createdAt).toLocaleString('fr-FR') : 'Date inconnue'}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </BaseModal>
      )}

      <section className="ui-card ui-card-interactive ui-card-fade-in p-4 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4">
          {renderMobileStatusPicker()}
          <div className="hidden md:flex md:items-center md:justify-between">
            {renderStatusTabs()}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par produit, client, adresse..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all duration-200"
                title="Rechercher par nom de produit, nom du client, email, téléphone, adresse de livraison ou note de suivi"
              />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:items-center">
              <button
                type="button"
                onClick={() => setAdvancedFilterOpen((prev) => !prev)}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  advancedFilterOpen
                    ? 'border-neutral-500 bg-neutral-100 text-neutral-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                Filtres
              </button>
              <button
                type="button"
                onClick={refreshCommandCenterData}
                disabled={ordersLoading || commandCenterLoading || alertsLoading}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gray-100 border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
              >
                <RefreshCcw className={`w-4 h-4 ${(ordersLoading || commandCenterLoading || alertsLoading) ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPaymentTypeFilter((prev) => (prev === 'installment' ? '' : 'installment'))
              }
              className={`inline-flex min-h-[38px] items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                paymentTypeFilter === 'installment'
                  ? 'border border-neutral-700 bg-neutral-700 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Paiement par tranche
            </button>
            <button
              type="button"
              onClick={() =>
                setDeliveryModeFilter((prev) => (prev === 'PICKUP' ? '' : 'PICKUP'))
              }
              className={`inline-flex min-h-[38px] items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                deliveryModeFilter === 'PICKUP'
                  ? 'border border-neutral-700 bg-neutral-700 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Récupérer en boutique
            </button>
          </div>
          {advancedFilterOpen && (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              >
                <option value="">Toutes les villes</option>
                {filterCityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                placeholder="Boutique (nom ou ID)"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              <select
                value={deliveryModeFilter}
                onChange={(e) => setDeliveryModeFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              >
                <option value="">Mode livraison (tous)</option>
                <option value="DELIVERY">Livraison</option>
                <option value="PICKUP">Récupérer en boutique</option>
              </select>
              <select
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              >
                <option value="">Paiement (tous)</option>
                <option value="full">Comptant</option>
                <option value="installment">Paiement par tranche</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              >
                <option value="">Priorité (toutes)</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              <label className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={delayedOnly}
                  onChange={(e) => setDelayedOnly(e.target.checked)}
                />
                Retards seulement
              </label>
              <button
                type="button"
                onClick={() => {
                  setCityFilter('');
                  setShopFilter('');
                  setDateFromFilter('');
                  setDateToFilter('');
                  setDeliveryModeFilter('');
                  setPaymentTypeFilter('');
                  setPriorityFilter('');
                  setDelayedOnly(false);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {meta.total} commande{meta.total > 1 ? 's' : ''} trouvée{meta.total > 1 ? 's' : ''}.
        </p>

        {ordersError && <p className="text-sm text-red-600">{ordersError}</p>}

        {ordersLoading ? (
          <p className="text-sm text-gray-500">Chargement des commandes…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Aucune commande à afficher.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {orders.map((order) => {
                const orderItems =
                  order.items && order.items.length
                    ? order.items
                    : order.productSnapshot
                    ? [
                        {
                          snapshot: order.productSnapshot,
                          quantity: 1,
                          product: order.product?._id
                        }
                      ]
                    : [];
                const sellerEntries = extractOrderSellers(order);
                const computedTotal = orderItems.reduce((sum, item) => {
                  const price = Number(item.snapshot?.price || item.product?.price || 0);
                  const qty = Number(item.quantity || 1);
                  return sum + price * qty;
                }, 0);
                const orderTotal = Number(order.totalAmount ?? computedTotal);
                const paidAmount = Number(order.paidAmount || 0);
                const remainingAmount =
                  order.remainingAmount != null
                    ? Number(order.remainingAmount)
                    : Math.max(0, orderTotal - paidAmount);
                return (
                  <div id={`order-${order._id}`} key={order._id} className="ui-card ui-card-interactive ui-card-fade-in p-4 space-y-3 scroll-mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900">Commande #{order._id.slice(-6)}</div>
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_CLASSES[order.status] || STATUS_CLASSES.pending}`}>
                        {STATUS_LABELS[order.status] || 'Inconnu'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(order.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <User size={14} />
                        {order.customer?.name || 'Client'}
                      </p>
                      <p className="text-xs text-gray-500">{order.customer?.phone}</p>
                      <p className="text-xs text-gray-500">{order.customer?.email}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Vendeur(s)</p>
                      <div className="mt-1 space-y-1">
                        {sellerEntries.map((seller, index) =>
                          seller.sellerId ? (
                            <Link
                              key={`${order._id}-seller-${seller.sellerId}-${index}`}
                              to={buildShopPath({ _id: seller.sellerId })}
                              {...externalLinkProps}
                              className="block text-xs font-semibold text-neutral-700 hover:text-neutral-500"
                            >
                              {seller.sellerName}
                            </Link>
                          ) : (
                            <span
                              key={`${order._id}-seller-name-${seller.sellerName}-${index}`}
                              className="block text-xs font-semibold text-neutral-700"
                            >
                              {seller.sellerName}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                      <div className="space-y-2 text-sm text-gray-700">
                        {orderItems.map((item) => (
                          <div key={`${order._id}-${item.product}-${item.snapshot?.title}`} className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{item.snapshot?.title || 'Produit'}</span>
                              <span className="text-xs text-gray-500">
                                x{item.quantity} · {formatCurrency(item.snapshot?.price || 0)}
                              </span>
                            </div>
                            <SelectedAttributesList
                              selectedAttributes={item.selectedAttributes}
                              compact
                            />
                            {item.snapshot?.confirmationNumber && (
                              <span className="text-[11px] text-neutral-600 font-semibold uppercase tracking-wide">
                                Code produit : {item.snapshot.confirmationNumber}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    {order.deliveryCode && (
                      <div className="ui-card-soft-separator mb-3 rounded-xl border-2 border-neutral-200 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={14} className="text-neutral-600" />
                          <p className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">Code de livraison</p>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-black text-neutral-900 tracking-wider font-mono">
                            {order.deliveryCode}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 text-sm text-gray-700">
                      <p className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-500" />
                        {order.deliveryCity}
                      </p>
                      <p className="text-xs text-gray-500">{order.deliveryAddress}</p>
                      {order.trackingNote && (
                        <p className="text-xs text-gray-500 italic">{order.trackingNote}</p>
                      )}
                    </div>
                    <div className="ui-card-soft-separator space-y-1 rounded-xl border border-slate-100 p-3 text-xs text-slate-600">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Paiement</p>
                      <p>
                        Acompte versé:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(paidAmount)}
                        </span>
                      </p>
                      <p>
                        Reste à payer:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(remainingAmount)}
                        </span>
                      </p>
                      <p>Nom du payeur: {order.paymentName || 'Non renseigné'}</p>
                      <p>Transaction: {order.paymentTransactionCode || 'Non renseigné'}</p>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrder(order._id, { status: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      >
                        {Object.keys(STATUS_LABELS).map((key) => (
                          <option key={key} value={key}>
                            {STATUS_LABELS[key]}
                          </option>
                        ))}
                      </select>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">
                          Livreur
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-700">
                          <div className="h-6 w-6 overflow-hidden rounded-full bg-gray-200">
                            {resolveDeliveryGuyProfileImage(order.deliveryGuy) ? (
                              <img
                                src={resolveDeliveryGuyProfileImage(order.deliveryGuy)}
                                alt={order.deliveryGuy?.name || 'Livreur'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-gray-600">
                                {String(order.deliveryGuy?.name || 'L').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p>{order.deliveryGuy?.name || 'Non assigné'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAssignModal(order)}
                          className="mt-2 text-xs font-semibold text-neutral-600 hover:underline"
                        >
                          Assigner un livreur
                        </button>
                      </div>
                      <textarea
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        rows={2}
                        value={order.trackingNote || ''}
                        onChange={(e) =>
                          handleUpdateOrder(order._id, {
                            trackingNote: e.target.value
                          })
                        }
                      />
                      {/* Chat Button */}
                      <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                        <OrderChat 
                          order={order} 
                          buttonText="Contacte l'acheteur"
                          unreadCount={orderUnreadCounts[order._id] || 0}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openTimelineDrawer(order)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Clock size={12} />
                          Timeline
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionModal(order)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <AlertCircle size={12} />
                          Action admin
                        </button>
                      </div>
                      {order.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => openOrderPdf(order)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          <ClipboardList size={14} />
                          Bon de commande (PDF)
                        </button>
                      )}
                      {order.status === 'cancelled' && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-red-600" />
                            <p className="text-xs font-bold text-red-800">Commande annulée</p>
                          </div>
                          {order.cancellationReason && (
                            <p className="text-xs text-red-700">Raison: {order.cancellationReason}</p>
                          )}
                          {order.cancelledAt && (
                            <p className="text-xs text-red-600">
                              Annulée le {new Date(order.cancelledAt).toLocaleString('fr-FR')}
                            </p>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteOrder(order)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Commande</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Client</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendeur(s)</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Livraison</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Statut</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const orderItems =
                      order.items && order.items.length
                        ? order.items
                        : order.productSnapshot
                        ? [
                            {
                              snapshot: order.productSnapshot,
                              quantity: 1,
                              product: order.product?._id
                            }
                          ]
                        : [];
                    const sellerEntries = extractOrderSellers(order);
                    const computedTotal = orderItems.reduce((sum, item) => {
                      const price = Number(item.snapshot?.price || item.product?.price || 0);
                      const qty = Number(item.quantity || 1);
                      return sum + price * qty;
                    }, 0);
                    const orderTotal = Number(order.totalAmount ?? computedTotal);
                    const paidAmount = Number(order.paidAmount || 0);
                    const remainingAmount =
                      order.remainingAmount != null
                        ? Number(order.remainingAmount)
                        : Math.max(0, orderTotal - paidAmount);
                    return (
                      <tr id={`order-${order._id}`} key={order._id} className="hover:bg-gray-50 scroll-mt-4">
                        <td className="px-3 py-3 space-y-2">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            <Package size={14} className="text-gray-400" />
                            Commande #{order._id.slice(-6)}
                          </div>
                          <div className="space-y-2 text-xs text-gray-600">
                            {orderItems.map((item) => (
                              <div key={`${order._id}-${item.product}-${item.snapshot?.title}`} className="space-y-0.5">
                              <div>
                                <span className="font-semibold text-gray-900">{item.snapshot?.title || 'Produit'}</span>{' '}
                                <span className="text-gray-500">
                                  x{item.quantity} · {formatCurrency(item.snapshot?.price || 0)}
                                </span>
                              </div>
                              <SelectedAttributesList
                                selectedAttributes={item.selectedAttributes}
                                compact
                              />
                              {item.snapshot?.confirmationNumber && (
                                <span className="block text-[11px] text-neutral-600 font-semibold uppercase tracking-wide">
                                  Code produit : {item.snapshot.confirmationNumber}
                                </span>
                              )}
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            Créée le{' '}
                            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{order.customer?.name}</div>
                          <div className="text-xs text-gray-500">{order.customer?.email}</div>
                          <div className="text-xs text-gray-500">{order.customer?.phone}</div>
                          <div className="mt-2 space-y-1 text-[11px] text-gray-500">
                            <div>
                              Acompte versé:{' '}
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(paidAmount)}
                              </span>
                            </div>
                            <div>
                              Reste à payer:{' '}
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(remainingAmount)}
                              </span>
                            </div>
                            <div>Nom du payeur: {order.paymentName || 'Non renseigné'}</div>
                            <div>
                              Transaction: {order.paymentTransactionCode || 'Non renseigné'}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 align-top">
                          <div className="space-y-1">
                            {sellerEntries.map((seller, index) =>
                              seller.sellerId ? (
                                <Link
                                  key={`${order._id}-seller-link-${seller.sellerId}-${index}`}
                                  to={buildShopPath({ _id: seller.sellerId })}
                                  {...externalLinkProps}
                                  className="block font-semibold text-neutral-700 hover:text-neutral-500"
                                >
                                  {seller.sellerName}
                                </Link>
                              ) : (
                                <span
                                  key={`${order._id}-seller-text-${seller.sellerName}-${index}`}
                                  className="block font-semibold text-neutral-700"
                                >
                                  {seller.sellerName}
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {order.deliveryCode && (
                            <div className="mb-2 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                              <div className="flex items-center gap-1 mb-1">
                                <ShieldCheck size={12} className="text-neutral-600" />
                                <span className="font-semibold text-neutral-700">Code:</span>
                              </div>
                              <span className="text-lg font-black text-neutral-900 tracking-wider font-mono">
                                {order.deliveryCode}
                              </span>
                            </div>
                          )}
                          <div>{order.deliveryAddress}</div>
                          <div className="text-gray-500">{order.deliveryCity}</div>
                          {order.trackingNote && (
                            <div className="mt-1 italic text-gray-500">{order.trackingNote}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[order.status] || STATUS_CLASSES.pending}`}>
                            {STATUS_LABELS[order.status] || 'Inconnu'}
                          </span>
                        </td>
                        <td className="px-3 py-3 space-y-2">
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrder(order._id, { status: e.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                          >
                            {Object.keys(STATUS_LABELS).map((key) => (
                              <option key={key} value={key}>
                                {STATUS_LABELS[key]}
                              </option>
                            ))}
                          </select>
                          <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">
                              Livreur
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-700">
                              <div className="h-5 w-5 overflow-hidden rounded-full bg-gray-200">
                                {resolveDeliveryGuyProfileImage(order.deliveryGuy) ? (
                                  <img
                                    src={resolveDeliveryGuyProfileImage(order.deliveryGuy)}
                                    alt={order.deliveryGuy?.name || 'Livreur'}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-gray-600">
                                    {String(order.deliveryGuy?.name || 'L').charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <span>{order.deliveryGuy?.name || 'Non assigné'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAssignModal(order)}
                              className="mt-1 text-[11px] font-semibold text-neutral-600 hover:underline"
                            >
                              Assigner un livreur
                            </button>
                          </div>
                          <textarea
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                            rows={2}
                            value={order.trackingNote || ''}
                            onChange={(e) =>
                              handleUpdateOrder(order._id, {
                                trackingNote: e.target.value
                              })
                            }
                          />
                          {/* Chat Button */}
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            <OrderChat 
                              order={order} 
                              buttonText="Contacte l'acheteur"
                              unreadCount={orderUnreadCounts[order._id] || 0}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => openTimelineDrawer(order)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <Clock size={11} />
                              Timeline
                            </button>
                            <button
                              type="button"
                              onClick={() => openActionModal(order)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <AlertCircle size={11} />
                              Action
                            </button>
                          </div>
                          {order.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => openOrderPdf(order)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100"
                            >
                              <ClipboardList size={12} />
                              Bon de commande (PDF)
                            </button>
                          )}
                          {order.status === 'cancelled' && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-2 space-y-1">
                              <div className="flex items-center gap-1">
                                <X className="w-3 h-3 text-red-600" />
                                <p className="text-[11px] font-bold text-red-800">Annulée</p>
                              </div>
                              {order.cancellationReason && (
                                <p className="text-[10px] text-red-700">Raison: {order.cancellationReason}</p>
                              )}
                              {order.cancelledAt && (
                                <p className="text-[10px] text-red-600">
                                  Le {new Date(order.cancelledAt).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteOrder(order)}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                          >
                            <Trash2 size={12} />
                            Supprimer
                          </button>
                          <div className="text-xs text-neutral-600 space-y-1">
                            {orderItems.map((item) =>
                              item.product ? (
                                <Link
                                  key={`${order._id}-${item.product}-${item.snapshot?.title}-link`}
                                  to={buildProductPath(item.product)}
                                  {...externalLinkProps}
                                  className="block hover:text-neutral-500"
                                >
                                  Voir « {item.snapshot?.title || 'Produit'} »
                                </Link>
                              ) : (
                                <span
                                  key={`${order._id}-${item.snapshot?.title}-text`}
                                  className="block text-gray-500"
                                >
                                  {item.snapshot?.title || 'Produit indisponible'}
                                </span>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Page {page} sur {meta.totalPages} — {meta.total} commande{meta.total > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
