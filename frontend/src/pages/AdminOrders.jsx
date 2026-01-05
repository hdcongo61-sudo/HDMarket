import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import { CheckCircle, Search, Package, User, MapPin, Truck, Clock, ClipboardList, Plus, RefreshCcw, ArrowLeft } from 'lucide-react';

const STATUS_LABELS = {
  confirmed: 'Confirmée',
  delivering: 'En cours de livraison',
  delivered: 'Livrée'
};

const STATUS_CLASSES = {
  confirmed: 'bg-yellow-100 text-yellow-800',
  delivering: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800'
};

const CITY_OPTIONS = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
const ORDERS_PER_PAGE = 12;

export default function AdminOrders() {
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

  const [deliveryGuys, setDeliveryGuys] = useState([]);
  const [deliveryGuysLoading, setDeliveryGuysLoading] = useState(false);
  const [deliveryGuysError, setDeliveryGuysError] = useState('');

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

  const formatCurrency = (value) => Number(value || 0).toLocaleString('fr-FR');

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

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
      const { data } = await api.get('/orders/admin/stats');
      setStats(data);
    } catch (error) {
      console.error('Erreur stats commandes:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

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

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', ORDERS_PER_PAGE);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchValue) params.append('search', searchValue);
      const { data } = await api.get(`/orders/admin?${params.toString()}`);
      const items = Array.isArray(data) ? data : data?.items || [];
      setOrders(items);
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
  }, [statusFilter, searchValue, page]);

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
    loadCustomers();
    loadProducts();
    loadDeliveryGuys();
  }, [loadStats, loadCustomers, loadProducts, loadDeliveryGuys]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
    try {
      await api.patch(`/orders/admin/${orderId}`, payload);
      await Promise.all([loadOrders(), loadStats()]);
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible de mettre à jour la commande.');
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

  const renderStatusTabs = () => (
    <div className="flex flex-wrap gap-2">
      {['all', 'confirmed', 'delivering', 'delivered'].map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setStatusFilter(key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
            statusFilter === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {key === 'all' ? 'Toutes' : STATUS_LABELS[key]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          Gestion des commandes
        </h1>
        <Link
          to="/admin"
          className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['confirmed', 'delivering', 'delivered'].map((key) => (
          <div key={key} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">{STATUS_LABELS[key]}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.statusCounts?.[key] || 0}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                {key === 'confirmed' && <Package className="w-5 h-5 text-yellow-600" />}
                {key === 'delivering' && <Truck className="w-5 h-5 text-blue-600" />}
                {key === 'delivered' && <CheckCircle className="w-5 h-5 text-green-600" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Creation form */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold text-lg">
          <Plus className="w-5 h-5 text-green-600" />
          Créer une commande
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
      </section>

      {/* Toolbar */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {renderStatusTabs()}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Rechercher (client, produit...)"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
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
                  <div key={order._id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900">Commande #{order._id.slice(-6)}</div>
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_CLASSES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
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
                      <select
                        value={order.deliveryGuy?._id || ''}
                        onChange={(e) =>
                          handleUpdateOrder(order._id, { deliveryGuyId: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={deliveryGuysLoading}
                      >
                        <option value="">Assigner un livreur</option>
                        {deliveryGuys.map((deliveryGuy) => (
                          <option key={deliveryGuy._id} value={deliveryGuy._id}>
                            {deliveryGuy.name}
                          </option>
                        ))}
                      </select>
                      {deliveryGuysError && (
                        <p className="text-xs text-red-500">{deliveryGuysError}</p>
                      )}
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
                      <tr key={order._id} className="hover:bg-gray-50">
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
                          <div>{order.deliveryAddress}</div>
                          <div className="text-gray-500">{order.deliveryCity}</div>
                          {order.trackingNote && (
                            <div className="mt-1 italic text-gray-500">{order.trackingNote}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${STATUS_CLASSES[order.status]}`}>
                            {STATUS_LABELS[order.status]}
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
                          <select
                            value={order.deliveryGuy?._id || ''}
                            onChange={(e) =>
                              handleUpdateOrder(order._id, { deliveryGuyId: e.target.value })
                            }
                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            disabled={deliveryGuysLoading}
                          >
                            <option value="">Assigner un livreur</option>
                            {deliveryGuys.map((deliveryGuy) => (
                              <option key={deliveryGuy._id} value={deliveryGuy._id}>
                                {deliveryGuy.name}
                              </option>
                            ))}
                          </select>
                          {deliveryGuysError && (
                            <p className="text-[11px] text-red-500">{deliveryGuysError}</p>
                          )}
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
