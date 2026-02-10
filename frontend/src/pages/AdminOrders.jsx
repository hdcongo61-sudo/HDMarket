import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import { CheckCircle, Search, Package, User, MapPin, Truck, Clock, ClipboardList, Plus, RefreshCcw, ArrowLeft, X, AlertCircle, ShieldCheck, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import OrderChat from '../components/OrderChat';
import AuthContext from '../context/AuthContext';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

const STATUS_CLASSES = {
  pending: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-yellow-100 text-yellow-800',
  delivering: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const CITY_OPTIONS = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
const ORDERS_PER_PAGE = 12;

export default function AdminOrders() {
  const { user } = useContext(AuthContext);
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
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });

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
    deliveryCity: 'Brazzaville',
    trackingNote: ''
  });

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

  const formatCurrency = (value) => Number(value || 0).toLocaleString('fr-FR');

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const exportToExcel = async () => {
    try {
      // Dynamically import xlsx library
      let XLSX;
      try {
        // @ts-ignore - Dynamic import for optional dependency
        XLSX = (await import('xlsx')).default || await import('xlsx');
      } catch (importError) {
        alert('Veuillez installer la bibliothèque xlsx: npm install xlsx');
        console.error('xlsx library not found:', importError);
        return;
      }
      
      if (!XLSX || !XLSX.utils) {
        alert('La bibliothèque xlsx n\'est pas correctement installée.');
        return;
      }
      
      // Fetch all orders (without pagination)
      const params = new URLSearchParams();
      params.set('limit', '10000'); // Large limit to get all orders
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchValue) params.append('search', searchValue);
      
      const { data } = await api.get(`/orders/admin?${params.toString()}`);
      const allOrders = Array.isArray(data) ? data : data?.items || [];

      // Prepare data for Excel
      const excelData = allOrders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsList = items.map((item) => {
          const title = item.snapshot?.title || item.product?.title || 'Produit';
          const qty = Number(item.quantity || 1);
          const price = Number(item.snapshot?.price || item.product?.price || 0);
          return `${title} (x${qty} - ${formatCurrency(price)} FCFA)`;
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
          'Total (FCFA)': formatCurrency(order.totalAmount || 0),
          'Acompte (FCFA)': formatCurrency(order.paidAmount || 0),
          'Reste à payer (FCFA)': formatCurrency(order.remainingAmount || 0),
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
        alert('Veuillez installer la bibliothèque xlsx: npm install xlsx');
      } else {
        alert('Impossible d\'exporter vers Excel. ' + (error?.message || ''));
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
            <td class="right">${price} FCFA</td>
            <td class="right">${lineTotal} FCFA</td>
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
              <p>Acompte versé: ${formatCurrency(paidAmount)} FCFA</p>
              <p>Reste à payer: ${formatCurrency(remainingAmount)} FCFA</p>
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
                  <td class="right">${formatCurrency(orderTotal)} FCFA</td>
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
      const params = searchValue ? { search: searchValue } : {};
      const { data } = await api.get('/orders/admin/stats', { params });
      setStats(data);
    } catch (error) {
      console.error('Erreur stats commandes:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [searchValue]);

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
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', ORDERS_PER_PAGE);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchValue) params.append('search', searchValue);
      if (orderIdFromUrl) params.set('orderId', orderIdFromUrl);
      const { data } = await api.get(`/orders/admin?${params.toString()}`);
      const items = Array.isArray(data) ? data : data?.items || [];
      // Deduplicate orders by _id to prevent any duplicate display issues
      const seenIds = new Set();
      const uniqueOrders = items.filter((order) => {
        if (!order?._id || seenIds.has(order._id)) return false;
        seenIds.add(order._id);
        return true;
      });
      setOrders(uniqueOrders);
      
      // Load unread message counts
      const orderIds = items.map((order) => order._id);
      const unreadCounts = await loadUnreadCounts(orderIds);
      setOrderUnreadCounts(unreadCounts);
      
      setMeta({
        total: data?.total ?? items.length,
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
  }, [statusFilter, searchValue, page, orderIdFromUrl]);

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

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
    const found = orders.some((o) => o._id === orderIdFromUrl);
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
  }, [statusFilter, searchValue]);

  const handleUpdateOrder = async (orderId, payload) => {
    const currentOrder = orders.find((order) => order._id === orderId);
    try {
      const { data } = await api.patch(`/orders/admin/${orderId}`, payload);
      const updatedOrder = data;
      const previousStatus = currentOrder?.status;
      const nextStatus = updatedOrder?.status || previousStatus;
      const removeFromView = statusFilter !== 'all' && nextStatus && statusFilter !== nextStatus;

      setOrders((prev) => {
        if (!Array.isArray(prev)) return prev;
        if (removeFromView) {
          return prev.filter((order) => order._id !== orderId);
        }
        // Replace the existing order, ensuring no duplicates
        const updated = prev.map((order) => (order._id === orderId ? updatedOrder : order));
        // Extra safety: deduplicate by _id
        const seenIds = new Set();
        return updated.filter((order) => {
          if (!order?._id || seenIds.has(order._id)) return false;
          seenIds.add(order._id);
          return true;
        });
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
          orderId,
          status: nextStatus
        });
      }
      return updatedOrder;
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible de mettre à jour la commande.');
      return null;
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/orders/admin/${orderId}`);
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
      setMeta((prev) => ({
        ...prev,
        total: Math.max(0, (prev.total || 0) - 1),
        totalPages: Math.max(1, Math.ceil(Math.max(0, (prev.total || 0) - 1) / ORDERS_PER_PAGE))
      }));
      const deletedOrder = orders.find((o) => o._id === orderId);
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
      await loadStats();
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible de supprimer la commande.');
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
        deliveryCity: 'Brazzaville',
        trackingNote: ''
      });
      setCreateOpen(false);
      await Promise.all([loadOrders(), loadStats()]);
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
      deliveryCity: selectedCustomer.city || prev.deliveryCity || 'Brazzaville'
    }));
  }, [selectedCustomer]);

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
    if (!deleteOrder) return;
  }, [deleteOrder]);

  const renderStatusTabs = () => (
    <div className="flex flex-wrap gap-2">
      {['all', 'pending', 'confirmed', 'delivering', 'delivered', 'cancelled'].map((key) => {
        const pendingCount = key === 'pending' ? (stats?.statusCounts?.pending || 0) : 0;
        const statusCount = stats?.statusCounts?.[key] || 0;
        const isActive = statusFilter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-xs font-semibold rounded-3xl border-2 transition-all duration-200 active:scale-95 flex items-center gap-2 shadow-sm ${
              isActive 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-lg' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <span>{key === 'all' ? 'Toutes' : STATUS_LABELS[key]}</span>
            {key === 'pending' && pendingCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-white/30 text-white' 
                  : 'bg-indigo-600 text-white'
              }`}>
                {pendingCount}
              </span>
            )}
            {key !== 'all' && key !== 'pending' && statusCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-white/30 text-white' 
                  : 'bg-indigo-600 text-white'
              }`}>
                {statusCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          Gestion des commandes
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Créer une commande
          </button>
          <Link
            to="/admin"
            className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
        </div>
      </div>

      {/* Stats - Improved Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'].map((key) => {
          const count = statsLoading ? 0 : stats?.statusCounts?.[key] || 0;
          const bgColors = {
            pending: 'bg-gradient-to-br from-gray-50 to-gray-100',
            confirmed: 'bg-gradient-to-br from-amber-50 to-yellow-100',
            delivering: 'bg-gradient-to-br from-blue-50 to-indigo-100',
            delivered: 'bg-gradient-to-br from-emerald-50 to-green-100',
            cancelled: 'bg-gradient-to-br from-red-50 to-pink-100'
          };
          const iconColors = {
            pending: 'text-gray-600',
            confirmed: 'text-amber-600',
            delivering: 'text-blue-600',
            delivered: 'text-emerald-600',
            cancelled: 'text-red-600'
          };
          return (
            <div key={key} className={`${bgColors[key]} border-2 border-transparent rounded-3xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-2xl ${bgColors[key]} flex items-center justify-center shadow-md`}>
                  {key === 'pending' && <Clock className={`w-6 h-6 ${iconColors[key]}`} />}
                  {key === 'confirmed' && <Package className={`w-6 h-6 ${iconColors[key]}`} />}
                  {key === 'delivering' && <Truck className={`w-6 h-6 ${iconColors[key]}`} />}
                  {key === 'delivered' && <CheckCircle className={`w-6 h-6 ${iconColors[key]}`} />}
                  {key === 'cancelled' && <X className={`w-6 h-6 ${iconColors[key]}`} />}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-gray-600 mb-1 tracking-wide">{STATUS_LABELS[key]}</p>
                <p className={`text-3xl font-black ${iconColors[key]}`}>
                  {statsLoading ? '...' : count.toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="relative w-full max-w-5xl rounded-3xl bg-white shadow-xl border border-gray-100 p-4 sm:p-6 max-h-[85vh] overflow-auto"
            onClick={(event) => event.stopPropagation()}
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
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                          selectedCustomer?._id === customer._id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
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
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                                {Number(product.price || 0).toLocaleString()} FCFA •{' '}
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
                                  : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
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
                    <div className="mt-4 bg-gray-50 rounded-2xl border border-gray-100 p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Produits sélectionnés
                      </p>
                      {selectedProducts.map(({ product, quantity }) => (
                        <div
                          key={product._id}
                          className="flex items-center gap-3 text-sm bg-white rounded-xl border border-gray-100 px-3 py-2"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{product.title}</p>
                            <p className="text-xs text-gray-500">
                              {Number(product.price || 0).toLocaleString()} FCFA
                            </p>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => updateSelectedProductQuantity(product._id, e.target.value)}
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={newOrder.deliveryCity}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, deliveryCity: e.target.value }))}
                  >
                    {CITY_OPTIONS.map((city) => (
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
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus size={16} />
                Ajouter la commande
              </button>
            </form>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeAssignModal}
          />
          <div
            className="relative w-full max-w-md rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
            onClick={(event) => event.stopPropagation()}
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
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={deliveryGuysLoading || assignSaving}
                >
                  <option value="">Assigner un livreur</option>
                  {deliveryGuys.map((deliveryGuy) => (
                    <option key={deliveryGuy._id} value={deliveryGuy._id}>
                      {deliveryGuy.name}
                    </option>
                  ))}
                </select>
                {deliveryGuysError && (
                  <p className="mt-2 text-xs text-red-500">{deliveryGuysError}</p>
                )}
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {assignSaving ? 'Mise à jour...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusUpdateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setStatusUpdateInfo(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white shadow-xl border border-gray-100 p-6 text-center"
            onClick={(event) => event.stopPropagation()}
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
          </div>
        </div>
      )}

      {deleteOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !deleteLoading && setDeleteOrder(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
            onClick={(event) => event.stopPropagation()}
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
          </div>
        </div>
      )}

      {/* Toolbar - Improved Design */}
      <section className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border-2 border-gray-200 shadow-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {renderStatusTabs()}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par produit, client, adresse..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-3xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                title="Rechercher par nom de produit, nom du client, email, téléphone, adresse de livraison ou note de suivi"
              />
            </div>
            <button
              type="button"
              onClick={loadOrders}
              disabled={ordersLoading}
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-gray-100 border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
            >
              <RefreshCcw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

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
                  <div id={`order-${order._id}`} key={order._id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3 scroll-mt-4">
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
                      <div className="space-y-2 text-sm text-gray-700">
                        {orderItems.map((item) => (
                          <div key={`${order._id}-${item.product}-${item.snapshot?.title}`} className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{item.snapshot?.title || 'Produit'}</span>
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
                    {order.deliveryCode && (
                      <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={14} className="text-indigo-600" />
                          <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Code de livraison</p>
                        </div>
                        <div className="text-center">
                          <span className="text-2xl font-black text-indigo-900 tracking-wider font-mono">
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
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Paiement</p>
                      <p>
                        Acompte versé:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(paidAmount)} FCFA
                        </span>
                      </p>
                      <p>
                        Reste à payer:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(remainingAmount)} FCFA
                        </span>
                      </p>
                      <p>Nom du payeur: {order.paymentName || 'Non renseigné'}</p>
                      <p>Transaction: {order.paymentTransactionCode || 'Non renseigné'}</p>
                    </div>
                    <div className="space-y-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrder(order._id, { status: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                        <p className="text-xs text-gray-700">
                          {order.deliveryGuy?.name || 'Non assigné'}
                        </p>
                        <button
                          type="button"
                          onClick={() => openAssignModal(order)}
                          className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          Assigner un livreur
                        </button>
                      </div>
                      <textarea
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={2}
                        value={order.trackingNote || ''}
                        onChange={(e) =>
                          handleUpdateOrder(order._id, {
                            trackingNote: e.target.value
                          })
                        }
                      />
                      {/* Chat Button */}
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                        <OrderChat 
                          order={order} 
                          buttonText="Contacte l'acheteur"
                          unreadCount={orderUnreadCounts[order._id] || 0}
                        />
                      </div>
                      {order.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => openOrderPdf(order)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
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
                                    x{item.quantity} · {Number(item.snapshot?.price || 0).toLocaleString()} FCFA
                                  </span>
                                </div>
                                {item.snapshot?.confirmationNumber && (
                                  <span className="block text-[11px] text-indigo-600 font-semibold uppercase tracking-wide">
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
                                {formatCurrency(paidAmount)} FCFA
                              </span>
                            </div>
                            <div>
                              Reste à payer:{' '}
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(remainingAmount)} FCFA
                              </span>
                            </div>
                            <div>Nom du payeur: {order.paymentName || 'Non renseigné'}</div>
                            <div>
                              Transaction: {order.paymentTransactionCode || 'Non renseigné'}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {order.deliveryCode && (
                            <div className="mb-2 p-2 rounded-lg border border-indigo-200 bg-indigo-50">
                              <div className="flex items-center gap-1 mb-1">
                                <ShieldCheck size={12} className="text-indigo-600" />
                                <span className="font-semibold text-indigo-700">Code:</span>
                              </div>
                              <span className="text-lg font-black text-indigo-900 tracking-wider font-mono">
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
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                            <div className="text-xs text-gray-700">
                              {order.deliveryGuy?.name || 'Non assigné'}
                            </div>
                            <button
                              type="button"
                              onClick={() => openAssignModal(order)}
                              className="mt-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                            >
                              Assigner un livreur
                            </button>
                          </div>
                          <textarea
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            rows={2}
                            value={order.trackingNote || ''}
                            onChange={(e) =>
                              handleUpdateOrder(order._id, {
                                trackingNote: e.target.value
                              })
                            }
                          />
                          {/* Chat Button */}
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                            <OrderChat 
                              order={order} 
                              buttonText="Contacte l'acheteur"
                              unreadCount={orderUnreadCounts[order._id] || 0}
                            />
                          </div>
                          {order.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => openOrderPdf(order)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
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
                          <div className="text-xs text-indigo-600 space-y-1">
                            {orderItems.map((item) =>
                              item.product ? (
                                <Link
                                  key={`${order._id}-${item.product}-${item.snapshot?.title}-link`}
                                  to={buildProductPath(item.product)}
                                  {...externalLinkProps}
                                  className="block hover:text-indigo-500"
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
  );
}
